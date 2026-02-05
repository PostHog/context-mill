import "dotenv/config";
import { GoogleGenAI } from "@posthog/ai";
import { PostHog } from "posthog-node";

const phClient = new PostHog(process.env.POSTHOG_API_KEY!, {
  host: process.env.POSTHOG_HOST,
});

const client = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  posthog: phClient,
});

const response = await client.models.generateContent({
  model: "gemini-2.5-flash",
  contents: ["Tell me a fun fact about hedgehogs"],
  posthogDistinctId: "user_123",
  posthogTraceId: "trace_123",
  posthogProperties: { conversation_id: "abc123" },
});

console.log(response.text);

phClient.shutdown();
