"""
Proposed Adaptive Cost-Aware Caching Algorithm
Inspired by CARSCM (Cost-balanced Adaptive Replica Server Cache Management, IEEE 2025).

Calculates multi-factor utility score based on:
1. Content popularity p(c) and recent access frequency
2. Local request density (DRR)
3. Content size S(c)
4. Cache miss cost penalty (Cm)
5. Server storage cost (Cs)

Utility Function:
U(c) = [ (p(c) + alpha * access_count) * Cm * (1 + beta * log(1 + local_density)) ] / [ (S(c) * Cs) + eps ]

Admission & Eviction Rule:
- When full, identifies cached object with lowest utility score U_min.
- Only admits candidate if U_cand > U_min * (1 + margin).
- Evicts lowest-utility object(s) to make room.
- Otherwise bypasses caching to minimize storage costs and avoid displacing valuable content.
"""
import math
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List, Tuple

class AdaptiveCostAwareCache:
    def __init__(
        self,
        capacity_mb: float = 500.0,
        storage_cost_per_mb: float = 0.03,  # Cs
        miss_cost_per_req: float = 0.05,     # Cm
        admission_margin: float = 0.05      # 5% margin to prevent thrashing
    ):
        self.capacity_mb = float(capacity_mb)
        self.storage_cost_per_mb = float(storage_cost_per_mb)
        self.miss_cost_per_req = float(miss_cost_per_req)
        self.admission_margin = float(admission_margin)
        
        self.used_mb = 0.0
        # cache maps content_id -> dict with size_mb, access_count, cached_at, last_accessed, utility_score, metadata
        self.cache: Dict[str, Dict[str, Any]] = {}
        
        # Access and popularity history across all requests
        self.content_access_history: Dict[str, int] = {}
        self.local_density = 100.0  # requests per interval
        
        self.total_hits = 0
        self.total_misses = 0
        self.total_bypasses = 0
        self.total_evictions = 0
        self.eviction_history: List[Dict[str, Any]] = []

    def set_local_density(self, density: float):
        """Update localized request density (DRR) for the current interval."""
        self.local_density = max(1.0, float(density))

    def calculate_utility(self, content_id: str, size_mb: float, metadata: Optional[Dict[str, Any]] = None) -> float:
        """
        Calculate dynamic utility score for a content item.
        Higher score means higher caching value (high popularity, small size, high miss penalty).
        """
        meta = metadata or {}
        base_pop = float(meta.get('popularity_score', 0.5))
        access_cnt = self.content_access_history.get(content_id, 1)
        
        # Logarithmic density factor
        density_factor = math.log1p(self.local_density / 50.0)
        
        numerator = (base_pop + 0.15 * min(access_cnt, 20)) * self.miss_cost_per_req * (1.0 + 0.25 * density_factor)
        denominator = (max(0.1, size_mb) * self.storage_cost_per_mb) + 0.001
        
        utility = numerator / denominator
        return round(utility, 4)

    def get(self, content_id: str) -> Optional[Dict[str, Any]]:
        """Lookup content in cache."""
        self.content_access_history[content_id] = self.content_access_history.get(content_id, 0) + 1
        
        if content_id in self.cache:
            self.total_hits += 1
            item = self.cache[content_id]
            item['access_count'] += 1
            item['last_accessed'] = datetime.now(timezone.utc).isoformat()
            # Recalculate utility with updated access count
            item['utility_score'] = self.calculate_utility(content_id, item['size_mb'], item.get('metadata'))
            return item
        
        self.total_misses += 1
        return None

    def put(self, content_id: str, size_mb: float, metadata: Optional[Dict[str, Any]] = None) -> Tuple[bool, List[str]]:
        """
        Evaluate candidate object against adaptive utility threshold and cache capacity.
        """
        if size_mb > self.capacity_mb:
            return False, []

        candidate_utility = self.calculate_utility(content_id, size_mb, metadata)

        # If already cached, refresh metadata and utility
        if content_id in self.cache:
            item = self.cache[content_id]
            self.used_mb -= item['size_mb']
            item['size_mb'] = size_mb
            item['last_accessed'] = datetime.now(timezone.utc).isoformat()
            item['utility_score'] = candidate_utility
            self.used_mb += size_mb
            return True, []

        evicted: List[str] = []

        # If cache has sufficient free space, admit directly
        free_space = self.capacity_mb - self.used_mb
        if free_space >= size_mb:
            self.cache[content_id] = {
                'content_id': content_id,
                'size_mb': size_mb,
                'cached_at': datetime.now(timezone.utc).isoformat(),
                'last_accessed': datetime.now(timezone.utc).isoformat(),
                'access_count': self.content_access_history.get(content_id, 1),
                'utility_score': candidate_utility,
                'metadata': metadata or {}
            }
            self.used_mb += size_mb
            return True, []

        # Cache is congested: Evaluate candidate utility vs existing cached items
        sorted_items = sorted(self.cache.items(), key=lambda kv: kv[1]['utility_score'])
        lowest_utility = sorted_items[0][1]['utility_score'] if sorted_items else 0.0

        # If candidate utility does not exceed lowest utility plus margin, bypass caching!
        if candidate_utility <= lowest_utility * (1.0 + self.admission_margin):
            self.total_bypasses += 1
            return False, []

        # Candidate is valuable enough: evict lowest utility items until space is made
        needed_space = size_mb - free_space
        freed_space = 0.0

        for victim_id, victim_data in sorted_items:
            # Check if victim has lower utility than candidate
            if victim_data['utility_score'] >= candidate_utility:
                break
            
            del self.cache[victim_id]
            self.used_mb -= victim_data['size_mb']
            freed_space += victim_data['size_mb']
            self.total_evictions += 1
            evicted.append(victim_id)

            self.eviction_history.append({
                'content_id': victim_id,
                'size_mb': victim_data['size_mb'],
                'utility_score': victim_data['utility_score'],
                'evicted_at': datetime.now(timezone.utc).isoformat(),
                'reason': f'LOW_UTILITY_EVICTED (Candidate {content_id} U={candidate_utility} > {victim_data["utility_score"]})',
                'access_count': victim_data.get('access_count', 1)
            })
            if len(self.eviction_history) > 100:
                self.eviction_history.pop(0)

            if freed_space >= needed_space:
                break

        # If we successfully freed enough space, insert candidate
        if (self.capacity_mb - self.used_mb) >= size_mb:
            self.cache[content_id] = {
                'content_id': content_id,
                'size_mb': size_mb,
                'cached_at': datetime.now(timezone.utc).isoformat(),
                'last_accessed': datetime.now(timezone.utc).isoformat(),
                'access_count': self.content_access_history.get(content_id, 1),
                'utility_score': candidate_utility,
                'metadata': metadata or {}
            }
            self.used_mb += size_mb
            return True, evicted
        else:
            # Could not free enough space without evicting higher utility items
            self.total_bypasses += 1
            return False, evicted

    def clear(self):
        self.cache.clear()
        self.content_access_history.clear()
        self.used_mb = 0.0
        self.total_hits = 0
        self.total_misses = 0
        self.total_bypasses = 0
        self.total_evictions = 0
        self.eviction_history = []

    def get_stats(self) -> Dict[str, Any]:
        total = self.total_hits + self.total_misses
        hit_ratio = (self.total_hits / total * 100) if total > 0 else 0.0
        return {
            'algorithm': 'Proposed Adaptive Cost-aware Caching',
            'inspired_by': 'CARSCM (IEEE 2025)',
            'capacity_mb': round(self.capacity_mb, 2),
            'used_mb': round(self.used_mb, 2),
            'usage_percent': round((self.used_mb / self.capacity_mb * 100), 2) if self.capacity_mb > 0 else 0.0,
            'total_items': len(self.cache),
            'total_hits': self.total_hits,
            'total_misses': self.total_misses,
            'total_bypasses': self.total_bypasses,
            'hit_ratio': round(hit_ratio, 2),
            'total_evictions': self.total_evictions,
            'local_density': round(self.local_density, 2),
            'storage_cost_per_mb': self.storage_cost_per_mb,
            'miss_cost_per_req': self.miss_cost_per_req,
            'eviction_history': self.eviction_history[-10:]
        }
