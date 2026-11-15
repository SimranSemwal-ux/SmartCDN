"""
Core CDN Simulator Engine for SmartCDN
Simulates real-time CDN workload routing, 3-tier cache hierarchy (Local Replica -> Peer Replica -> Origin),
dynamic auto-scaling of replica servers, and metric aggregation.
"""
import time
import math
import random
import threading
import numpy as np
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

from backend.algorithms.lru import LRUCache
from backend.algorithms.dynamic_selective import DynamicSelectiveCache
from backend.algorithms.adaptive_cache import AdaptiveCostAwareCache
from backend.simulation.request_generator import SyntheticWorkloadGenerator, REGIONS
from backend.simulation.cost_optimizer import CostOptimizer

SERVER_REGIONS = {
    'RS1': {'name': 'Replica Server 1', 'region': 'US-East (Virginia)', 'tz': -5},
    'RS2': {'name': 'Replica Server 2', 'region': 'US-West (California)', 'tz': -8},
    'RS3': {'name': 'Replica Server 3', 'region': 'EU-Central (Frankfurt)', 'tz': 1},
    'RS4': {'name': 'Replica Server 4', 'region': 'AP-East (Tokyo)', 'tz': 9},
    'RS5': {'name': 'Replica Server 5', 'region': 'AP-South (Singapore)', 'tz': 8},
}

