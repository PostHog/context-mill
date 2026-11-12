import { useFeatureFlagEnabled, usePostHog } from "@posthog/react";
import type { ActionFunctionArgs, MetaFunction } from "@remix-run/node";
import { useFetcher } from "@remix-run/react";
import { useState } from "react";

import { useAuth } from "../auth";
import { captureEvent } from "../posthog.server";

export const meta: MetaFunction = () => [{ title: "Burrito - Burrito consideration app" }];

const considerations = new Map<string, number>();

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const username = String(formData.get("username") ?? "");
  if (!username) return Response.json({ error: "Username required" }, { status: 400 });

  const count = (considerations.get(username) ?? 0) + 1;
  considerations.set(username, count);

  await captureEvent(request, "burrito_considered", { total_considerations: count });

  return { count };
}

export default function Burrito() {
  const { user } = useAuth();
  const posthog = usePostHog();
  const showTip = useFeatureFlagEnabled("burrito-tip");
  const fetcher = useFetcher<typeof action>();
  const [crash, setCrash] = useState(false);

  if (crash) throw new Error("Demo burrito error");

  if (!user) return <main>Please sign in on the home page first.</main>;

  const handleError = () => {
    try {
      throw new Error("Demo caught burrito error");
    } catch (err) {
      posthog.captureException(err);
    }
  };

  return (
    <main>
      <h1>Burrito consideration zone</h1>
      {showTip && <p>Tip: consider the beans.</p>}
      <fetcher.Form method="post">
        <input type="hidden" name="username" value={user} />
        <button type="submit">Consider a burrito</button>
      </fetcher.Form>
      {fetcher.data && "count" in fetcher.data && (
        <p>Total considerations: {fetcher.data.count}</p>
      )}
      <button onClick={handleError}>Capture a caught error</button>{" "}
      <button onClick={() => setCrash(true)}>Crash the page</button>
    </main>
  );
}
