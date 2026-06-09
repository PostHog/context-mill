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
    """Test endpoint demonstrating manual exception capture in PostHog.

    Shows how to intentionally capture specific errors in PostHog.
    Use this pattern for critical operations where you want error tracking.

    Query params:
    - capture: "true" to capture the exception in PostHog, "false" to just raise it
    """
    should_capture = request.args.get("capture", "true").lower() == "true"

    try:
        # Simulate a critical operation failure
        raise Exception("Test exception from critical operation")
    except Exception as e:
        if should_capture:
            # Manually capture this specific exception in PostHog
            with new_context():
                identify_context(current_user.email)
                event_id = posthog.capture_exception(e)

            return jsonify({
                "error": "Operation failed",
                "error_id": event_id,
                "message": f"Error captured in PostHog. Reference ID: {event_id}"
            }), 500
        else:
            # Just return error without PostHog capture
            return jsonify({"error": str(e)}), 500


