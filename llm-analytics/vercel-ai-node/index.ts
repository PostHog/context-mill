import "dotenv/config";
import { PostHog } from "posthog-node";
import { withTracing } from "@posthog/ai";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

const phClient = new PostHog(process.env.POSTHOG_API_KEY!, {
  host: process.env.POSTHOG_HOST,
});

const openaiClient = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  compatibility: "strict",
});

const model = withTracing(openaiClient("gpt-4o-mini"), phClient, {
  posthogDistinctId: "user_123",
  posthogTraceId: "trace_123",
  posthogProperties: { conversationId: "abc123" },
});

const { text } = await generateText({
  model,
  prompt: "Tell me a fun fact about hedgehogs",
});

console.log(text);

phClient.shutdown();
