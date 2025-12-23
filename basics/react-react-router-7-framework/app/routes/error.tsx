import type { Route } from "./+types/error";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Error Test - Burrito Consideration App" },
    { name: "description", content: "Test error boundary" },
  ];
}

export default function ErrorPage() {
  // This will throw an error during render, which will be caught by ErrorBoundary
  throw new Error('Test error for ErrorBoundary - this is a render-time error');
}

