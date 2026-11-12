import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
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
  });
} else if (import.meta.env.DEV) {
  console.warn('VITE_PUBLIC_POSTHOG_PROJECT_TOKEN is not set. Skipping PostHog initialization.');
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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PostHogProvider client={posthog}>
      <RouterProvider router={router} />
    </PostHogProvider>
  </StrictMode>
);

