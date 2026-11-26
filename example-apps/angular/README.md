# PostHog Angular Example

This is an [Angular](https://angular.dev/) example demonstrating PostHog integration with product analytics, session replay, and error tracking.

## Features

- **Product analytics**: Track user events and behaviors
- **Session replay**: Record and replay user sessions
- **Error tracking**: Capture and track errors
- **User authentication**: Demo login system with PostHog user identification and session restore
- **SSR-safe**: Uses platform checks for browser-only PostHog calls
- **Reverse proxy**: Point `NG_APP_POSTHOG_HOST` at a reverse proxy

## Getting started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env` in the root directory and fill in your PostHog project token:

```bash
NG_APP_POSTHOG_PROJECT_TOKEN=
NG_APP_POSTHOG_HOST=https://us.i.posthog.com
```

Get your PostHog project token from your [PostHog project settings](https://app.posthog.com/project/settings).
If the project token is not set, the app skips PostHog initialization and logs an error in development.

### 3. Run the development server

```bash
pnpm start
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the app.

## Project structure

```
src/
├── app/
│   ├── components/
│   │   └── header/            # Navigation header with auth state
│   ├── pages/
│   │   ├── home/              # Home/Login page
│   │   ├── burrito/           # Demo feature page with event tracking
│   │   └── profile/           # User profile with error tracking demo
│   ├── services/
│   │   ├── posthog.service.ts # PostHog service wrapper (SSR-safe)
│   │   └── auth.service.ts    # Auth service with PostHog integration
│   ├── guards/
│   │   └── auth.guard.ts      # Route guard for protected pages
│   ├── app.component.ts       # Root component with PostHog init
│   ├── app.routes.ts          # Route definitions
│   └── app.config.ts          # App configuration
├── environments/
│   ├── environment.ts         # Dev environment config
│   └── environment.production.ts
└── main.ts                    # App entry point
```

## Key integration points

### PostHog service (services/posthog.service.ts)

A wrapper service that handles SSR safety and exposes the initialized browser PostHog instance:

```typescript
import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import posthog, { PostHogConfig } from 'posthog-js';

@Injectable({ providedIn: 'root' })
export class PostHogService {
  private readonly platformId = inject(PLATFORM_ID);
  private initialized = false;

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
```

### PostHog initialization (app.component.ts)

PostHog is initialized in the root component's `ngOnInit`, and any persisted user session is re-identified after initialization:

```typescript
import { AuthService } from './services/auth.service';
import { PostHogService } from './services/posthog.service';
import { environment } from '../environments/environment';

export class AppComponent implements OnInit {
  private readonly posthogService = inject(PostHogService);
  private readonly authService = inject(AuthService);

  ngOnInit(): void {
    const token = environment.posthogKey?.trim();
    if (token) {
      this.posthogService.init(token, {
        api_host: environment.posthogHost,
        defaults: '2026-08-30',
        capture_exceptions: true,
      });

      const restoredUser = this.authService.user();
      if (restoredUser) {
        this.posthogService.posthog?.identify(restoredUser.id, {
          username: restoredUser.username,
        });
      }
    } else if (!environment.production) {
      console.error(
        'NG_APP_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NG_APP_POSTHOG_PROJECT_TOKEN is configured'
      );
    }
  }
}
```

### User identification and logout (services/auth.service.ts)

```typescript
posthogService.posthog?.identify(user.id, {
  username: user.username,
});

posthogService.posthog?.capture('user_logged_in', {
  is_new_user: isNewUser,
});

// On logout from an authenticated session, capture before reset()
posthogService.posthog?.capture('user_logged_out');
posthogService.posthog?.reset();
```

### Event tracking (pages/burrito/burrito.component.ts)

```typescript
posthogService.posthog?.capture('burrito_considered', {
  total_considerations: updatedCount,
});
```

### Error tracking (pages/profile/profile.component.ts)

```typescript
posthogService.posthog?.captureException(error);
```

## Angular-specific details

This example uses Angular 21 with modern features:

1. **Standalone components**: No NgModules, all components use `standalone: true`
2. **Signals**: Reactive state management with Angular signals
3. **SSR support**: Uses `isPlatformBrowser()` checks for SSR safety
4. **Dependency injection**: PostHog wrapped in an injectable service
5. **Environment files**: Read from `.env` at build time by `@ngx-env/builder` (variables use the `NG_APP_` prefix), with `fileReplacements` swapping `environment.production.ts` into production builds

## Environment variable handling

Angular CLI doesn't natively support `.env` files. This project uses [`@ngx-env/builder`](https://github.com/chihab/ngx-env), which exposes `NG_APP_*` variables through `import.meta.env`. The files in `src/environments/` read `NG_APP_POSTHOG_PROJECT_TOKEN` without a fallback string so missing configuration stays `undefined` and `AppComponent` skips PostHog initialization cleanly.

## Reverse proxy

Ad blockers drop requests sent to PostHog's domain, so some events never arrive. A reverse proxy sends events through your own domain instead.

The recommended option is the [managed reverse proxy](https://posthog.com/docs/advanced/proxy/managed-reverse-proxy), which PostHog hosts for you. You create a subdomain in your [organization proxy settings](https://app.posthog.com/settings/organization-proxy) and add a CNAME record at your DNS provider.

If you prefer to run your own, PostHog has guides for [Vercel](https://posthog.com/docs/advanced/proxy/vercel), [Netlify](https://posthog.com/docs/advanced/proxy/netlify) and [Cloudflare](https://posthog.com/docs/advanced/proxy/cloudflare), among others. See [Deploy a reverse proxy](https://posthog.com/docs/advanced/proxy) for the full list.

Once the proxy is live, set `NG_APP_POSTHOG_HOST` to the proxy URL, for example `https://yoursubdomain.myapp.com`. Also add `ui_host` to the `posthog.init` options, set to your PostHog app URL (`https://us.posthog.com` or `https://eu.posthog.com`), so the toolbar and links into PostHog keep working.

## Learn more

- [PostHog Documentation](https://posthog.com/docs)
- [Angular Documentation](https://angular.dev/)
- [PostHog JavaScript Web SDK](https://posthog.com/docs/libraries/js)
