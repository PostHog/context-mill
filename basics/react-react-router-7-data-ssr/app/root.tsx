import { Outlet, useRouteError, isRouteErrorResponse } from "react-router";
import Header from "./components/Header.js";
import { AuthProvider } from "./contexts/AuthContext.js";
import { PHProvider } from "./components/PHProvider.js";
// CSS is bundled by Vite for client, not needed for SSR

export default function Root() {
  return (
    <PHProvider>
      <AuthProvider>
        <Header />
        <main>
          <Outlet />
        </main>
      </AuthProvider>
    </PHProvider>
  );
}

export function RootErrorBoundary() {
  const error = useRouteError();
  
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
