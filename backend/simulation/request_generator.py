"""
Synthetic Request Generator for SmartCDN
Generates realistic CDN request traces based on:
- Zipf distribution for content popularity (alpha = 0.5 default from IEEE 2025 paper)
- 24-hour temporal patterns (diurnal curve, peak-hour surges, low-demand troughs, sudden spikes)
- Regional time-zone shifts across 5 geographical regions
- 10,000 users, 100 content objects, 5 replica servers
"""
import os
import random
import numpy as np
import pandas as pd
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional

REGIONS = [
    {"region": "US-East (Virginia)", "server": "RS1", "tz_offset": -5},
    {"region": "US-West (California)", "server": "RS2", "tz_offset": -8},
    {"region": "EU-Central (Frankfurt)", "server": "RS3", "tz_offset": 1},
    {"region": "AP-East (Tokyo)", "server": "RS4", "tz_offset": 9},
    {"region": "AP-South (Singapore)", "server": "RS5", "tz_offset": 8},
]

CONTENT_CATEGORIES = [
    {"category": "Video Streaming", "avg_size": 18.5, "weight": 0.35},
    {"category": "High-Res Image", "avg_size": 4.2, "weight": 0.25},
    {"category": "JavaScript Bundle", "avg_size": 1.8, "weight": 0.20},
    {"category": "REST API Payload", "avg_size": 0.4, "weight": 0.12},
    {"category": "Static Document", "avg_size": 2.5, "weight": 0.08},
]

