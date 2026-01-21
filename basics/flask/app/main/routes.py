"""Core view functions demonstrating PostHog integration patterns."""

import posthog
from flask import flash, redirect, render_template, request, session, url_for
from flask_login import current_user, login_required, login_user, logout_user
from posthog import capture, identify_context, new_context, tag

from app.main import main_bp
from app.models import User


@main_bp.route("/", methods=["GET", "POST"])
def home():
    """Home/login page."""
    if current_user.is_authenticated:
        return redirect(url_for("main.dashboard"))

    if request.method == "POST":
        email = request.form.get("email")
        password = request.form.get("password")

        user = User.authenticate(email, password)
        if user:
            login_user(user)

            # PostHog: Identify user and capture login event
            with new_context():
                identify_context(user.email)

                # Set person properties (PII goes in tag, not capture)
                tag("email", user.email)
                tag("is_staff", user.is_staff)
                tag("date_joined", user.date_joined.isoformat())

                capture("user_logged_in", properties={"login_method": "password"})

            return redirect(url_for("main.dashboard"))
        else:
            flash("Invalid email or password", "error")

    return render_template("home.html")


@main_bp.route("/signup", methods=["GET", "POST"])
def signup():
    """User registration page."""
    if current_user.is_authenticated:
        return redirect(url_for("main.dashboard"))

    if request.method == "POST":
        email = request.form.get("email")
        password = request.form.get("password")
        password_confirm = request.form.get("password_confirm")

        # Validation
        if not email or not password:
            flash("Email and password are required", "error")
        elif password != password_confirm:
            flash("Passwords do not match", "error")
        elif User.get_by_email(email):
            flash("Email already registered", "error")
        else:
            # Create new user
            user = User.create_user(
                email=email,
                password=password,
                is_staff=False,
            )

            # PostHog: Identify new user and capture signup event
            with new_context():
                identify_context(user.email)

                tag("email", user.email)
                tag("is_staff", user.is_staff)
                tag("date_joined", user.date_joined.isoformat())

                capture("user_signed_up", properties={"signup_method": "form"})

            # Log the user in
            login_user(user)
            flash("Account created successfully!", "success")
            return redirect(url_for("main.dashboard"))

    return render_template("signup.html")


@main_bp.route("/logout")
@login_required
def logout():
    """Logout and capture event."""
    # PostHog: Capture logout event before session ends
    with new_context():
        identify_context(current_user.email)
        capture("user_logged_out")

    logout_user()
    return redirect(url_for("main.home"))


@main_bp.route("/dashboard")
@login_required
def dashboard():
    """Dashboard with feature flag demonstration."""
    # PostHog: Capture dashboard view
    with new_context():
        identify_context(current_user.email)
        capture("dashboard_viewed", properties={"is_staff": current_user.is_staff})

    # Check feature flag
    show_new_feature = posthog.feature_enabled(
        "new-dashboard-feature",
        current_user.email,
        person_properties={
            "email": current_user.email,
            "is_staff": current_user.is_staff,
        },
    )

    # Get feature flag payload
    feature_config = posthog.get_feature_flag_payload(
        "new-dashboard-feature", current_user.email
    )

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
    # PostHog: Capture profile view
    with new_context():
        identify_context(current_user.email)
        capture("profile_viewed")

    return render_template("profile.html")
