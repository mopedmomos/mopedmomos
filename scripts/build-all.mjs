import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const isRender = Boolean(process.env.RENDER);
const skipExport = isRender || process.env.SKIP_EXPO_EXPORT === 'true' || process.argv.includes('--skip-expo');

if (!skipExport && existsSync('public/index.html')) {
  console.log('--- Pre-built Expo web apps found in public/ ---');
}

if (!skipExport && (!existsSync('public/index.html') || process.env.FORCE_EXPO_EXPORT === 'true')) {
  console.log('--- 1. Exporting Orders Expo Web App ---');
  execSync('npm --prefix mobile run export:orders:web', { stdio: 'inherit' });

  console.log('--- 2. Exporting Kitchen Expo Web App ---');
  execSync('npm --prefix mobile run export:kitchen:web', { stdio: 'inherit' });

  console.log('--- 3. Assembling Expo Apps into public/ ---');
  execSync('node scripts/assemble-native-preview.mjs public', { stdio: 'inherit' });
} else {
  console.log('--- Serving pre-built Expo web apps from public/ ---');
}

console.log('--- Building Next.js Server ---');
execSync('npx next build --webpack', { stdio: 'inherit' });

console.log('--- Build Complete! ---');
