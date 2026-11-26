// Define the type of the environment variables.
// Leave NG_APP_POSTHOG_PROJECT_TOKEN optional so missing configuration stays undefined instead of defaulting to an empty string.
declare interface Env {
  readonly NODE_ENV: string;
  readonly NG_APP_POSTHOG_PROJECT_TOKEN: string | undefined;
  readonly NG_APP_POSTHOG_HOST: string | undefined;
}

// Use import.meta.env.YOUR_ENV_VAR in your code.
declare interface ImportMeta {
  readonly env: Env;
}
