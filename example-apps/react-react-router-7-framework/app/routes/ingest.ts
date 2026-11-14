import type { Route } from "./+types/ingest";

// Proxy to the region in VITE_PUBLIC_POSTHOG_HOST: us.i.posthog.com or eu.i.posthog.com
const API_HOST = new URL(process.env.VITE_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com").hostname;
const ASSET_HOST = API_HOST.replace(".i.posthog.com", "-assets.i.posthog.com");

async function posthogProxy(request: Request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const useAssetHost = pathname.startsWith("/ingest/static/") || pathname.startsWith("/ingest/array/");
  const hostname = useAssetHost ? ASSET_HOST : API_HOST;

  const newUrl = new URL(url);
  newUrl.protocol = "https";
  newUrl.hostname = hostname;
  newUrl.port = "443";
  newUrl.pathname = newUrl.pathname.replace(/^\/ingest/, "");

  const headers = new Headers(request.headers);
  headers.set("host", hostname);
  // Remove cookies before forwarding to PostHog
  headers.delete("cookie");
  // Forward PostHog keys (Bearer phc_, phs_ or phx_), which the SDKs need. Strip any other credentials.
  if (!/^Bearer ph[csx]_/.test(headers.get("authorization") ?? "")) {
    headers.delete("authorization");
  }
  headers.delete("accept-encoding");

  const response = await fetch(newUrl, {
    method: request.method,
    headers,
    body: request.body,
    // @ts-expect-error - duplex is required for streaming request bodies
    duplex: "half",
  });

  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("content-length");

  const data = await response.arrayBuffer();

  return new Response(data, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}

export async function loader({ request }: Route.LoaderArgs) {
  return posthogProxy(request);
}

export async function action({ request }: Route.ActionArgs) {
  return posthogProxy(request);
}
