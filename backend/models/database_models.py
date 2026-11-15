from datetime import datetime, timezone
import json
from backend.database.db import db

class ReplicaServer(db.Model):
    __tablename__ = 'replica_servers'
    
    id = db.Column(db.String(10), primary_key=True)  # RS1, RS2, etc.
    name = db.Column(db.String(100), nullable=False)
    region = db.Column(db.String(100), nullable=False)
    status = db.Column(db.String(20), default='Active')  # Active, Inactive, High Demand, Overloaded
    capacity_mb = db.Column(db.Float, default=500.0)
    used_mb = db.Column(db.Float, default=0.0)
    cpu_percent = db.Column(db.Float, default=12.0)
    memory_percent = db.Column(db.Float, default=15.0)
    active_requests = db.Column(db.Integer, default=0)
    cache_hits = db.Column(db.Integer, default=0)
    cache_misses = db.Column(db.Integer, default=0)
    is_auto_scale = db.Column(db.Boolean, default=True)
    manual_override = db.Column(db.Boolean, default=False)
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        total_reqs = self.cache_hits + self.cache_misses
        hit_ratio = round((self.cache_hits / total_reqs * 100), 2) if total_reqs > 0 else 0.0
        return {
            'id': self.id,
            'name': self.name,
            'region': self.region,
            'status': self.status,
            'capacity_mb': round(self.capacity_mb, 2),
            'used_mb': round(self.used_mb, 2),
            'cache_usage_percent': round((self.used_mb / self.capacity_mb * 100), 2) if self.capacity_mb > 0 else 0.0,
            'cpu_percent': round(self.cpu_percent, 1),
            'memory_percent': round(self.memory_percent, 1),
            'active_requests': self.active_requests,
            'cache_hits': self.cache_hits,
            'cache_misses': self.cache_misses,
            'hit_ratio': hit_ratio,
            'is_auto_scale': self.is_auto_scale,
            'manual_override': self.manual_override,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class ContentObject(db.Model):
    __tablename__ = 'content_objects'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    content_id = db.Column(db.String(50), unique=True, nullable=False)
    name = db.Column(db.String(120), nullable=False)
    size_mb = db.Column(db.Float, nullable=False)
    category = db.Column(db.String(50), default='Static Asset')
    popularity_score = db.Column(db.Float, default=0.0)
    access_count = db.Column(db.Integer, default=0)
    last_accessed = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            'id': self.id,
            'content_id': self.content_id,
            'name': self.name,
            'size_mb': round(self.size_mb, 2),
            'category': self.category,
            'popularity_score': round(self.popularity_score, 4),
            'access_count': self.access_count,
            'last_accessed': self.last_accessed.isoformat() if self.last_accessed else None
        }


class CacheEntry(db.Model):
    __tablename__ = 'cache_entries'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    server_id = db.Column(db.String(10), db.ForeignKey('replica_servers.id'), nullable=False)
    content_id = db.Column(db.String(50), nullable=False)
    size_mb = db.Column(db.Float, nullable=False)
    cached_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    access_count = db.Column(db.Integer, default=1)
    last_accessed = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    utility_score = db.Column(db.Float, default=0.0)

    def to_dict(self):
        return {
            'id': self.id,
            'server_id': self.server_id,
            'content_id': self.content_id,
            'size_mb': round(self.size_mb, 2),
            'cached_at': self.cached_at.isoformat() if self.cached_at else None,
            'access_count': self.access_count,
            'last_accessed': self.last_accessed.isoformat() if self.last_accessed else None,
            'utility_score': round(self.utility_score, 4)
        }


