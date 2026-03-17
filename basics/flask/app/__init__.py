"""Flask application factory."""

from flask import Flask, g, jsonify, render_template, request
from flask_login import current_user
from werkzeug.exceptions import HTTPException

from app.config import config
from app.extensions import db, login_manager
from app.posthog_client import posthog


def create_app(config_name="default"):
    """Application factory."""
    app = Flask(__name__)
    app.config.from_object(config[config_name])

    # Initialize extensions
    db.init_app(app)
    login_manager.init_app(app)

    # Import models after db is initialized
    from app.models import User

    # User loader for Flask-Login
    @login_manager.user_loader
    def load_user(user_id):
        return User.get_by_id(user_id)

    # Error handlers with automatic PostHog exception capture
    @app.errorhandler(Exception)
    def handle_exception(e):
        """Capture unhandled exceptions in PostHog for error tracking."""
        if not isinstance(e, HTTPException):
            posthog.capture_exception(e)
        if isinstance(e, HTTPException) and e.code == 404:
            if request.path.startswith('/api/'):
                return jsonify({"error": "Not found"}), 404
            return render_template('errors/404.html'), 404
        if request.path.startswith('/api/'):
            return jsonify({"error": "Internal server error"}), 500
        return render_template('errors/500.html'), 500

    @app.errorhandler(404)
    def page_not_found(e):
        if request.path.startswith('/api/'):
            return jsonify({"error": "Not found"}), 404
        return render_template('errors/404.html'), 404

    @app.errorhandler(500)
    def internal_server_error(e):
        posthog.capture_exception(e)
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
