import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, isRouteErrorResponse, RouterProvider, type ClientOnErrorFunction } from "react-router";
import Root, { RootErrorBoundary } from "./app/root";
import Home from "./app/routes/home";
import Burrito from "./app/routes/burrito";
import Profile from "./app/routes/profile";

import posthog from 'posthog-js';
import { PostHogProvider } from '@posthog/react'

const posthogToken = import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN;

if (posthogToken) {
  posthog.init(posthogToken, {
    api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
    defaults: '2026-08-30',
    capture_exceptions: true,
  });
} else if (import.meta.env.DEV) {
  console.error('VITE_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once VITE_PUBLIC_POSTHOG_PROJECT_TOKEN is configured');
}

const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    ErrorBoundary: RootErrorBoundary,
    children: [
      {
        index: true,
        Component: Home,
      },
      {
        path: "burrito",
        Component: Burrito,
      },
      {
        path: "profile",
        Component: Profile,
      },
    ],
  },
]);

// Errors React Router catches (render, loader, action, fetcher). Responses thrown on purpose,
// such as 404s, are not errors to track.
const onError: ClientOnErrorFunction = (error) => {
  if (isRouteErrorResponse(error)) return;
  posthog.captureException(error);
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PostHogProvider client={posthog}>
      <RouterProvider router={router} onError={onError} />
    </PostHogProvider>
  </StrictMode>
);

