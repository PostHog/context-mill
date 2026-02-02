import "dotenv/config";
import { Anthropic } from "@posthog/ai";
import { PostHog } from "posthog-node";

const phClient = new PostHog(process.env.POSTHOG_API_KEY!, {
  host: process.env.POSTHOG_HOST,
});

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  posthog: phClient,
});

const response = await client.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 1024,
  messages: [
    { role: "user", content: "Tell me a fun fact about hedgehogs" },
  ],
  posthogDistinctId: "user_123",
  posthogTraceId: "trace_123",
  posthogProperties: { conversation_id: "abc123" },
});

console.log(response.content[0].text);

phClient.shutdown();
