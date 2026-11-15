from flask import Blueprint, jsonify, request
from backend.simulation.cdn_simulator import CDNSimulator

cache_bp = Blueprint('cache', __name__)

@cache_bp.route('', methods=['GET'])
def get_cache_contents():
    sim = CDNSimulator.get_instance()
    server_id = request.args.get('server_id', 'RS1')
    
    if server_id not in sim.caches:
        return jsonify({'status': 'error', 'message': f'Server {server_id} not found'}), 404

    cache_inst = sim.caches[server_id]
    stats = cache_inst.get_stats()

    # Extract cached entries
    entries = []
    raw_cache = getattr(cache_inst, 'cache', {})
    for cid, item in raw_cache.items():
        meta = item.get('metadata', {})
        entries.append({
            'content_id': cid,
            'name': meta.get('name', f"Asset-{cid}"),
            'category': meta.get('category', 'Asset'),
            'size_mb': item.get('size_mb', 0.0),
            'popularity_score': meta.get('popularity_score', 0.0),
            'access_count': item.get('access_count', 1),
            'cached_at': item.get('cached_at', ''),
            'last_accessed': item.get('last_accessed', ''),
            'utility_score': item.get('utility_score', None)
        })

    # Sort by access count descending
    entries.sort(key=lambda x: x['access_count'], reverse=True)

    return jsonify({
        'status': 'success',
        'data': {
            'server_id': server_id,
            'stats': stats,
            'entries': entries,
            'active_algorithm': sim.algorithm_name
        }
    })

@cache_bp.route('/statistics', methods=['GET'])
def get_all_cache_statistics():
    sim = CDNSimulator.get_instance()
    all_stats = {}
    for sid, c in sim.caches.items():
        all_stats[sid] = c.get_stats()

    return jsonify({
        'status': 'success',
        'data': {
            'active_algorithm': sim.algorithm_name,
            'servers': all_stats
        }
    })

@cache_bp.route('/algorithm', methods=['POST'])
def change_caching_algorithm():
    sim = CDNSimulator.get_instance()
    data = request.get_json(silent=True) or {}
    algo = data.get('algorithm')

    if algo not in ['LRU', 'Dynamic Selective', 'Adaptive Cost-aware']:
        return jsonify({
            'status': 'error',
            'message': 'Invalid algorithm. Choose from: LRU, Dynamic Selective, Adaptive Cost-aware'
        }), 400

    sim.set_algorithm(algo)
    return jsonify({
        'status': 'success',
        'message': f'Caching algorithm updated to {algo}',
        'algorithm': algo
    })

@cache_bp.route('/clear', methods=['POST'])
def clear_cache():
    sim = CDNSimulator.get_instance()
    data = request.get_json(silent=True) or {}
    server_id = data.get('server_id')

    if server_id:
        if server_id in sim.caches:
            sim.caches[server_id].clear()
            sim.servers[server_id]['used_mb'] = 0.0
            return jsonify({'status': 'success', 'message': f'Cache cleared for {server_id}'})
        return jsonify({'status': 'error', 'message': f'Server {server_id} not found'}), 404
    else:
        for sid in sim.caches:
            sim.caches[sid].clear()
            sim.servers[sid]['used_mb'] = 0.0
        return jsonify({'status': 'success', 'message': 'All replica caches cleared'})
