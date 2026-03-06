export default {
  expo: {
    name: 'BurritoApp',
    slug: 'burrito-app',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    newArchEnabled: true,
    experiments: {
      reactCompiler: true,
    },
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#333333',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.posthog.burritoapp',
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#333333',
      },
      package: 'com.posthog.burritoapp',
      edgeToEdgeEnabled: true,
    },
    web: {
      favicon: './assets/favicon.png',
    },
    scheme: 'burritoapp',
    extra: {
      posthogProjectToken: process.env.POSTHOG_PROJECT_TOKEN,
      posthogHost: process.env.POSTHOG_HOST || 'https://us.i.posthog.com',
    },
    plugins: ['expo-router', 'expo-localization'],
  },
}
