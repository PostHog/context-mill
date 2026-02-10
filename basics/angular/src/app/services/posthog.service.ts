import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import posthog, { PostHogConfig } from 'posthog-js';

@Injectable({ providedIn: 'root' })
export class PostHogService {
  private readonly platformId = inject(PLATFORM_ID);
  private initialized = false;

  /**
   * The posthog instance. Use this directly to call posthog methods.
   * Returns the actual posthog instance on browser, or a no-op proxy on server.
   */
  get posthog(): typeof posthog {
    if (isPlatformBrowser(this.platformId) && this.initialized) {
      return posthog;
    }
    // Return a no-op proxy for SSR safety
    return new Proxy({} as typeof posthog, {
      get: () => () => undefined,
    });
  }

  init(apiKey: string, options: Partial<PostHogConfig>): void {
    if (isPlatformBrowser(this.platformId) && !this.initialized) {
      posthog.init(apiKey, options);
      this.initialized = true;
    }
  }
}
