import "dotenv/config";
import Instructor from "@instructor-ai/instructor";
import { OpenAI } from "@posthog/ai";
import { PostHog } from "posthog-node";
import { z } from "zod";

const phClient = new PostHog(process.env.POSTHOG_API_KEY!, {
  host: process.env.POSTHOG_HOST,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  posthog: phClient,
});

const client = Instructor({ client: openai, mode: "TOOLS" });

const UserInfo = z.object({
  name: z.string(),
  age: z.number(),
});

const user = await client.chat.completions.create({
  model: "gpt-4o-mini",
  response_model: { schema: UserInfo, name: "UserInfo" },
  messages: [{ role: "user", content: "John Doe is 30 years old." }],
  posthogDistinctId: "user_123",
  posthogTraceId: "trace_123",
  posthogProperties: { conversation_id: "abc123" },
});

console.log(`${user.name} is ${user.age} years old`);

phClient.shutdown();
