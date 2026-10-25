import {spawnSync} from 'node:child_process';
const [role,...args]=process.argv.slice(2);
if(!['orders','kitchen','wrapper'].includes(role)||!args.length)throw new Error('Usage: node scripts/run-variant.mjs orders|kitchen|wrapper <expo arguments>');
const result=spawnSync(process.platform==='win32'?'npx.cmd':'npx',['expo',...args],{stdio:'inherit',shell:process.platform==='win32',env:{...process.env,APP_VARIANT:role,EXPO_PUBLIC_APP_VARIANT:role}});
if(result.error)throw result.error;
process.exit(result.status??1);
