"""
Machine Learning Demand Predictor for SmartCDN
Predicts future request demand density (DRR) for replica servers (RS1-RS5)
using time-lag features, rolling statistics, and RandomForestRegressor.
"""
import os
import json
import joblib
import numpy as np
import pandas as pd
from typing import Dict, Any, List, Optional, Tuple
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from backend.config import Config

FEATURE_COLS = [
    'server_idx',
    'hour_of_day',
    'lag_1_requests',
    'lag_2_requests',
    'lag_3_requests',
    'rolling_mean_3',
    'traffic_intensity'
]

SERVER_MAP = {
    'RS1': 0,
    'RS2': 1,
    'RS3': 2,
    'RS4': 3,
    'RS5': 4
}
INV_SERVER_MAP = {v: k for k, v in SERVER_MAP.items()}

class DemandPredictor:
    def __init__(self, model_path: Optional[str] = None):
        self.model_path = model_path or Config.MODEL_PATH
        self.metrics_path = Config.MODEL_METRICS_PATH
        self.model: Optional[RandomForestRegressor] = None
        self.metrics: Dict[str, Any] = {}
        self.load_model()

    def load_model(self) -> bool:
        """Load trained model and metrics from disk if available."""
        if os.path.exists(self.model_path):
            try:
                self.model = joblib.load(self.model_path)
                if os.path.exists(self.metrics_path):
                    with open(self.metrics_path, 'r') as f:
                        self.metrics = json.load(f)
                return True
            except Exception as e:
                print(f"[DemandPredictor] Error loading model: {e}")
                self.model = None
        return False

    @staticmethod
    def prepare_features_from_dataframe(df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.Series]:
        """
        Aggregate raw requests into (server, hour) interval time series
        and extract lag and rolling features.
        """
        df_copy = df.copy()
        df_copy['timestamp'] = pd.to_datetime(df_copy['timestamp'])
        df_copy['hour_interval'] = df_copy['timestamp'].dt.floor('h')

        # Aggregate requests per server per hour
        agg = df_copy.groupby(['replica_server', 'hour_interval']).agg(
            request_count=('request_id', 'count'),
            avg_density=('request_density', 'mean')
        ).reset_index()

        agg = agg.sort_values(by=['replica_server', 'hour_interval']).reset_index(drop=True)

        feature_rows = []
        for server, group in agg.groupby('replica_server'):
            s_idx = SERVER_MAP.get(server, 0)
            group = group.reset_index(drop=True)
            reqs = group['request_count'].values
            hours = group['hour_interval'].dt.hour.values

            for i in range(len(group)):
                # Lags with safe padding
                l1 = reqs[i-1] if i >= 1 else reqs[i]
                l2 = reqs[i-2] if i >= 2 else l1
                l3 = reqs[i-3] if i >= 3 else l2
                rolling = float(np.mean([l1, l2, l3]))
                intensity = round(rolling / (np.mean(reqs) + 1e-5), 3)

                feature_rows.append({
                    'server_idx': s_idx,
                    'hour_of_day': int(hours[i]),
                    'lag_1_requests': float(l1),
                    'lag_2_requests': float(l2),
                    'lag_3_requests': float(l3),
                    'rolling_mean_3': float(rolling),
                    'traffic_intensity': float(intensity),
                    'target_requests': float(reqs[i])
                })

        feat_df = pd.DataFrame(feature_rows)
        X = feat_df[FEATURE_COLS]
        y = feat_df['target_requests']
        return X, y

    def train(self, df: pd.DataFrame, n_estimators: int = 100, random_state: int = 42) -> Dict[str, Any]:
        """
        Train RandomForestRegressor on workload DataFrame.
        Evaluates on 20% test split and records real MAE, RMSE, and R2.
        """
        if len(df) < 50:
            raise ValueError("Insufficient data records to train demand prediction model (requires >= 50 requests)")

        X, y = self.prepare_features_from_dataframe(df)

        if len(X) < 10:
            raise ValueError("Insufficient aggregated time intervals to train model.")

        # Train-test split (80/20)
        test_size = 0.2 if len(X) >= 20 else 0.1
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=random_state, shuffle=True
        )

        model = RandomForestRegressor(
            n_estimators=n_estimators,
            max_depth=12,
            min_samples_split=2,
            random_state=random_state,
            n_jobs=-1
        )
        model.fit(X_train, y_train)

        # Evaluate on held-out test set
        y_pred = model.predict(X_test)
        mae = float(mean_absolute_error(y_test, y_pred))
        rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))
        r2 = float(r2_score(y_test, y_pred))

        # Feature importances
        importances = dict(zip(FEATURE_COLS, [round(float(v), 4) for v in model.feature_importances_]))

        self.model = model
        self.metrics = {
            'trained': True,
            'total_samples': len(X),
            'train_samples': len(X_train),
            'test_samples': len(X_test),
            'mae': round(mae, 2),
            'rmse': round(rmse, 2),
            'r2_score': round(r2, 4),
            'feature_importances': importances,
            'model_type': 'RandomForestRegressor',
            'timestamp': pd.Timestamp.now().isoformat()
        }

        # Persist model and metrics
        os.makedirs(os.path.dirname(self.model_path), exist_ok=True)
        joblib.dump(self.model, self.model_path)
        with open(self.metrics_path, 'w') as f:
            json.dump(self.metrics, f, indent=2)

        return self.metrics

    def predict_next_interval(
        self,
        current_hour: int,
        server_histories: Dict[str, List[float]],
        traffic_factor: float = 1.0
    ) -> Dict[str, Dict[str, Any]]:
        """
        Predict demand for RS1–RS5 for the upcoming interval.
        Returns dict with predictions, confidence bounds, and comparison.
        """
        predictions = {}

        for server_id in ['RS1', 'RS2', 'RS3', 'RS4', 'RS5']:
            s_idx = SERVER_MAP[server_id]
            hist = server_histories.get(server_id, [200.0, 220.0, 210.0])
            
            l1 = hist[-1] if len(hist) >= 1 else 200.0
            l2 = hist[-2] if len(hist) >= 2 else l1
            l3 = hist[-3] if len(hist) >= 3 else l2
            rolling = float(np.mean([l1, l2, l3]))
            intensity = round(traffic_factor * (rolling / 200.0), 3)

            feat = pd.DataFrame([{
                'server_idx': s_idx,
                'hour_of_day': int(current_hour % 24),
                'lag_1_requests': float(l1),
                'lag_2_requests': float(l2),
                'lag_3_requests': float(l3),
                'rolling_mean_3': float(rolling),
                'traffic_intensity': float(intensity)
            }])[FEATURE_COLS]

            if self.model is not None:
                predicted_val = float(self.model.predict(feat)[0])
            else:
                # Fallback heuristic if model not yet trained
                predicted_val = float(rolling * traffic_factor * (1.0 + 0.15 * np.sin(current_hour * np.pi / 12.0)))

            predicted_val = max(10.0, predicted_val)
            # Estimate confidence margin based on model RMSE or 10%
            error_margin = self.metrics.get('rmse', 25.0)

            predictions[server_id] = {
                'server_id': server_id,
                'current_hour': current_hour,
                'predicted_demand': round(predicted_val, 1),
                'lower_bound': max(0.0, round(predicted_val - error_margin, 1)),
                'upper_bound': round(predicted_val + error_margin, 1),
                'lag_1': round(l1, 1),
                'rolling_mean_3': round(rolling, 1),
                'model_active': self.model is not None
            }

        return predictions
