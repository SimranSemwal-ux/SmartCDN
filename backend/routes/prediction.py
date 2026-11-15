import os
import pandas as pd
from datetime import datetime, timezone
from flask import Blueprint, jsonify, request
from backend.config import Config
from backend.ml.demand_predictor import DemandPredictor
from backend.simulation.cdn_simulator import CDNSimulator

prediction_bp = Blueprint('prediction', __name__)
predictor = DemandPredictor()

@prediction_bp.route('/train', methods=['POST'])
def train_model():
    data = request.get_json(silent=True) or {}
    dataset_path = data.get('dataset_path', Config.DEFAULT_DATASET_PATH)

    if not os.path.exists(dataset_path):
        return jsonify({
            'status': 'error',
            'message': f'Dataset not found at {dataset_path}. Please generate a dataset first in Dataset Management.'
        }), 404

    try:
        df = pd.read_csv(dataset_path)
        metrics = predictor.train(df, n_estimators=int(data.get('n_estimators', 100)))
        return jsonify({
            'status': 'success',
            'message': 'RandomForestRegressor demand prediction model trained successfully on held-out test data',
            'metrics': metrics
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'Training failed: {str(e)}'
        }), 500

@prediction_bp.route('/results', methods=['GET'])
def get_prediction_results():
    sim = CDNSimulator.get_instance()
    
    # Check if model exists
    is_trained = predictor.model is not None

    current_hour = datetime.now(timezone.utc).hour
    
    # Collect demand histories from replica servers
    server_histories = {
        sid: srv['history_demand'] for sid, srv in sim.servers.items()
    }

    # Generate next interval predictions
    predictions = predictor.predict_next_interval(
        current_hour=current_hour,
        server_histories=server_histories,
        traffic_factor=sim.traffic_intensity
    )

    # Historical vs predicted comparison series for RS1-RS5
    comparison_chart = []
    for sid in ['RS1', 'RS2', 'RS3', 'RS4', 'RS5']:
        hist = server_histories.get(sid, [100.0])
        actual = hist[-1] if hist else 100.0
        pred = predictions[sid]['predicted_demand']
        diff = round(abs(actual - pred), 1)
        err_pct = round((diff / (actual + 1e-5)) * 100.0, 1)

        comparison_chart.append({
            'server_id': sid,
            'region': sim.servers[sid]['region'],
            'actual_demand': round(actual, 1),
            'predicted_demand': pred,
            'lower_bound': predictions[sid]['lower_bound'],
            'upper_bound': predictions[sid]['upper_bound'],
            'absolute_error': diff,
            'error_percent': min(100.0, err_pct)
        })

    return jsonify({
        'status': 'success',
        'data': {
            'is_trained': is_trained,
            'metrics': predictor.metrics if is_trained else {
                'trained': False,
                'message': 'ML Model not yet trained. Click "Train Model" to fit RandomForest on historical workload dataset.'
            },
            'predictions': predictions,
            'comparison': comparison_chart,
            'current_hour': current_hour
        }
    })

@prediction_bp.route('/status', methods=['GET'])
def get_prediction_status():
    return jsonify({
        'status': 'success',
        'data': {
            'is_trained': predictor.model is not None,
            'metrics': predictor.metrics
        }
    })
