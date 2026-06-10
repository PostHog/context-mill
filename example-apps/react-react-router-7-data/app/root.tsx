import { Outlet, useRouteError, isRouteErrorResponse } from "react-router";
import Header from "./components/Header";
import { AuthProvider } from "./contexts/AuthContext";
import "./globals.css";
import { usePostHog } from "@posthog/react";

export default function Root() {
  return (
      <AuthProvider>
        <Header />
        <main>
          <Outlet />
        </main>
      </AuthProvider>
  );
}

export function RootErrorBoundary() {
  const error = useRouteError();
  
  const posthog = usePostHog();
  if (error) {
    posthog.captureException(error);
  }

  if (isRouteErrorResponse(error)) {
    return (
      <>
        <h1>
          {error.status} {error.statusText}
        </h1>
        <p>{error.data}</p>
      </>
    );
  } else if (error instanceof Error) {
    return (
      <div>
        <h1>Error</h1>
        <p>{error.message}</p>
        <p>The stack trace is:</p>
        <pre>{error.stack}</pre>
      </div>
    );
  } else {
    return <h1>Unknown Error</h1>;
  }
}
