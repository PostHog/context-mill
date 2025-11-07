// @ignoreFile
import { test, expect } from '@playwright/test';

// Global variables to store the generated username
let generatedUsername: string;

// PostHog event tracking
let eventCounts: Record<string, number> = {};
let capturedEvents: Array<{
  event: string;
  timestamp: string;
  uuid?: string;
  properties?: any;
  fullMessage: string;
}> = [];

test('verify user is logged in', async ({ page }) => {
  // Reset event tracking
  eventCounts = {};
  capturedEvents = [];
  
  // Setup PostHog event monitoring
  setupPostHogEventMonitoring(page);
  
  // Navigate to home page and wait for network to be idle  
  await loginAsTestAgent(page);
  
  // Wait for expected PostHog events
  await waitForExpectedEvents(['$pageview', 'user_logged_in', '$identify']);
  
  // Verify we can see the welcome message (user should be logged in from beforeEach)
  await expect(page.getByText(`Welcome back, ${generatedUsername}!`)).toBeVisible();
  
  // Print PostHog events summary
  printPostHogEventsSummary();
  
  // Assert PostHog events snapshot using Playwright's built-in snapshot functionality
  const eventsSnapshot = createPostHogEventsSnapshot();
  expect(JSON.stringify(eventsSnapshot, null, 2)).toMatchSnapshot('posthog-events.json');
  
  // Verify expected events were captured
  verifyExpectedEvents();
});

// Helper functions

// PostHog Events Snapshot Helper - Using Playwright's built-in snapshot functionality
function createPostHogEventsSnapshot() {
  return {
    eventCounts: eventCounts,
    events: capturedEvents.map(event => ({
      event: event.event,
      properties: event.properties,
      fullMessage: sanitizeMessage(event.fullMessage)
    }))
  };
}

// Sanitize dynamic values in messages for stable snapshots
function sanitizeMessage(message: string): string {
  return message
    // Replace UUIDs with placeholder
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '[UUID]')
    // Replace PostHog UUIDs (longer format)
    .replace(/[0-9a-f]{24}/gi, '[POSTHOG_UUID]')
    // Replace all timestamp formats with placeholder (including timezone descriptions)
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z|[A-Za-z]{3} \w{3} \d{1,2} \d{4} \d{2}:\d{2}:\d{2} GMT[+-]\d{4}( \([^)]+\))?/g, '[TIMESTAMP]');
}

