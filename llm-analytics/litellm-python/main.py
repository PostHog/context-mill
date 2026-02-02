import os
from dotenv import load_dotenv
import litellm

load_dotenv()

os.environ["POSTHOG_API_KEY"] = os.environ["POSTHOG_API_KEY"]
os.environ["POSTHOG_API_URL"] = os.environ["POSTHOG_HOST"]

litellm.success_callback = ["posthog"]
litellm.failure_callback = ["posthog"]

response = litellm.completion(
    model="gpt-4o-mini",
    messages=[
        {"role": "user", "content": "Tell me a fun fact about hedgehogs"}
    ],
    metadata={
        "user_id": "user_123",
    },
)

print(response.choices[0].message.content)
