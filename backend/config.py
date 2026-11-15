import os

BASE_DIR = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))
BACKEND_DIR = os.path.join(BASE_DIR, 'backend')
DATASETS_DIR = os.path.join(BASE_DIR, 'datasets')
MODELS_DIR = os.path.join(BASE_DIR, 'models')

os.makedirs(DATASETS_DIR, exist_ok=True)
os.makedirs(MODELS_DIR, exist_ok=True)

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'smartcdn-dev-secret-key-2025')
    DATABASE_PATH = os.path.join(BACKEND_DIR, 'smartcdn.db')
    SQLALCHEMY_DATABASE_URI = f"sqlite:///{DATABASE_PATH}"
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # CDN Default Parameters
    DEFAULT_STORAGE_COST_PER_SERVER = float(os.environ.get('STORAGE_COST_PER_SERVER', 15.0))  # $ per server / hr
    DEFAULT_MISS_COST_PER_REQUEST = float(os.environ.get('MISS_COST_PER_REQUEST', 0.05))     # $ per cache miss penalty
    DEFAULT_SERVER_CAPACITY_MB = int(os.environ.get('SERVER_CAPACITY_MB', 500))              # MB per replica server
    DEFAULT_ZIPF_ALPHA = float(os.environ.get('ZIPF_ALPHA', 0.5))                             # As in IEEE 2025 paper
    DEFAULT_NUM_OBJECTS = int(os.environ.get('NUM_OBJECTS', 100))
    DEFAULT_NUM_USERS = int(os.environ.get('NUM_USERS', 10000))
    DEFAULT_MAX_SERVERS = 5
    
    # Model Artifact Path
    MODEL_PATH = os.path.join(MODELS_DIR, 'demand_predictor.joblib')
    MODEL_METRICS_PATH = os.path.join(MODELS_DIR, 'model_metrics.json')
    DEFAULT_DATASET_PATH = os.path.join(DATASETS_DIR, 'synthetic_cdn_workload.csv')
