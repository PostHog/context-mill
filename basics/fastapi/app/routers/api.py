"""API endpoints demonstrating PostHog integration patterns."""

from typing import Annotated

import posthog
from fastapi import APIRouter, Cookie, Form, Query
from fastapi.responses import JSONResponse
from posthog import capture, identify_context, new_context

from app.dependencies import RequiredUser

router = APIRouter()

MAX_BURRITO_COUNT = 10000


@router.post("/burrito/consider")
async def consider_burrito(
    current_user: RequiredUser,
    burrito_count: Annotated[int, Cookie()] = 0,
):
    """Track burrito consideration event."""
    safe_count = max(0, min(burrito_count, MAX_BURRITO_COUNT))
    new_count = safe_count + 1

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
    """Test endpoint demonstrating manual exception capture in PostHog."""
    should_capture = capture_param.lower() == "true"

    try:
        raise Exception("Test exception from critical operation")
    except Exception as e:
        if should_capture:
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
            return JSONResponse({"error": "Operation failed"}, status_code=500)


@router.post("/trigger-error")
async def trigger_error(
    current_user: RequiredUser,
    error_type: Annotated[str, Form()] = "generic",
):
    """Trigger different error types for testing error tracking."""
    error_messages = {
        "value": "Invalid value provided",
        "key": "Missing required key",
        "generic": "Generic test error",
    }

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
        with new_context():
            identify_context(current_user.email)
            posthog.capture_exception(e)
            capture(
                "error_triggered",
                properties={"error_type": safe_error_type, "error_message": error_message},
            )

        return JSONResponse(
            {
                "success": True,
                "message": "Error captured in PostHog",
                "error": error_message,
            }
        )
