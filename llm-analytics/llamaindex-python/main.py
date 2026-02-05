import os
from dotenv import load_dotenv
from llama_index.llms.openai import OpenAI as LlamaOpenAI
from posthog.ai.openai import OpenAI
from posthog import Posthog

load_dotenv()

posthog = Posthog(
    os.environ["POSTHOG_API_KEY"],
    host=os.environ["POSTHOG_HOST"],
)

openai_client = OpenAI(
    api_key=os.environ["OPENAI_API_KEY"],
    posthog_client=posthog,
)

llm = LlamaOpenAI(
    model="gpt-4o-mini",
    api_key=os.environ["OPENAI_API_KEY"],
)
llm._client = openai_client

response = llm.complete("Tell me a fun fact about hedgehogs")
print(response)
