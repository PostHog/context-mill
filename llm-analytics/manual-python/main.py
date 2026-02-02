import os
import time
from dotenv import load_dotenv
from posthog import Posthog
import openai

load_dotenv()

posthog = Posthog(
    os.environ["POSTHOG_API_KEY"],
    host=os.environ["POSTHOG_HOST"],
)

client = openai.OpenAI(api_key=os.environ["OPENAI_API_KEY"])

messages = [{"role": "user", "content": "Tell me a fun fact about hedgehogs"}]

start = time.time()
response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=messages,
)
latency = time.time() - start

posthog.capture(
    distinct_id="user_123",
    event="$ai_generation",
    properties={
        "$ai_trace_id": "trace_123",
        "$ai_model": "gpt-4o-mini",
        "$ai_provider": "openai",
        "$ai_input": messages,
        "$ai_input_tokens": response.usage.prompt_tokens,
        "$ai_output_choices": [
            {
                "role": "assistant",
                "content": response.choices[0].message.content,
            }
        ],
        "$ai_output_tokens": response.usage.completion_tokens,
        "$ai_latency": latency,
    },
)

print(response.choices[0].message.content)