class SyntheticWorkloadGenerator:
    def __init__(
        self,
        num_users: int = 10000,
        num_objects: int = 100,
        num_servers: int = 5,
        total_requests: int = 100000,
        time_span_hours: int = 24,
        zipf_alpha: float = 0.5,
        seed: Optional[int] = 42
    ):
        self.num_users = int(num_users)
        self.num_objects = int(num_objects)
        self.num_servers = min(5, int(num_servers))
        self.total_requests = int(total_requests)
        self.time_span_hours = int(time_span_hours)
        self.zipf_alpha = float(zipf_alpha)
        self.seed = seed

        if seed is not None:
            np.random.seed(seed)
            random.seed(seed)

        self.content_catalog = self._generate_content_catalog()

    def _generate_content_catalog(self) -> List[Dict[str, Any]]:
        """Generate content catalog with Zipfian theoretical popularity distribution."""
        ranks = np.arange(1, self.num_objects + 1)
        # Zipf probability p(r) = (1 / r^alpha) / sum(1 / i^alpha)
        zipf_weights = 1.0 / (ranks ** self.zipf_alpha)
        zipf_probs = zipf_weights / zipf_weights.sum()

        catalog = []
        for i in range(self.num_objects):
            obj_id = f"OBJ-{i+1:03d}"
            # Choose category
            cat_weights = [c["weight"] for c in CONTENT_CATEGORIES]
            cat_idx = np.random.choice(len(CONTENT_CATEGORIES), p=cat_weights)
            cat_info = CONTENT_CATEGORIES[cat_idx]
            
            # Size in MB with small variance
            size = max(0.2, np.random.normal(cat_info["avg_size"], cat_info["avg_size"] * 0.2))
            
            catalog.append({
                "content_id": obj_id,
                "name": f"Asset-{obj_id}-{cat_info['category'].split()[0]}",
                "size_mb": round(float(size), 2),
                "category": cat_info["category"],
                "popularity_score": round(float(zipf_probs[i]), 6),
                "zipf_rank": int(ranks[i])
            })
        return catalog

    def _get_hourly_intensity(self, hour: int, region_offset: int) -> float:
        """
        Calculates traffic intensity factor (0.2 to 2.5) for a given hour
        incorporating diurnal wave, peak surge, low trough, and regional time shift.
        """
        # Local hour in region
        local_hour = (hour + region_offset) % 24

        # Base diurnal sinusoidal pattern: peak at 20:00 (8pm), trough at 04:00 (4am)
        # sin((local_hour - 14) * pi / 12) reaches max 1 at hour 20, min -1 at hour 8
        base_wave = 1.0 + 0.6 * np.sin((local_hour - 8) * np.pi / 12.0)

        # Evening peak surge multiplier (19:00 to 23:00)
        peak_multiplier = 1.0
        if 19 <= local_hour <= 23:
            peak_multiplier = 1.35
        elif 2 <= local_hour <= 6:
            peak_multiplier = 0.45

        # Stochastic continuous fluctuation (5% to 15% noise)
        noise = np.random.normal(1.0, 0.08)

        # Occasional flash crowd spike in hour 14 or 21
        spike = 1.0
        if local_hour in [14, 21] and np.random.rand() < 0.3:
            spike = 1.45

        intensity = base_wave * peak_multiplier * noise * spike
        return max(0.15, intensity)

    def generate_dataframe(self) -> pd.DataFrame:
        """
        Generate complete synthetic CDN request dataset.
        Returns Pandas DataFrame matching Section 8 requirements.
        """
        if self.seed is not None:
            np.random.seed(self.seed)
            random.seed(self.seed)

        base_time = datetime(2025, 10, 1, 0, 0, 0, tzinfo=timezone.utc)
        
        # Calculate regional hourly weights
        hourly_weights = []
        for h in range(self.time_span_hours):
            reg_weights = []
            for r_idx in range(self.num_servers):
                reg_info = REGIONS[r_idx]
                w = self._get_hourly_intensity(h, reg_info["tz_offset"])
                reg_weights.append(w)
            hourly_weights.append(reg_weights)

        # Flatten into grid of (hour, server)
        grid_weights = np.array(hourly_weights) # shape: (time_span_hours, num_servers)
        prob_grid = grid_weights / grid_weights.sum()

        # Content sampling probabilities from Zipf catalog
        content_probs = [item["popularity_score"] for item in self.content_catalog]
        content_probs = np.array(content_probs) / sum(content_probs)
        content_ids = [item["content_id"] for item in self.content_catalog]

        # Allocate request counts to each (hour, server) cell
        cell_counts = np.random.multinomial(self.total_requests, prob_grid.flatten())
        cell_counts = cell_counts.reshape(self.time_span_hours, self.num_servers)

        rows = []
        req_id_counter = 1

        for h in range(self.time_span_hours):
            hour_start = base_time + timedelta(hours=h)
            for s_idx in range(self.num_servers):
                r_info = REGIONS[s_idx]
                server_id = r_info["server"]
                region_name = r_info["region"]
                num_cell_reqs = cell_counts[h, s_idx]

                if num_cell_reqs == 0:
                    continue

                # Sample contents according to Zipf distribution
                sampled_content_indices = np.random.choice(
                    self.num_objects, size=num_cell_reqs, p=content_probs
                )
                
                # Sample users
                sampled_users = np.random.randint(1, self.num_users + 1, size=num_cell_reqs)
                
                # Second offsets within the hour
                sec_offsets = np.sort(np.random.randint(0, 3600, size=num_cell_reqs))

                # Local request density for this cell
                density = float(num_cell_reqs)
                server_load = min(98.5, max(8.0, 15.0 + (density / (self.total_requests / (self.time_span_hours * self.num_servers))) * 45.0 + np.random.normal(0, 2.0)))

                for i in range(num_cell_reqs):
                    c_idx = sampled_content_indices[i]
                    content_meta = self.content_catalog[c_idx]
                    req_time = hour_start + timedelta(seconds=int(sec_offsets[i]))
                    user_str = f"USR-{sampled_users[i]:05d}"
                    
                    # Popularity-based baseline hit probability (higher rank = higher hit rate)
                    pop = content_meta["popularity_score"]
                    is_hit = 1 if (np.random.rand() < min(0.92, 0.35 + pop * 3.5)) else 0
                    
                    # Simulated response time (hits ~12-28ms, misses ~90-210ms)
                    if is_hit == 1:
                        resp_time = round(float(np.random.normal(18.5, 3.5)), 2)
                    else:
                        resp_time = round(float(np.random.normal(145.0, 25.0)), 2)

                    rows.append({
                        "request_id": f"REQ-{req_id_counter:07d}",
                        "timestamp": req_time.strftime("%Y-%m-%d %H:%M:%S"),
                        "user_id": user_str,
                        "region": region_name,
                        "content_id": content_meta["content_id"],
                        "replica_server": server_id,
                        "request_count": 1,
                        "cache_hit": is_hit,
                        "response_time": max(5.0, resp_time),
                        "server_load": round(server_load, 1),
                        "content_popularity": content_meta["popularity_score"],
                        "request_density": round(density, 1)
                    })
                    req_id_counter += 1

        df = pd.DataFrame(rows)
        return df

    def save_to_csv(self, file_path: str) -> pd.DataFrame:
        """Generate and save workload dataset to CSV."""
        df = self.generate_dataframe()
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        df.to_csv(file_path, index=False)
        return df
