"""API endpoints demonstrating PostHog integration patterns."""

from flask import current_app, jsonify, request, session
from flask_login import current_user, login_required
from posthog import identify_context

from app.api import api_bp


@api_bp.route("/burrito/consider", methods=["POST"])
@login_required
def consider_burrito():
    """Track burrito consideration event."""
    burrito_count = session.get("burrito_count", 0) + 1
    session["burrito_count"] = burrito_count

    posthog_client = current_app.extensions.get("posthog")
    if posthog_client:
        identify_context(str(current_user.id))
        posthog_client.capture(
            "burrito_considered",
            properties={"total_considerations": burrito_count},
        )

    return jsonify({"success": True, "count": burrito_count})


@api_bp.route("/trigger-error", methods=["POST"])
@login_required
def trigger_error():
    """Trigger different error types for testing error tracking."""
    error_messages = {
        "value": "Invalid value provided",
        "key": "Missing required key",
        "generic": "Generic test error",
    }

    error_type = request.form.get("error_type", "generic")
    safe_error_type = error_type if error_type in error_messages else "generic"
    error_message = error_messages[safe_error_type]

    try:
        if safe_error_type == "value":
            raise ValueError(error_message)
        elif safe_error_type == "key":
            raise KeyError("missing_key")
        else:
            raise Exception(error_message)
    except Exception as e:
        posthog_client = current_app.extensions.get("posthog")
        if posthog_client:
            identify_context(str(current_user.id))
            posthog_client.capture_exception(e)
            posthog_client.capture(
                "error_triggered",
                properties={
                    "error_type": safe_error_type,
                    "error_message": error_message,
                },
            )

        return jsonify(
            {
                "success": True,
                "message": "Error captured in PostHog",
                "error": error_message,
            }
        )


@api_bp.route("/test-error", methods=["POST"])
@login_required
def test_error():
    """Test endpoint demonstrating manual exception capture in PostHog."""
    should_capture = request.args.get("capture", "true").lower() == "true"

    try:
        raise Exception("Test exception from critical operation")
    except Exception as e:
        if should_capture:
            posthog_client = current_app.extensions.get("posthog")
            if posthog_client:
                identify_context(str(current_user.id))
                event_id = posthog_client.capture_exception(e)
            else:
                event_id = None

            return jsonify(
                {
                    "error": "Operation failed",
                    "error_id": event_id,
                    "message": f"Error captured in PostHog. Reference ID: {event_id}",
                }
            ), 500

        return jsonify({"error": str(e)}), 500
