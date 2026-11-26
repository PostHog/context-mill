# PostHog React Native example

This is a bare [React Native](https://reactnative.dev/) example (no Expo) demonstrating PostHog integration with product analytics, user identification, autocapture, and error tracking.

## Features

- **Product analytics**: Track user events and behaviors
- **Autocapture**: Automatic touch event and manual React Navigation v7 screen tracking
- **Error tracking**: Capture and track errors manually
- **User authentication**: Demo login system with stable user ID identification and session restore
- **Session persistence**: AsyncStorage for maintaining user sessions across app restarts
- **Native navigation**: React Navigation v7 with native stack navigator

## Prerequisites

### For iOS Development

You need a Mac with the following installed:

1. **Xcode** (from the Mac App Store)
   - Open App Store, search for "Xcode", and install it
   - Open Xcode once to accept the license agreement

2. **Xcode Command Line Tools**
   ```bash
   xcode-select --install
   ```

3. **CocoaPods** (iOS dependency manager)
   ```bash
   brew install cocoapods
   ```

### For Android Development

1. **Android Studio**
   ```bash
   brew install --cask android-studio
   ```

2. **First-time Android Studio Setup**
   - Open Android Studio and complete the setup wizard
   - Go to **Settings > Languages & Frameworks > Android SDK**
   - Ensure "Android SDK Platform 34" (or latest) is installed

3. **Create an Android Emulator**
   - In Android Studio, open **Tools > Device Manager**
   - Click **Create Device**, select a phone, download a system image, and launch it

4. **Environment Variables** (add to `~/.zshrc` or `~/.bashrc`)
   ```bash
   export ANDROID_HOME=$HOME/Library/Android/sdk
   export PATH=$PATH:$ANDROID_HOME/emulator
   export PATH=$PATH:$ANDROID_HOME/platform-tools

   export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
   export PATH=$JAVA_HOME/bin:$PATH
   ```
   Then run `source ~/.zshrc` to apply.

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a `.env` file:

```bash
cp .env.example .env
```

Edit `.env` and add your PostHog project token:

```bash
POSTHOG_PROJECT_TOKEN=your_posthog_project_token
POSTHOG_HOST=https://us.i.posthog.com
```

Get your PostHog project token from your [PostHog project settings](https://app.posthog.com/project/settings).

> **Note:** When `POSTHOG_PROJECT_TOKEN` is left blank, `posthog` stays `null` and the app runs cleanly without initializing the SDK.

### 3. Run on iOS

Install iOS dependencies (first time only):
```bash
cd ios && pod install && cd ..
```

Run the app:
```bash
npm run ios
```

### 4. Run on Android

Make sure an Android emulator is running, then:

```bash
npm run android
```

## Project structure

```
src/
├── config/
│   └── posthog.ts           # Optional PostHog client configuration
├── contexts/
│   └── AuthContext.tsx      # Authentication context with PostHog integration
├── navigation/
│   └── RootNavigator.tsx    # React Navigation stack navigator
├── screens/
│   ├── HomeScreen.tsx       # Home and login screen
│   ├── BurritoScreen.tsx    # Demo feature screen with event tracking
│   └── ProfileScreen.tsx    # User profile with error tracking demo
├── services/
│   └── storage.ts           # AsyncStorage wrapper for persistence
├── styles/
│   └── theme.ts             # Shared style constants
└── types/
    └── env.d.ts             # Type declarations for environment variables

App.tsx                      # Root component with conditional PostHogProvider
index.js                     # App entry point
.env.example                 # Environment variables template
ios/                         # Native iOS project (Xcode)
android/                     # Native Android project (Android Studio)
```

## Key integration points

### PostHog client setup (src/config/posthog.ts)

Read `POSTHOG_PROJECT_TOKEN` optionally from `react-native-config`. When unset or blank, log an error in `__DEV__` and export `null` rather than constructing `PostHog` with a placeholder token:

```typescript
import PostHog from 'posthog-react-native'
import Config from 'react-native-config'

const token = Config.POSTHOG_PROJECT_TOKEN?.trim() || undefined
const host = Config.POSTHOG_HOST?.trim() || 'https://us.i.posthog.com'

if (!token && __DEV__) {
  console.error(
    'POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once POSTHOG_PROJECT_TOKEN is configured',
  )
}

export const posthog: PostHog | null = token
  ? new PostHog(token, {
      host,
      captureAppLifecycleEvents: true,
      flushAt: 20,
      flushInterval: 10000,
      preloadFeatureFlags: true,
    })
  : null

if (posthog && __DEV__) {
  posthog.debug(true)
}
```

### Provider setup with React Navigation v7 (App.tsx)

For React Navigation v7, place `PostHogProvider` **inside** `NavigationContainer` when `posthog` is non-null, and track screens manually via `onStateChange`:

```typescript
export default function App() {
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null)
  const routeNameRef = useRef<string | undefined>(undefined)

  const appTree = (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  )

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={() => {
        routeNameRef.current = navigationRef.current?.getCurrentRoute()?.name
      }}
      onStateChange={() => {
        const previousRouteName = routeNameRef.current
        const currentRouteName = navigationRef.current?.getCurrentRoute()?.name

        if (previousRouteName !== currentRouteName && currentRouteName) {
          posthog?.screen(currentRouteName, {
            previous_screen: previousRouteName ?? null,
          })
        }
        routeNameRef.current = currentRouteName
      }}
    >
      {posthog ? (
        <PostHogProvider
          client={posthog}
          autocapture={{
            captureScreens: false,
            captureTouches: true,
            propsToCapture: ['testID'],
          }}
        >
          {appTree}
        </PostHogProvider>
      ) : (
        appTree
      )}
    </NavigationContainer>
  )
}
```

### User identification (src/contexts/AuthContext.tsx)

Identify with a stable `userData.id` both on login and when restoring a saved session on launch, keeping `username` in `$set` person properties and out of `capture()` event properties:

```typescript
const posthog: PostHog | undefined = usePostHog()

posthog?.identify(userData.id, {
  $set: {
    username: trimmedUsername,
  },
  $set_once: {
    first_login_date: new Date().toISOString(),
  },
})

posthog?.capture('user_logged_in', {
  login_method: 'username',
  is_new_user: isNewUser,
})

// On logout from an authenticated session, capture before reset
posthog?.capture('user_logged_out')
posthog?.reset()
```

### Event tracking (src/screens/BurritoScreen.tsx)

Capture custom events with non-PII properties:

```typescript
const posthog: PostHog | undefined = usePostHog()

posthog?.capture('burrito_considered', {
  total_considerations: user.burritoConsiderations + 1,
})
```

### Error tracking (src/screens/ProfileScreen.tsx)

Capture exceptions using `captureException` without PII properties:

```typescript
const posthog: PostHog | undefined = usePostHog()

try {
  throw new Error('Test error for PostHog error tracking')
} catch (err) {
  posthog?.captureException(err as Error, {
    screen: 'Profile',
  })
}
```

## Learn more

- [PostHog documentation](https://posthog.com/docs)
- [PostHog React Native integration](https://posthog.com/docs/libraries/react-native)
- [PostHog React Native autocapture](https://posthog.com/docs/libraries/react-native#autocapture)
- [PostHog React Native screen tracking](https://posthog.com/docs/libraries/react-native#capturing-screen-views)
- [React Native documentation](https://reactnative.dev/docs/getting-started)
- [React Navigation documentation](https://reactnavigation.org/docs/getting-started)
