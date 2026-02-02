import os
from dotenv import load_dotenv
from posthog import Posthog
from posthog.ai.openai_agents import instrument
from agents import Agent, Runner

load_dotenv()

posthog = Posthog(
    os.environ["POSTHOG_API_KEY"],
    host=os.environ["POSTHOG_HOST"],
)

instrument(
    client=posthog,
    distinct_id="user_123",
    properties={"environment": "development"},
)

agent = Agent(
    name="Assistant",
    instructions="You are a helpful assistant.",
)

result = Runner.run_sync(agent, "Tell me a fun fact about hedgehogs")
print(result.final_output)
