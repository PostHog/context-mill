import { PostHog } from "posthog-node";
import type { Request, Response, NextFunction } from "express";

// Extend Express Request to include posthog
declare global {
  namespace Express {
    interface Request {
      posthog?: PostHog;
    }
  }
}

export async function posthogMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Skip PostHog if API key is not provided
  if (!process.env.VITE_PUBLIC_POSTHOG_KEY) {
    return next();
  }

  const posthog = new PostHog(process.env.VITE_PUBLIC_POSTHOG_KEY, {
    host: process.env.VITE_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    flushAt: 1,
    flushInterval: 0,
    enableExceptionAutocapture: true,
  });

  const sessionId = req.headers["x-posthog-session-id"] as string | undefined;
  const distinctId = req.headers["x-posthog-distinct-id"] as string | undefined;

  req.posthog = posthog;

  // Cleanup after response finishes (works with all response methods)
  res.once("finish", () => {
    posthog.shutdown().catch(() => {});
  });

  // Wrap the request handling with PostHog context
  // The context will be active during all subsequent middleware and route handlers
  try {
    await posthog.withContext(
      {
        sessionId: sessionId ?? undefined,
        distinctId: distinctId ?? undefined,
      },
      async () => {
        next();
      }
    );
  } catch (error) {
    next(error as Error);
  }
}

