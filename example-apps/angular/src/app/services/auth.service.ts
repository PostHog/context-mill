import {
  Injectable,
  signal,
  computed,
  inject,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PostHogService } from './posthog.service';

export interface User {
  id: string;
  username: string;
  burritoConsiderations: number;
}

// Stands in for your auth system, giving each username a stable UUID like a database primary key.
// Identify with that id, never with the username or email.
function getUserId(username: string): string {
  const key = `demo-user-id:${username}`;
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const id = crypto.randomUUID();
  window.localStorage.setItem(key, id);
  return id;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly posthogService = inject(PostHogService);

  // In-memory user store for the current browser session
  private readonly users = new Map<string, User>();

  // Signals for reactive state
  private readonly _user = signal<User | null>(null);

  // Public computed signals
  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);

  constructor() {
    // Restore persisted demo session from localStorage on browser startup
    if (isPlatformBrowser(this.platformId)) {
      const raw = localStorage.getItem('currentUser');
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as Partial<User>;
          // Only restore a complete user record that carries a stable id and username.
          if (
            typeof parsed?.id === 'string' &&
            parsed.id &&
            typeof parsed?.username === 'string' &&
            parsed.username.trim()
          ) {
            const restored: User = {
              id: parsed.id,
              username: parsed.username.trim(),
              burritoConsiderations:
                typeof parsed.burritoConsiderations === 'number'
                  ? parsed.burritoConsiderations
                  : 0,
            };
            this.users.set(restored.username, restored);
            this._user.set(restored);
          } else {
            localStorage.removeItem('currentUser');
          }
        } catch {
          localStorage.removeItem('currentUser');
        }
      }
    }
  }

  login(username: string, password: string): boolean {
    const trimmedUsername = username.trim();
    // Reject blank credentials so we never identify or capture login events without a valid user identity.
    if (!trimmedUsername || !password) {
      return false;
    }

    let user = this.users.get(trimmedUsername);
    const isNewUser = !user;

    if (!user) {
      user = {
        id: getUserId(trimmedUsername),
        username: trimmedUsername,
        burritoConsiderations: 0,
      };
      this.users.set(trimmedUsername, user);
    }

    this._user.set(user);

    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('currentUser', JSON.stringify(user));
    }

    this.posthogService.posthog?.identify(user.id, {
      username: user.username,
    });

    // Omit username and other PII from event properties. Keep user attributes on identify() person properties.
    this.posthogService.posthog?.capture('user_logged_in', {
      is_new_user: isNewUser,
    });

    return true;
  }

  logout(): void {
    const currentUser = this._user();
    // Only capture logout and reset PostHog when signing out of an authenticated session.
    if (!currentUser) {
      return;
    }

    this.posthogService.posthog?.capture('user_logged_out');
    this.posthogService.posthog?.reset();

    this._user.set(null);

    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('currentUser');
    }
  }

  incrementBurritoConsiderations(): void {
    const currentUser = this._user();
    if (currentUser) {
      const updated: User = {
        ...currentUser,
        burritoConsiderations: currentUser.burritoConsiderations + 1,
      };
      this.users.set(currentUser.username, updated);
      this._user.set(updated);
      if (isPlatformBrowser(this.platformId)) {
        localStorage.setItem('currentUser', JSON.stringify(updated));
      }
    }
  }
}
