import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

// Read .env file
const envPath = resolve(rootDir, '.env');
const envContent = readFileSync(envPath, 'utf-8');

// Parse .env
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const [key, ...valueParts] = trimmed.split('=');
    env[key] = valueParts.join('=');
  }
}

// Generate environment.generated.ts
const output = `// Auto-generated from .env - DO NOT EDIT
export const generatedEnv = {
  posthogKey: '${env.VITE_POSTHOG_KEY || ''}',
  posthogHost: '${env.VITE_POSTHOG_HOST || 'https://us.posthog.com'}',
};
`;

writeFileSync(resolve(rootDir, 'src/environments/environment.generated.ts'), output);
console.log('Generated environment.generated.ts from .env');
