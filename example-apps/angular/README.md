# PostHog Angular Example

This is an [Angular](https://angular.dev/) example demonstrating PostHog integration with product analytics, session replay, and error tracking.

## Features

- **Product analytics**: Track user events and behaviors
- **Session replay**: Record and replay user sessions
- **Error tracking**: Capture and track errors
- **User authentication**: Demo login system with PostHog user identification
- **SSR-safe**: Uses platform checks for browser-only PostHog calls
- **Reverse proxy**: Point `NG_APP_POSTHOG_HOST` at a reverse proxy

## Getting started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment variables

Create a `.env` file in the root directory:

```bash
NG_APP_POSTHOG_PROJECT_TOKEN=your_posthog_project_token
NG_APP_POSTHOG_HOST=https://us.i.posthog.com
```

Get your PostHog project token from your [PostHog project settings](https://app.posthog.com/project/settings).
If the project token is not set, the app skips PostHog initialization and logs a warning in development.

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

A wrapper service that handles SSR safety and provides access to the PostHog instance:

```typescript
import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import posthog from 'posthog-js';

@Injectable({ providedIn: 'root' })
export class PostHogService {
  private readonly platformId = inject(PLATFORM_ID);

  get posthog(): typeof posthog {
    if (isPlatformBrowser(this.platformId)) {
      return posthog;
    }
    // Return a no-op proxy for SSR safety
    return new Proxy({} as typeof posthog, {
      get: () => () => undefined,
    });
  }

  init(apiKey: string, options: Partial<PostHogConfig>): void {
    if (isPlatformBrowser(this.platformId)) {
      posthog.init(apiKey, options);
    }
  }
}
```

### PostHog initialization (app.component.ts)

PostHog is initialized in the root component's `ngOnInit`:

```typescript
import { PostHogService } from './services/posthog.service';
import { environment } from '../environments/environment';

export class AppComponent implements OnInit {
  private readonly posthogService = inject(PostHogService);

  ngOnInit(): void {
    if (environment.posthogKey) {
      this.posthogService.init(environment.posthogKey, {
        api_host: environment.posthogHost,
        defaults: '2026-08-30',
        capture_exceptions: true,
      });
    }
  }
}
```

### User identification (services/auth.service.ts)

```typescript
import { PostHogService } from './posthog.service';

const posthogService = inject(PostHogService);

posthogService.posthog.identify(username, {
  username,
  isNewUser,
});
```

### Event tracking (pages/burrito/burrito.component.ts)

```typescript
import { PostHogService } from '../../services/posthog.service';

const posthogService = inject(PostHogService);

posthogService.posthog.capture('burrito_considered', {
  total_considerations: count,
  username: username,
});
```

### Error tracking (pages/profile/profile.component.ts)

```typescript
posthogService.posthog.captureException(error);
```

## Angular-specific details

This example uses Angular 21 with modern features:

1. **Standalone components**: No NgModules, all components use `standalone: true`
2. **Signals**: Reactive state management with Angular signals
3. **SSR support**: Uses `isPlatformBrowser()` checks for SSR safety
4. **Dependency injection**: PostHog wrapped in an injectable service
5. **Environment files**: Read from `.env` at build time by `@ngx-env/builder` (variables use the `NG_APP_` prefix)

## Environment variable handling

Angular CLI doesn't natively support `.env` files. This project uses [`@ngx-env/builder`](https://github.com/chihab/ngx-env), which exposes `NG_APP_*` variables through `import.meta.env`. The files in `src/environments/` read them and default to an empty project token, which skips PostHog initialization.

## Reverse proxy

Ad blockers drop requests sent to PostHog's domain, so some events never arrive. A reverse proxy sends events through your own domain instead.

The recommended option is the [managed reverse proxy](https://posthog.com/docs/advanced/proxy/managed-reverse-proxy), which PostHog hosts for you. You create a subdomain in your [organization proxy settings](https://app.posthog.com/settings/organization-proxy) and add a CNAME record at your DNS provider.

If you prefer to run your own, PostHog has guides for [Vercel](https://posthog.com/docs/advanced/proxy/vercel), [Netlify](https://posthog.com/docs/advanced/proxy/netlify) and [Cloudflare](https://posthog.com/docs/advanced/proxy/cloudflare), among others. See [Deploy a reverse proxy](https://posthog.com/docs/advanced/proxy) for the full list.

Once the proxy is live, set `NG_APP_POSTHOG_HOST` to the proxy URL, for example `https://yoursubdomain.myapp.com`. Also add `ui_host` to the `posthog.init` options, set to your PostHog app URL (`https://us.posthog.com` or `https://eu.posthog.com`), so the toolbar and links into PostHog keep working.

## Learn more

- [PostHog Documentation](https://posthog.com/docs)
- [Angular Documentation](https://angular.dev/)
- [PostHog JavaScript Web SDK](https://posthog.com/docs/libraries/js)
