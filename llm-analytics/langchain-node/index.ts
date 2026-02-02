import "dotenv/config";
import { PostHog } from "posthog-node";
import { LangChainCallbackHandler } from "@posthog/ai";
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";

const phClient = new PostHog(process.env.POSTHOG_API_KEY!, {
  host: process.env.POSTHOG_HOST,
});

const callbackHandler = new LangChainCallbackHandler({
  client: phClient,
  distinctId: "user_123",
  traceId: "trace_456",
  properties: { conversationId: "abc123" },
});

const prompt = ChatPromptTemplate.fromMessages([
  ["system", "You are a helpful assistant."],
  ["user", "{input}"],
]);

const model = new ChatOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const chain = prompt.pipe(model);

const response = await chain.invoke(
  { input: "Tell me a fun fact about hedgehogs" },
  { callbacks: [callbackHandler] },
);

console.log(response.content);

phClient.shutdown();
