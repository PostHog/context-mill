import os
from dotenv import load_dotenv
import instructor
from pydantic import BaseModel
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

client = instructor.from_openai(openai_client)


class UserInfo(BaseModel):
    name: str
    age: int


user = client.chat.completions.create(
    model="gpt-4o-mini",
    response_model=UserInfo,
    messages=[
        {"role": "user", "content": "John Doe is 30 years old."}
    ],
    posthog_distinct_id="user_123",
    posthog_trace_id="trace_123",
    posthog_properties={"conversation_id": "abc123"},
)

print(f"{user.name} is {user.age} years old")
