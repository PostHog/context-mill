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
    base_url="https://api.perplexity.ai",
    api_key=os.environ["PERPLEXITY_API_KEY"],
    posthog_client=posthog,
)

response = client.chat.completions.create(
    model="sonar",
    messages=[
        {"role": "user", "content": "Tell me a fun fact about hedgehogs"}
    ],
    posthog_distinct_id="user_123",
    posthog_trace_id="trace_123",
    posthog_properties={"conversation_id": "abc123"},
)

print(response.choices[0].message.content)
