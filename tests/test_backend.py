"""
Unit tests for SmartCDN backend components and algorithms.
"""
import pytest
import os
import sys

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.algorithms.lru import LRUCache
from backend.algorithms.dynamic_selective import DynamicSelectiveCache
from backend.algorithms.adaptive_cache import AdaptiveCostAwareCache
from backend.simulation.cost_optimizer import CostOptimizer
from backend.simulation.request_generator import SyntheticWorkloadGenerator
from backend.app import create_app

def test_lru_cache():
    cache = LRUCache(capacity_mb=50.0)
    
    # Put item 1
    admitted, evicted = cache.put("OBJ-01", 30.0)
    assert admitted is True
    assert len(evicted) == 0
    assert cache.get("OBJ-01") is not None

    # Put item 2
    admitted, evicted = cache.put("OBJ-02", 15.0)
    assert admitted is True
    assert len(evicted) == 0

    # Put item 3 which forces eviction of OBJ-01 (LRU)
    admitted, evicted = cache.put("OBJ-03", 20.0)
    assert admitted is True
    assert "OBJ-01" in evicted
    assert cache.get("OBJ-01") is None
    assert cache.get("OBJ-02") is not None
    assert cache.get("OBJ-03") is not None

def test_dynamic_selective_cache():
    cache = DynamicSelectiveCache(capacity_mb=50.0, admission_threshold_k=2)
    
    # 1st request for OBJ-A: should be bypassed (k=2 required)
    admitted, evicted = cache.put("OBJ-A", 10.0)
    assert admitted is False
    assert cache.get("OBJ-A") is None
    assert cache.total_bypasses == 1

    # 2nd request for OBJ-A: threshold reached, should be admitted!
    admitted, evicted = cache.put("OBJ-A", 10.0)
    assert admitted is True
    assert cache.get("OBJ-A") is not None
    assert cache.total_hits == 1

def test_adaptive_cost_aware_cache():
    cache = AdaptiveCostAwareCache(capacity_mb=50.0, storage_cost_per_mb=0.03, miss_cost_per_req=0.05)
    
    # High popularity small object
    u_high = cache.calculate_utility("OBJ-HIGH", 2.0, {'popularity_score': 0.8})
    # Low popularity large object
    u_low = cache.calculate_utility("OBJ-LOW", 25.0, {'popularity_score': 0.05})
    assert u_high > u_low

    # Admit OBJ-HIGH
    admitted, evicted = cache.put("OBJ-HIGH", 2.0, {'popularity_score': 0.8})
    assert admitted is True
    assert cache.get("OBJ-HIGH") is not None

def test_cost_optimizer():
    optimizer = CostOptimizer(storage_cost_per_server=15.0, miss_cost_coefficient=0.05, server_capacity_reqs=2000)
    
    # Test paper formula: C_total = Cs * Nr + Cm * (DRR / Nr)
    # With Cs=15, Cm=0.05, DRR=1000, Nr=2:
    # Storage = 15*2 = 30.0, Miss = 0.05*(1000/2) = 25.0, Total = 55.0
    storage, miss, total = optimizer.calculate_paper_formula_cost(2, 1000.0)
    assert storage == 30.0
    assert miss == 25.0
    assert total == 55.0

    # Evaluate configurations
    evals = optimizer.evaluate_all_configurations(1500.0)
    assert len(evals) == 5
    assert evals[0]['active_servers'] == 1

def test_synthetic_generator():
    generator = SyntheticWorkloadGenerator(
        num_users=100,
        num_objects=10,
        num_servers=5,
        total_requests=200,
        time_span_hours=6,
        seed=123
    )
    df = generator.generate_dataframe()
    assert len(df) == 200
    assert 'request_id' in df.columns
    assert 'replica_server' in df.columns
    assert 'cache_hit' in df.columns

def test_flask_endpoints():
    app = create_app()
    client = app.test_client()

    # Health check
    res = client.get('/api/health')
    assert res.status_code == 200
    assert res.json['status'] == 'healthy'

    # Dashboard metrics
    res = client.get('/api/dashboard/metrics')
    assert res.status_code == 200
    assert 'data' in res.json
    assert 'active_servers' in res.json['data']

    # Servers list
    res = client.get('/api/servers')
    assert res.status_code == 200
    assert len(res.json['data']['servers']) == 5

    # Cache statistics
    res = client.get('/api/cache/statistics')
    assert res.status_code == 200
    assert 'servers' in res.json['data']
