import {createHash,randomBytes} from 'node:crypto';
import {db,query} from './db';
import {AppError} from './errors';
import {ownerEmail} from './owner-policy';
export const SESSION_COOKIE='moped_session';
export const hashToken=(s:string)=>createHash('sha256').update(s).digest('hex');
export const randomToken=()=>randomBytes(32).toString('base64url');
export async function getSession(token:string|undefined,kind:'browser'|'native'='browser'){
 if(!token)return null;
 const result=await query(db(),`SELECT a.id,a.username,o.email,s.authenticated_at FROM sessions s JOIN administrators a ON a.id=s.admin_id JOIN owner_identity o ON o.admin_id=a.id WHERE s.token_hash=? AND s.expires_at>? AND s.kind=? AND o.email=? AND NOT EXISTS(SELECT 1 FROM app_settings WHERE key='account_deleted')`,[hashToken(token),Date.now(),kind,ownerEmail()]);return result.rows[0]??null;
}
export function requestSession(req:Request):{token:string|undefined;kind:'browser'|'native'}{const a=req.headers.get('authorization');if(a)return {token:/^Bearer [a-zA-Z0-9_-]{43}$/.test(a)?a.slice(7):undefined,kind:'native'};return {token:req.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(SESSION_COOKIE+'='))?.slice(SESSION_COOKIE.length+1),kind:'browser'};}
export async function requireAdmin(req:Request){const c=requestSession(req),s=await getSession(c.token,c.kind);if(!s)throw new AppError(401,'Sign in with the owner Google account to continue.');return s;}
export function nativeOrigin(req:Request){const origin=req.headers.get('origin');if(origin&&origin!==process.env.APP_ORIGIN&&origin!==process.env.NATIVE_WEB_ORIGIN)throw new AppError(403,'Request origin is not allowed.');}
export function sameOrigin(req:Request){const expected=process.env.APP_ORIGIN??new URL(req.url).origin;if(req.headers.get('origin')!==expected)throw new AppError(403,'Request origin is not allowed.');}
export async function validateDisplay(token:string){if(!/^[a-zA-Z0-9_-]{43}$/.test(token))throw new AppError(403,'This kitchen link is invalid or has been replaced.');const r=await query(db(),'SELECT id,channel FROM display_links WHERE token_hash=? AND revoked_at IS NULL',[hashToken(token)]);if(!r.rows[0])throw new AppError(403,'This kitchen link is invalid or has been replaced.');return {id:String(r.rows[0].id),channel:String(r.rows[0].channel)};}
