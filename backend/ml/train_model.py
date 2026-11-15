"""
Model Training Script for SmartCDN
Generates a baseline synthetic dataset if needed and trains the RandomForest demand predictor.
"""
import os
import sys

# Ensure backend path is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from backend.config import Config
from backend.simulation.request_generator import SyntheticWorkloadGenerator
from backend.ml.demand_predictor import DemandPredictor

def train_baseline_model(force_regenerate: bool = False):
    print("=" * 60)
    print("SmartCDN: Demand Prediction ML Model Training Pipeline")
    print("=" * 60)

    dataset_path = Config.DEFAULT_DATASET_PATH
    
    if force_regenerate or not os.path.exists(dataset_path):
        print(f"[Dataset] Generating baseline synthetic dataset at: {dataset_path}")
        generator = SyntheticWorkloadGenerator(
            num_users=10000,
            num_objects=100,
            num_servers=5,
            total_requests=100000,
            time_span_hours=24,
            zipf_alpha=0.5,
            seed=42
        )
        df = generator.save_to_csv(dataset_path)
        print(f"[Dataset] Generated {len(df)} request records.")
    else:
        print(f"[Dataset] Loading existing dataset from: {dataset_path}")
        import pandas as pd
        df = pd.read_csv(dataset_path)
        print(f"[Dataset] Loaded {len(df)} records.")

    predictor = DemandPredictor()
    print("[ML] Training RandomForestRegressor demand predictor...")
    metrics = predictor.train(df, n_estimators=100, random_state=42)

    print("\n--- Training Results on Held-out Test Data ---")
    print(f"Total time intervals : {metrics['total_samples']}")
    print(f"Train samples        : {metrics['train_samples']}")
    print(f"Test samples         : {metrics['test_samples']}")
    print(f"MAE                  : {metrics['mae']} requests")
    print(f"RMSE                 : {metrics['rmse']} requests")
    print(f"R² Score             : {metrics['r2_score']}")
    print(f"Feature Importances  : {metrics['feature_importances']}")
    print(f"Model saved to       : {predictor.model_path}")
    print("=" * 60)
    return metrics

if __name__ == '__main__':
    train_baseline_model()
