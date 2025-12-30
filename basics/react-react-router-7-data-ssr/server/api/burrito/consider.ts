import type { Request, Response } from "express";
import { users } from "../auth/login.js";
import { incrementBurritoConsiderations } from "../../lib/db.js";

export async function handleBurritoConsider(req: Request, res: Response) {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ error: 'Username required' });
  }

  const user = users.get(username);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const burritoConsiderations = await incrementBurritoConsiderations(username);

  // Use PostHog from middleware if available
  if (req.posthog) {
    req.posthog.capture({
      event: 'burrito_considered',
    });
  }

  return res.json({ 
    success: true, 
    user: { ...user, burritoConsiderations } 
  });
}

