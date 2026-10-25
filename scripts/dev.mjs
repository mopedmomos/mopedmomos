import {spawn} from 'node:child_process';
const args=process.argv.slice(2),get=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--hostname',get('--host','0.0.0.0'),'--port',get('--port',process.env.PORT??'3000')],{stdio:'inherit',env:process.env});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));child.on('exit',code=>process.exit(code??0));
