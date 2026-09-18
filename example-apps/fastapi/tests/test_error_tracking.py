"""The error endpoints hand the exception to PostHog and surface its event id."""


def test_test_error_captures_the_exception_and_returns_its_id(logged_in_client, posthog_calls):
    response = logged_in_client.post("/api/test-error")

    assert response.status_code == 500
    assert response.json()["error_id"] == "test-event-id"
    assert len(posthog_calls["exceptions"]) == 1


def test_test_error_can_skip_the_capture(logged_in_client, posthog_calls):
    response = logged_in_client.post("/api/test-error?capture=false")

    assert response.status_code == 500
    assert "error_id" not in response.json()
    assert posthog_calls["exceptions"] == []


def test_trigger_error_captures_both_the_exception_and_an_event(logged_in_client, posthog_calls):
    response = logged_in_client.post("/api/trigger-error", data={"error_type": "value"})

    assert response.status_code == 200
    assert len(posthog_calls["exceptions"]) == 1
    assert isinstance(posthog_calls["exceptions"][0], ValueError)

    events = [event for event, _ in posthog_calls["events"]]
    assert "error_triggered" in events


def test_trigger_error_falls_back_to_a_generic_error(logged_in_client, posthog_calls):
    logged_in_client.post("/api/trigger-error", data={"error_type": "not-a-real-type"})

    types = [
        kwargs["properties"]["error_type"]
        for event, kwargs in posthog_calls["events"]
        if event == "error_triggered"
    ]
    assert types == ["generic"]
