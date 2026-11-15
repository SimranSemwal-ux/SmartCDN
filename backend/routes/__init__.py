from backend.routes.dashboard import dashboard_bp
from backend.routes.simulation import simulation_bp
from backend.routes.servers import servers_bp
from backend.routes.cache import cache_bp
from backend.routes.prediction import prediction_bp
from backend.routes.optimization import optimization_bp
from backend.routes.dataset import dataset_bp
from backend.routes.comparison import comparison_bp

__all__ = [
    'dashboard_bp',
    'simulation_bp',
    'servers_bp',
    'cache_bp',
    'prediction_bp',
    'optimization_bp',
    'dataset_bp',
    'comparison_bp'
]
