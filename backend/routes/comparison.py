from flask import Blueprint, jsonify, request
from backend.services.comparison_service import AlgorithmComparisonService

comparison_bp = Blueprint('comparison', __name__)
service = AlgorithmComparisonService()
latest_results = None

@comparison_bp.route('/run', methods=['POST'])
def run_comparison():
    global latest_results
    data = request.get_json(silent=True) or {}
    
    num_requests = int(data.get('num_requests', 3000))
    num_objects = int(data.get('num_objects', 100))
    zipf_alpha = float(data.get('zipf_alpha', 0.5))
    seed = int(data.get('seed', 42))

    try:
        results = service.run_benchmark(
            num_requests=num_requests,
            num_objects=num_objects,
            zipf_alpha=zipf_alpha,
            seed=seed
        )
        latest_results = results
        return jsonify({
            'status': 'success',
            'message': 'Benchmark completed across LRU, Dynamic Selective, and Adaptive Cost-aware algorithms',
            'data': results
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': f'Comparison run failed: {str(e)}'}), 500

@comparison_bp.route('/results', methods=['GET'])
def get_comparison_results():
    global latest_results
    if latest_results is None:
        # Run default baseline comparison so user sees populated results immediately
        latest_results = service.run_benchmark(num_requests=3000, num_objects=100, zipf_alpha=0.5, seed=42)

    return jsonify({
        'status': 'success',
        'data': latest_results
    })
