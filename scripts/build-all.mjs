import { execSync } from 'node:child_process';

console.log('--- 1. Exporting Orders Expo Web App ---');
execSync('npm --prefix mobile run export:orders:web', { stdio: 'inherit' });

console.log('--- 2. Exporting Kitchen Expo Web App ---');
execSync('npm --prefix mobile run export:kitchen:web', { stdio: 'inherit' });

console.log('--- 3. Assembling Expo Apps into public/ ---');
execSync('node scripts/assemble-native-preview.mjs public', { stdio: 'inherit' });

console.log('--- 4. Building Next.js Server ---');
execSync('npx next build --webpack', { stdio: 'inherit' });

console.log('--- Build All Complete! ---');
