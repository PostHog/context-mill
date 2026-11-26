"""Flask application factory."""

import atexit

from flask import Flask, jsonify, render_template, request
from flask_login import current_user
from posthog import Posthog, identify_context
from posthog.integrations.flask import PosthogFlaskIntegration

from app.config import config
from app.extensions import db, login_manager


def create_app(config_name="default"):
    """Application factory."""
    app = Flask(__name__)
    app.config.from_object(config[config_name])

    # Initialize extensions
    db.init_app(app)
    login_manager.init_app(app)

    # Construct the PostHog client before blueprint registration only when a real token is configured,
    # leaving app.extensions["posthog"] as None instead of passing an empty or placeholder key.
    token = (app.config.get("POSTHOG_PROJECT_TOKEN") or "").strip()
    if not app.config["POSTHOG_DISABLED"] and token:
        posthog_client = Posthog(
            token,
            host=app.config["POSTHOG_HOST"],
            enable_exception_autocapture=True,
            debug=app.config["DEBUG"],
        )
        PosthogFlaskIntegration(app, client=posthog_client)
        atexit.register(posthog_client.shutdown)
        app.extensions["posthog"] = posthog_client
    else:
        app.extensions["posthog"] = None
        if not app.config["POSTHOG_DISABLED"] and app.config["DEBUG"]:
            app.logger.warning(
                "POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, "
                "this causes events to be silently missed. This error stops appearing once POSTHOG_PROJECT_TOKEN is configured"
            )

    @app.before_request
    def identify_authenticated_request():
        # Only identify the request context when a signed-in user exists, never with a shared fallback ID.
        if current_user.is_authenticated:
            identify_context(str(current_user.id))

    # Import models after db is initialized
    from app.models import User

    # User loader for Flask-Login
    @login_manager.user_loader
    def load_user(user_id):
        return User.get_by_id(user_id)

    # Error page renderers (PosthogFlaskIntegration already captures unhandled route exceptions)
    @app.errorhandler(404)
    def page_not_found(e):
        if request.path.startswith("/api/"):
            return jsonify({"error": "Not found"}), 404
        return render_template("errors/404.html"), 404

    @app.errorhandler(500)
    def internal_server_error(e):
        if request.path.startswith("/api/"):
            return jsonify({"error": "Internal server error"}), 500
        return render_template("errors/500.html"), 500

    # Register blueprints after PostHog initialization
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
