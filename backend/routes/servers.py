from flask import Blueprint, jsonify, request
from datetime import datetime, timezone
from backend.simulation.cdn_simulator import CDNSimulator
from backend.database.db import db
from backend.models.database_models import ServerActivityLog

servers_bp = Blueprint('servers', __name__)

@servers_bp.route('', methods=['GET'])
def get_servers():
    sim = CDNSimulator.get_instance()
    servers_list = []
    
    for sid, srv in sim.servers.items():
        cache_inst = sim.caches.get(sid)
        used_mb = getattr(cache_inst, 'used_mb', 0.0)
        total_reqs = srv['cache_hits'] + srv['cache_misses']
        hit_ratio = round((srv['cache_hits'] / total_reqs * 100), 2) if total_reqs > 0 else 0.0
        
        servers_list.append({
            'id': srv['id'],
            'name': srv['name'],
            'region': srv['region'],
            'status': srv['status'],
            'cpu_percent': srv['cpu_percent'],
            'memory_percent': srv['memory_percent'],
            'capacity_mb': srv['capacity_mb'],
            'used_mb': round(used_mb, 2),
            'cache_usage_percent': round((used_mb / srv['capacity_mb'] * 100), 2) if srv['capacity_mb'] > 0 else 0.0,
            'active_requests': srv['active_requests'],
            'request_density': round(srv['history_demand'][-1], 1) if srv['history_demand'] else 0.0,
            'response_time_ms': srv['avg_latency_ms'],
            'cache_hits': srv['cache_hits'],
            'peer_hits': srv['peer_hits'],
            'cache_misses': srv['cache_misses'],
            'hit_ratio': hit_ratio,
            'is_auto_scale': srv['is_auto_scale'],
            'manual_override': srv['manual_override']
        })

    return jsonify({
        'status': 'success',
        'data': {
            'servers': servers_list,
            'origin': sim.origin_server,
            'auto_scaling_enabled': sim.auto_scaling_enabled
        }
    })

@servers_bp.route('/toggle', methods=['POST'])
def toggle_server():
    sim = CDNSimulator.get_instance()
    data = request.get_json(silent=True) or {}
    server_id = data.get('server_id')

    if not server_id or server_id not in sim.servers:
        return jsonify({'status': 'error', 'message': f'Server {server_id} not found'}), 404

    target_server = sim.servers[server_id]
    current_status = target_server['status']
    
    # Don't deactivate if it's the only active server
    active_count = sum(1 for s in sim.servers.values() if s['status'] in ['Active', 'High Demand', 'Overloaded'])
    if current_status in ['Active', 'High Demand', 'Overloaded'] and active_count <= 1:
        return jsonify({
            'status': 'error',
            'message': 'Cannot deactivate the last remaining active replica server. SmartCDN requires at least one active replica server.'
        }), 400

    new_status = 'Inactive' if current_status != 'Inactive' else 'Active'
    target_server['status'] = new_status
    target_server['manual_override'] = True

    # Log activity to SQLite
    action = "ACTIVATED" if new_status == 'Active' else "DEACTIVATED"
    log = ServerActivityLog(
        server_id=server_id,
        timestamp=datetime.now(timezone.utc),
        action=action,
        reason=f"Manual operator override: toggled to {new_status}",
        active_count=sum(1 for s in sim.servers.values() if s['status'] != 'Inactive')
    )
    db.session.add(log)
    db.session.commit()

    return jsonify({
        'status': 'success',
        'message': f"Server {server_id} is now {new_status}",
        'server': target_server
    })

@servers_bp.route('/auto-scale', methods=['POST'])
def toggle_auto_scaling():
    sim = CDNSimulator.get_instance()
    data = request.get_json(silent=True) or {}
    enabled = data.get('enabled')
    if enabled is not None:
        sim.auto_scaling_enabled = bool(enabled)
    else:
        sim.auto_scaling_enabled = not sim.auto_scaling_enabled

    return jsonify({
        'status': 'success',
        'auto_scaling_enabled': sim.auto_scaling_enabled,
        'message': f"Auto-scaling {'enabled' if sim.auto_scaling_enabled else 'disabled'}"
    })

@servers_bp.route('/reset-overrides', methods=['POST'])
def reset_manual_overrides():
    sim = CDNSimulator.get_instance()
    for srv in sim.servers.values():
        srv['manual_override'] = False
    return jsonify({
        'status': 'success',
        'message': 'Manual overrides cleared. System auto-scale now manages all servers.'
    })
