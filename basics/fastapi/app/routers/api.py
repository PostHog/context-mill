"""API endpoints demonstrating PostHog integration patterns."""

from typing import Annotated

import posthog
from fastapi import APIRouter, Cookie, Form, Query
from fastapi.responses import JSONResponse
from posthog import capture, identify_context, new_context

from app.dependencies import RequiredUser

router = APIRouter()


@router.post("/burrito/consider")
async def consider_burrito(
    current_user: RequiredUser,
    burrito_count: Annotated[int, Cookie()] = 0,
):
    """Track burrito consideration event."""
    # Increment counter
    new_count = burrito_count + 1

    # PostHog: Capture custom event
    with new_context():
        identify_context(current_user.email)
        capture("burrito_considered", properties={"total_considerations": new_count})

    response = JSONResponse({"success": True, "count": new_count})
    response.set_cookie(
        key="burrito_count",
        value=str(new_count),
        httponly=True,
        samesite="lax",
    )
    return response


@router.post("/test-error")
async def test_error(
    current_user: RequiredUser,
    capture_param: Annotated[str, Query(alias="capture")] = "true",
):
    """Test endpoint demonstrating manual exception capture in PostHog.

    Shows how to intentionally capture specific errors in PostHog.
    Use this pattern for critical operations where you want error tracking.

    Query params:
    - capture: "true" to capture the exception in PostHog, "false" to just raise it
    """
    should_capture = capture_param.lower() == "true"

    try:
        # Simulate a critical operation failure
        raise Exception("Test exception from critical operation")
    except Exception as e:
        if should_capture:
            # Manually capture this specific exception in PostHog
            with new_context():
                identify_context(current_user.email)
                event_id = posthog.capture_exception(e)

            return JSONResponse(
                {
                    "error": "Operation failed",
                    "error_id": event_id,
                    "message": f"Error captured in PostHog. Reference ID: {event_id}",
                },
                status_code=500,
            )
        else:
            # Just return error without PostHog capture
            return JSONResponse({"error": str(e)}, status_code=500)


@router.post("/trigger-error")
async def trigger_error(
    current_user: RequiredUser,
    error_type: Annotated[str, Form()] = "generic",
):
    """Trigger different error types for testing error tracking.

    Form params:
    - error_type: "value", "key", or "generic"
    """
    try:
        if error_type == "value":
            raise ValueError("Invalid value provided")
        elif error_type == "key":
            raise KeyError("missing_key")
        else:
            raise Exception("Generic test error")
    except Exception as e:
        # Capture exception and event with user context
        with new_context():
            identify_context(current_user.email)
            posthog.capture_exception(e)
            capture(
                "error_triggered",
                properties={"error_type": error_type, "error_message": str(e)},
            )

        return JSONResponse(
            {
                "success": True,
                "message": "Error captured in PostHog",
                "error": str(e),
            }
        )
