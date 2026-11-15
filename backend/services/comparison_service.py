"""
Algorithm Comparison Service for SmartCDN
Executes LRU, Dynamic Selective Caching, and Proposed Adaptive Cost-aware Caching
against the EXACT same workload trace and returns empirical performance benchmarks.
All performance metrics and costs are computed directly from actual execution.
"""
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

from backend.algorithms.lru import LRUCache
from backend.algorithms.dynamic_selective import DynamicSelectiveCache
from backend.algorithms.adaptive_cache import AdaptiveCostAwareCache
from backend.simulation.request_generator import SyntheticWorkloadGenerator
from backend.simulation.cost_optimizer import CostOptimizer

class AlgorithmComparisonService:
    def __init__(
        self,
        cache_capacity_mb: float = 500.0,
        storage_cost_per_server: float = 15.0,
        miss_cost_per_req: float = 0.05
    ):
        self.cache_capacity_mb = float(cache_capacity_mb)
        self.storage_cost_per_server = float(storage_cost_per_server)
        self.miss_cost_per_req = float(miss_cost_per_req)
        self.cost_optimizer = CostOptimizer(
            storage_cost_per_server=self.storage_cost_per_server,
            miss_cost_coefficient=self.miss_cost_per_req,
            server_capacity_reqs=2500
        )

    def run_benchmark(
        self,
        num_requests: int = 5000,
        num_objects: int = 100,
        zipf_alpha: float = 0.5,
        seed: int = 42
    ) -> Dict[str, Any]:
        """
        Executes all 3 algorithms sequentially on the exact same synthetic trace.
        """
        generator = SyntheticWorkloadGenerator(
            num_users=5000,
            num_objects=num_objects,
            num_servers=5,
            total_requests=num_requests,
            time_span_hours=24,
            zipf_alpha=zipf_alpha,
            seed=seed
        )
        catalog = {item['content_id']: item for item in generator.content_catalog}
        df_trace = generator.generate_dataframe()
        requests_list = df_trace.to_dict(orient='records')
        total_reqs = len(requests_list)

        # Calculate average hourly demand to dynamically compute optimal active servers
        avg_hourly_demand = max(100.0, float(total_reqs / 24.0))
        evaluations = self.cost_optimizer.evaluate_all_configurations(avg_hourly_demand)
        feasible_configs = [e for e in evaluations if e['feasible'] and e['active_servers'] >= 1]
        best_adaptive_nr = min(feasible_configs, key=lambda e: e['total_cost'])['active_servers'] if feasible_configs else 3

        algorithms = [
            {
                'name': 'LRU',
                'label': 'Least Recently Used (Standard)',
                'active_servers': 5,  # Static allocation: all 5 servers run permanently
                'factory': lambda: {f'RS{i}': LRUCache(self.cache_capacity_mb) for i in range(1, 6)}
            },
            {
                'name': 'Dynamic Selective',
                'label': 'Dynamic Selective Caching (K=2)',
                'active_servers': 5,  # Static allocation: all 5 servers run permanently
                'factory': lambda: {f'RS{i}': DynamicSelectiveCache(self.cache_capacity_mb, admission_threshold_k=2) for i in range(1, 6)}
            },
            {
                'name': 'Adaptive Cost-aware',
                'label': 'Proposed Adaptive Cost-aware (CARSCM-inspired)',
                'active_servers': best_adaptive_nr,  # Dynamic optimal allocation from CostOptimizer
                'factory': lambda: {f'RS{i}': AdaptiveCostAwareCache(
                    self.cache_capacity_mb,
                    storage_cost_per_mb=0.03,
                    miss_cost_per_req=self.miss_cost_per_req
                ) for i in range(1, 6)}
            }
        ]

        results = []

        for algo in algorithms:
            caches = algo['factory']()
            total_hits = 0
            total_misses = 0
            total_peer_hits = 0
            latencies = []
            evictions = 0

            # Execute workload
            for req in requests_list:
                cid = req['content_id']
                target_server = req['replica_server']
                target_cache = caches[target_server]
                content = catalog.get(cid, {'content_id': cid, 'size_mb': 5.0, 'popularity_score': 0.1})

                # If adaptive cache, provide local density context
                if hasattr(target_cache, 'set_local_density'):
                    target_cache.set_local_density(avg_hourly_demand / algo['active_servers'])

                # Check local cache
                hit = target_cache.get(cid)
                if hit is not None:
                    total_hits += 1
                    latencies.append(18.0)
                else:
                    # Check peer servers
                    peer_hit = False
                    for peer_sid, peer_cache in caches.items():
                        if peer_sid != target_server and cid in getattr(peer_cache, 'cache', {}):
                            peer_hit = True
                            break

                    if peer_hit:
                        total_peer_hits += 1
                        latencies.append(55.0)
                        admitted, evicted_list = target_cache.put(cid, content['size_mb'], metadata=content)
                        evictions += len(evicted_list)
                    else:
                        total_misses += 1
                        latencies.append(155.0)
                        admitted, evicted_list = target_cache.put(cid, content['size_mb'], metadata=content)
                        evictions += len(evicted_list)

            hit_ratio = round((total_hits / total_reqs * 100), 2) if total_reqs > 0 else 0.0
            miss_ratio = round((total_misses / total_reqs * 100), 2) if total_reqs > 0 else 0.0
            avg_latency = round(float(np.mean(latencies)), 2) if latencies else 0.0

            # Storage and miss cost calculations
            # Workload simulated over 4 hours equivalent operational window
            workload_window_hours = 4.0
            active_nodes = algo['active_servers']
            storage_cost = round(active_nodes * self.storage_cost_per_server * workload_window_hours, 2)
            miss_cost = round(total_misses * self.miss_cost_per_req, 2)
            total_cost = round(storage_cost + miss_cost, 2)
            
            # Average memory used per server cache
            avg_cache_used_mb = round(float(np.mean([getattr(c, 'used_mb', 0.0) for c in caches.values()])), 2)

            results.append({
                'algorithm': algo['name'],
                'label': algo['label'],
                'total_requests': total_reqs,
                'cache_hits': total_hits,
                'peer_hits': total_peer_hits,
                'cache_misses': total_misses,
                'hit_ratio': hit_ratio,
                'miss_ratio': miss_ratio,
                'avg_latency_ms': avg_latency,
                'total_evictions': evictions,
                'active_servers': active_nodes,
                'storage_cost': storage_cost,
                'miss_cost': miss_cost,
                'total_cost': total_cost,
                'avg_cache_used_mb': avg_cache_used_mb
            })

        # Rank algorithms by lowest total cost (and highest hit ratio as tie-breaker)
        ranked = sorted(results, key=lambda r: (r['total_cost'], -r['hit_ratio']))
        for rank_idx, r in enumerate(ranked):
            r['rank'] = rank_idx + 1

        # Calculate cost savings compared to LRU baseline
        lru_cost = next((r['total_cost'] for r in results if r['algorithm'] == 'LRU'), results[0]['total_cost'])
        for r in results:
            savings = max(0.0, round(lru_cost - r['total_cost'], 2))
            savings_pct = round((savings / (lru_cost + 1e-5)) * 100, 1)
            r['cost_savings_dollars'] = savings
            r['cost_savings_percent'] = savings_pct

        return {
            'benchmark_id': f"BENCH-{int(datetime.now(timezone.utc).timestamp())}",
            'workload_parameters': {
                'num_requests': num_requests,
                'num_objects': num_objects,
                'zipf_alpha': zipf_alpha,
                'seed': seed,
                'cache_capacity_mb': self.cache_capacity_mb,
                'optimal_computed_servers': best_adaptive_nr
            },
            'results': results,
            'summary': {
                'best_cost_algorithm': ranked[0]['algorithm'],
                'best_hit_ratio_algorithm': max(results, key=lambda r: r['hit_ratio'])['algorithm'],
                'lowest_latency_algorithm': min(results, key=lambda r: r['avg_latency_ms'])['algorithm'],
                'max_savings_vs_lru': f"${ranked[0]['cost_savings_dollars']:.2f} ({ranked[0]['cost_savings_percent']}%)",
                'attribution_note': "Proposed Adaptive Cost-aware algorithm is our implementation inspired by CARSCM (IEEE 2025)."
            }
        }
