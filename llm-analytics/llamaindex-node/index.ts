import "dotenv/config";
import { OpenAI } from "@posthog/ai";
import { PostHog } from "posthog-node";
import { OpenAI as LlamaOpenAI } from "llamaindex";

const phClient = new PostHog(process.env.POSTHOG_API_KEY!, {
  host: process.env.POSTHOG_HOST,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  posthog: phClient,
});

const llm = new LlamaOpenAI({
  model: "gpt-4o-mini",
  apiKey: process.env.OPENAI_API_KEY,
});

// Inject PostHog-wrapped client
(llm as any).session = openai;

const response = await llm.complete({ prompt: "Tell me a fun fact about hedgehogs" });
console.log(response.text);

phClient.shutdown();
