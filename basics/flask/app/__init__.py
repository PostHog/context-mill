"""Flask application factory."""

import posthog
from flask import Flask, g, jsonify, render_template, request
from flask_login import current_user
from posthog import identify_context, new_context
from werkzeug.exceptions import HTTPException

from app.config import config
from app.extensions import db, login_manager


def create_app(config_name="default"):
    """Application factory."""
    app = Flask(__name__)
    app.config.from_object(config[config_name])

    # Initialize extensions
    db.init_app(app)
    login_manager.init_app(app)

    # Initialize PostHog
    if not app.config["POSTHOG_DISABLED"]:
        posthog.api_key = app.config["POSTHOG_API_KEY"]
        posthog.host = app.config["POSTHOG_HOST"]
        posthog.debug = app.config["DEBUG"]

    # Import models after db is initialized
    from app.models import User

    # User loader for Flask-Login
    @login_manager.user_loader
    def load_user(user_id):
        return User.get_by_id(user_id)

    # Simple error handlers - no automatic PostHog capture
    # Capture exceptions manually only where it makes sense (e.g., test endpoints)
    @app.errorhandler(404)
    def page_not_found(e):
        if request.path.startswith('/api/'):
            return jsonify({"error": "Not found"}), 404
        return render_template('errors/404.html'), 404

    @app.errorhandler(500)
    def internal_server_error(e):
        if request.path.startswith('/api/'):
            return jsonify({"error": "Internal server error"}), 500
        return render_template('errors/500.html'), 500

    # Register blueprints
    from app.api import api_bp
    from app.main import main_bp

    app.register_blueprint(main_bp)
    app.register_blueprint(api_bp, url_prefix="/api")

    # Create database tables and seed default admin user
    with app.app_context():
        db.create_all()
        if not User.get_by_email("admin@example.com"):
            User.create_user(
                email="admin@example.com",
                password="admin",
                is_staff=True,
            )

    return app
