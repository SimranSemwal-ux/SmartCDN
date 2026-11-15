"""
LRU (Least Recently Used) Cache Implementation for SmartCDN
Evicts the least recently accessed content object when cache capacity is reached.
"""
from collections import OrderedDict
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List, Tuple

class LRUCache:
    def __init__(self, capacity_mb: float = 500.0):
        self.capacity_mb = float(capacity_mb)
        self.used_mb = 0.0
        # OrderedDict maintains insertion / access order: key -> metadata dict
        self.cache: OrderedDict[str, Dict[str, Any]] = OrderedDict()
        self.total_hits = 0
        self.total_misses = 0
        self.total_evictions = 0
        self.eviction_history: List[Dict[str, Any]] = []

    def get(self, content_id: str) -> Optional[Dict[str, Any]]:
        """Lookup content in cache. Moves to end if hit (most recently used)."""
        if content_id in self.cache:
            self.total_hits += 1
            # Move to end to mark as most recently used
            self.cache.move_to_end(content_id)
            item = self.cache[content_id]
            item['access_count'] += 1
            item['last_accessed'] = datetime.now(timezone.utc).isoformat()
            return item
        
        self.total_misses += 1
        return None

    def put(self, content_id: str, size_mb: float, metadata: Optional[Dict[str, Any]] = None) -> Tuple[bool, List[str]]:
        """
        Admit content into LRU cache.
        If size exceeds capacity or cache is full, evict least recently used items until space is available.
        Returns (success, list_of_evicted_content_ids).
        """
        if size_mb > self.capacity_mb:
            return False, []

        evicted: List[str] = []

        # If already in cache, update size and move to end
        if content_id in self.cache:
            old_item = self.cache.pop(content_id)
            self.used_mb -= old_item['size_mb']

        # Evict LRU items from beginning of OrderedDict while needed
        while (self.used_mb + size_mb) > self.capacity_mb and len(self.cache) > 0:
            evicted_id, evicted_item = self.cache.popitem(last=False)
            self.used_mb -= evicted_item['size_mb']
            self.total_evictions += 1
            evicted.append(evicted_id)
            self.eviction_history.append({
                'content_id': evicted_id,
                'size_mb': evicted_item['size_mb'],
                'evicted_at': datetime.now(timezone.utc).isoformat(),
                'reason': 'LRU_CAPACITY_EXCEEDED',
                'access_count': evicted_item.get('access_count', 1)
            })
            if len(self.eviction_history) > 100:
                self.eviction_history.pop(0)

        # Insert new item
        item_data = {
            'content_id': content_id,
            'size_mb': size_mb,
            'cached_at': datetime.now(timezone.utc).isoformat(),
            'last_accessed': datetime.now(timezone.utc).isoformat(),
            'access_count': 1,
            'metadata': metadata or {}
        }
        self.cache[content_id] = item_data
        self.used_mb += size_mb
        return True, evicted

    def clear(self):
        self.cache.clear()
        self.used_mb = 0.0
        self.total_hits = 0
        self.total_misses = 0
        self.total_evictions = 0
        self.eviction_history = []

    def get_stats(self) -> Dict[str, Any]:
        total = self.total_hits + self.total_misses
        hit_ratio = (self.total_hits / total * 100) if total > 0 else 0.0
        return {
            'algorithm': 'LRU',
            'capacity_mb': round(self.capacity_mb, 2),
            'used_mb': round(self.used_mb, 2),
            'usage_percent': round((self.used_mb / self.capacity_mb * 100), 2) if self.capacity_mb > 0 else 0.0,
            'total_items': len(self.cache),
            'total_hits': self.total_hits,
            'total_misses': self.total_misses,
            'hit_ratio': round(hit_ratio, 2),
            'total_evictions': self.total_evictions,
            'eviction_history': self.eviction_history[-10:]
        }
