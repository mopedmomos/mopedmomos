import {randomUUID,createHash} from 'node:crypto';
import type {Row, Transaction} from '@libsql/client';
import {db,query,write,type Executor} from './db';
import {AppError} from './errors';
import {hashToken,randomToken} from './auth';
import {draftSchema,optionSchema,settingsSchema} from './validation';
import {businessDate,calculateStats,canTransition,defaultSettings,isActive,kitchenProjection,type Order,type OrderItem,type Settings,type MenuOption,type Draft,type Status} from '../lib/domain';
export async function settings(cx:Executor=db()):Promise<Settings> {const r=await query(cx,"SELECT value FROM app_settings WHERE key='stall'");return r.rows[0]?JSON.parse(String(r.rows[0].value)):defaultSettings;}
export async function menu(cx:Executor=db()):Promise<MenuOption[]> {
 const r=await query(cx,'SELECT o.*,p.name,p.category_id,c.name AS category FROM menu_options o JOIN menu_products p ON p.id=o.product_id JOIN menu_categories c ON c.id=p.category_id ORDER BY o.sort,p.name');
 return r.rows.map(r=>({id:String(r.id),productId:String(r.product_id),name:String(r.name),variant:String(r.variant),portion:String(r.portion),pieces:r.pieces===null?null:Number(r.pieces),price:Number(r.price),available:!!r.available,category:String(r.category),sort:Number(r.sort),image:String(r.image),...(r.drive_file_id?{driveFileId:String(r.drive_file_id)}:{})}));
}
function mapItem(r:Row):OrderItem {return {serviceType:String(r.service_type) as OrderItem['serviceType'],id:String(r.id),optionId:String(r.option_id),name:String(r.name),variant:String(r.variant),portion:String(r.portion),pieces:r.pieces===null?null:Number(r.pieces),quantity:Number(r.quantity),unitPrice:Number(r.unit_price),total:Number(r.total),note:String(r.note)};}
export async function readOrders(cx:Executor,where='1=1',args:(string|number)[]=[]):Promise<Order[]> {
 const rows=(await query(cx,`SELECT * FROM orders WHERE ${where} ORDER BY created_at DESC LIMIT 1001`,args)).rows;
 if(rows.length>1000)throw new AppError(422,'Too many tickets. Choose a shorter date range.');
 if(!rows.length)return [];
 const all=(await query(cx,`SELECT * FROM order_items WHERE order_id IN (${rows.map(()=>'?').join(',')})`,rows.map(r=>String(r.id)))).rows;
 return rows.map(r=>({id:String(r.id),businessDate:String(r.business_date),sequence:Number(r.sequence),status:String(r.status) as Status,type:String(r.order_type) as Order['type'],note:String(r.note),subtotal:Number(r.subtotal),adjustment:Number(r.adjustment),total:Number(r.total),collected:Number(r.collected),method:r.payment_method as Order['method'],createdAt:Number(r.created_at),updatedAt:Number(r.updated_at),version:Number(r.version),items:all.filter(i=>i.order_id===r.id).map(mapItem)}));
}
export async function snapshot() {return write(async tx=>{const config=await settings(tx);const today=businessDate(new Date(),config.timezone);const [items,orders,link]=await Promise.all([menu(tx),readOrders(tx,"business_date=? OR status IN ('pending','preparing','ready')",[today]),query(tx,'SELECT id FROM display_links WHERE revoked_at IS NULL LIMIT 1')]);return {menu:items,orders,settings:config,businessDate:today,stats:calculateStats(orders.filter(o=>o.businessDate===today)),realtimeConfigured:!!process.env.ABLY_API_KEY,displayConfigured:!!link.rows.length};});}
export async function kitchenSnapshot() {return write(async tx=>{const all=await readOrders(tx,"status IN ('pending','preparing','ready')");const config=await settings(tx);return {menu:(await menu(tx)).map(({id,name,variant,portion,category,sort,available})=>({id,name,variant,portion,category,sort,available})),orders:kitchenProjection(all).sort((a,b)=>a.createdAt-b.createdAt),name:config.name,timezone:config.timezone,serverTime:Date.now(),realtimeConfigured:!!process.env.ABLY_API_KEY};});}
async function record(tx:Transaction,orderId:string,version:number,kind:string,detail:unknown) {
 const id=randomUUID(),now=Date.now();await query(tx,'INSERT INTO order_events(id,order_id,kind,version,created_at,detail) VALUES (?,?,?,?,?,?)',[id,orderId,kind,version,now,JSON.stringify(detail)]);await query(tx,'INSERT INTO outbox(id,order_id,version,created_at) VALUES (?,?,?,?)',[id,orderId,version,now]);
}
function normalizeDraft(raw:unknown):Draft {const p=draftSchema.parse(raw);const merged=new Map<string,{optionId:string;quantity:number;note:string;serviceType:Order['type']}>();for(const i of p.items){const serviceType=i.serviceType??p.type;const key=i.optionId+':'+serviceType;const old=merged.get(key);const qty=(old?.quantity??0)+i.quantity;if(qty>99)throw new AppError(422,'Maximum quantity is 99 per serving option and service type.');merged.set(key,{optionId:i.optionId,quantity:qty,serviceType,note:[old?.note,i.note].filter(Boolean).join('; ').slice(0,160)});}return {...p,items:[...merged.values()].sort((a,b)=>(a.optionId+':'+a.serviceType).localeCompare(b.optionId+':'+b.serviceType))};}
async function buildItems(tx:Transaction,p:Draft,previous?:Order) {
 const options=await menu(tx);return p.items.map(i=>{const opt=options.find(o=>o.id===i.optionId);const original=previous?.items.find(o=>o.optionId===i.optionId);if(!opt||(!opt.available&&!original))throw new AppError(409,'An item is no longer available. Refresh the menu.');return {serviceType:i.serviceType??p.type,id:randomUUID(),optionId:opt.id,name:original?.name??opt.name,variant:original?.variant??opt.variant,portion:original?.portion??opt.portion,pieces:original?original.pieces:opt.pieces,quantity:i.quantity,unitPrice:original?.unitPrice??opt.price,total:i.quantity*(original?.unitPrice??opt.price),note:i.note??''};});
}
async function insertItems(tx:Transaction,id:string,items:OrderItem[]) {for(const i of items)await query(tx,'INSERT INTO order_items(id,order_id,option_id,name,variant,portion,pieces,quantity,unit_price,total,note,service_type) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',[i.id,id,i.optionId,i.name,i.variant,i.portion,i.pieces,i.quantity,i.unitPrice,i.total,i.note,i.serviceType]);}
export async function createOrder(raw:unknown) {
 const p=normalizeDraft(raw);const fingerprint=createHash('sha256').update(JSON.stringify(p)).digest('hex');
 return write(async tx=>{
  const prior=await query(tx,'SELECT id,request_hash FROM orders WHERE idempotency_key=?',[p.idempotencyKey]);
  if(prior.rows[0]){if(prior.rows[0].request_hash!==fingerprint)throw new AppError(409,'This submission was already used for a different order.');return (await readOrders(tx,'id=?',[String(prior.rows[0].id)]))[0];}
  const config=await settings(tx);const date=businessDate(new Date(),config.timezone);const items=await buildItems(tx,p);const subtotal=items.reduce((s,i)=>s+i.total,0),total=subtotal+p.adjustment;if(total<0)throw new AppError(422,'Adjustment cannot exceed the order value.');
  const seq=await query(tx,'INSERT INTO daily_sequences(business_date,sequence) VALUES (?,1) ON CONFLICT(business_date) DO UPDATE SET sequence=sequence+1 RETURNING sequence',[date]);
  const id=randomUUID(),now=Date.now();await query(tx,"INSERT INTO orders(id,business_date,sequence,status,order_type,note,subtotal,adjustment,total,collected,payment_method,created_at,updated_at,version,idempotency_key,request_hash) VALUES (?,?,?,'pending',?,?,?,?,?,?,?,?,?,1,?,?)",[id,date,Number(seq.rows[0].sequence),p.type,p.note,subtotal,p.adjustment,total,p.paid?total:0,p.paymentMethod,now,now,p.idempotencyKey,fingerprint]);
  await insertItems(tx,id,items);await record(tx,id,1,'created',{items,note:p.note,total,type:p.type});return (await readOrders(tx,'id=?',[id]))[0];
 });
}
export async function updateOrder(id:string,version:number,action:{status?:Status;payment?:{collected:number;method:Order['method']};edit?:unknown}) {
 return write(async tx=>{
  const order=(await readOrders(tx,'id=?',[id]))[0];if(!order)throw new AppError(404,'Ticket not found.');if(order.version!==version)throw new AppError(409,'This ticket changed on another screen. Refresh and try again.');
  const next={...order,version:version+1,updatedAt:Date.now()};let kind='updated';
  if(action.status){if(!canTransition(order.status,action.status))throw new AppError(409,'This status change is no longer allowed.');next.status=action.status;kind=action.status;}
  else if(action.payment){if(action.payment.collected>order.total)throw new AppError(422,'Collection cannot exceed ticket value.');next.collected=action.payment.collected;next.method=action.payment.method;if(next.collected>0&&!next.method)throw new AppError(422,'Choose a payment method.');kind='payment';}
  else if(action.edit){if(!['pending','preparing'].includes(order.status))throw new AppError(409,'Only pending or preparing tickets can be edited.');const p=normalizeDraft(action.edit);next.items=await buildItems(tx,p,order);next.subtotal=next.items.reduce((s,i)=>s+i.total,0);next.adjustment=p.adjustment;next.total=next.subtotal+p.adjustment;if(next.total<next.collected||next.total<0)throw new AppError(422,'Refund the excess collection before reducing the ticket total.');next.note=p.note;next.type=p.type;await query(tx,'DELETE FROM order_items WHERE order_id=?',[id]);await insertItems(tx,id,next.items);kind='edited';}
  else throw new AppError(422,'Choose an update action.');
  const r=await query(tx,'UPDATE orders SET status=?,order_type=?,note=?,subtotal=?,adjustment=?,total=?,collected=?,payment_method=?,updated_at=?,version=? WHERE id=? AND version=?',[next.status,next.type,next.note,next.subtotal,next.adjustment,next.total,next.collected,next.method,next.updatedAt,next.version,id,version]);if(r.rowsAffected!==1)throw new AppError(409,'Ticket was changed. Refresh and try again.');await record(tx,id,next.version,kind,{before:order,after:next});return next;
 });
}
export async function saveOption(raw:unknown) {const o=optionSchema.parse(raw);await write(async tx=>{const category=o.category.toLowerCase().replace(/[^a-z0-9]/g,'-')||randomUUID();await query(tx,'INSERT INTO menu_categories(id,name) VALUES (?,?) ON CONFLICT(name) DO NOTHING',[category,o.category]);const c=await query(tx,'SELECT id FROM menu_categories WHERE name=?',[o.category]);await query(tx,'INSERT INTO menu_products(id,category_id,name) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,category_id=excluded.category_id',[o.productId,String(c.rows[0].id),o.name]);await query(tx,'INSERT INTO menu_options(id,product_id,variant,portion,pieces,price,available,sort,image,drive_file_id) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET product_id=excluded.product_id,variant=excluded.variant,portion=excluded.portion,pieces=excluded.pieces,price=excluded.price,available=excluded.available,sort=excluded.sort,image=excluded.image,drive_file_id=excluded.drive_file_id',[o.id,o.productId,o.variant,o.portion,o.pieces,o.price,o.available?1:0,o.sort,o.image,o.driveFileId??null]);});return o;}
export async function saveSettings(raw:unknown) {const value=settingsSchema.parse(raw);await query(db(),"INSERT INTO app_settings(key,value) VALUES ('stall',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",[JSON.stringify(value)]);return value;}
export async function rotateDisplay() {const token=randomToken(),id=randomUUID();await write(async tx=>{await query(tx,'UPDATE display_links SET revoked_at=? WHERE revoked_at IS NULL',[Date.now()]);await query(tx,'INSERT INTO display_links(id,token_hash,channel,created_at) VALUES (?,?,?,?)',[id,hashToken(token),`kitchen-${id}`,Date.now()]);});return {token,path:`/k/${token}`};}
export async function orderEvents(id:string) {const r=await query(db(),'SELECT * FROM order_events WHERE order_id=? ORDER BY created_at,version',[id]);return r.rows.map(r=>({id:String(r.id),orderId:String(r.order_id),kind:String(r.kind),version:Number(r.version),createdAt:Number(r.created_at),detail:String(r.detail)}));}
export async function history(from:string,to:string) {return write(tx=>readOrders(tx,'business_date>=? AND business_date<=?',[from,to]));}
export async function clearOrders() {
  await write(async tx => {
    await query(tx, 'DELETE FROM outbox');
    await query(tx, 'DELETE FROM order_events');
    await query(tx, 'DELETE FROM order_items');
    await query(tx, 'DELETE FROM orders');
    await query(tx, 'DELETE FROM daily_sequences');
  });
  return { cleared: true };
}
export async function healthy() {await query(db(),'SELECT 1');return {database:true,realtime:!!process.env.ABLY_API_KEY};}
export {isActive};
