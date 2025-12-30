import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import routes from "./app/routes.js";
import "./app/globals.css";

declare global {
  interface Window {
    __staticRouterHydrationData?: any;
  }
}

const router = createBrowserRouter(routes, {
  hydrationData: window.__staticRouterHydrationData,
});

// PHProvider handles PostHog initialization and provider setup
startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>
  );
});
