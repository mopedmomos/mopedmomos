import { createClient, type Client, type Transaction, type InValue } from '@libsql/client';
let instance:Client|undefined;
export function db():Client {
 if(instance)return instance;
 const url=process.env.TURSO_DATABASE_URL;
 if(!url)throw new Error('TURSO_DATABASE_URL is required. Run setup before taking orders.');
 if((process.env.VERCEL || process.env.RENDER) && !url.startsWith('libsql://') && !url.startsWith('https://'))throw new Error('Cloud deployments require a remote Turso database.');
 instance=createClient({url,authToken:process.env.TURSO_AUTH_TOKEN,intMode:'number'}); return instance;
}
export type Executor=Client|Transaction;
export const query=(cx:Executor,sql:string,args:InValue[]=[])=>cx.execute({sql,args});
export async function write<T>(fn:(tx:Transaction)=>Promise<T>):Promise<T> {
 for(let attempt=0;;attempt++) {
  let tx:Transaction|undefined;
  try {tx=await db().transaction('write');const result=await fn(tx);await tx.commit();return result;}
  catch(error) {if(tx&&!tx.closed)await tx.rollback().catch(()=>{});const code=String((error as {code?:string}).code);if(attempt<3&&/BUSY|TRANSACTION_CONFLICT/.test(code)){await new Promise(r=>setTimeout(r,40*(attempt+1)));continue;}throw error;}
  finally {tx?.close();}
 }
}
