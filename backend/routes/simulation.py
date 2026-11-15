import json
import io
import csv
from datetime import datetime, timezone
from flask import Blueprint, jsonify, request, Response
from backend.simulation.cdn_simulator import CDNSimulator
from backend.database.db import db
from backend.models.database_models import SimulationRun

simulation_bp = Blueprint('simulation', __name__)

@simulation_bp.route('/start', methods=['POST'])
def start_simulation():
    sim = CDNSimulator.get_instance()
    sim.start()
    return jsonify({
        'status': 'success',
        'message': 'Simulation started',
        'state': sim.state
    })

@simulation_bp.route('/pause', methods=['POST'])
def pause_simulation():
    sim = CDNSimulator.get_instance()
    sim.pause()
    return jsonify({
        'status': 'success',
        'message': 'Simulation paused',
        'state': sim.state
    })

@simulation_bp.route('/resume', methods=['POST'])
def resume_simulation():
    sim = CDNSimulator.get_instance()
    sim.resume()
    return jsonify({
        'status': 'success',
        'message': 'Simulation resumed',
        'state': sim.state
    })

@simulation_bp.route('/stop', methods=['POST'])
def stop_simulation():
    sim = CDNSimulator.get_instance()
    sim.stop()
    return jsonify({
        'status': 'success',
        'message': 'Simulation stopped',
        'state': sim.state
    })

@simulation_bp.route('/reset', methods=['POST'])
def reset_simulation():
    sim = CDNSimulator.get_instance()
    sim.reset()
    return jsonify({
        'status': 'success',
        'message': 'Simulation reset',
        'state': sim.state
    })

@simulation_bp.route('/step', methods=['POST'])
def step_simulation():
    sim = CDNSimulator.get_instance()
    data = request.get_json(silent=True) or {}
    batch_size = int(data.get('batch_size', 10))
    sim.step(batch_size=batch_size)
    return jsonify({
        'status': 'success',
        'message': f'Executed step with batch size {batch_size}',
        'step': sim.simulation_step,
        'metrics': sim.get_dashboard_metrics()
    })

@simulation_bp.route('/config', methods=['POST'])
def configure_simulation():
    sim = CDNSimulator.get_instance()
    data = request.get_json(silent=True) or {}
    
    if 'speed' in data:
        sim.set_speed(float(data['speed']))
    if 'traffic_intensity' in data:
        sim.set_traffic_intensity(float(data['traffic_intensity']))
    if 'algorithm' in data:
        sim.set_algorithm(str(data['algorithm']))
    if 'auto_scaling' in data:
        sim.auto_scaling_enabled = bool(data['auto_scaling'])

    return jsonify({
        'status': 'success',
        'message': 'Simulation configuration updated',
        'config': {
            'speed': sim.speed_multiplier,
            'traffic_intensity': sim.traffic_intensity,
            'algorithm': sim.algorithm_name,
            'auto_scaling': sim.auto_scaling_enabled
        }
    })

@simulation_bp.route('/status', methods=['GET'])
def get_simulation_status():
    sim = CDNSimulator.get_instance()
    return jsonify({
        'status': 'success',
        'data': {
            'state': sim.state,
            'step': sim.simulation_step,
            'total_requests': sim.total_requests,
            'speed_multiplier': sim.speed_multiplier,
            'traffic_intensity': sim.traffic_intensity,
            'algorithm': sim.algorithm_name,
            'auto_scaling_enabled': sim.auto_scaling_enabled
        }
    })

@simulation_bp.route('/save', methods=['POST'])
def save_simulation_snapshot():
    sim = CDNSimulator.get_instance()
    metrics = sim.get_dashboard_metrics()
    
    data = request.get_json(silent=True) or {}
    run_name = data.get('name', f"Run-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}")
    run_id = f"SIM-{int(datetime.now(timezone.utc).timestamp())}"

    config = {
        'speed_multiplier': sim.speed_multiplier,
        'traffic_intensity': sim.traffic_intensity,
        'auto_scaling_enabled': sim.auto_scaling_enabled,
        'active_servers': metrics['active_servers']
    }

    sim_run = SimulationRun(
        id=run_id,
        name=run_name,
        created_at=datetime.now(timezone.utc),
        algorithm=sim.algorithm_name,
        total_requests=metrics['total_requests'],
        cache_hits=metrics['cache_hits'],
        cache_misses=metrics['origin_misses'],
        hit_ratio=metrics['hit_ratio'],
        avg_latency_ms=metrics['avg_response_time_ms'],
        total_cost=metrics['total_operating_cost'],
        storage_cost=metrics['total_storage_cost'],
        miss_cost=metrics['total_miss_cost'],
        active_servers=metrics['active_servers'],
        config_json=json.dumps(config)
    )

    db.session.add(sim_run)
    db.session.commit()

    return jsonify({
        'status': 'success',
        'message': 'Simulation run recorded successfully',
        'run': sim_run.to_dict()
    })

@simulation_bp.route('/history', methods=['GET'])
def get_simulation_history():
    runs = SimulationRun.query.order_by(SimulationRun.created_at.desc()).all()
    return jsonify({
        'status': 'success',
        'data': [r.to_dict() for r in runs]
    })

@simulation_bp.route('/history/<run_id>', methods=['DELETE'])
def delete_simulation_run(run_id):
    sim_run = db.session.get(SimulationRun, run_id)
    if not sim_run:
        return jsonify({'status': 'error', 'message': 'Run not found'}), 404

    db.session.delete(sim_run)
    db.session.commit()
    return jsonify({'status': 'success', 'message': f'Deleted run {run_id}'})

@simulation_bp.route('/history/export', methods=['GET'])
def export_simulation_history_csv():
    runs = SimulationRun.query.order_by(SimulationRun.created_at.desc()).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        'Simulation ID', 'Name', 'Timestamp', 'Algorithm', 'Total Requests',
        'Cache Hits', 'Cache Misses', 'Hit Ratio (%)', 'Avg Latency (ms)',
        'Total Cost ($)', 'Storage Cost ($)', 'Miss Cost ($)', 'Active Servers'
    ])
    
    for r in runs:
        writer.writerow([
            r.id, r.name, r.created_at.isoformat() if r.created_at else '',
            r.algorithm, r.total_requests, r.cache_hits, r.cache_misses,
            r.hit_ratio, r.avg_latency_ms, r.total_cost, r.storage_cost,
            r.miss_cost, r.active_servers
        ])

    output.seek(0)
    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment;filename=smartcdn_simulation_history.csv"}
    )
