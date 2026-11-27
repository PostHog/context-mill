"""Core view functions demonstrating PostHog integration patterns."""

from flask import current_app, flash, redirect, render_template, request, session, url_for
from flask_login import current_user, login_required, login_user, logout_user
from posthog import identify_context, new_context

from app.main import main_bp
from app.models import User


@main_bp.route("/", methods=["GET", "POST"])
def home():
    """Home and login page."""
    if current_user.is_authenticated:
        return redirect(url_for("main.dashboard"))

    if request.method == "POST":
        email = (request.form.get("email") or "").strip()
        password = request.form.get("password") or ""

        # Reject empty credentials before authentication and omit analytics calls when no user resolves.
        if not email or not password:
            flash("Email and password are required", "error")
            return render_template("home.html")

        user = User.authenticate(email, password)
        if user:
            login_user(user)

            posthog_client = current_app.extensions.get("posthog")
            if posthog_client:
                user_id = str(user.id)
                with new_context(client=posthog_client):
                    identify_context(user_id)
                    # PII belongs in person properties via set(), never in event properties.
                    posthog_client.set(
                        distinct_id=user_id,
                        properties={
                            "email": user.email,
                            "is_staff": user.is_staff,
                            "date_joined": user.date_joined.isoformat(),
                        },
                    )
                    posthog_client.capture(
                        "user_logged_in",
                        properties={"login_method": "password"},
                    )

            return redirect(url_for("main.dashboard"))

        flash("Invalid email or password", "error")

    return render_template("home.html")


@main_bp.route("/signup", methods=["GET", "POST"])
def signup():
    """User registration page."""
    if current_user.is_authenticated:
        return redirect(url_for("main.dashboard"))

    if request.method == "POST":
        email = (request.form.get("email") or "").strip()
        password = request.form.get("password") or ""
        password_confirm = request.form.get("password_confirm") or ""

        # Validate signup input before creating a user so invalid submissions never emit analytics.
        if not email or not password:
            flash("Email and password are required", "error")
        elif password != password_confirm:
            flash("Passwords do not match", "error")
        elif User.get_by_email(email):
            flash("Email already registered", "error")
        else:
            user = User.create_user(
                email=email,
                password=password,
                is_staff=False,
            )

            posthog_client = current_app.extensions.get("posthog")
            if posthog_client:
                user_id = str(user.id)
                with new_context(client=posthog_client):
                    identify_context(user_id)
                    posthog_client.set(
                        distinct_id=user_id,
                        properties={
                            "email": user.email,
                            "is_staff": user.is_staff,
                            "date_joined": user.date_joined.isoformat(),
                        },
                    )
                    posthog_client.capture(
                        "user_signed_up",
                        properties={"signup_method": "form"},
                    )

            login_user(user)
            flash("Account created successfully!", "success")
            return redirect(url_for("main.dashboard"))

    return render_template("signup.html")


@main_bp.route("/logout")
@login_required
def logout():
    """Logout and capture event."""
    # Capture logout while current_user is still authenticated and before logout_user() clears the session.
    posthog_client = current_app.extensions.get("posthog")
    if posthog_client:
        identify_context(str(current_user.id))
        posthog_client.capture("user_logged_out")

    logout_user()
    return redirect(url_for("main.home"))


@main_bp.route("/dashboard")
@login_required
def dashboard():
    """Dashboard with feature flag demonstration."""
    user_id = str(current_user.id)
    posthog_client = current_app.extensions.get("posthog")

    if posthog_client:
        identify_context(user_id)
        posthog_client.capture(
            "dashboard_viewed",
            properties={"is_staff": current_user.is_staff},
        )
        show_new_feature = posthog_client.feature_enabled(
            "new-dashboard-feature",
            user_id,
            person_properties={
                "email": current_user.email,
                "is_staff": current_user.is_staff,
            },
        )
        feature_config = posthog_client.get_feature_flag_payload(
            "new-dashboard-feature", user_id
        )
    else:
        show_new_feature = False
        feature_config = None

    return render_template(
        "dashboard.html",
        show_new_feature=show_new_feature,
        feature_config=feature_config,
    )


@main_bp.route("/burrito")
@login_required
def burrito():
    """Burrito consideration tracker page."""
    burrito_count = session.get("burrito_count", 0)
    return render_template("burrito.html", burrito_count=burrito_count)


@main_bp.route("/profile")
@login_required
def profile():
    """User profile page."""
    posthog_client = current_app.extensions.get("posthog")
    if posthog_client:
        identify_context(str(current_user.id))
        posthog_client.capture("profile_viewed")

    return render_template("profile.html")
