import type { NextConfig } from "next";

// Proxy to the region in NEXT_PUBLIC_POSTHOG_HOST: us.i.posthog.com or eu.i.posthog.com
const apiHost = new URL(process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com").hostname;
const assetHost = apiHost.replace(".i.posthog.com", "-assets.i.posthog.com");

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: `https://${assetHost}/static/:path*`,
      },
      {
        source: "/ingest/array/:path*",
        destination: `https://${assetHost}/array/:path*`,
      },
      {
        source: "/ingest/:path*",
        destination: `https://${apiHost}/:path*`,
      },
    ];
  },
  // This is required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
