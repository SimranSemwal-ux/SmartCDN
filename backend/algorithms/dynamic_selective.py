"""
Dynamic Selective Caching Implementation for SmartCDN
Filters content admission based on a configurable request-frequency / Kth-miss threshold.
Only admits objects requested >= K times to avoid cache pollution from one-hit wonders.
Evicts using LRU when capacity is reached.
"""
from collections import OrderedDict
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List, Tuple

class DynamicSelectiveCache:
    def __init__(self, capacity_mb: float = 500.0, admission_threshold_k: int = 2):
        self.capacity_mb = float(capacity_mb)
        self.admission_threshold_k = int(admission_threshold_k)
        self.used_mb = 0.0
        self.cache: OrderedDict[str, Dict[str, Any]] = OrderedDict()
        
        # Track frequency of requests/misses before admission
        self.request_counter: Dict[str, int] = {}
        
        self.total_hits = 0
        self.total_misses = 0
        self.total_bypasses = 0
        self.total_evictions = 0
        self.eviction_history: List[Dict[str, Any]] = []

    def get(self, content_id: str) -> Optional[Dict[str, Any]]:
        """Lookup content in cache."""
        if content_id in self.cache:
            self.total_hits += 1
            self.cache.move_to_end(content_id)
            item = self.cache[content_id]
            item['access_count'] += 1
            item['last_accessed'] = datetime.now(timezone.utc).isoformat()
            return item
        
        self.total_misses += 1
        return None

    def put(self, content_id: str, size_mb: float, metadata: Optional[Dict[str, Any]] = None) -> Tuple[bool, List[str]]:
        """
        Admit content into Dynamic Selective cache only if request_counter >= K.
        Otherwise increments counter and bypasses cache insertion.
        """
        if size_mb > self.capacity_mb:
            return False, []

        # If already cached, update and move to MRU
        if content_id in self.cache:
            old_item = self.cache.pop(content_id)
            self.used_mb -= old_item['size_mb']
            item_data = {
                'content_id': content_id,
                'size_mb': size_mb,
                'cached_at': old_item.get('cached_at', datetime.now(timezone.utc).isoformat()),
                'last_accessed': datetime.now(timezone.utc).isoformat(),
                'access_count': old_item.get('access_count', 1) + 1,
                'metadata': metadata or {}
            }
            self.cache[content_id] = item_data
            self.used_mb += size_mb
            return True, []

        # Track observed frequency
        curr_freq = self.request_counter.get(content_id, 0) + 1
        self.request_counter[content_id] = curr_freq

        # Check selective threshold
        if curr_freq < self.admission_threshold_k:
            self.total_bypasses += 1
            return False, []  # Bypassed cache admission

        evicted: List[str] = []
        # Evict LRU items if capacity exceeded
        while (self.used_mb + size_mb) > self.capacity_mb and len(self.cache) > 0:
            evicted_id, evicted_item = self.cache.popitem(last=False)
            self.used_mb -= evicted_item['size_mb']
            self.total_evictions += 1
            evicted.append(evicted_id)
            self.eviction_history.append({
                'content_id': evicted_id,
                'size_mb': evicted_item['size_mb'],
                'evicted_at': datetime.now(timezone.utc).isoformat(),
                'reason': 'CAPACITY_EXCEEDED_SELECTIVE',
                'access_count': evicted_item.get('access_count', 1)
            })
            if len(self.eviction_history) > 100:
                self.eviction_history.pop(0)

        item_data = {
            'content_id': content_id,
            'size_mb': size_mb,
            'cached_at': datetime.now(timezone.utc).isoformat(),
            'last_accessed': datetime.now(timezone.utc).isoformat(),
            'access_count': curr_freq,
            'metadata': metadata or {}
        }
        self.cache[content_id] = item_data
        self.used_mb += size_mb
        return True, evicted

    def clear(self):
        self.cache.clear()
        self.request_counter.clear()
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
            'algorithm': 'Dynamic Selective Caching',
            'admission_threshold_k': self.admission_threshold_k,
            'capacity_mb': round(self.capacity_mb, 2),
            'used_mb': round(self.used_mb, 2),
            'usage_percent': round((self.used_mb / self.capacity_mb * 100), 2) if self.capacity_mb > 0 else 0.0,
            'total_items': len(self.cache),
            'total_hits': self.total_hits,
            'total_misses': self.total_misses,
            'total_bypasses': self.total_bypasses,
            'hit_ratio': round(hit_ratio, 2),
            'total_evictions': self.total_evictions,
            'eviction_history': self.eviction_history[-10:]
        }
