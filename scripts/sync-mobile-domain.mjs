import {copyFile} from 'node:fs/promises';
for(const name of ['domain.ts','presentation.ts','upi.ts'])await copyFile(`src/lib/${name}`,`mobile/src/lib/${name}`);
console.log('Native domain contracts synchronized.');
