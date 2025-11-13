// @ignoreFile
import { test, expect } from '@playwright/test';
import packageJson from '../package.json';

test('e2e-query', async () => {
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const dateStr = yesterday.toISOString().split('T')[0];
  
  const packageName = packageJson.name;
  const yesterdayUsername = `${packageName}-${dateStr}-test-user`;
  
  const posthogApiKey = process.env.PERSONAL_ACCESS_KEY;
  const posthogProjectId = process.env.PROJECT_ID;
  const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.posthog.com';
  
  if (!posthogApiKey || !posthogProjectId) {
    throw new Error('PERSONAL_ACCESS_KEY and POSTHOG_PROJECT_ID environment variables are required');
  }
  
  const expectedEvents = ['server_login', '$web_vitals', 'user_logged_in', '$identify'];
  
  const query = {
    kind: 'HogQLQuery',
    query: `SELECT * FROM events WHERE distinct_id = '${yesterdayUsername}'`
  };
  
  const url = `${posthogHost}/api/projects/${posthogProjectId}/query/`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${posthogApiKey}`
    },
    body: JSON.stringify({
      query: query,
      name: 'e2e-query-yesterday-user-events'
    })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`PostHog API request failed: ${response.status} ${response.statusText}\n${errorText}`);
  }
  
  const data = await response.json();
  
  expect(data).toHaveProperty('results');
  expect(Array.isArray(data.results)).toBe(true);
  
  const columns = data.columns || [];
  const eventColumnIndex = columns.indexOf('event');
  
  expect(eventColumnIndex).not.toBe(-1);
  expect(eventColumnIndex).toBeGreaterThanOrEqual(0);
  
  const foundEvents = data.results
    .map((row: any[]) => row[eventColumnIndex])
    .filter((event: string) => event !== null && event !== undefined);
  
  expectedEvents.forEach(expectedEvent => {
    expect(foundEvents).toContain(expectedEvent);
  });
});
