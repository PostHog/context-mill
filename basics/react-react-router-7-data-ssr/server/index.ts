import "dotenv/config";
import express from "express";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import React from "react";
import {
  createStaticHandler,
  createStaticRouter,
  StaticRouterProvider,
} from "react-router";
import { renderToString } from "react-dom/server";
import { PostHog, setupExpressErrorHandler } from "posthog-node";
import routes from "../app/routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const { query, dataRoutes } = createStaticHandler(routes);

// Setup PostHog exception autocapture for Express
const posthog = new PostHog(process.env.VITE_PUBLIC_POSTHOG_KEY || "", {
  host: process.env.VITE_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
  flushAt: 1,
  flushInterval: 0,
  enableExceptionAutocapture: true,
});

setupExpressErrorHandler(posthog, app);

// Read HTML template once at startup
const htmlTemplate = readFileSync(
  join(__dirname, "../client/index.html"),
  "utf-8"
);

// Body parser for POST/PUT requests
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// PostHog middleware for session handling
import { posthogMiddleware } from "./lib/posthog-middleware.js";
app.use(posthogMiddleware);

// API routes (before SSR handler)
import { handleLogin } from "./api/auth/login.js";
import { handleBurritoConsider } from "./api/burrito/consider.js";

app.post("/api/auth/login", handleLogin);
app.post("/api/burrito/consider", handleBurritoConsider);

// Test route for exception autocapture
app.get("/api/test-error", () => {
  throw new Error("Test error for PostHog exception autocapture");
});

// Serve static assets from the client build
app.use(
  "/assets",
  express.static(join(__dirname, "../client/assets"), {
    immutable: true,
    maxAge: "1y",
  })
);

// Convert Express headers to Headers object
function expressHeadersToHeaders(
  headers: express.Request["headers"]
): Headers {
  const headersObj = new Headers();
  for (const [key, value] of Object.entries(headers)) {
    if (value) {
      if (Array.isArray(value)) {
        value.forEach((v) => headersObj.append(key, v));
      } else {
        headersObj.set(key, value);
      }
    }
  }
  return headersObj;
}

// Convert Headers to Express-compatible object
function headersToExpress(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

// Serve the HTML shell
app.all("*", async (req, res, next) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const headers = expressHeadersToHeaders(req.headers);
    
    // Get request body if present
    let body: string | undefined;
    if (req.method !== "GET" && req.method !== "HEAD" && req.body) {
      body = JSON.stringify(req.body);
    }

    const request = new Request(url, {
      method: req.method,
      headers,
      body,
    });

    // Run loaders/actions to get routing context
    const context = await query(request);

    // If query returns a Response, send it raw (redirect, etc.)
    if (context instanceof Response) {
      const responseHeaders = headersToExpress(context.headers);
      return res
        .status(context.status)
        .set(responseHeaders)
        .send(await context.text());
    }

    // Create static router for SSR
    const router = createStaticRouter(dataRoutes, context);

    // Render the app - don't wrap with PostHogProvider on server
    // PostHogProvider is client-only and doesn't render DOM, so we can add it only on client
    // Use suppressHydrationWarning to avoid mismatch warnings
    const html = renderToString(
      React.createElement(
        React.StrictMode,
        null,
        React.createElement(StaticRouterProvider, { router, context })
      )
    );

    // Get headers from the deepest match
    const leaf = context.matches[context.matches.length - 1];
    const actionHeaders = context.actionHeaders?.[leaf.route.id];
    const loaderHeaders = context.loaderHeaders?.[leaf.route.id];
    const responseHeaders = new Headers(actionHeaders);
    if (loaderHeaders) {
      for (const [key, value] of loaderHeaders.entries()) {
        responseHeaders.append(key, value);
      }
    }

    responseHeaders.set("Content-Type", "text/html; charset=utf-8");

    // Inject the rendered HTML and hydration data
    const hydrationData = JSON.stringify(context);
    const finalHtml = htmlTemplate
      .replace('<div id="root"></div>', `<div id="root">${html}</div>`)
      .replace(
        "</body>",
        `<script>window.__staticRouterHydrationData = ${hydrationData};</script></body>`
      );

    res
      .status(context.statusCode)
      .set(headersToExpress(responseHeaders))
      .send(finalHtml);
  } catch (error) {
    next(error);
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

