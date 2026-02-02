import os
from dotenv import load_dotenv
from posthog.ai.gemini import Client
from posthog import Posthog

load_dotenv()

posthog = Posthog(
    os.environ["POSTHOG_API_KEY"],
    host=os.environ["POSTHOG_HOST"],
)

client = Client(
    api_key=os.environ["GEMINI_API_KEY"],
    posthog_client=posthog,
)

response = client.models.generate_content(
    model="gemini-2.5-flash",
    contents=["Tell me a fun fact about hedgehogs"],
    posthog_distinct_id="user_123",
    posthog_trace_id="trace_123",
    posthog_properties={"conversation_id": "abc123"},
)

print(response.text)
