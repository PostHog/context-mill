# PostHog Angular Example

This is an [Angular](https://angular.dev/) example demonstrating PostHog integration with product analytics, session replay, and error tracking.

## Features

- **Product analytics**: Track user events and behaviors
- **Session replay**: Record and replay user sessions
- **Error tracking**: Capture and track errors
- **User authentication**: Demo login system with PostHog user identification
- **SSR-safe**: Uses platform checks for browser-only PostHog calls
- **Reverse proxy**: PostHog ingestion through Angular proxy

## Getting started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment variables

Create a `.env` file in the root directory:

```bash
VITE_POSTHOG_KEY=your_posthog_project_api_key
VITE_POSTHOG_HOST=https://us.posthog.com
```

Get your PostHog API key from your [PostHog project settings](https://app.posthog.com/project/settings).

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
    this.posthogService.init(environment.posthogKey, {
      api_host: '/ingest',
      ui_host: environment.posthogHost || 'https://us.posthog.com',
      capture_exceptions: true,
    });
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
posthogService.posthog.capture('$exception', {
  $exception_message: error.message,
  $exception_type: error.name,
  $exception_stack_trace_raw: error.stack,
});
```

## Angular-specific details

This example uses Angular 21 with modern features:

1. **Standalone components**: No NgModules, all components use `standalone: true`
2. **Signals**: Reactive state management with Angular signals
3. **SSR support**: Uses `isPlatformBrowser()` checks for SSR safety
4. **Dependency injection**: PostHog wrapped in an injectable service
5. **Proxy configuration**: Uses `proxy.conf.json` for PostHog API calls
6. **Environment files**: Generated from `.env` at build time via prebuild script

## Environment variable handling

Angular CLI doesn't natively support `.env` files. This project uses a prebuild script:

1. `scripts/generate-env.js` reads `.env` and generates `environment.generated.ts`
2. The script runs automatically before `pnpm start` and `pnpm build`
3. Environment files import from the generated file

## Learn more

- [PostHog Documentation](https://posthog.com/docs)
- [Angular Documentation](https://angular.dev/)
- [PostHog JavaScript Web SDK](https://posthog.com/docs/libraries/js)
