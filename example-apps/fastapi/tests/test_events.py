"""The events this example demonstrates reach capture() with their properties."""


def event_names(posthog_calls):
    return [event for event, _ in posthog_calls["events"]]


def properties_for(posthog_calls, name):
    return [kwargs["properties"] for event, kwargs in posthog_calls["events"] if event == name]


def test_login_captures_user_logged_in(client, posthog_calls):
    client.post(
        "/",
        data={"email": "admin@example.com", "password": "admin"},
        follow_redirects=False,
    )

    assert "user_logged_in" in event_names(posthog_calls)


def test_signup_captures_user_signed_up_with_the_method(client, posthog_calls):
    client.post(
        "/signup",
        data={
            "email": "new@example.com",
            "password": "hunter2",
            "password_confirm": "hunter2",
        },
        follow_redirects=False,
    )

    properties = properties_for(posthog_calls, "user_signed_up")
    assert len(properties) == 1
    assert properties[0]["signup_method"] == "form"


def test_burrito_endpoint_captures_a_running_count(logged_in_client, posthog_calls):
    logged_in_client.post("/api/burrito/consider")
    logged_in_client.post("/api/burrito/consider")

    counts = [p["total_considerations"] for p in properties_for(posthog_calls, "burrito_considered")]
    assert counts == [1, 2]


def test_burrito_endpoint_requires_authentication(client, posthog_calls):
    response = client.post("/api/burrito/consider")

    assert response.status_code == 401
    assert "burrito_considered" not in event_names(posthog_calls)
