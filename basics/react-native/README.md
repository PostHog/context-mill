# PostHog React Native example

This is a bare [React Native](https://reactnative.dev/) example (no Expo) demonstrating PostHog integration with product analytics, user identification, autocapture, and error tracking.

## Features

- **Product analytics**: Track user events and behaviors
- **Autocapture**: Automatic touch event and screen view tracking
- **Error tracking**: Capture and track errors manually
- **User authentication**: Demo login system with PostHog user identification
- **Session persistence**: AsyncStorage for maintaining user sessions across app restarts
- **Native navigation**: React Navigation v7 with native stack navigator

## Prerequisites

### For iOS Development

You need a Mac with the following installed:

1. **Xcode** (from the Mac App Store)
   - Open App Store and search for "Xcode"
   - Install it (~12GB download)
   - After installing, open Xcode once to accept the license agreement

2. **Xcode Command Line Tools**
   ```bash
   xcode-select --install
   ```

3. **CocoaPods** (iOS dependency manager)
   ```bash
   brew install cocoapods
   ```
   Or without Homebrew:
   ```bash
   sudo gem install cocoapods
   ```

### For Android Development

1. **Android Studio** (the Android IDE)
   ```bash
   brew install --cask android-studio
   ```
   Or download from: https://developer.android.com/studio

2. **First-time Android Studio Setup**
   - Open Android Studio
   - Complete the setup wizard (downloads Android SDK automatically)
   - Go to **Settings → Languages & Frameworks → Android SDK**
   - Ensure "Android SDK Platform 34" (or latest) is installed

3. **Create an Android Emulator**
   - In Android Studio: **Tools → Device Manager**
   - Click **Create Device**
   - Select a phone (e.g., "Pixel 7")
   - Download a system image (e.g., API 34)
   - Finish and click the **Play** button to launch

4. **Environment Variables** (add to `~/.zshrc` or `~/.bashrc`)
   ```bash
   # Android SDK
   export ANDROID_HOME=$HOME/Library/Android/sdk
   export PATH=$PATH:$ANDROID_HOME/emulator
   export PATH=$PATH:$ANDROID_HOME/platform-tools
   
   # Java from Android Studio (required for Gradle)
   export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
   export PATH=$JAVA_HOME/bin:$PATH
   ```
   Then run `source ~/.zshrc` to apply.

5. **Create local.properties file** (if SDK location is not detected)
   Create `android/local.properties` with:
   ```
   sdk.dir=$HOME/Library/Android/sdk
   ```

6. **Clear Gradle cache** (required when jumping between different versions of Gradle)
   ```bash
   rm -rf ~/.gradle/caches/modules-2/files-2.1/org.gradle.toolchains/foojay-resolver
   ```

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

Edit `.env` and add your PostHog API key:

```bash
POSTHOG_API_KEY=phc_your_api_key_here
POSTHOG_HOST=https://us.i.posthog.com
```

Get your PostHog API key from your [PostHog project settings](https://app.posthog.com/project/settings).

> **Note:** The app will still run without a PostHog API key - analytics will simply be disabled.

### 3. Run on iOS

Install iOS dependencies (first time only):
```bash
cd ios && pod install && cd ..
```

Run the app:
```bash
npm run ios
```

> **Note:** First build takes 5-10 minutes. Subsequent builds are much faster.

### 4. Run on Android

Make sure an Android emulator is running (from Android Studio Device Manager), then:

```bash
npm run android
```

> **Note:** First build takes 3-5 minutes.

## Troubleshooting

### iOS Issues

**"No `Podfile' found"**
- Make sure you're in the `ios` directory: `cd ios && pod install`

**Build fails with signing errors**
- Open `ios/BurritoApp.xcworkspace` in Xcode
- Select the project → Signing & Capabilities
- Select your development team

**Simulator not launching**
- Open Xcode → Open Developer Tool → Simulator
- Or run: `open -a Simulator`

### Android Issues

**"SDK location not found"**
- Ensure `ANDROID_HOME` is set in your shell profile
- Run `source ~/.zshrc` after adding it

**"No connected devices"**
- Launch an emulator from Android Studio Device Manager
- Or connect a physical device with USB debugging enabled

**Gradle build fails**
- Try: `cd android && ./gradlew clean && cd ..`
- Then: `npm run android`

## Project structure

```
src/
├── config/
│   └── posthog.ts           # PostHog client configuration
├── contexts/
│   └── AuthContext.tsx      # Authentication context with PostHog integration
├── navigation/
│   └── RootNavigator.tsx    # React Navigation stack navigator
├── screens/
│   ├── HomeScreen.tsx       # Home/login screen
│   ├── BurritoScreen.tsx    # Demo feature screen with event tracking
│   └── ProfileScreen.tsx    # User profile with error tracking demo
├── services/
│   └── storage.ts           # AsyncStorage wrapper for persistence
├── styles/
│   └── theme.ts             # Shared style constants
└── types/
    └── env.d.ts             # Type declarations for environment variables

App.tsx                      # Root component with PostHogProvider
index.js                     # App entry point
.env                         # Environment variables (create from .env.example)
ios/                         # Native iOS project (Xcode)
android/                     # Native Android project (Android Studio)
```

## Key integration points

### PostHog client setup (config/posthog.ts)

The PostHog client is configured with V4 SDK options. If no API key is provided, analytics are disabled gracefully:

```typescript
import PostHog from 'posthog-react-native'
import Config from 'react-native-config'

const apiKey = Config.POSTHOG_API_KEY
const isPostHogConfigured = apiKey && apiKey !== 'phc_your_api_key_here'

export const posthog = new PostHog(apiKey || 'placeholder_key', {
  host: Config.POSTHOG_HOST || 'https://us.i.posthog.com',
  disabled: !isPostHogConfigured,  // Disable if no API key
  captureAppLifecycleEvents: true,
  debug: __DEV__,
  flushAt: 20,
  flushInterval: 10000,
  preloadFeatureFlags: true,
})
```

### Provider setup with React Navigation v7 (App.tsx)

For React Navigation v7, `PostHogProvider` must be placed **inside** `NavigationContainer`, and screen tracking must be done manually:

```typescript
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native'
import { PostHogProvider } from 'posthog-react-native'
import { posthog } from './src/config/posthog'

export default function App() {
  const navigationRef = useRef<NavigationContainerRef<RootStackParamList>>(null)
  const routeNameRef = useRef<string | undefined>()

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={() => {
        routeNameRef.current = navigationRef.current?.getCurrentRoute()?.name
      }}
      onStateChange={() => {
        // Manual screen tracking for React Navigation v7
        const previousRouteName = routeNameRef.current
        const currentRouteName = navigationRef.current?.getCurrentRoute()?.name

        if (previousRouteName !== currentRouteName && currentRouteName) {
          posthog.screen(currentRouteName, {
            previous_screen: previousRouteName,
          })
        }
        routeNameRef.current = currentRouteName
      }}
    >
      <PostHogProvider
        client={posthog}
        autocapture={{
          captureScreens: false,  // Disabled for React Navigation v7
          captureTouches: true,   // Enable touch event autocapture
          propsToCapture: ['testID'],
        }}
      >
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </PostHogProvider>
    </NavigationContainer>
  )
}
```

### Autocapture

PostHog autocapture automatically tracks:

- **Touch events**: When users interact with the screen
- **App lifecycle events**: Application Installed, Updated, Opened, Became Active, Backgrounded

Use `testID` prop on components to help identify them in analytics:

```typescript
<TouchableOpacity testID="consider-burrito-button" onPress={handlePress}>
  <Text>Consider Burrito</Text>
</TouchableOpacity>
```

### User identification (contexts/AuthContext.tsx)

Use `$set` and `$set_once` for person properties:

```typescript
import { usePostHog } from 'posthog-react-native'

const posthog = usePostHog()

// On login - identify with person properties
posthog.identify(username, {
  $set: {
    username: username,
  },
  $set_once: {
    first_login_date: new Date().toISOString(),
  },
})

// Capture login event
posthog.capture('user_logged_in', {
  username: username,
  is_new_user: isNewUser,
})

// On logout - reset clears distinct ID and anonymous ID
posthog.capture('user_logged_out')
posthog.reset()
```

### Event tracking (screens/BurritoScreen.tsx)

Capture custom events with properties:

```typescript
import { usePostHog } from 'posthog-react-native'

const posthog = usePostHog()

// We recommend using a [object] [verb] format for event names
posthog.capture('burrito_considered', {
  total_considerations: user.burritoConsiderations + 1,
  username: user.username,
})
```

### Error tracking (screens/ProfileScreen.tsx)

Capture exceptions using the `$exception` event:

```typescript
import { usePostHog } from 'posthog-react-native'

const posthog = usePostHog()

try {
  throw new Error('Test error for PostHog error tracking')
} catch (err) {
  posthog.capture('$exception', {
    $exception_type: err.name,
    $exception_message: err.message,
    $exception_source: 'ProfileScreen',
    $exception_stack_trace_raw: err.stack,
  })
}
```

### Session persistence (services/storage.ts)

AsyncStorage replaces localStorage for persisting user sessions:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage'

export const storage = {
  getCurrentUser: async (): Promise<string | null> => {
    return await AsyncStorage.getItem('currentUser')
  },

  setCurrentUser: async (username: string): Promise<void> => {
    await AsyncStorage.setItem('currentUser', username)
  },

  saveUser: async (user: User): Promise<void> => {
    const users = await storage.getUsers()
    users[user.username] = user
    await AsyncStorage.setItem('users', JSON.stringify(users))
  },
}
```

## Learn more

- [PostHog documentation](https://posthog.com/docs)
- [PostHog React Native integration](https://posthog.com/docs/libraries/react-native)
- [PostHog React Native autocapture](https://posthog.com/docs/libraries/react-native#autocapture)
- [PostHog React Native screen tracking](https://posthog.com/docs/libraries/react-native#capturing-screen-views)
- [React Native documentation](https://reactnative.dev/docs/getting-started)
- [React Native environment setup](https://reactnative.dev/docs/set-up-your-environment)
- [React Navigation documentation](https://reactnavigation.org/docs/getting-started)
