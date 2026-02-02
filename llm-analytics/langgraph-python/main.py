import os
from dotenv import load_dotenv
from posthog.ai.langchain import CallbackHandler
from posthog import Posthog
from langgraph.prebuilt import create_react_agent
from langchain_openai import ChatOpenAI
from langchain_core.tools import tool

load_dotenv()

posthog = Posthog(
    os.environ["POSTHOG_API_KEY"],
    host=os.environ["POSTHOG_HOST"],
)

callback_handler = CallbackHandler(
    client=posthog,
    distinct_id="user_123",
    trace_id="trace_456",
    properties={"conversation_id": "abc123"},
)


@tool
def get_weather(city: str) -> str:
    """Get the weather for a given city."""
    return f"It's always sunny in {city}!"


model = ChatOpenAI(api_key=os.environ["OPENAI_API_KEY"])
agent = create_react_agent(model, tools=[get_weather])

result = agent.invoke(
    {"messages": [{"role": "user", "content": "What's the weather in Paris?"}]},
    config={"callbacks": [callback_handler]},
)

print(result["messages"][-1].content)
