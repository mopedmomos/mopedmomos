import Ably from 'ably';
import { db,query } from './db';
import { AppError } from './errors';
let client:Ably.Rest|undefined;
function rest() {if(!process.env.ABLY_API_KEY)throw new AppError(503,'Live connection is not configured. Automatic refresh is active.');return client??=new Ably.Rest({key:process.env.ABLY_API_KEY});}
const adminChannel=()=>process.env.ABLY_CHANNEL??'moped-orders';
export async function tokenRequest(channel?:string) {return rest().auth.createTokenRequest({ttl:60000,capability:JSON.stringify({[channel??adminChannel()]:['subscribe']})});}
export async function flushOutbox() {
 if(!process.env.ABLY_API_KEY)return {sent:0,pending:true};
 const pending=await query(db(),'SELECT * FROM outbox WHERE published_at IS NULL ORDER BY created_at LIMIT 30');
 const links=await query(db(),'SELECT channel FROM display_links WHERE revoked_at IS NULL');let sent=0;
 for(const row of pending.rows) {
  try {const payload={eventId:String(row.id),orderId:String(row.order_id),version:Number(row.version)};const channels=[adminChannel(),...links.rows.map(l=>String(l.channel))];await Promise.all(channels.map(c=>rest().channels.get(c).publish('order-change',payload)));await query(db(),'UPDATE outbox SET published_at=?,attempts=attempts+1 WHERE id=?',[Date.now(),String(row.id)]);sent++;}
  catch {await query(db(),'UPDATE outbox SET attempts=attempts+1 WHERE id=?',[String(row.id)]);console.error('Order notification delayed; database snapshot remains authoritative.');break;}
 }
 return {sent,pending:sent<pending.rows.length};
}
export const getAdminChannel=adminChannel;
