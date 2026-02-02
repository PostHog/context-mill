import "dotenv/config";
import { AzureOpenAI } from "@posthog/ai";
import { PostHog } from "posthog-node";

const phClient = new PostHog(process.env.POSTHOG_API_KEY!, {
  host: process.env.POSTHOG_HOST,
});

const client = new AzureOpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  apiVersion: "2024-10-21",
  endpoint: process.env.AZURE_OPENAI_ENDPOINT!,
  posthog: phClient,
});

const completion = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "Tell me a fun fact about hedgehogs" }],
  posthogDistinctId: "user_123",
  posthogTraceId: "trace_123",
  posthogProperties: { conversation_id: "abc123" },
});

console.log(completion.choices[0].message.content);

phClient.shutdown();
