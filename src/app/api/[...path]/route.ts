import {NextResponse,after} from 'next/server';
import {z,ZodError} from 'zod';
import {db,query} from '@/server/db';
import {SESSION_COOKIE,sameOrigin,requireAdmin,validateDisplay,hashToken,requestSession,nativeOrigin} from '@/server/auth';
import {AppError} from '@/server/errors';
import {beginGoogle,completeGoogleCallback,exchangeHandoff,revokeDrive,limitGoogleStart} from '@/server/google';
import {accountInfo,uploadDrivePhoto,deleteAccount} from '@/server/account';
import * as store from '@/server/store';
import {flushOutbox,tokenRequest,getAdminChannel} from '@/server/realtime';
import {csvCell,statuses,ticket,serviceLabel,serviceName} from '@/lib/domain';
import {initKeepAlive} from '@/server/keep-alive';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=30;
const headers={'Cache-Control':'private, no-store, max-age=0','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer'};
const json=(data:unknown,status=200)=>NextResponse.json({data},{status,headers});
async function body(req:Request,limit=64000) {if(Number(req.headers.get('content-length')??0)>limit)throw new AppError(413,'Request is too large.');const text=await req.text();if(text.length>limit)throw new AppError(413,'Request is too large.');try{return JSON.parse(text);}catch{throw new AppError(400,'Request body must be valid JSON.');}}
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!isNaN(Date.parse(v)));
async function dispatch(req:Request,context:{params:Promise<{path:string[]}>}) {
 try {
  const path=(await context.params).path.join('/'),url=new URL(req.url),method=req.method;
  if((path==='auth/login'||path==='auth/mobile-login')&&method==='POST')throw new AppError(410,'Password sign-in has been removed. Use Google sign-in.');
  if(path==='auth/google/start'&&method==='POST'){
   nativeOrigin(req);await limitGoogleStart(req);const input=z.object({kind:z.enum(['browser','native']),purpose:z.enum(['login','drive']),challenge:z.string().length(43),returnUri:z.string().max(500)}).parse(await body(req));const admin=input.purpose==='drive'?await requireAdmin(req):null;
   return json(await beginGoogle(input,admin?String(admin.id):undefined));
  }
  if(path==='auth/google/callback'&&method==='GET'){
   const state=z.string().regex(/^[A-Za-z0-9_-]{43}$/).parse(url.searchParams.get('state'));if(url.searchParams.has('error'))throw new AppError(403,'Google sign-in was cancelled. Return to Orders to try again.');const code=z.string().min(1).max(4096).parse(url.searchParams.get('code'));
   return NextResponse.redirect(await completeGoogleCallback(state,code),{status:303,headers});
  }
  if(path==='auth/google/exchange'&&method==='POST'){
   nativeOrigin(req);const input=z.object({code:z.string().regex(/^[A-Za-z0-9_-]{43}$/),verifier:z.string().min(43).max(128)}).parse(await body(req));const result=await exchangeHandoff(input.code,input.verifier);
   if('kind' in result&&result.kind==='browser'){const response=json({email:result.email,expiresAt:result.expiresAt});response.cookies.set(SESSION_COOKIE,result.token!,{httpOnly:true,secure:true,sameSite:'strict',path:'/',maxAge:365*24*3600});return response;}return json(result);
  }
  initKeepAlive();
   if((path==='ping'||path==='health')&&method==='GET'){return json({ok:true,service:'moped-momos',uptime:Math.round(process.uptime()),time:new Date().toISOString()});}
   if(path==='cron/outbox'&&method==='GET'){if(!process.env.CRON_SECRET||req.headers.get('authorization')!==`Bearer ${process.env.CRON_SECRET}`)throw new AppError(401,'Not authorized.');return json(await flushOutbox());}
  if(path.startsWith('kitchen/')) {
   if(method!=='GET')throw new AppError(405,'Kitchen displays are read-only.');
   const token=req.headers.get('x-kitchen-token')??'';const link=await validateDisplay(token);
   if(path==='kitchen/snapshot')return json(await store.kitchenSnapshot());
   if(path==='kitchen/check')return json({latest:await store.latestTimestamp()});
   if(path==='kitchen/token')return json({tokenRequest:await tokenRequest(link.channel),channel:link.channel});
   throw new AppError(404,'Endpoint not found.');
  }
  const administrator=await requireAdmin(req);if(method!=='GET'){if(requestSession(req).kind==='native')nativeOrigin(req);else sameOrigin(req);}
  if(path==='auth/logout'&&method==='POST'){const {token}=requestSession(req);if(token)await query(db(),'DELETE FROM sessions WHERE token_hash=?',[hashToken(token)]);const r=json({ok:true});r.cookies.delete(SESSION_COOKIE);return r;}
  if(path==='admin/account'&&method==='GET')return json(await accountInfo(String(administrator.id)));
  if(path==='admin/account'&&method==='DELETE'){const input=z.object({confirmation:z.literal('DELETE')}).parse(await body(req));const result=await deleteAccount(String(administrator.id),Number(administrator.authenticated_at),input.confirmation);const response=json(result);response.cookies.delete(SESSION_COOKIE);return response;}
  if(path==='admin/drive/disconnect'&&method==='POST'){await revokeDrive(String(administrator.id));return json({disconnected:true});}
  if(path==='admin/drive/upload'&&method==='POST'){const input=z.object({image:z.string().max(350000),name:z.string().max(80)}).parse(await body(req,400000));return json(await uploadDrivePhoto(String(administrator.id),input.image,input.name));}
  if(path==='admin/snapshot'&&method==='GET') {after(()=>flushOutbox().then(()=>{}).catch(()=>{}));return json(await store.snapshot());}
  if(path==='admin/check'&&method==='GET')return json({latest:await store.latestTimestamp()});
  if(path==='admin/token'&&method==='GET')return json({tokenRequest:await tokenRequest(),channel:getAdminChannel()});
  if(path==='admin/health'&&method==='GET')return json(await store.healthy());
   if(path==='admin/reset-data'&&method==='POST')return json(await store.clearOrders());
  if(path==='admin/orders'&&method==='POST'){const o=await store.createOrder(await body(req));after(()=>flushOutbox().then(()=>{}).catch(()=>{}));return json(o,201);}
  const match=path.match(/^admin\/orders\/([a-f0-9-]{36})(\/events)?$/);
  if(match&&method==='GET'&&match[2])return json(await store.orderEvents(match[1]));
  if(match&&method==='PATCH'&&!match[2]) {
   const b=z.object({version:z.number().int().min(1),status:z.enum(statuses).optional(),payment:z.object({collected:z.number().int().min(0),method:z.enum(['cash','upi','other']).nullable()}).optional(),edit:z.unknown().optional()}).refine(b=>[b.status,b.payment,b.edit].filter(x=>x!==undefined).length===1,{message:'Supply exactly one update action.'}).parse(await body(req));
   const o=await store.updateOrder(match[1],b.version,b);after(()=>flushOutbox().then(()=>{}).catch(()=>{}));return json(o);
  }
  if(path==='admin/menu'&&method==='POST')return json(await store.saveOption(await body(req,400000)));
  if(path==='admin/settings'&&method==='POST')return json(await store.saveSettings(await body(req)));
  if(path==='admin/display'&&method==='POST'){const link=await store.rotateDisplay();const QR=await import('qrcode');const displayUrl=(process.env.APP_ORIGIN??new URL(req.url).origin)+link.path;return json({...link,qrDataUrl:await QR.toDataURL(displayUrl,{width:320,margin:2})});}
  if((path==='admin/history'||path==='admin/export')&&method==='GET') {
   const fromParam=url.searchParams.get('from'),toParam=url.searchParams.get('to');
   const from=fromParam?date.parse(fromParam):'2020-01-01',to=toParam?date.parse(toParam):'2099-12-31';
   if(from>to)throw new AppError(422,'Start date must come before end date.');const orders=await store.history(from,to);
   if(path.endsWith('history'))return json(orders);
   const rows=[['Business date','Ticket','Status','Order type','Gross paise','Adjustment paise','Net paise','Collected paise','Unpaid paise','Method','Items'],...orders.map(o=>[o.businessDate,ticket(o.sequence),o.status,serviceLabel(o.items,o.type),o.subtotal,o.adjustment,o.total,o.collected,o.status==='cancelled'?0:o.total-o.collected,o.method??'',o.items.map(i=>`${i.quantity} × ${i.name} / ${i.variant} / ${i.portion} / ${serviceName(i.serviceType)}`).join('; ')])];
   return new Response('\uFEFF'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n'),{headers:{...headers,'Content-Type':'text/csv;charset=utf-8','Content-Disposition':`attachment; filename="moped-${from}-${to}.csv"`}});
  }
  throw new AppError(404,'Endpoint not found.');
 } catch(error) {
  if(error instanceof ZodError)return NextResponse.json({error:error.issues.map(i=>i.message).join(' ')},{status:422,headers});
  if(error instanceof AppError)return NextResponse.json({error:error.message},{status:error.status,headers});
  console.error('Request failed:',error instanceof Error?error.name:'UnknownError');return NextResponse.json({error:'The server could not finish this request. Check the connection and retry safely.'},{status:503,headers});
 }
}
async function handle(req:Request,context:{params:Promise<{path:string[]}>}){const response=await dispatch(req,context);const origin=req.headers.get('origin');if(origin&&(origin===process.env.APP_ORIGIN||origin===process.env.NATIVE_WEB_ORIGIN)){response.headers.set('Access-Control-Allow-Origin',origin);response.headers.set('Vary','Origin');}return response;}
export async function OPTIONS(req:Request){const origin=req.headers.get('origin');if(!origin||(origin!==process.env.APP_ORIGIN&&origin!==process.env.NATIVE_WEB_ORIGIN))return new Response(null,{status:403});return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET,POST,PATCH,DELETE,OPTIONS','Access-Control-Allow-Headers':'Authorization,Content-Type,X-Kitchen-Token','Vary':'Origin','Access-Control-Max-Age':'600'}});}
export {handle as GET,handle as POST,handle as PATCH,handle as DELETE};
