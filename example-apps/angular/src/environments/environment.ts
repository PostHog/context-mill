// Leave posthogKey undefined when NG_APP_POSTHOG_PROJECT_TOKEN is unset rather than defaulting to an empty string.
export const environment: {
  production: boolean;
  posthogKey: string | undefined;
  posthogHost: string;
} = {
  production: false,
  posthogKey: import.meta.env['NG_APP_POSTHOG_PROJECT_TOKEN'],
  posthogHost: import.meta.env['NG_APP_POSTHOG_HOST'] || 'https://us.i.posthog.com',
};
