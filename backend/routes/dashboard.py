from flask import Blueprint, jsonify
from backend.simulation.cdn_simulator import CDNSimulator

dashboard_bp = Blueprint('dashboard', __name__)

@dashboard_bp.route('/metrics', methods=['GET'])
def get_dashboard_metrics():
    simulator = CDNSimulator.get_instance()
    metrics = simulator.get_dashboard_metrics()
    return jsonify({
        'status': 'success',
        'data': metrics
    })
