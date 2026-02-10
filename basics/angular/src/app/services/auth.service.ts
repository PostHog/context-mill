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
  username: string;
  burritoConsiderations: number;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly posthogService = inject(PostHogService);

  // In-memory user store (matches TanStack behavior)
  private readonly users = new Map<string, User>();

  // Signals for reactive state
  private readonly _user = signal<User | null>(null);

  // Public computed signals
  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);

  constructor() {
    // Initialize from localStorage on browser
    if (isPlatformBrowser(this.platformId)) {
      const storedUsername = localStorage.getItem('currentUser');
      if (storedUsername) {
        const existingUser = this.users.get(storedUsername);
        if (existingUser) {
          this._user.set(existingUser);
        }
      }
    }
  }

  login(username: string, password: string): boolean {
    if (!username || !password) {
      return false;
    }

    // Get or create user in local map (no API call)
    let user = this.users.get(username);
    const isNewUser = !user;

    if (!user) {
      user = { username, burritoConsiderations: 0 };
      this.users.set(username, user);
    }

    this._user.set(user);

    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('currentUser', username);
    }

    // PostHog identification (client-side only)
    this.posthogService.posthog.identify(username, {
      username,
      isNewUser,
    });

    this.posthogService.posthog.capture('user_logged_in', {
      username,
      isNewUser,
    });

    return true;
  }

  logout(): void {
    this.posthogService.posthog.capture('user_logged_out');
    this.posthogService.posthog.reset();

    this._user.set(null);

    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('currentUser');
    }
  }

  incrementBurritoConsiderations(): void {
    const currentUser = this._user();
    if (currentUser) {
      const updated = {
        ...currentUser,
        burritoConsiderations: currentUser.burritoConsiderations + 1,
      };
      this.users.set(currentUser.username, updated);
      this._user.set(updated);
    }
  }
}
