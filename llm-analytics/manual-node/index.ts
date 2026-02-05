import "dotenv/config";
import { PostHog } from "posthog-node";
import OpenAI from "openai";

const phClient = new PostHog(process.env.POSTHOG_API_KEY!, {
  host: process.env.POSTHOG_HOST,
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const messages: OpenAI.ChatCompletionMessageParam[] = [
  { role: "user", content: "Tell me a fun fact about hedgehogs" },
];

const start = Date.now();
const completion = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages,
});
const latency = (Date.now() - start) / 1000;

phClient.capture({
  distinctId: "user_123",
  event: "$ai_generation",
  properties: {
    $ai_trace_id: "trace_123",
    $ai_model: "gpt-4o-mini",
    $ai_provider: "openai",
    $ai_input: messages,
    $ai_input_tokens: completion.usage?.prompt_tokens,
    $ai_output_choices: [
      {
        role: "assistant",
        content: completion.choices[0].message.content,
      },
    ],
    $ai_output_tokens: completion.usage?.completion_tokens,
    $ai_latency: latency,
  },
});

console.log(completion.choices[0].message.content);

phClient.shutdown();
