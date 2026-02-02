import "dotenv/config";
import { OpenAI } from "@posthog/ai";
import { PostHog } from "posthog-node";

const phClient = new PostHog(process.env.POSTHOG_API_KEY!, {
  host: process.env.POSTHOG_HOST,
});

const openai = new OpenAI({
  baseURL: "http://localhost:11434/v1",
  apiKey: "ollama",
  posthog: phClient,
});

const completion = await openai.chat.completions.create({
  model: "llama3.2",
  messages: [{ role: "user", content: "Tell me a fun fact about hedgehogs" }],
  posthogDistinctId: "user_123",
  posthogTraceId: "trace_123",
  posthogProperties: { conversation_id: "abc123" },
});

console.log(completion.choices[0].message.content);

phClient.shutdown();