class CDNSimulator:
    _instance = None
    _lock = threading.Lock()

    @classmethod
    def get_instance(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = CDNSimulator()
            return cls._instance

    def __init__(self):
        self.state = "IDLE"  # IDLE, RUNNING, PAUSED, STOPPED
        self.algorithm_name = "Adaptive Cost-aware"  # "LRU", "Dynamic Selective", "Adaptive Cost-aware"
        self.speed_multiplier = 1.0  # 1x, 2x, 5x, 10x
        self.traffic_intensity = 1.0  # 0.2 to 3.0
        self.auto_scaling_enabled = True

        # Network topology
        self.origin_server = {
            'id': 'ORIGIN',
            'name': 'Origin Central Repository',
            'region': 'Global Primary (US-Central)',
            'status': 'Online',
            'total_served': 0,
            'bandwidth_egress_mb': 0.0
        }

        self.server_capacity_mb = 500.0
        self.storage_cost_per_server = 15.0  # Cs
        self.miss_cost_per_req = 0.05        # Cm

        # Cost optimizer
        self.cost_optimizer = CostOptimizer(
            storage_cost_per_server=self.storage_cost_per_server,
            miss_cost_coefficient=self.miss_cost_per_req,
            server_capacity_reqs=2500
        )

        # Content objects catalog
        self.generator = SyntheticWorkloadGenerator(
            num_users=10000,
            num_objects=100,
            num_servers=5,
            total_requests=100000,
            zipf_alpha=0.5,
            seed=42
        )
        self.catalog = {item['content_id']: item for item in self.generator.content_catalog}
        self.catalog_list = self.generator.content_catalog
        self.zipf_probs = np.array([item['popularity_score'] for item in self.catalog_list])
        self.zipf_probs /= self.zipf_probs.sum()

        # Replica servers and their cache instances
        self.servers: Dict[str, Dict[str, Any]] = {}
        self.caches: Dict[str, Any] = {}
        self._init_servers()

        # Operational metrics
        self.simulation_step = 0
        self.total_requests = 0
        self.cache_hits = 0
        self.peer_hits = 0
        self.origin_misses = 0
        self.total_latency_ms = 0.0
        self.total_storage_cost = 0.0
        self.total_miss_cost = 0.0
        self.total_operating_cost = 0.0

        # Recent logs & time-series histories for charts
        self.recent_events: List[Dict[str, Any]] = []
        self.density_history: List[Dict[str, Any]] = []
        self.utilization_history: List[Dict[str, Any]] = []
        self.cost_history: List[Dict[str, Any]] = []
        self.server_state_history: List[Dict[str, Any]] = []

        # Background thread control
        self._stop_event = threading.Event()
        self._pause_event = threading.Event()
        self._thread: Optional[threading.Thread] = None

    def _init_servers(self):
        """Initialize RS1-RS5 replica servers and their cache instances."""
        self.servers.clear()
        self.caches.clear()

        for sid, info in SERVER_REGIONS.items():
            self.servers[sid] = {
                'id': sid,
                'name': info['name'],
                'region': info['region'],
                'status': 'Active',  # Initially all active or first 3 active
                'capacity_mb': self.server_capacity_mb,
                'used_mb': 0.0,
                'cpu_percent': 12.0,
                'memory_percent': 15.0,
                'active_requests': 0,
                'cache_hits': 0,
                'peer_hits': 0,
                'cache_misses': 0,
                'avg_latency_ms': 18.0,
                'is_auto_scale': True,
                'manual_override': False,
                'history_demand': [150.0, 180.0, 160.0]
            }
            self.caches[sid] = self._create_cache_instance(self.algorithm_name)

    def _create_cache_instance(self, algo_name: str):
        if algo_name == 'LRU':
            return LRUCache(capacity_mb=self.server_capacity_mb)
        elif algo_name == 'Dynamic Selective':
            return DynamicSelectiveCache(capacity_mb=self.server_capacity_mb, admission_threshold_k=2)
        else:
            return AdaptiveCostAwareCache(
                capacity_mb=self.server_capacity_mb,
                storage_cost_per_mb=0.03,
                miss_cost_per_req=self.miss_cost_per_req
            )

    def set_algorithm(self, algo_name: str):
        """Switch caching algorithm for all replica servers."""
        if algo_name in ['LRU', 'Dynamic Selective', 'Adaptive Cost-aware']:
            self.algorithm_name = algo_name
            # Recreate caches
            for sid in self.servers:
                self.caches[sid] = self._create_cache_instance(algo_name)
                self.servers[sid]['used_mb'] = 0.0

    def start(self):
        """Start or resume background simulation thread."""
        with self._lock:
            if self.state == "RUNNING":
                return
            
            if self.state == "PAUSED":
                self.state = "RUNNING"
                self._pause_event.clear()
                return

            self.state = "RUNNING"
            self._stop_event.clear()
            self._pause_event.clear()
            self._thread = threading.Thread(target=self._run_loop, daemon=True)
            self._thread.start()

    def pause(self):
        """Pause simulation execution."""
        with self._lock:
            if self.state == "RUNNING":
                self.state = "PAUSED"
                self._pause_event.set()

    def resume(self):
        """Resume simulation from paused state."""
        with self._lock:
            if self.state == "PAUSED":
                self.state = "RUNNING"
                self._pause_event.clear()

    def stop(self):
        """Stop simulation."""
        with self._lock:
            self.state = "STOPPED"
            self._stop_event.set()
            self._pause_event.clear()

    def reset(self):
        """Reset simulation state and metrics to initial baseline."""
        with self._lock:
            self.stop()
            time.sleep(0.1)
            self.state = "IDLE"
            self.simulation_step = 0
            self.total_requests = 0
            self.cache_hits = 0
            self.peer_hits = 0
            self.origin_misses = 0
            self.total_latency_ms = 0.0
            self.total_storage_cost = 0.0
            self.total_miss_cost = 0.0
            self.total_operating_cost = 0.0
            self.recent_events.clear()
            self.density_history.clear()
            self.utilization_history.clear()
            self.cost_history.clear()
            self.server_state_history.clear()
            self._init_servers()

    def set_speed(self, multiplier: float):
        self.speed_multiplier = max(0.5, min(20.0, float(multiplier)))

    def set_traffic_intensity(self, intensity: float):
        self.traffic_intensity = max(0.1, min(5.0, float(intensity)))

    def toggle_server_status(self, server_id: str, new_status: Optional[str] = None) -> bool:
        """Manual override for server status (Active/Inactive)."""
        if server_id in self.servers:
            srv = self.servers[server_id]
            if new_status:
                srv['status'] = new_status
            else:
                srv['status'] = 'Inactive' if srv['status'] == 'Active' else 'Active'
            srv['manual_override'] = True
            return True
        return False

    def _select_target_server(self, region_name: str) -> Optional[str]:
        """
        Route request to the nearest active replica server.
        If local server is Inactive, fails over to nearest active peer.
        """
        # Exact regional match
        for sid, srv in self.servers.items():
            if srv['region'] == region_name and srv['status'] in ['Active', 'High Demand']:
                return sid

        # Failover to any active server
        active_sids = [sid for sid, srv in self.servers.items() if srv['status'] in ['Active', 'High Demand']]
        if active_sids:
            return random.choice(active_sids)
        
        # If all replica servers inactive, activate RS1 as safety baseline
        self.servers['RS1']['status'] = 'Active'
        return 'RS1'

    def process_request(self, content_id: str, region_name: str, user_id: str) -> Dict[str, Any]:
        """
        Process a single content request through CDN tiers:
        1. Local Replica Cache
        2. Peer Active Replica Server Cache
        3. Origin Server
        """
        self.total_requests += 1
        content = self.catalog.get(content_id)
        if not content:
            content = self.catalog_list[0]
            content_id = content['content_id']

        target_sid = self._select_target_server(region_name)
        target_server = self.servers[target_sid]
        target_cache = self.caches[target_sid]

        event = {
            'id': f"REQ-{self.total_requests:06d}",
            'timestamp': datetime.now(timezone.utc).strftime("%H:%M:%S"),
            'user_id': user_id,
            'region': region_name,
            'content_id': content_id,
            'target_server': target_sid,
            'status': '',
            'latency_ms': 0.0,
            'source': ''
        }

        # 1. Check Local Cache
        local_hit = target_cache.get(content_id)
        if local_hit is not None:
            self.cache_hits += 1
            target_server['cache_hits'] += 1
            latency = round(float(np.random.normal(16.0, 3.0)), 1)
            event['status'] = 'LOCAL_HIT'
            event['latency_ms'] = latency
            event['source'] = f"{target_sid} Cache"
        else:
            # 2. Check Peer Active Replica Servers
            peer_hit_server = None
            for peer_sid, peer_cache in self.caches.items():
                if peer_sid != target_sid and self.servers[peer_sid]['status'] in ['Active', 'High Demand']:
                    # Non-mutating lookup in peer cache
                    if content_id in getattr(peer_cache, 'cache', {}):
                        peer_hit_server = peer_sid
                        break

            if peer_hit_server:
                self.peer_hits += 1
                target_server['peer_hits'] += 1
                latency = round(float(np.random.normal(55.0, 8.0)), 1)
                event['status'] = 'PEER_HIT'
                event['latency_ms'] = latency
                event['source'] = f"Peer {peer_hit_server}"

                # Admit into local cache
                admitted, evicted = target_cache.put(content_id, content['size_mb'], metadata=content)
            else:
                # 3. Cache Miss: Fetch from Origin Server
                self.origin_misses += 1
                target_server['cache_misses'] += 1
                self.origin_server['total_served'] += 1
                self.origin_server['bandwidth_egress_mb'] += content['size_mb']

                latency = round(float(np.random.normal(165.0, 22.0)), 1)
                event['status'] = 'ORIGIN_MISS'
                event['latency_ms'] = latency
                event['source'] = "Origin Central"

                # Apply cache algorithm admission
                admitted, evicted = target_cache.put(content_id, content['size_mb'], metadata=content)

        # Update server metrics
        target_server['used_mb'] = getattr(target_cache, 'used_mb', 0.0)
        target_server['active_requests'] += 1
        
        # CPU & Memory load modeling
        current_load = (target_server['active_requests'] * 1.5) + (target_server['used_mb'] / target_server['capacity_mb'] * 40.0)
        target_server['cpu_percent'] = min(99.0, max(8.0, round(current_load + np.random.normal(0, 2.0), 1)))
        target_server['memory_percent'] = min(98.0, max(12.0, round(30.0 + (target_server['used_mb'] / target_server['capacity_mb'] * 60.0), 1)))

        # Server status thresholds
        if target_server['status'] != 'Inactive':
            if target_server['cpu_percent'] > 85.0:
                target_server['status'] = 'Overloaded'
            elif target_server['cpu_percent'] > 65.0:
                target_server['status'] = 'High Demand'
            else:
                target_server['status'] = 'Active'

        self.total_latency_ms += event['latency_ms']
        
        # Log event
        self.recent_events.append(event)
        if len(self.recent_events) > 40:
            self.recent_events.pop(0)

        return event

    def step(self, batch_size: int = 15):
        """Execute one simulation step processing a batch of synthetic requests."""
        self.simulation_step += 1
        now_str = datetime.now(timezone.utc).strftime("%H:%M:%S")

        # Pick random contents according to Zipf distribution
        sample_indices = np.random.choice(len(self.catalog_list), size=batch_size, p=self.zipf_probs)
        
        step_server_counts = {sid: 0 for sid in self.servers}

        for idx in sample_indices:
            content = self.catalog_list[idx]
            # Pick a region weighted by regional intensity
            r_info = random.choice(REGIONS)
            user_id = f"USR-{random.randint(1, 10000):05d}"
            ev = self.process_request(content['content_id'], r_info['region'], user_id)
            step_server_counts[ev['target_server']] += 1

        # Periodic auto-scaling check (every 5 steps)
        if self.auto_scaling_enabled and self.simulation_step % 5 == 0:
            self._evaluate_auto_scaling()

        # Update rolling demand history for ML lag features
        for sid, srv in self.servers.items():
            srv['history_demand'].append(float(step_server_counts[sid] * 10))
            if len(srv['history_demand']) > 24:
                srv['history_demand'].pop(0)
            # Decay active requests slowly
            srv['active_requests'] = max(0, int(srv['active_requests'] * 0.7))

        # Record time series point for charts
        active_count = sum(1 for s in self.servers.values() if s['status'] in ['Active', 'High Demand', 'Overloaded'])
        
        # Operational costs accumulation
        step_storage_cost = (active_count * (self.storage_cost_per_server / 3600.0)) * 5.0
        step_miss_cost = (self.origin_misses * 0.002)
        self.total_storage_cost += step_storage_cost
        self.total_miss_cost += step_miss_cost
        self.total_operating_cost = self.total_storage_cost + self.total_miss_cost

        # Append to histories
        self.density_history.append({
            'time': now_str,
            'step': self.simulation_step,
            'RS1': step_server_counts['RS1'],
            'RS2': step_server_counts['RS2'],
            'RS3': step_server_counts['RS3'],
            'RS4': step_server_counts['RS4'],
            'RS5': step_server_counts['RS5'],
            'total': sum(step_server_counts.values())
        })
        if len(self.density_history) > 30:
            self.density_history.pop(0)

        self.utilization_history.append({
            'time': now_str,
            'RS1': self.servers['RS1']['cpu_percent'],
            'RS2': self.servers['RS2']['cpu_percent'],
            'RS3': self.servers['RS3']['cpu_percent'],
            'RS4': self.servers['RS4']['cpu_percent'],
            'RS5': self.servers['RS5']['cpu_percent'],
            'average': round(np.mean([s['cpu_percent'] for s in self.servers.values()]), 1)
        })
        if len(self.utilization_history) > 30:
            self.utilization_history.pop(0)

        self.cost_history.append({
            'time': now_str,
            'storage_cost': round(self.total_storage_cost, 2),
            'miss_cost': round(self.total_miss_cost, 2),
            'total_cost': round(self.total_operating_cost, 2)
        })
        if len(self.cost_history) > 30:
            self.cost_history.pop(0)

        self.server_state_history.append({
            'time': now_str,
            'active_servers': active_count,
            'RS1': self.servers['RS1']['status'],
            'RS2': self.servers['RS2']['status'],
            'RS3': self.servers['RS3']['status'],
            'RS4': self.servers['RS4']['status'],
            'RS5': self.servers['RS5']['status']
        })
        if len(self.server_state_history) > 30:
            self.server_state_history.pop(0)

    def _evaluate_auto_scaling(self):
        """Use cost optimizer to scale servers based on observed request rate."""
        current_active = sum(1 for s in self.servers.values() if s['status'] in ['Active', 'High Demand', 'Overloaded'])
        recent_total = sum(srv['history_demand'][-1] for srv in self.servers.values())
        
        opt_res = self.cost_optimizer.optimize_configuration(
            predicted_demand_drr=recent_total * 4.0,
            current_active_count=current_active,
            current_servers=list(self.servers.values())
        )

        for plan in opt_res.get('server_plan', []):
            sid = plan['server_id']
            if sid in self.servers and not self.servers[sid]['manual_override']:
                if plan['recommended_status'] == 'Active' and self.servers[sid]['status'] == 'Inactive':
                    self.servers[sid]['status'] = 'Active'
                elif plan['recommended_status'] == 'Inactive' and self.servers[sid]['status'] in ['Active', 'High Demand']:
                    # Ensure at least 1 active
                    if sum(1 for s in self.servers.values() if s['status'] != 'Inactive') > 1:
                        self.servers[sid]['status'] = 'Inactive'

    def _run_loop(self):
        """Continuous background execution loop."""
        while not self._stop_event.is_set():
            if self._pause_event.is_set():
                time.sleep(0.2)
                continue

            batch_size = max(5, int(15 * self.traffic_intensity))
            self.step(batch_size=batch_size)

            # Sleep duration adjusted by speed multiplier
            sleep_sec = max(0.08, 0.9 / self.speed_multiplier)
            time.sleep(sleep_sec)

    def get_dashboard_metrics(self) -> Dict[str, Any]:
        """Aggregate KPI metrics for operational dashboard."""
        total_reqs = self.total_requests
        hit_ratio = round((self.cache_hits / total_reqs * 100), 2) if total_reqs > 0 else 0.0
        miss_ratio = round(100.0 - hit_ratio, 2) if total_reqs > 0 else 0.0
        avg_latency = round((self.total_latency_ms / total_reqs), 1) if total_reqs > 0 else 0.0

        active_servers = sum(1 for s in self.servers.values() if s['status'] in ['Active', 'High Demand', 'Overloaded'])
        avg_utilization = round(np.mean([s['cpu_percent'] for s in self.servers.values()]), 1) if self.servers else 0.0

        # Baseline cost if all 5 servers ran continuously without optimization
        baseline_cost = round((5 * (self.storage_cost_per_server / 3600.0) * max(1, self.simulation_step * 5.0)) + (self.origin_misses * 0.0035), 2)
        cost_savings = max(0.0, round(baseline_cost - self.total_operating_cost, 2))

        return {
            'state': self.state,
            'algorithm': self.algorithm_name,
            'speed_multiplier': self.speed_multiplier,
            'traffic_intensity': self.traffic_intensity,
            'auto_scaling_enabled': self.auto_scaling_enabled,
            'simulation_step': self.simulation_step,
            'active_servers': active_servers,
            'total_servers': len(self.servers),
            'total_requests': total_reqs,
            'cache_hits': self.cache_hits,
            'peer_hits': self.peer_hits,
            'origin_misses': self.origin_misses,
            'hit_ratio': hit_ratio,
            'miss_ratio': miss_ratio,
            'avg_response_time_ms': avg_latency,
            'total_storage_cost': round(self.total_storage_cost, 2),
            'total_miss_cost': round(self.total_miss_cost, 2),
            'total_operating_cost': round(self.total_operating_cost, 2),
            'cost_savings': cost_savings,
            'server_utilization': avg_utilization,
            'servers': [s for s in self.servers.values()],
            'origin_server': self.origin_server,
            'recent_events': self.recent_events[-15:],
            'density_history': self.density_history[-20:],
            'utilization_history': self.utilization_history[-20:],
            'cost_history': self.cost_history[-20:],
            'server_state_history': self.server_state_history[-20:]
        }
