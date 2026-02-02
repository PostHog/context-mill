import os
from dotenv import load_dotenv
import dspy
import litellm

load_dotenv()

os.environ["POSTHOG_API_KEY"] = os.environ["POSTHOG_API_KEY"]
os.environ["POSTHOG_API_URL"] = os.environ["POSTHOG_HOST"]

litellm.success_callback = ["posthog"]
litellm.failure_callback = ["posthog"]

lm = dspy.LM("openai/gpt-4o-mini", api_key=os.environ["OPENAI_API_KEY"])
dspy.configure(lm=lm)


class QA(dspy.Signature):
    """Answer the question."""
    question: str = dspy.InputField()
    answer: str = dspy.OutputField()


predictor = dspy.Predict(QA)
result = predictor(question="What is a fun fact about hedgehogs?")
print(result.answer)
