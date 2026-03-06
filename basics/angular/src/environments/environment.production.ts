export const environment = {
  production: true,
  posthogKey: import.meta.env['NG_APP_POSTHOG_PROJECT_TOKEN'] || '<ph_project_token>',
  posthogHost: import.meta.env['NG_APP_POSTHOG_HOST'] || 'https://us.posthog.com',
};
