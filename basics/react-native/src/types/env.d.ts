declare module 'react-native-config' {
  export interface NativeConfig {
    POSTHOG_API_KEY?: string
    POSTHOG_HOST?: string
  }

  export const Config: NativeConfig
  export default Config
}
