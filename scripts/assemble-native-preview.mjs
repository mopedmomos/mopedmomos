import {cpSync,mkdirSync,rmSync,existsSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const output=resolve(process.argv[2]??'preview-native');
for(const role of ['orders','kitchen'])if(!existsSync(`mobile/dist-${role}/index.html`))throw new Error(`Export ${role} web before assembling the preview.`);
if(!output.endsWith('public'))rmSync(output,{recursive:true,force:true});
cpSync('mobile/dist-orders',output,{recursive:true});
for(const folder of ['assets','_expo'])if(existsSync(`mobile/dist-kitchen/${folder}`))cpSync(`mobile/dist-kitchen/${folder}`,`${output}/${folder}`,{recursive:true});
mkdirSync(`${output}/kitchen`,{recursive:true});
cpSync('mobile/dist-kitchen/index.html',`${output}/kitchen/index.html`);
for(const path of [output+'/index.html',output+'/kitchen/index.html']){const html=readFileSync(path,'utf8');writeFileSync(path,html.replace('</head>','<meta name="referrer" content="no-referrer"><meta name="robots" content="noindex,nofollow"></head>'));}
console.log(`Orders and Kitchen previews assembled at ${output}`);
