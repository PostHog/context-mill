import os
from dotenv import load_dotenv
from posthog.ai.langchain import CallbackHandler
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from posthog import Posthog

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

prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a helpful assistant."),
    ("user", "{input}"),
])

model = ChatOpenAI(openai_api_key=os.environ["OPENAI_API_KEY"])
chain = prompt | model

response = chain.invoke(
    {"input": "Tell me a fun fact about hedgehogs"},
    config={"callbacks": [callback_handler]},
)

print(response.content)
