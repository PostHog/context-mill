export const environment = {
  production: false,
  posthogKey: import.meta.env['NG_APP_POSTHOG_PROJECT_TOKEN'] || '',
  posthogHost: import.meta.env['NG_APP_POSTHOG_HOST'] || 'https://us.i.posthog.com',
};
