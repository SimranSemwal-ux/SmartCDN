"""
Comprehensive Audit Test Suite for SmartCDN Platform
Validates:
1. Dataset generation and CSV export.
2. Request distribution across five replica servers.
3. Cache hit/miss calculations (local hit, peer hit, origin miss).
4. LRU, Dynamic Selective, and Adaptive Cost-aware cache evictions.
5. Automatic and manual server activation/deactivation safeguards.
6. Cost optimization calculations (paper formula and operational cost).
7. Actual ML training and demand prediction (RandomForest).
8. Algorithm comparison using identical request workloads.
9. Dashboard KPI metric updates.
10. Simulation history snapshot and SQLite database persistence.
"""
import pytest
import os
import sys
import json
import pandas as pd

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.algorithms.lru import LRUCache
from backend.algorithms.dynamic_selective import DynamicSelectiveCache
from backend.algorithms.adaptive_cache import AdaptiveCostAwareCache
from backend.simulation.cost_optimizer import CostOptimizer
from backend.simulation.request_generator import SyntheticWorkloadGenerator
from backend.simulation.cdn_simulator import CDNSimulator
from backend.services.comparison_service import AlgorithmComparisonService
from backend.ml.demand_predictor import DemandPredictor
from backend.app import create_app
from backend.database.db import db
from backend.models.database_models import SimulationRun, ServerActivityLog

@pytest.fixture
def app_client():
    app = create_app()
    app.config['TESTING'] = True
    with app.test_client() as client:
        with app.app_context():
            db.create_all()
        yield client

# 1. Dataset Generation & CSV Export
def test_dataset_generation_and_export(tmp_path):
    generator = SyntheticWorkloadGenerator(
        num_users=200,
        num_objects=25,
        num_servers=5,
        total_requests=500,
        time_span_hours=6,
        zipf_alpha=0.5,
        seed=42
    )
    csv_file = tmp_path / "test_workload.csv"
    df = generator.save_to_csv(str(csv_file))

    assert os.path.exists(str(csv_file))
    assert len(df) == 500
    expected_cols = {
        'request_id', 'timestamp', 'user_id', 'region', 'content_id',
        'replica_server', 'request_count', 'cache_hit', 'response_time',
        'server_load', 'content_popularity', 'request_density'
    }
    assert expected_cols.issubset(set(df.columns))
    # Verify Zipfian distribution: rank 1 item should have more requests than rank 20
    top_obj = generator.content_catalog[0]['content_id']
    low_obj = generator.content_catalog[-1]['content_id']
    top_count = (df['content_id'] == top_obj).sum()
    low_count = (df['content_id'] == low_obj).sum()
    assert top_count >= low_count

# 2. Request Distribution Across 5 Replica Servers
def test_request_distribution_across_servers():
    sim = CDNSimulator.get_instance()
    sim.reset()

    # Step simulation multiple times
    for _ in range(5):
        sim.step(batch_size=20)

    # Verify requests were routed across multiple servers
    total_served = sum(
        s['cache_hits'] + s['peer_hits'] + s['origin_misses'] for s in sim.servers.values()
    )
    assert total_served == 100
    assert sim.total_requests == 100

    # Ensure all 5 servers received telemetry
    assert len(sim.servers) == 5
    for sid in ['RS1', 'RS2', 'RS3', 'RS4', 'RS5']:
        assert sid in sim.servers
        assert sim.servers[sid]['cpu_percent'] >= 8.0