// Wait for expected PostHog events
async function waitForExpectedEvents(expectedEvents: string[], timeout: number = 10000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const foundEvents = expectedEvents.filter(eventName => eventCounts[eventName] > 0);
    
    if (foundEvents.length === expectedEvents.length) {
      console.log(`✅ All expected events found: ${foundEvents.join(', ')}`);
      return;
    }
    
    const remainingEvents = expectedEvents.filter(eventName => !foundEvents.includes(eventName));
    if (remainingEvents.length > 0) {
      console.log(`⏳ Still waiting for events: ${remainingEvents.join(', ')}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log(`⏰ Timeout waiting for events: ${expectedEvents.join(', ')}`);
  console.log(`📊 Current event counts:`, eventCounts);
}

// Verify expected events were captured
function verifyExpectedEvents() {
  const expectedEvents = ['$pageview', 'user_logged_in', '$identify'];
  const missingEvents = expectedEvents.filter(eventName => !eventCounts[eventName]);
  
  if (missingEvents.length > 0) {
    console.log(`⚠️  Missing expected events: ${missingEvents.join(', ')}`);
  } else {
    console.log('✅ All expected events were captured!');
  }
  
  // Assert that we have at least some events
  expect(capturedEvents.length).toBeGreaterThan(0);
  
  // Assert that we have the key events
  expect(eventCounts['$pageview']).toBeGreaterThan(0);
  expect(eventCounts['user_logged_in']).toBeGreaterThan(0);
  expect(eventCounts['$identify']).toBeGreaterThan(0);
}

// Setup PostHog event monitoring
function setupPostHogEventMonitoring(page: any) {
  page.on('console', (msg: any) => {
    const text = msg.text();
    
    // Capture PostHog events from console logs
    if (text.includes('[PostHog.js] send "') && text.includes('{uuid:')) {
      const eventMatch = text.match(/\[PostHog\.js\] send "([^"]+)"/);
      if (eventMatch) {
        const eventName = eventMatch[1];
        eventCounts[eventName] = (eventCounts[eventName] || 0) + 1;
        
        // Extract UUID from the message
        const uuidMatch = text.match(/{uuid: ([^,}]+)/);
        const uuid = uuidMatch ? uuidMatch[1] : undefined;
        
        // Extract properties from the message - try multiple patterns
        let properties = undefined;
        
        // Try to extract properties object
        const propertiesMatch = text.match(/properties: (Object|{[^}]+})/);
        if (propertiesMatch) {
          if (propertiesMatch[1] === 'Object') {
            properties = '[Object - see full message for details]';
          } else {
            try {
              properties = JSON.parse(propertiesMatch[1]);
            } catch (e) {
              properties = propertiesMatch[1];
            }
          }
        }
        
        // Also try to extract $set and $set_once for identify events
        const setMatch = text.match(/\$set: (Object|{[^}]+})/);
        const setOnceMatch = text.match(/\$set_once: (Object|{[^}]+})/);
        
        if (setMatch || setOnceMatch) {
          // Create a clean object for $set and $set_once
          const identifyProps: any = {};
          
          if (setMatch) {
            identifyProps.$set = setMatch[1] === 'Object' ? '[Object]' : setMatch[1];
          }
          
          if (setOnceMatch) {
            identifyProps.$set_once = setOnceMatch[1] === 'Object' ? '[Object]' : setOnceMatch[1];
          }
          
          // If we already have properties, merge them properly
          if (properties && typeof properties === 'object') {
            properties = { ...properties, ...identifyProps };
          } else {
            properties = identifyProps;
          }
        }
        
        capturedEvents.push({
          event: eventName,
          timestamp: new Date().toISOString(),
          uuid: uuid,
          properties: properties,
          fullMessage: text
        });
        
      }
    }
  });
}

// Print PostHog events summary
function printPostHogEventsSummary() {
  console.log('\n🎯 ===== POSTHOG EVENTS SUMMARY =====');
  console.log(`📊 Total Events Captured: ${capturedEvents.length}`);
  console.log(`📈 Event Counts:`);
  
  Object.entries(eventCounts).forEach(([eventName, count]) => {
    console.log(`  - ${eventName}: ${count}`);
  });
  
  console.log('\n📋 Detailed Event Information:');
  capturedEvents.forEach((event, index) => {
    console.log(`\n${index + 1}. Event: ${event.event}`);
    console.log(`   Timestamp: ${event.timestamp}`);
    console.log(`   UUID: ${event.uuid || 'N/A'}`);
    if (event.properties) {
      console.log(`   Properties:`, JSON.stringify(event.properties, null, 2));
    }
    console.log(`   Full Message: ${event.fullMessage}`);
  });
  
  console.log('\n🎯 ===== END POSTHOG EVENTS SUMMARY =====\n');
}

// Login helper function
async function loginAsTestAgent(page: any) {
  await page.goto('/');

  const randomPassword = 'test_password_123';

  generatedUsername = 'test_user';

  // Fill in the username field
  await page.getByLabel('Username:').fill(generatedUsername);

  // Fill in the password field with random password
  await page.getByLabel('Password:').fill(randomPassword);

  // Click the Sign In button
  await page.getByRole('button', { name: 'Sign In' }).click();

  // Expect to see the welcome message after successful login
  await expect(page.getByText(`Welcome back, ${generatedUsername}!`)).toBeVisible();
}