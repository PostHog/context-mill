"""API endpoints demonstrating PostHog integration patterns."""

import posthog
from flask import jsonify, request, session
from flask_login import current_user, login_required
from posthog import capture, identify_context, new_context

from app.api import api_bp


@api_bp.route("/burrito/consider", methods=["POST"])
@login_required
def consider_burrito():
    """Track burrito consideration event."""
    # Increment session counter
    burrito_count = session.get("burrito_count", 0) + 1
    session["burrito_count"] = burrito_count

    # PostHog: Capture custom event
    with new_context():
        identify_context(current_user.email)
        capture("burrito_considered", properties={"total_considerations": burrito_count})

    return jsonify({"success": True, "count": burrito_count})


@api_bp.route("/test-error", methods=["POST"])
@login_required
def test_error():
    """Test endpoint to manually trigger errors for PostHog error tracking verification.

    Only server errors (5xx) are captured in PostHog.
    Client errors (4xx) are not captured as they represent user issues, not bugs.

    Query params:
    - error_type: "server" (500), "client" (400), "not_found" (404)
    """
    error_type = request.args.get("error_type", "server")

    if error_type == "client":
        # Client error (400) - NOT captured in PostHog
        from werkzeug.exceptions import BadRequest
        raise BadRequest("Invalid request - this is a client error and won't be captured")
    elif error_type == "not_found":
        # 404 error - NOT captured in PostHog
        from werkzeug.exceptions import NotFound
        raise NotFound("Resource not found - this won't be captured")
    else:
        # Server error (500) - WILL be captured in PostHog
        raise Exception("Test server error - this WILL be captured in PostHog")

    return jsonify({"success": True})


@api_bp.route("/group-analytics", methods=["GET", "POST"])
@login_required
def group_analytics():
    """Demonstrate group analytics."""
    # PostHog: Group identify
    posthog.group_identify(
        "company",
        "acme-corp",
        {"name": "Acme Corporation", "plan": "enterprise", "employee_count": 500},
    )

    # Capture event with group association
    with new_context():
        identify_context(current_user.email)
        capture(
            "feature_used",
            properties={"feature_name": "group_analytics"},
            groups={"company": "acme-corp"},
        )

    return jsonify({"success": True, "message": "Group analytics event captured"})
