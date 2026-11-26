import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import posthog, { PostHogConfig } from 'posthog-js';

@Injectable({ providedIn: 'root' })
export class PostHogService {
  private readonly platformId = inject(PLATFORM_ID);
  private initialized = false;

  /**
   * Returns the initialized browser PostHog client, or null on the server or when unconfigured.
   */
  get posthog(): typeof posthog | null {
    if (isPlatformBrowser(this.platformId) && this.initialized) {
      return posthog;
    }
    return null;
  }

  init(apiKey: string | undefined, options: Partial<PostHogConfig>): void {
    // Skip initialization when the project token is missing instead of passing an empty or placeholder key.
    if (!apiKey?.trim()) {
      return;
    }
    if (isPlatformBrowser(this.platformId) && !this.initialized) {
      posthog.init(apiKey.trim(), options);
      this.initialized = true;
    }
  }
}
