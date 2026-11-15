import os
import sys

# Ensure root workspace is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from flask import Flask, jsonify, request, make_response
from backend.config import Config
from backend.database.db import init_db
from backend.routes import (
    dashboard_bp,
    simulation_bp,
    servers_bp,
    cache_bp,
    prediction_bp,
    optimization_bp,
    dataset_bp,
    comparison_bp
)

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Initialize SQLite Database & SQLAlchemy
    init_db(app)

    # Native robust CORS handler for all origins, headers and methods
    @app.before_request
    def handle_preflight():
        if request.method == "OPTIONS":
            response = make_response()
            response.headers.add("Access-Control-Allow-Origin", "*")
            response.headers.add("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Requested-With")
            response.headers.add("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS")
            return response

    @app.after_request
    def add_cors_headers(response):
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization,X-Requested-With"
        response.headers["Access-Control-Allow-Methods"] = "GET,PUT,POST,DELETE,OPTIONS"
        return response

    # Register API Blueprints
    app.register_blueprint(dashboard_bp, url_prefix='/api/dashboard')
    app.register_blueprint(simulation_bp, url_prefix='/api/simulation')
    app.register_blueprint(servers_bp, url_prefix='/api/servers')
    app.register_blueprint(cache_bp, url_prefix='/api/cache')
    app.register_blueprint(prediction_bp, url_prefix='/api/prediction')
    app.register_blueprint(optimization_bp, url_prefix='/api/optimization')
    app.register_blueprint(dataset_bp, url_prefix='/api/dataset')
    app.register_blueprint(comparison_bp, url_prefix='/api/comparison')

    @app.route('/api/health', methods=['GET'])
    def health_check():
        return jsonify({
            'status': 'healthy',
            'system': 'SmartCDN - Machine Learning-Based Adaptive Replica Server and Cache Optimization System',
            'version': '1.0.0',
            'ieee_paper_reference': 'Cost-balanced Adaptive Replica Server Cache Management under Time-Varying User Request Density in CCDNs (2025)'
        })

    @app.errorhandler(404)
    def not_found(error):
        return jsonify({'status': 'error', 'message': 'Resource not found', 'path': request.path}), 404

    @app.errorhandler(500)
    def internal_error(error):
        return jsonify({'status': 'error', 'message': 'Internal server error'}), 500

    return app

app = create_app()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"[*] Starting SmartCDN Backend Server on port {port}...")
    app.run(host='0.0.0.0', port=port, debug=True)
