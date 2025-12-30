import type { Request, Response } from "express";
import { getBurritoConsiderations } from "../../lib/db.js";

// In-memory user storage (similar to framework version)
const users = new Map<string, { username: string }>();

export { users };

export async function handleLogin(req: Request, res: Response) {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  let user = users.get(username);
  
  if (!user) {
    user = { username };
    users.set(username, user);
  }

  // Use PostHog from middleware if available
  if (req.posthog) {
    req.posthog.capture({
      event: 'user_logged_in',
    });
  }

  const burritoConsiderations = await getBurritoConsiderations(username);
  return res.json({
    success: true,
    user: { ...user, burritoConsiderations }
  });
}

