import os
import io
import pandas as pd
from datetime import datetime, timezone
from flask import Blueprint, jsonify, request, send_file, Response
from werkzeug.utils import secure_filename
from backend.config import Config
from backend.simulation.request_generator import SyntheticWorkloadGenerator
from backend.database.db import db
from backend.models.database_models import DatasetMetadata

dataset_bp = Blueprint('dataset', __name__)

@dataset_bp.route('/generate', methods=['POST'])
def generate_dataset():
    data = request.get_json(silent=True) or {}
    
    num_users = int(data.get('num_users', 10000))
    num_objects = int(data.get('num_objects', 100))
    num_servers = int(data.get('num_servers', 5))
    total_requests = int(data.get('total_requests', 100000))
    time_span_hours = int(data.get('time_span_hours', 24))
    zipf_alpha = float(data.get('zipf_alpha', 0.5))
    seed = int(data.get('seed', 42))

    filename = f"synthetic_workload_{int(datetime.now(timezone.utc).timestamp())}.csv"
    file_path = os.path.join(Config.DATASETS_DIR, filename)

    generator = SyntheticWorkloadGenerator(
        num_users=num_users,
        num_objects=num_objects,
        num_servers=num_servers,
        total_requests=total_requests,
        time_span_hours=time_span_hours,
        zipf_alpha=zipf_alpha,
        seed=seed
    )
    df = generator.save_to_csv(file_path)

    # Also update default dataset symlink / file
    df.to_csv(Config.DEFAULT_DATASET_PATH, index=False)

    # Save metadata record
    meta = DatasetMetadata(
        name=f"Zipf-a{zipf_alpha}-N{total_requests}",
        filename=filename,
        record_count=len(df),
        user_count=num_users,
        content_count=num_objects,
        time_span_hours=time_span_hours,
        zipf_alpha=zipf_alpha,
        created_at=datetime.now(timezone.utc),
        file_path=file_path
    )
    db.session.add(meta)
    db.session.commit()

    return jsonify({
        'status': 'success',
        'message': f'Successfully generated synthetic CDN dataset with {len(df):,} records',
        'dataset': meta.to_dict()
    })

@dataset_bp.route('/preview', methods=['GET'])
def preview_dataset():
    file_path = request.args.get('path', Config.DEFAULT_DATASET_PATH)

    if not os.path.exists(file_path):
        return jsonify({
            'status': 'error',
            'message': 'No dataset found. Please click "Generate Dataset" to create synthetic workload trace.'
        }), 404

    df = pd.read_csv(file_path)

    # Basic stats
    total_records = len(df)
    missing_values = df.isnull().sum().to_dict()
    
    # Columns metadata
    columns_info = []
    for col in df.columns:
        columns_info.append({
            'column': col,
            'type': str(df[col].dtype),
            'unique_values': int(df[col].nunique()),
            'null_count': int(missing_values.get(col, 0))
        })

    # Summary statistics for numeric columns
    numeric_summary = {}
    for col in df.select_dtypes(include=['number']).columns:
        desc = df[col].describe()
        numeric_summary[col] = {
            'mean': round(float(desc['mean']), 2),
            'std': round(float(desc['std']), 2),
            'min': round(float(desc['min']), 2),
            '25%': round(float(desc['25%']), 2),
            '50%': round(float(desc['50%']), 2),
            '75%': round(float(desc['75%']), 2),
            'max': round(float(desc['max']), 2)
        }

    # First 50 rows preview
    preview_rows = df.head(50).to_dict(orient='records')

    return jsonify({
        'status': 'success',
        'data': {
            'filename': os.path.basename(file_path),
            'total_records': total_records,
            'total_columns': len(df.columns),
            'columns': columns_info,
            'numeric_summary': numeric_summary,
            'missing_values': missing_values,
            'preview': preview_rows
        }
    })

@dataset_bp.route('/download', methods=['GET'])
def download_dataset():
    file_path = request.args.get('path', Config.DEFAULT_DATASET_PATH)
    if not os.path.exists(file_path):
        return jsonify({'status': 'error', 'message': 'Dataset file not found'}), 404

    return send_file(
        file_path,
        mimetype='text/csv',
        as_attachment=True,
        download_name='smartcdn_workload_dataset.csv'
    )

@dataset_bp.route('/upload', methods=['POST'])
def upload_dataset():
    if 'file' not in request.files:
        return jsonify({'status': 'error', 'message': 'No file uploaded in request'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'status': 'error', 'message': 'Empty file selected'}), 400

    filename = secure_filename(file.filename)
    save_path = os.path.join(Config.DATASETS_DIR, f"uploaded_{filename}")
    file.save(save_path)

    # Validate CSV structure
    try:
        df = pd.read_csv(save_path)
        required_cols = {'request_id', 'timestamp', 'replica_server', 'content_id'}
        missing = required_cols - set(df.columns)
        if missing:
            return jsonify({
                'status': 'warning',
                'message': f"CSV uploaded, but missing recommended columns: {list(missing)}",
                'records': len(df)
            })

        # Save metadata
        meta = DatasetMetadata(
            name=f"Upload-{filename}",
            filename=filename,
            record_count=len(df),
            user_count=int(df['user_id'].nunique()) if 'user_id' in df.columns else 0,
            content_count=int(df['content_id'].nunique()) if 'content_id' in df.columns else 0,
            time_span_hours=24,
            zipf_alpha=0.5,
            created_at=datetime.now(timezone.utc),
            file_path=save_path
        )
        db.session.add(meta)
        db.session.commit()

        # Update default dataset
        df.to_csv(Config.DEFAULT_DATASET_PATH, index=False)

        return jsonify({
            'status': 'success',
            'message': f'Uploaded {filename} successfully ({len(df):,} records)',
            'metadata': meta.to_dict()
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': f'Failed to parse CSV: {str(e)}'}), 400
