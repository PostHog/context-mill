// Gauge setup script for the delivery evals. Runs in the session VM before the agent.
// Reads the eval PostHog project from the attached PostHog MCP server and hands its
// project token and host to the agent, so the app it sets up can send real events.
import { agent, mcp, params } from "@withgauge/session";

const client = await mcp.connect(params.mcpServer);
const result = await client.callTool({
    name: "exec",
    arguments: { command: "call project-get {}", context: "install skill evals: read the eval project" },
});
if (result.isError) throw new Error("project-get failed");
const text = JSON.stringify(result);
const field = (key: string) => (text.match(new RegExp(`\\b${key}: ?\\\\?"?([^\\\\"\\n,]+)`)) || [])[1];

const projectId = field("id");
const token = field("api_token");
const host = field("api_host");
if (!token || !host) throw new Error("project-get returned no api_token or api_host");
// The delivery evals only ever run against the project named in evals.json.
if (String(projectId) !== String(params.projectId)) {
    throw new Error(`MCP is signed in to project ${projectId}, expected the eval project ${params.projectId}`);
}

await agent.setEnv("POSTHOG_PROJECT_TOKEN", token);
await agent.setEnv("POSTHOG_HOST", host);
await client.close();
