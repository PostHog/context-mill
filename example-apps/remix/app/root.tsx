import { useEffect } from "react";
import { usePostHog } from "@posthog/react";
import {
  Link,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
  useRouteError,
} from "@remix-run/react";

import { AuthProvider } from "./auth";
import { PHProvider } from "./provider";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <PHProvider>
          <AuthProvider>
            <nav>
              <Link to="/">Home</Link> | <Link to="/burrito">Burrito</Link>
            </nav>
            {children}
          </AuthProvider>
          <ScrollRestoration />
          <Scripts />
        </PHProvider>
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary() {
  const error = useRouteError();
  const posthog = usePostHog();

  useEffect(() => {
    posthog.captureException(error);
  }, [error, posthog]);

  return (
    <main>
      <h1>{isRouteErrorResponse(error) ? error.status : "Oops!"}</h1>
      <p>Something went wrong.</p>
    </main>
  );
}
