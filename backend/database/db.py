from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

def init_db(app):
    db.init_app(app)
    with app.app_context():
        # Import models so tables are registered
        from backend.models import database_models  # noqa
        db.create_all()
