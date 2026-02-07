export const environment = {
  production: true,
  posthogKey: import.meta.env['NG_APP_POSTHOG_KEY'] || '<ph_project_api_key>',
  posthogHost: import.meta.env['NG_APP_POSTHOG_HOST'] || 'https://us.posthog.com',
};
