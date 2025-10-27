# PostHog React Router v7 Example

This is a React Router v7 example demonstrating PostHog integration with product analytics, session replay, and error tracking using vanilla React principles. This is a **client-side only** implementation.

## Features

- **Product Analytics**: Track user events and behaviors
- **Session Replay**: Record and replay user sessions
- **Error Tracking**: Capture and track errors
- **User Authentication**: Demo login system with PostHog user identification
- **Client-side Tracking**: Pure client-side React implementation
- **Reverse Proxy**: PostHog ingestion through Vite proxy

## Getting Started

### 1. Install Dependencies

```bash
npm install
# or
pnpm install
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory:

```bash
VITE_POSTHOG_KEY=your_posthog_project_api_key
VITE_POSTHOG_HOST=https://us.i.posthog.com
```

Get your PostHog API key from your [PostHog project settings](https://app.posthog.com/project/settings).

### 3. Run the Development Server

```bash
npm run dev
# or
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173) with your browser to see the app.

## Project Structure

```
app/
├── components/
│   └── Header.tsx              # Navigation header with auth state
├── contexts/
│   └── AuthContext.tsx         # Authentication context with PostHog integration
├── lib/
│   └── posthog-client.ts       # Client-side PostHog initialization
├── routes/
│   ├── home.tsx                # Home/Login page
│   ├── burrito.tsx             # Demo feature page with event tracking
│   └── profile.tsx             # User profile with error tracking demo
├── app.css                     # Tailwind styles
├── globals.css                 # Custom global styles
├── root.tsx                    # Root layout with providers
└── routes.ts                   # Route configuration

vite.config.ts                  # Vite config with PostHog proxy
```

## Key Integration Points

### Client-side Initialization (lib/posthog-client.ts)

```typescript
import posthog from "posthog-js";

// Initialize PostHog client-side
if (typeof window !== 'undefined' && !posthog.__loaded) {
  posthog.init(import.meta.env.VITE_POSTHOG_KEY || '', {
    api_host: import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com",
    ui_host: "https://us.posthog.com",
    person_profiles: 'identified_only',
    capture_exceptions: true,
    debug: import.meta.env.DEV,
  });
}

export default posthog;
```

### PostHog Provider Setup (root.tsx)

```typescript
import { PostHogProvider } from 'posthog-js/react';
import posthog from "./lib/posthog-client";

export default function App() {
  return (
    <PostHogProvider client={posthog}>
      <AuthProvider>
        <Header />
        <main>
          <Outlet />
        </main>
      </AuthProvider>
    </PostHogProvider>
  );
}
```

### Using PostHog Hooks (contexts/AuthContext.tsx)

```typescript
import { usePostHog } from 'posthog-js/react';

export function AuthProvider({ children }: { children: ReactNode }) {
  const posthog = usePostHog();

  const login = async (username: string, password: string): Promise<boolean> => {
    // ... login logic

    // Track with PostHog
    posthog.identify(username, { username });
    posthog.capture('user_logged_in', { username });

    return true;
  };

  // ...
}
```

### Event Tracking (routes/burrito.tsx)

```typescript
import { usePostHog } from 'posthog-js/react';

export default function BurritoPage() {
  const posthog = usePostHog();

  const handleConsideration = () => {
    posthog.capture('burrito_considered', {
      total_considerations: user.burritoConsiderations + 1,
      username: user.username,
    });
  };
}
```

### Error Tracking (routes/profile.tsx)

```typescript
import { usePostHog } from 'posthog-js/react';

export default function ProfilePage() {
  const posthog = usePostHog();

  const triggerTestError = () => {
    try {
      throw new Error('Test error for PostHog error tracking');
    } catch (err) {
      posthog.captureException(err);
    }
  };
}
```


## React Router v7 Approach

This example uses React Router v7 with vanilla React patterns and **client-side only** logic:

1. **File-based Routing**: Routes defined in `app/routes.ts` and route files in `app/routes/`
2. **Root Layout**: `root.tsx` wraps all pages with providers and layout
3. **Client-side State**: All state managed in React Context and localStorage
4. **React Context**: Using standard React Context API for state management
5. **React Hooks**: `useState`, `useEffect`, `useNavigate` for component logic
6. **Standard React Patterns**: No framework-specific conventions, just React
7. **No Server Logic**: Pure client-side implementation, no server-side rendering of user data

## Differences from Next.js Examples

Unlike the Next.js App Router and Pages Router examples:

1. **Client-side Only**: No server-side logic, no API routes, no posthog-node
2. **No 'use client'**: React Router v7 doesn't require client directives
3. **Standard Hooks**: Uses `useNavigate()` from react-router instead of Next's router
4. **Route Config**: Routes defined in `routes.ts` instead of file system based
5. **Vite Proxy**: Uses Vite's proxy config instead of Next.js rewrites
6. **Import Meta Env**: Uses `import.meta.env` for environment variables instead of `process.env.NEXT_PUBLIC_*`
7. **Local State Only**: All authentication and user data stored in memory and localStorage
8. **Meta Exports**: Uses `meta` function exports for page metadata

## Learn More

- [PostHog Documentation](https://posthog.com/docs)
- [React Router v7 Documentation](https://reactrouter.com/home)
- [PostHog React Integration Guide](https://posthog.com/docs/libraries/react)

## Deploy

Build the production application:

```bash
npm run build
# or
pnpm build
```

Start the production server:

```bash
npm start
# or
pnpm start
```
