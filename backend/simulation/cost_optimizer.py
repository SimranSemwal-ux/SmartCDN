"""
Cost Optimization Engine for SmartCDN
Inspired by IEEE 2025: "Cost-balanced Adaptive Replica Server Cache Management under Time-Varying User Request Density in CCDNs"

Calculates optimal active replica server configuration Nr* minimizing:
1. Paper-inspired theoretical cost formula:
   C_total = Cs * Nr + Cm * (DRR / Nr)
2. Operational actual cost model:
   C_actual = (Active_Servers * Cs_hourly) + (Cache_Misses * Cm_per_miss) + Storage_Volume_Cost

Features:
- Multi-server evaluation (Nr in 1..5)
- Server capacity constraint enforcement
- Flapping prevention / hysteresis damping (minimum 5% improvement to switch)
- Recommended server activation/deactivation plan
"""
import math
from typing import Dict, Any, List, Tuple

class CostOptimizer:
    def __init__(
        self,
        storage_cost_per_server: float = 15.0,  # Cs: $ / hr per active replica server
        miss_cost_coefficient: float = 0.05,     # Cm: penalty per missed request
        server_capacity_reqs: int = 2500,        # Max requests / hr per server
        damping_threshold: float = 0.05,        # 5% threshold to avoid flapping
        min_active_servers: int = 1,
        max_servers: int = 5
    ):
        self.cs = float(storage_cost_per_server)
        self.cm = float(miss_cost_coefficient)
        self.server_capacity_reqs = int(server_capacity_reqs)
        self.damping_threshold = float(damping_threshold)
        self.min_active_servers = int(min_active_servers)
        self.max_servers = int(max_servers)

    def calculate_paper_formula_cost(self, nr: int, drr: float) -> Tuple[float, float, float]:
        """
        Paper simplified formula:
        C_total = Cs * Nr + Cm * (DRR / Nr)
        Returns (storage_cost, miss_penalty_cost, total_cost)
        """
        if nr <= 0:
            return float('inf'), float('inf'), float('inf')
        storage_cost = self.cs * nr
        miss_cost = self.cm * (drr / nr)
        total_cost = storage_cost + miss_cost
        return round(storage_cost, 2), round(miss_cost, 2), round(total_cost, 2)

    def calculate_operational_cost(
        self,
        active_server_count: int,
        actual_misses: int,
        total_requests: int,
        storage_mb_used: float,
        storage_cost_per_mb: float = 0.005
    ) -> Dict[str, float]:
        """
        Operational actual cost:
        Server runtime + cache miss bandwidth penalty + storage volume usage.
        """
        server_running_cost = active_server_count * self.cs
        miss_penalty = actual_misses * self.cm
        storage_volume_cost = storage_mb_used * storage_cost_per_mb
        total = server_running_cost + miss_penalty + storage_volume_cost

        return {
            'server_running_cost': round(server_running_cost, 2),
            'miss_penalty_cost': round(miss_penalty, 2),
            'storage_volume_cost': round(storage_volume_cost, 2),
            'total_operational_cost': round(total, 2)
        }

    def evaluate_all_configurations(self, predicted_demand_drr: float) -> List[Dict[str, Any]]:
        """
        Evaluate costs for all possible active server counts (Nr = 1..5).
        """
        drr = max(10.0, float(predicted_demand_drr))
        evaluations = []

        for nr in range(1, self.max_servers + 1):
            storage_cost, miss_cost, total_cost = self.calculate_paper_formula_cost(nr, drr)
            
            # Check capacity constraint
            total_capacity = nr * self.server_capacity_reqs
            utilization = min(100.0, round((drr / total_capacity) * 100.0, 1))
            capacity_feasible = drr <= (total_capacity * 1.1)  # allow up to 10% burst

            evaluations.append({
                'active_servers': nr,
                'storage_cost': storage_cost,
                'miss_cost': miss_cost,
                'total_cost': total_cost,
                'total_capacity': total_capacity,
                'predicted_utilization': utilization,
                'feasible': capacity_feasible
            })

        return evaluations

    def optimize_configuration(
        self,
        predicted_demand_drr: float,
        current_active_count: int,
        current_servers: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Determine optimal active server count and identify which servers to activate/deactivate.
        Includes hysteresis damping to prevent oscillation.
        """
        drr = max(10.0, float(predicted_demand_drr))
        evaluations = self.evaluate_all_configurations(drr)

        # Filter feasible configurations (satisfying capacity)
        feasible = [e for e in evaluations if e['feasible'] and e['active_servers'] >= self.min_active_servers]
        if not feasible:
            # If demand exceeds all capacity, use maximum servers
            feasible = [evaluations[-1]]

        # Find configuration with minimum theoretical cost
        best_candidate = min(feasible, key=lambda e: e['total_cost'])
        optimal_nr = best_candidate['active_servers']

        # Find current cost
        current_eval = next((e for e in evaluations if e['active_servers'] == current_active_count), evaluations[0])
        current_cost = current_eval['total_cost']
        optimal_cost = best_candidate['total_cost']

        # Damping check: only switch if cost improvement exceeds damping threshold,
        # OR if current capacity is violated (utilization > 95%)
        cost_difference = current_cost - optimal_cost
        relative_improvement = cost_difference / (current_cost + 1e-5)

        current_capacity = current_active_count * self.server_capacity_reqs
        capacity_threatened = drr > (current_capacity * 0.95)

        recommended_nr = current_active_count
        action = "MAINTAIN"
        reason = "System operating within optimal cost-capacity equilibrium"

        if capacity_threatened and optimal_nr > current_active_count:
            recommended_nr = optimal_nr
            action = "SCALE_UP"
            reason = f"Predicted demand ({drr:.0f} req/h) exceeds current capacity ({current_capacity} req/h). Scaling up."
        elif relative_improvement > self.damping_threshold and optimal_nr != current_active_count:
            if optimal_nr > current_active_count:
                recommended_nr = optimal_nr
                action = "SCALE_UP"
                reason = f"Activating {optimal_nr - current_active_count} server(s) reduces miss costs by ${cost_difference:.2f}/h."
            else:
                recommended_nr = optimal_nr
                action = "SCALE_DOWN"
                reason = f"Deactivating {current_active_count - optimal_nr} server(s) saves ${cost_difference:.2f}/h in storage/idle cost."

        # Compute specific server plan (RS1 to RS5)
        # Prioritize keeping servers active that have highest request history or manual overrides
        sorted_servers = sorted(
            current_servers,
            key=lambda s: (s.get('manual_override', False), s.get('cache_hits', 0)),
            reverse=True
        )

        server_plan = []
        for i, s in enumerate(current_servers):
            server_id = s.get('id', f'RS{i+1}')
            # Keep active first recommended_nr servers, unless manual override is set
            is_manual = s.get('manual_override', False)
            if is_manual:
                should_be_active = (s.get('status') == 'Active')
            else:
                should_be_active = (i < recommended_nr)

            server_plan.append({
                'server_id': server_id,
                'region': s.get('region', 'Unknown'),
                'current_status': s.get('status', 'Active'),
                'recommended_status': 'Active' if should_be_active else 'Inactive',
                'manual_override': is_manual
            })

        actual_new_active = sum(1 for p in server_plan if p['recommended_status'] == 'Active')
        actual_new_active = max(1, actual_new_active)

        new_eval = next((e for e in evaluations if e['active_servers'] == actual_new_active), best_candidate)
        new_cost = new_eval['total_cost']
        savings = max(0.0, current_cost - new_cost)

        return {
            'predicted_demand': round(drr, 1),
            'current_active_servers': current_active_count,
            'optimal_active_servers': recommended_nr,
            'action': action,
            'reason': reason,
            'current_cost_per_hour': current_cost,
            'optimized_cost_per_hour': new_cost,
            'estimated_hourly_savings': round(savings, 2),
            'server_plan': server_plan,
            'all_configurations': evaluations,
            'cost_parameters': {
                'storage_cost_per_server': self.cs,
                'miss_cost_coefficient': self.cm,
                'server_capacity_reqs': self.server_capacity_reqs
            }
        }
