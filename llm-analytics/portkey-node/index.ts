import "dotenv/config";
import { OpenAI } from "@posthog/ai";
import { PostHog } from "posthog-node";

const phClient = new PostHog(process.env.POSTHOG_API_KEY!, {
  host: process.env.POSTHOG_HOST,
});

const openai = new OpenAI({
  baseURL: "https://api.portkey.ai/v1",
  apiKey: process.env.OPENAI_API_KEY,
  defaultHeaders: {
    "x-portkey-api-key": process.env.PORTKEY_API_KEY!,
    "x-portkey-virtual-key": process.env.PORTKEY_VIRTUAL_KEY!,
  },
  posthog: phClient,
});

const completion = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "Tell me a fun fact about hedgehogs" }],
  posthogDistinctId: "user_123",
  posthogTraceId: "trace_123",
  posthogProperties: { conversation_id: "abc123" },
});

console.log(completion.choices[0].message.content);

phClient.shutdown();