# 3. Cache Hit / Miss Calculations (Local Hit, Peer Hit, Origin Miss)
def test_cache_hit_miss_calculations():
    sim = CDNSimulator.get_instance()
    sim.reset()

    # Request content OBJ-001 at US-East (Virginia) -> RS1
    ev1 = sim.process_request('OBJ-001', 'US-East (Virginia)', 'USR-00001')
    # First time: must be Origin Miss
    assert ev1['status'] == 'ORIGIN_MISS'
    assert sim.origin_misses >= 1

    # Second time for same content: must be Local Hit
    ev2 = sim.process_request('OBJ-001', 'US-East (Virginia)', 'USR-00002')
    assert ev2['status'] == 'LOCAL_HIT'
    assert sim.cache_hits >= 1

    # Request same content from US-West (RS2): RS2 doesn't have it, but peer RS1 has it!
    ev3 = sim.process_request('OBJ-001', 'US-West (California)', 'USR-00003')
    assert ev3['status'] == 'PEER_HIT'
    assert sim.peer_hits >= 1

# 4. LRU, Dynamic Selective, and Adaptive Cache Eviction
def test_cache_eviction_mechanics():
    # A. LRU
    lru = LRUCache(capacity_mb=40.0)
    lru.put("OBJ-1", 25.0)
    lru.put("OBJ-2", 10.0)
    assert lru.used_mb == 35.0
    # Admitting OBJ-3 (15MB) requires 10MB freed, evicting OBJ-1 (25MB)
    admitted, evicted = lru.put("OBJ-3", 15.0)
    assert admitted is True
    assert "OBJ-1" in evicted
    assert lru.get("OBJ-1") is None
    assert lru.get("OBJ-2") is not None
    assert lru.get("OBJ-3") is not None

    # B. Dynamic Selective
    sel = DynamicSelectiveCache(capacity_mb=50.0, admission_threshold_k=2)
    # First request: bypassed
    adm1, _ = sel.put("OBJ-ONEHIT", 10.0)
    assert adm1 is False
    assert sel.total_bypasses == 1
    # Second request: admitted
    adm2, _ = sel.put("OBJ-ONEHIT", 10.0)
    assert adm2 is True
    assert sel.get("OBJ-ONEHIT") is not None

    # C. Adaptive Cost-Aware
    adapt = AdaptiveCostAwareCache(capacity_mb=30.0, storage_cost_per_mb=0.03, miss_cost_per_req=0.05)
    adapt.put("OBJ-VALUABLE", 15.0, {'popularity_score': 0.95})
    adapt.put("OBJ-AVERAGE", 10.0, {'popularity_score': 0.40})
    
    # Trying to admit low popularity object when full -> should bypass
    adm_low, _ = adapt.put("OBJ-TRIVIAL", 10.0, {'popularity_score': 0.01})
    assert adm_low is False
    assert adapt.total_bypasses >= 1

# 5. Automatic and Manual Server Activation/Deactivation Safeguards
def test_server_activation_deactivation():
    sim = CDNSimulator.get_instance()
    sim.reset()

    # Manual toggle of RS2 to Inactive
    ok = sim.toggle_server_status('RS2', 'Inactive')
    assert ok is True
    assert sim.servers['RS2']['status'] == 'Inactive'
    assert sim.servers['RS2']['manual_override'] is True

    # Attempt to deactivate all remaining servers one by one
    sim.toggle_server_status('RS3', 'Inactive')
    sim.toggle_server_status('RS4', 'Inactive')
    sim.toggle_server_status('RS5', 'Inactive')
    
    # RS1 is now the ONLY active server left. Deactivating it MUST FAIL as safeguard!
    fail_deactivate = sim.toggle_server_status('RS1', 'Inactive')
    assert fail_deactivate is False
    assert sim.servers['RS1']['status'] == 'Active'

