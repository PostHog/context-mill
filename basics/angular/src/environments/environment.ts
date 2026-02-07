export const environment = {
  production: false,
  posthogKey: import.meta.env['NG_APP_POSTHOG_KEY'] || '<ph_project_api_key>',
  posthogHost: import.meta.env['NG_APP_POSTHOG_HOST'] || 'https://us.posthog.com',
};
