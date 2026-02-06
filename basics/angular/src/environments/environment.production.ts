import { generatedEnv } from './environment.generated';

export const environment = {
  production: true,
  posthogKey: generatedEnv.posthogKey || '<ph_project_api_key>',
  posthogHost: generatedEnv.posthogHost || 'https://us.posthog.com',
};
