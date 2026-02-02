import os
from dotenv import load_dotenv
from posthog.ai.langchain import CallbackHandler
from posthog import Posthog
from crewai import Agent, Task, Crew

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

researcher = Agent(
    role="Researcher",
    goal="Find interesting facts about hedgehogs",
    backstory="You are an expert wildlife researcher.",
    callbacks=[callback_handler],
)

task = Task(
    description="Research three fun facts about hedgehogs.",
    expected_output="A list of three fun facts.",
    agent=researcher,
)

crew = Crew(
    agents=[researcher],
    tasks=[task],
)

result = crew.kickoff()
print(result)
