import os
from dotenv import load_dotenv
from posthog.ai.anthropic import AnthropicBedrock
from posthog import Posthog

load_dotenv()

posthog = Posthog(
    os.environ["POSTHOG_API_KEY"],
    host=os.environ["POSTHOG_HOST"],
)

client = AnthropicBedrock(
    aws_region=os.environ.get("AWS_REGION", "us-east-1"),
    posthog_client=posthog,
)

message = client.messages.create(
    model="anthropic.claude-sonnet-4-20250514",
    max_tokens=1024,
    messages=[
        {"role": "user", "content": "Tell me a fun fact about hedgehogs"}
    ],
    posthog_distinct_id="user_123",
    posthog_trace_id="trace_123",
    posthog_properties={"conversation_id": "abc123"},
)

print(message.content[0].text)
