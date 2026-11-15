import json
from datetime import datetime, timezone
from flask import Blueprint, jsonify, request
from backend.simulation.cdn_simulator import CDNSimulator
from backend.simulation.cost_optimizer import CostOptimizer
from backend.database.db import db
from backend.models.database_models import OptimizationDecision

optimization_bp = Blueprint('optimization', __name__)

@optimization_bp.route('/run', methods=['POST'])
def run_optimization():
    sim = CDNSimulator.get_instance()
    data = request.get_json(silent=True) or {}

    storage_cost = float(data.get('storage_cost_per_server', sim.storage_cost_per_server))
    miss_cost = float(data.get('miss_cost_per_request', sim.miss_cost_per_req))
    server_capacity = int(data.get('server_capacity_reqs', 2500))
    custom_demand = data.get('demand_override')

    optimizer = CostOptimizer(
        storage_cost_per_server=storage_cost,
        miss_cost_coefficient=miss_cost,
        server_capacity_reqs=server_capacity
    )

    # Use custom demand or calculate from recent simulation demand
    if custom_demand is not None:
        predicted_drr = float(custom_demand)
    else:
        recent_total = sum(srv['history_demand'][-1] for srv in sim.servers.values())
        predicted_drr = max(200.0, recent_total * 4.0)

    current_active = sum(1 for s in sim.servers.values() if s['status'] in ['Active', 'High Demand', 'Overloaded'])

    result = optimizer.optimize_configuration(
        predicted_demand_drr=predicted_drr,
        current_active_count=current_active,
        current_servers=list(sim.servers.values())
    )

    # Record decision in database
    decision = OptimizationDecision(
        timestamp=datetime.now(timezone.utc),
        predicted_demand=predicted_drr,
        previous_active_count=current_active,
        new_active_count=result['optimal_active_servers'],
        estimated_cost_before=result['current_cost_per_hour'],
        estimated_cost_after=result['optimized_cost_per_hour'],
        cost_savings=result['estimated_hourly_savings'],
        strategy='Cost-balanced Adaptive Replica Allocation (CARSCM 2025)',
        details_json=json.dumps(result)
    )
    db.session.add(decision)
    db.session.commit()

    return jsonify({
        'status': 'success',
        'decision_id': decision.id,
        'data': result
    })

@optimization_bp.route('/results', methods=['GET'])
def get_optimization_results():
    sim = CDNSimulator.get_instance()
    recent_total = sum(srv['history_demand'][-1] for srv in sim.servers.values())
    predicted_drr = max(200.0, recent_total * 4.0)
    current_active = sum(1 for s in sim.servers.values() if s['status'] in ['Active', 'High Demand', 'Overloaded'])

    optimizer = sim.cost_optimizer
    result = optimizer.optimize_configuration(
        predicted_demand_drr=predicted_drr,
        current_active_count=current_active,
        current_servers=list(sim.servers.values())
    )

    # Fetch recent past decisions
    past_decisions = OptimizationDecision.query.order_by(OptimizationDecision.timestamp.desc()).limit(10).all()

    return jsonify({
        'status': 'success',
        'data': {
            'current_optimization': result,
            'past_decisions': [d.to_dict() for d in past_decisions]
        }
    })

@optimization_bp.route('/apply', methods=['POST'])
def apply_optimization_plan():
    sim = CDNSimulator.get_instance()
    data = request.get_json(silent=True) or {}
    server_plan = data.get('server_plan', [])

    applied_changes = []
    for item in server_plan:
        sid = item.get('server_id')
        rec_status = item.get('recommended_status')
        if sid in sim.servers and rec_status in ['Active', 'Inactive']:
            old_status = sim.servers[sid]['status']
            if old_status != rec_status:
                sim.servers[sid]['status'] = rec_status
                sim.servers[sid]['manual_override'] = False
                applied_changes.append(f"{sid}: {old_status} -> {rec_status}")

    return jsonify({
        'status': 'success',
        'message': f"Applied optimization plan to {len(applied_changes)} server(s)",
        'changes': applied_changes
    })
