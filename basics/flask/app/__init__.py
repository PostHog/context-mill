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

    # Global error handler for PostHog exception capture
    # Production best practice: Only capture server errors (5xx), not client errors (4xx)
    @app.errorhandler(Exception)
    def handle_exception(e):
        # Skip capturing client errors (4xx) - these are user issues, not bugs
        # Only capture server errors (5xx) and unhandled exceptions
        event_id = None
        if isinstance(e, HTTPException):
            if e.code < 500:
                # Client error (4xx) - don't capture, just handle normally
                if request.path.startswith('/api/'):
                    return jsonify({"error": e.description}), e.code
                return e.get_response()

        # Server error (5xx) or unhandled exception - capture in PostHog
        with new_context():
            if current_user.is_authenticated:
                identify_context(current_user.email)
            event_id = posthog.capture_exception(e)

        # For API routes, return JSON error response
        if request.path.startswith('/api/'):
            if isinstance(e, HTTPException):
                return jsonify({
                    "error": e.description,
                    "error_id": event_id,
                    "message": f"An error occurred. Reference ID: {event_id}"
                }), e.code
            return jsonify({
                "error": "Internal server error",
                "error_id": event_id,
                "message": f"An error occurred. Reference ID: {event_id}"
            }), 500

        # For web routes, render 500 error page with error_id
        # (All 5xx HTTPExceptions reach here; 4xx are handled above)
        return render_template('errors/500.html', error_id=event_id, error=str(e) if not isinstance(e, HTTPException) else None), 500

    # Specific handler for 404 - no PostHog capture
    @app.errorhandler(404)
    def page_not_found(e):
        if request.path.startswith('/api/'):
            return jsonify({"error": "Not found"}), 404
        return render_template('errors/404.html'), 404

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
