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


@api_bp.route("/trigger-error", methods=["POST"])
@login_required
def trigger_error():
    """Demonstrate error tracking."""
    error_type = request.form.get("error_type", "generic")

    try:
        if error_type == "value":
            raise ValueError("Invalid value provided by user")
        elif error_type == "key":
            data = {}
            _ = data["nonexistent_key"]
        else:
            raise Exception("A generic error occurred")
    except Exception as e:
        # PostHog: Capture exception and track error event with user context
        with new_context():
            identify_context(current_user.email)
            posthog.capture_exception(e)
            capture(
                "error_triggered",
                properties={"error_type": error_type, "error_message": str(e)},
            )

        return (
            jsonify(
                {
                    "success": False,
                    "error": "An error occurred",
                    "message": "Error has been captured by PostHog",
                }
            ),
            400,
        )

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
