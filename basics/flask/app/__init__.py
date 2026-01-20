"""Flask application factory."""

import posthog
from flask import Flask, jsonify
from flask_login import current_user
from posthog import identify_context, new_context

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

    # Global error handler for PostHog exception capture
    # Flask's built-in error handlers bypass PostHog's default autocapture,
    # so we need to manually capture exceptions here
    @app.errorhandler(Exception)
    def handle_exception(e):
        # Capture the exception in PostHog and get the event UUID
        # This UUID can be shown to users for bug reports
        # Use context to attribute exception to the current user
        with new_context():
            if current_user.is_authenticated:
                identify_context(current_user.email)
            event_id = posthog.capture_exception(e)

        # For API routes, return JSON error response
        if hasattr(e, "code"):
            status_code = e.code
        else:
            status_code = 500

        return (
            jsonify(
                {
                    "error": str(e),
                    "error_id": event_id,
                    "message": "An error occurred. Reference ID: "
                    + (event_id or "unknown"),
                }
            ),
            status_code,
        )

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
