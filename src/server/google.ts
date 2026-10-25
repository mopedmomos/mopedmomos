import {OAuth2Client,type Credentials} from 'google-auth-library';
import {createCipheriv,createDecipheriv,createHash,createHmac,randomBytes,randomUUID} from 'node:crypto';
import {db,query,write} from './db';
import {hashToken,randomToken} from './auth';
import {AppError} from './errors';
import {ownerEmail,validateOwnerIdentity,type GoogleIdentity} from './owner-policy';
export const DRIVE_SCOPE='https://www.googleapis.com/auth/drive.file';
function config(){const origin=process.env.APP_ORIGIN,id=process.env.GOOGLE_CLIENT_ID,secret=process.env.GOOGLE_CLIENT_SECRET;ownerEmail();if(!origin||(!origin.startsWith('https://')&&!origin.startsWith('http://localhost')&&!origin.startsWith('http://127.0.0.1'))||!id||!secret)throw new AppError(503,'Google sign-in needs its production Google OAuth configuration.');return {origin,id,secret};}
function client(){const c=config();return new OAuth2Client(c.id,c.secret,c.origin+'/api/auth/google/callback');}
function tokenKey(){const key=Buffer.from(process.env.GOOGLE_TOKEN_ENCRYPTION_KEY??'','base64');if(key.length!==32)throw new AppError(503,'Google Drive token encryption is not configured.');return key;}
export function sealTokens(value:Credentials){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',tokenKey(),iv);const bytes=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),bytes]).toString('base64');}
export function openTokens(value:string):Credentials{const bytes=Buffer.from(value,'base64'),decipher=createDecipheriv('aes-256-gcm',tokenKey(),bytes.subarray(0,12));decipher.setAuthTag(bytes.subarray(12,28));return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString('utf8'));}
export function validateReturnUri(uri:string,kind:'browser'|'native'){
 if(kind==='native'&&['mopedmomos-orders://auth','mopedmomos-wrapper://auth'].includes(uri))return uri;
 const u=new URL(uri),allowed=[process.env.APP_ORIGIN,process.env.NATIVE_WEB_ORIGIN].filter(Boolean);if(!allowed.includes(u.origin)||!['/','/auth/complete'].includes(u.pathname)||u.search||u.hash||u.username||u.password)throw new AppError(403,'This sign-in return address is not allowed.');return uri;
}
export async function beginGoogle(input:{kind:'browser'|'native';purpose:'login'|'drive';challenge:string;returnUri:string},adminId?:string){
 const c=config();if(!/^[A-Za-z0-9_-]{43}$/.test(input.challenge))throw new AppError(422,'Sign-in requires PKCE.');validateReturnUri(input.returnUri,input.kind);
 if((await query(db(),"SELECT key FROM app_settings WHERE key='account_deleted'")).rows.length)throw new AppError(403,'This app account has been deleted. Sign-in is disabled.');
 if(input.purpose==='drive'){if(!adminId)throw new AppError(401,'Sign in before connecting Drive.');tokenKey();}
 const oauth=client(),pkce=await oauth.generateCodeVerifierAsync(),state=randomToken(),nonce=randomToken(),now=Date.now();
 await write(async tx=>{await query(tx,'DELETE FROM oauth_flows WHERE expires_at<?',[now]);await query(tx,'DELETE FROM oauth_handoffs WHERE expires_at<?',[now]);await query(tx,'INSERT INTO oauth_flows VALUES (?,?,?,?,?,?,?,?,?)',[hashToken(state),nonce,pkce.codeVerifier,input.challenge,input.returnUri,input.kind,input.purpose,adminId??null,now+300000]);});
 const authorizationUrl=oauth.generateAuthUrl({access_type:input.purpose==='drive'?'offline':'online',scope:['openid','email',...(input.purpose==='drive'?[DRIVE_SCOPE]:[])],prompt:input.purpose==='drive'?'consent select_account':'select_account',state,nonce,login_hint:ownerEmail(),code_challenge:pkce.codeChallenge,code_challenge_method:'S256' as import('google-auth-library').CodeChallengeMethod});
 return {authorizationUrl,state,origin:c.origin};
}
export async function completeGoogleCallback(state:string,code:string){
 const flow=await write(async tx=>{const r=await query(tx,'DELETE FROM oauth_flows WHERE state_hash=? AND expires_at>? RETURNING *',[hashToken(state),Date.now()]);return r.rows[0];});if(!flow)throw new AppError(403,'This Google sign-in expired or was already used.');
 const oauth=client(),exchange=await oauth.getToken({code,codeVerifier:String(flow.google_verifier)}),tokens=exchange.tokens;if(!tokens.id_token)throw new AppError(403,'Google did not return a verified identity.');
 const verified=await oauth.verifyIdToken({idToken:tokens.id_token,audience:config().id});const identity=validateOwnerIdentity(verified.getPayload() as GoogleIdentity,String(flow.nonce));
 const adminId=await write(async tx=>{
  if((await query(tx,"SELECT key FROM app_settings WHERE key='account_deleted'")).rows.length)throw new AppError(403,'This app account is deleted.');
  const owner=(await query(tx,'SELECT * FROM owner_identity WHERE singleton=1')).rows[0];
  if(owner&&(owner.google_sub!==identity.sub||owner.email!==identity.email))throw new AppError(403,'A different Google account is already bound to this app.');
  if(flow.purpose==='drive'&&(!owner||owner.admin_id!==flow.admin_id))throw new AppError(403,'Drive must use the same owner account.');
  if(owner)return String(owner.admin_id);
  const id=randomUUID();await query(tx,'INSERT INTO administrators VALUES (?,?,?,?)',[id,identity.email,'GOOGLE_ONLY',Date.now()]);await query(tx,'INSERT INTO owner_identity VALUES (1,?,?,?,?)',[id,identity.sub,identity.email,Date.now()]);return id;
 });
 if(flow.purpose==='drive'){
  if(!tokens.scope?.split(' ').includes(DRIVE_SCOPE))throw new AppError(403,'Allow the menu-photo Drive permission to connect.');
  const old=(await query(db(),'SELECT encrypted_tokens FROM google_connections WHERE admin_id=?',[adminId])).rows[0];const previous=old?openTokens(String(old.encrypted_tokens)):{};
  if(!tokens.refresh_token&&!previous.refresh_token)throw new AppError(403,'Google did not grant offline Drive access. Reconnect and allow access.');
  await query(db(),'INSERT INTO google_connections VALUES (?,?,?) ON CONFLICT(admin_id) DO UPDATE SET encrypted_tokens=excluded.encrypted_tokens,updated_at=excluded.updated_at',[adminId,sealTokens({...previous,...tokens,refresh_token:tokens.refresh_token??previous.refresh_token}),Date.now()]);
 }
 const handoff=randomToken();await query(db(),'INSERT INTO oauth_handoffs VALUES (?,?,?,?,?,?)',[hashToken(handoff),String(flow.app_challenge),adminId,String(flow.kind),String(flow.purpose),Date.now()+60000]);
 const redirect=new URL(String(flow.return_uri));redirect.searchParams.set('auth_code',handoff);redirect.searchParams.set('flow',state);return redirect.href;
}
export async function exchangeHandoff(code:string,verifier:string){
 if(!/^[A-Za-z0-9_-]{43,128}$/.test(verifier))throw new AppError(403,'Invalid sign-in verifier.');const challenge=createHash('sha256').update(verifier).digest('base64url');
 return write(async tx=>{const r=await query(tx,'DELETE FROM oauth_handoffs WHERE code_hash=? AND app_challenge=? AND expires_at>? RETURNING *',[hashToken(code),challenge,Date.now()]);const flow=r.rows[0];if(!flow)throw new AppError(403,'This sign-in was not started on this device or has expired.');const owner=(await query(tx,"SELECT * FROM owner_identity WHERE admin_id=? AND email=? AND NOT EXISTS(SELECT 1 FROM app_settings WHERE key='account_deleted')",[String(flow.admin_id),ownerEmail()])).rows[0];if(!owner)throw new AppError(403,'Owner access is unavailable.');
 const token=randomToken(),now=Date.now(),expiresAt=now+365*24*3600000;await query(tx,'INSERT INTO sessions(token_hash,admin_id,expires_at,kind,authenticated_at) VALUES (?,?,?,?,?)',[hashToken(token),String(flow.admin_id),expiresAt,String(flow.kind),now]);return {token,expiresAt,kind:String(flow.kind),email:String(owner.email),driveConnected:flow.purpose==='drive'};});
}
export async function driveClient(adminId:string){const r=(await query(db(),'SELECT encrypted_tokens FROM google_connections WHERE admin_id=?',[adminId])).rows[0];if(!r)throw new AppError(409,'Connect your owner Google Drive in Account & Drive before uploading a photo.');const oauth=client();oauth.setCredentials(openTokens(String(r.encrypted_tokens)));oauth.on('tokens',t=>{void query(db(),'UPDATE google_connections SET encrypted_tokens=?,updated_at=? WHERE admin_id=?',[sealTokens({...oauth.credentials,...t}),Date.now(),adminId]).catch(()=>{});});return oauth;}
export async function revokeDrive(adminId:string){const r=(await query(db(),'SELECT encrypted_tokens FROM google_connections WHERE admin_id=?',[adminId])).rows[0];if(!r)return;const tokens=openTokens(String(r.encrypted_tokens));await query(db(),'DELETE FROM google_connections WHERE admin_id=?',[adminId]);const token=tokens.refresh_token??tokens.access_token;if(token)await fetch('https://oauth2.googleapis.com/revoke',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token}),signal:AbortSignal.timeout(10000)}).catch(()=>{});}

export async function limitGoogleStart(req:Request){
 const secret=process.env.AUTH_SECRET;if(!secret||secret.length<32)throw new AppError(503,'Authentication rate-limit protection is not configured.');
 const ip=(process.env.VERCEL || process.env.RENDER)?req.headers.get('x-forwarded-for')?.split(',')[0].trim()??'unknown':'shared';const key=createHmac('sha256',secret).update('google:'+ip).digest('hex'),now=Date.now();
 const attempts=await write(async tx=>{await query(tx,'INSERT INTO login_limits(key_hash,window_start,attempts) VALUES (?,?,1) ON CONFLICT(key_hash) DO UPDATE SET attempts=CASE WHEN window_start<? THEN 1 ELSE attempts+1 END,window_start=CASE WHEN window_start<? THEN excluded.window_start ELSE window_start END',[key,now,now-900000,now-900000]);return Number((await query(tx,'SELECT attempts FROM login_limits WHERE key_hash=?',[key])).rows[0].attempts);});
 if(attempts>20)throw new AppError(429,'Too many sign-in attempts. Try again in 15 minutes.');
}
