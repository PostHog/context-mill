# Burrito Consideration App (Expo)

A React Native Expo app demonstrating PostHog product analytics integration with modern React Native best practices.

## Features

- **Product Analytics**: Full PostHog integration with event tracking
- **Autocapture**: Touch events and manual Expo Router screen tracking
- **Error Tracking**: Manual exception capture with `captureException`
- **User Authentication**: Demo login with stable user ID identification and session restore
- **Session Persistence**: AsyncStorage for session management
- **Modern React**: React 19 with React Compiler for automatic memoization
- **File-based Routing**: Expo Router for navigation
- **New Architecture**: Enabled by default for better performance

## Project Structure

```
example-apps/expo/
├── app/                          # Expo Router screens (file-based routing)
│   ├── _layout.tsx               # Root layout with conditional PostHogProvider + AuthProvider
│   ├── index.tsx                 # Home screen (login/welcome)
│   ├── burrito.tsx               # Burrito consideration screen
│   └── profile.tsx               # User profile screen
├── src/
│   ├── config/
│   │   └── posthog.ts            # Optional PostHog client configuration
│   ├── contexts/
│   │   └── AuthContext.tsx       # Authentication context with PostHog
│   ├── services/
│   │   └── storage.ts            # AsyncStorage wrapper
│   └── styles/
│       └── theme.ts              # Shared style constants
├── app.config.js                 # Expo configuration reading POSTHOG_* env vars
├── babel.config.js               # Babel config with React Compiler
├── eslint.config.js              # ESLint flat config
├── package.json                  # Dependencies
├── tsconfig.json                 # TypeScript strict configuration
└── .env.example                  # Environment variables template
```

## Getting Started

### Prerequisites

- Node.js 18+
- iOS: Xcode (for iOS Simulator)
- Android: Android Studio with emulator

**For Android builds:** Set environment variables in `~/.zshrc` or `~/.bashrc`:

```bash
export JAVA_HOME="<path-to-android-studio-jdk>"
export ANDROID_HOME="$HOME/Library/Android/sdk"
```

Then run `source ~/.zshrc` to apply.

### Installation

1. Install dependencies:
   ```bash
   cd example-apps/expo
   npm install
   ```

2. Configure PostHog:
   ```bash
   cp .env.example .env
   # Edit .env with your PostHog project token
   ```

3. Start the development server:
   ```bash
   npx expo start
   ```

### Running the App

```bash
npx expo start
npx expo run:ios
npx expo run:android
```

## PostHog Integration

### Configuration

PostHog is configured in `src/config/posthog.ts` using build-time environment variables exposed via `app.config.js` extras. When `POSTHOG_PROJECT_TOKEN` is missing or empty, `posthog` is `null`, development builds log an error, and `<PostHogProvider>` is skipped rather than constructing `PostHog` with a placeholder token:

```typescript
import PostHog from 'posthog-react-native'
import Constants from 'expo-constants'

const rawProjectToken = Constants.expoConfig?.extra?.posthogProjectToken as string | undefined
const token = rawProjectToken?.trim() || undefined
const rawHost = Constants.expoConfig?.extra?.posthogHost as string | undefined
const host = rawHost?.trim() || 'https://us.i.posthog.com'

if (!token && __DEV__) {
  console.error(
    'POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once POSTHOG_PROJECT_TOKEN is configured'
  )
}

export const posthog: PostHog | null = token
  ? new PostHog(token, {
      host,
      captureAppLifecycleEvents: true,
    })
  : null

if (posthog && __DEV__) {
  posthog.debug(true)
}
```

### Event Tracking

Events carry non-PII context properties, guarded with optional chaining when PostHog is unconfigured:

```typescript
posthog?.capture('burrito_considered', {
  total_considerations: count,
})
```

### User Identification

Users are identified with a stable `userData.id` both on login and when restoring a saved session on app launch, keeping `username` in `$set` person properties and out of `capture()` event properties:

```typescript
posthog?.identify(userData.id, {
  $set: { username: trimmedUsername },
  $set_once: { first_login_date: new Date().toISOString() },
})

posthog?.capture('user_logged_in', {
  login_method: 'username',
  is_new_user: isNewUser,
})
```

### Screen Tracking

Manual screen tracking with Expo Router avoids spreading raw route params that could contain PII:

```typescript
useEffect(() => {
  if (previousPathname.current !== pathname) {
    posthog?.screen(pathname, {
      previous_screen: previousPathname.current ?? null,
    })
    previousPathname.current = pathname
  }
}, [pathname])
```

### Error Tracking

Manual exception capture without PII properties:

```typescript
posthog?.captureException(error, {
  screen: 'Profile',
})
```

## Modern React Features

### React Compiler

Automatic memoization is enabled via `babel-plugin-react-compiler`. No need for manual `useMemo`, `useCallback`, or `React.memo`.

### React 19 `use` API

The `useAuth` hook uses the `use` API for context:

```typescript
export function useAuth() {
  const context = use(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
```

### New Architecture

Enabled in `app.config.js` for better performance:

```javascript
export default {
  expo: {
    newArchEnabled: true,
  },
}
```

## Building for Production

Use EAS Build for production builds:

```bash
npm install -g eas-cli
eas build:configure
eas build --platform ios
eas build --platform android
```

## Tech Stack

- **Expo SDK 54**, managed workflow
- **React 19**, latest React with Compiler support
- **React Native 0.81**, latest stable
- **Expo Router 6**, file-based navigation
- **PostHog**, product analytics
- **TypeScript**, strict mode enabled
- **React Native Reanimated**, smooth animations
- **React Native Gesture Handler**, native gestures

## License

MIT