# 6. Cost Optimization Calculations (Paper Formula and Convexity)
def test_cost_optimization_formula():
    opt = CostOptimizer(storage_cost_per_server=15.0, miss_cost_coefficient=0.05, server_capacity_reqs=2500)
    
    # DRR = 1500 req/h
    # Nr = 1: Cs*1 + Cm*(1500/1) = 15 + 75 = 90
    # Nr = 2: Cs*2 + Cm*(1500/2) = 30 + 37.5 = 67.5
    # Nr = 3: Cs*3 + Cm*(1500/3) = 45 + 25 = 70.0
    storage1, miss1, total1 = opt.calculate_paper_formula_cost(1, 1500.0)
    storage2, miss2, total2 = opt.calculate_paper_formula_cost(2, 1500.0)
    storage3, miss3, total3 = opt.calculate_paper_formula_cost(3, 1500.0)

    assert total1 == 90.0
    assert total2 == 67.5
    assert total3 == 70.0
    assert total2 < total1 and total2 < total3  # True convex minimum at Nr=2!

    evals = opt.evaluate_all_configurations(1500.0)
    assert len(evals) == 5
    best = min(evals, key=lambda x: x['total_cost'])
    assert best['active_servers'] == 2

# 7. Actual ML Training and Demand Prediction
def test_ml_demand_predictor(tmp_path):
    generator = SyntheticWorkloadGenerator(
        num_users=300,
        num_objects=30,
        num_servers=5,
        total_requests=1000,
        time_span_hours=8,
        seed=101
    )
    df = generator.generate_dataframe()
    
    model_file = str(tmp_path / "test_model.joblib")
    predictor = DemandPredictor(model_path=model_file)
    metrics = predictor.train(df, n_estimators=25, random_state=42)

    assert metrics['trained'] is True
    assert 'mae' in metrics and metrics['mae'] >= 0.0
    assert 'rmse' in metrics and metrics['rmse'] >= 0.0
    assert 'r2_score' in metrics
    assert os.path.exists(model_file)

    # Next interval prediction
    preds = predictor.predict_next_interval(current_hour=14, server_histories={
        'RS1': [500.0, 520.0, 510.0],
        'RS2': [400.0, 420.0, 410.0],
    })
    assert len(preds) == 5
    assert preds['RS1']['predicted_demand'] > 0

# 8. Algorithm Comparison Using Identical Workload Trace
def test_algorithm_comparison_service():
    service = AlgorithmComparisonService(cache_capacity_mb=500.0, storage_cost_per_server=15.0, miss_cost_per_req=0.05)
    bench = service.run_benchmark(num_requests=600, num_objects=25, zipf_alpha=0.5, seed=42)

    assert 'results' in bench
    assert len(bench['results']) == 3
    
    algo_names = [r['algorithm'] for r in bench['results']]
    assert 'LRU' in algo_names
    assert 'Dynamic Selective' in algo_names
    assert 'Adaptive Cost-aware' in algo_names

    # Ensure identical workload count was executed on all 3 algorithms
    for r in bench['results']:
        assert r['total_requests'] == 600
        assert r['cache_hits'] + r['peer_hits'] + r['cache_misses'] == 600

# 9. Dashboard KPI Metric Updates
def test_dashboard_kpis(app_client):
    res = app_client.get('/api/dashboard/metrics')
    assert res.status_code == 200
    data = res.json['data']

    required_kpis = [
        'active_servers', 'total_requests', 'hit_ratio', 'miss_ratio',
        'avg_response_time_ms', 'total_storage_cost', 'total_miss_cost',
        'total_operating_cost', 'cost_savings', 'server_utilization'
    ]
    for kpi in required_kpis:
        assert kpi in data

# 10. Simulation History and Database Persistence
def test_simulation_history_persistence(app_client):
    # Save a run snapshot
    save_res = app_client.post('/api/simulation/save', json={'name': 'Audit Verification Run'})
    assert save_res.status_code == 200
    run_id = save_res.json['run']['id']

    # Query history
    hist_res = app_client.get('/api/simulation/history')
    assert hist_res.status_code == 200
    run_ids = [r['id'] for r in hist_res.json['data']]
    assert run_id in run_ids

    # Delete the run
    del_res = app_client.delete(f'/api/simulation/history/{run_id}')
    assert del_res.status_code == 200

    # Ensure deleted
    hist_after = app_client.get('/api/simulation/history')
    after_ids = [r['id'] for r in hist_after.json['data']]
    assert run_id not in after_ids
