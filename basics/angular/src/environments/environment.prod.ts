export const environment = {
  production: true,
  posthogKey: import.meta.env.VITE_POSTHOG_KEY ?? '<ph_project_api_key>',
  posthogHost: import.meta.env.VITE_POSTHOG_HOST ?? 'https://us.posthog.com',
};
