# Burrito Consideration App (Expo)

A React Native Expo app demonstrating PostHog product analytics integration with modern React Native best practices.

## Features

- **Product Analytics**: Full PostHog integration with event tracking
- **Autocapture**: Touch events and screen tracking
- **Error Tracking**: Manual exception capture with `$exception` events
- **User Authentication**: Demo login with PostHog user identification
- **Session Persistence**: AsyncStorage for session management
- **Modern React**: React 19 with React Compiler for automatic memoization
- **File-based Routing**: Expo Router for navigation
- **New Architecture**: Enabled by default for better performance

## Project Structure

```
basics/expo/
├── app/                          # Expo Router screens (file-based routing)
│   ├── _layout.tsx               # Root layout with PostHogProvider + AuthProvider
│   ├── index.tsx                 # Home screen (login/welcome)
│   ├── burrito.tsx               # Burrito consideration screen
│   └── profile.tsx               # User profile screen
├── src/
│   ├── config/
│   │   └── posthog.ts            # PostHog client configuration
│   ├── contexts/
│   │   └── AuthContext.tsx       # Authentication context with PostHog
│   ├── services/
│   │   └── storage.ts            # AsyncStorage wrapper
│   └── styles/
│       └── theme.ts              # Shared style constants
├── app.json                      # Expo configuration
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

**For Android builds:** Set environment variables (required):

Add to `~/.zshrc` or `~/.bashrc`:
```bash
# Java from Android Studio (required for Gradle)
export JAVA_HOME="<path-to-android-studio-jdk>"

# Android SDK location
export ANDROID_HOME="$HOME/Library/Android/sdk"
```

Examples:
- `export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"`
- `export ANDROID_HOME="$HOME/Library/Android/sdk"`

Then run `source ~/.zshrc` to apply.

### Installation

1. Install dependencies:
   ```bash
   cd basics/expo
   npm install
   ```

2. Configure PostHog (optional):
   ```bash
   cp .env.example .env
   # Edit .env with your PostHog API key
   ```

3. Start the development server:
   ```bash
   npx expo start
   ```

### Running the App

```bash
# Start development server
npx expo start

# Run on iOS Simulator
npx expo run:ios

# Run on Android Emulator
npx expo run:android
```

## PostHog Integration

### Configuration

PostHog is configured in `src/config/posthog.ts` using environment variables from `app.json`:

```typescript
import Constants from 'expo-constants'

const apiKey = Constants.expoConfig?.extra?.posthogApiKey
```

### Event Tracking

Events are captured with properties:

```typescript
posthog.capture('burrito_considered', {
  total_considerations: count,
  username: user.username,
})
```

### User Identification

Users are identified on login:

```typescript
posthog.identify(username, {
  $set: { username },
  $set_once: { first_login_date: new Date().toISOString() },
})
```

### Screen Tracking

Manual screen tracking with Expo Router:

```typescript
useEffect(() => {
  posthog.screen(pathname, {
    previous_screen: previousPathname.current,
  })
}, [pathname])
```

### Error Tracking

Manual exception capture:

```typescript
posthog.capture('$exception', {
  $exception_type: error.name,
  $exception_message: error.message,
  $exception_stack_trace_raw: error.stack,
})
```

## Modern React Features

### React Compiler

Automatic memoization is enabled via `babel-plugin-react-compiler`. No need for manual `useMemo`, `useCallback`, or `React.memo`.

### React 19 `use` API

The `useAuth` hook uses the new `use` API for context:

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

Enabled in `app.json` for better performance:

```json
{
  "expo": {
    "newArchEnabled": true
  }
}
```

## Building for Production

Use EAS Build for production builds:

```bash
# Install EAS CLI
npm install -g eas-cli

# Configure EAS
eas build:configure

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android
```

## Performance Debugging

1. Press `J` in Expo CLI to open Chrome DevTools
2. Go to: **Profiler > [Gear icon] > "Highlight updates when components render"**
3. Interact with your app to see which components re-render

## Tech Stack

- **Expo SDK 54** - Managed workflow
- **React 19** - Latest React with Compiler support
- **React Native 0.81** - Latest stable
- **Expo Router 6** - File-based navigation
- **PostHog** - Product analytics
- **TypeScript** - Strict mode enabled
- **React Native Reanimated** - Smooth animations
- **React Native Gesture Handler** - Native gestures

## License

MIT
