import os
from dotenv import load_dotenv
from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider
from posthog.ai.openai import AsyncOpenAI
from posthog import Posthog

load_dotenv()

posthog = Posthog(
    os.environ["POSTHOG_API_KEY"],
    host=os.environ["POSTHOG_HOST"],
)

openai_client = AsyncOpenAI(
    api_key=os.environ["OPENAI_API_KEY"],
    posthog_client=posthog,
)

provider = OpenAIProvider(openai_client=openai_client)

model = OpenAIChatModel(
    "gpt-4o-mini",
    provider=provider,
)

agent = Agent(
    model,
    system_prompt="You are a helpful assistant.",
)

result = agent.run_sync("Tell me a fun fact about hedgehogs.")
print(result.output)