class SimulationRun(db.Model):
    __tablename__ = 'simulation_runs'
    
    id = db.Column(db.String(50), primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    algorithm = db.Column(db.String(50), default='Adaptive Cost-aware')
    total_requests = db.Column(db.Integer, default=0)
    cache_hits = db.Column(db.Integer, default=0)
    cache_misses = db.Column(db.Integer, default=0)
    hit_ratio = db.Column(db.Float, default=0.0)
    avg_latency_ms = db.Column(db.Float, default=0.0)
    total_cost = db.Column(db.Float, default=0.0)
    storage_cost = db.Column(db.Float, default=0.0)
    miss_cost = db.Column(db.Float, default=0.0)
    active_servers = db.Column(db.Integer, default=5)
    config_json = db.Column(db.Text, default='{}')

    def to_dict(self):
        config = {}
        try:
            config = json.loads(self.config_json) if self.config_json else {}
        except Exception:
            pass
            
        return {
            'id': self.id,
            'name': self.name,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'algorithm': self.algorithm,
            'total_requests': self.total_requests,
            'cache_hits': self.cache_hits,
            'cache_misses': self.cache_misses,
            'hit_ratio': round(self.hit_ratio, 2),
            'miss_ratio': round(100.0 - self.hit_ratio, 2),
            'avg_latency_ms': round(self.avg_latency_ms, 2),
            'total_cost': round(self.total_cost, 2),
            'storage_cost': round(self.storage_cost, 2),
            'miss_cost': round(self.miss_cost, 2),
            'active_servers': self.active_servers,
            'config': config
        }


class ServerActivityLog(db.Model):
    __tablename__ = 'server_activity_logs'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    server_id = db.Column(db.String(10), nullable=False)
    timestamp = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    action = db.Column(db.String(30), nullable=False)  # ACTIVATED, DEACTIVATED, OVERLOADED, SCALE_UP, SCALE_DOWN
    reason = db.Column(db.String(255), nullable=True)
    active_count = db.Column(db.Integer, default=1)

    def to_dict(self):
        return {
            'id': self.id,
            'server_id': self.server_id,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'action': self.action,
            'reason': self.reason,
            'active_count': self.active_count
        }


class OptimizationDecision(db.Model):
    __tablename__ = 'optimization_decisions'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    timestamp = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    predicted_demand = db.Column(db.Float, nullable=False)
    previous_active_count = db.Column(db.Integer, nullable=False)
    new_active_count = db.Column(db.Integer, nullable=False)
    estimated_cost_before = db.Column(db.Float, nullable=False)
    estimated_cost_after = db.Column(db.Float, nullable=False)
    cost_savings = db.Column(db.Float, default=0.0)
    strategy = db.Column(db.String(100), default='Adaptive Cost Optimization')
    details_json = db.Column(db.Text, default='{}')

    def to_dict(self):
        details = {}
        try:
            details = json.loads(self.details_json) if self.details_json else {}
        except Exception:
            pass
        return {
            'id': self.id,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None,
            'predicted_demand': round(self.predicted_demand, 2),
            'previous_active_count': self.previous_active_count,
            'new_active_count': self.new_active_count,
            'estimated_cost_before': round(self.estimated_cost_before, 2),
            'estimated_cost_after': round(self.estimated_cost_after, 2),
            'cost_savings': round(self.cost_savings, 2),
            'strategy': self.strategy,
            'details': details
        }


class DatasetMetadata(db.Model):
    __tablename__ = 'dataset_metadata'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(150), nullable=False)
    filename = db.Column(db.String(200), nullable=False)
    record_count = db.Column(db.Integer, default=0)
    user_count = db.Column(db.Integer, default=10000)
    content_count = db.Column(db.Integer, default=100)
    time_span_hours = db.Column(db.Integer, default=24)
    zipf_alpha = db.Column(db.Float, default=0.5)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    file_path = db.Column(db.String(255), nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'filename': self.filename,
            'record_count': self.record_count,
            'user_count': self.user_count,
            'content_count': self.content_count,
            'time_span_hours': self.time_span_hours,
            'zipf_alpha': self.zipf_alpha,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'file_path': self.file_path
        }
