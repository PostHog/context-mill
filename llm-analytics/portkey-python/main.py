import os
from dotenv import load_dotenv
from posthog.ai.openai import OpenAI
from posthog import Posthog

load_dotenv()

posthog = Posthog(
    os.environ["POSTHOG_API_KEY"],
    host=os.environ["POSTHOG_HOST"],
)

client = OpenAI(
    base_url="https://api.portkey.ai/v1",
    api_key=os.environ["OPENAI_API_KEY"],
        default_headers={
            "x-portkey-api-key": os.environ["PORTKEY_API_KEY"],
            "x-portkey-virtual-key": os.environ["PORTKEY_VIRTUAL_KEY"],
        },
    posthog_client=posthog,
)

response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[
        {"role": "user", "content": "Tell me a fun fact about hedgehogs"}
    ],
    posthog_distinct_id="user_123",
    posthog_trace_id="trace_123",
    posthog_properties={"conversation_id": "abc123"},
)

print(response.choices[0].message.content)
