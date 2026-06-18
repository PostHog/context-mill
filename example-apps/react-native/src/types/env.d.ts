declare module 'react-native-config' {
  export interface NativeConfig {
    POSTHOG_PROJECT_TOKEN?: string
    POSTHOG_HOST?: string
  }

  export const Config: NativeConfig
  export default Config
}
