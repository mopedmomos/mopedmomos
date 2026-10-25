import {readFileSync,readdirSync} from 'node:fs';
import {db,query,write} from '../src/server/db';
await db().execute('CREATE TABLE IF NOT EXISTS schema_migrations(version TEXT PRIMARY KEY,applied_at INTEGER NOT NULL)');
for(const file of readdirSync('migrations').filter(x=>x.endsWith('.sql')).sort()) {
 await write(async tx=>{if((await query(tx,'SELECT version FROM schema_migrations WHERE version=?',[file])).rows.length)return;
 for(const statement of readFileSync(`migrations/${file}`,'utf8').split(';').map(x=>x.trim()).filter(Boolean))await tx.execute(statement);
 await query(tx,'INSERT INTO schema_migrations VALUES (?,?)',[file,Date.now()]);});console.log('Migration ready:',file);
}
await db().execute('PRAGMA foreign_keys=ON');db().close();
