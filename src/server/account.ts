import {db,query,write} from './db';
import {AppError} from './errors';
import {revokeDrive,driveClient} from './google';
import {randomUUID} from 'node:crypto';
export async function accountInfo(adminId:string){const owner=(await query(db(),'SELECT email FROM owner_identity WHERE admin_id=?',[adminId])).rows[0];if(!owner)throw new AppError(401,'Owner sign-in is required.');return {email:String(owner.email),driveConnected:!!(await query(db(),'SELECT admin_id FROM google_connections WHERE admin_id=?',[adminId])).rows.length};}
export function requireFreshAccountDelete(authenticatedAt:number,confirmation:string){if(confirmation!=='DELETE')throw new AppError(422,'Type DELETE to confirm account deletion.');if(Date.now()-authenticatedAt>300000||authenticatedAt>Date.now())throw new AppError(403,'Sign in with Google again, then delete the account within five minutes.');}
export async function deleteAccount(adminId:string,authenticatedAt:number,confirmation:string){
 requireFreshAccountDelete(authenticatedAt,confirmation);await revokeDrive(adminId);
 await write(async tx=>{const owner=(await query(tx,'SELECT admin_id FROM owner_identity WHERE singleton=1')).rows[0];if(owner?.admin_id!==adminId)throw new AppError(403,'Only the owner can delete this app account.');
 for(const table of ['oauth_handoffs','oauth_flows','sessions','google_connections','owner_identity','administrators','outbox','order_events','order_items','orders','daily_sequences','menu_options','menu_products','menu_categories','drive_assets','display_links','login_limits','app_settings'])await query(tx,`DELETE FROM ${table}`);
 await query(tx,"INSERT INTO app_settings(key,value) VALUES ('account_deleted','true')");});
 return {deleted:true};
}
export async function uploadDrivePhoto(adminId:string,dataUri:string,name:string){
 const match=dataUri.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/);if(!match||dataUri.length>350000)throw new AppError(422,'Choose an optimized JPEG, PNG or WebP photo.');
 const bytes=Buffer.from(match[2],'base64'),mime='image/'+match[1];
 const valid=match[1]==='jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:match[1]==='png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';if(!valid)throw new AppError(422,'The uploaded file is not a supported image.');
 const oauth=await driveClient(adminId),token=await oauth.getAccessToken();if(!token.token)throw new AppError(409,'Reconnect Google Drive.');
 const boundary='moped-'+randomUUID();const metadata=JSON.stringify({name:(name.trim()||'Menu photo').slice(0,80)+'.'+(match[1]==='jpeg'?'jpg':match[1]),appProperties:{app:'moped-momos',kind:'menu-photo'}});
 const body=Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`),bytes,Buffer.from(`\r\n--${boundary}--`)]);
 const result=await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',{method:'POST',headers:{Authorization:'Bearer '+token.token,'Content-Type':'multipart/related; boundary='+boundary},body,signal:AbortSignal.timeout(20000)});
 if(!result.ok)throw new AppError(result.status===401?409:502,result.status===401?'Reconnect Google Drive.':'Google Drive could not save this photo. Try again.');const file=await result.json();if(!/^[A-Za-z0-9_-]+$/.test(file.id??''))throw new AppError(502,'Drive returned an invalid photo identifier.');
 await query(db(),'INSERT INTO drive_assets VALUES (?,?,?)',[randomUUID(),file.id,Date.now()]);
 // A private optimized copy renders without making the Drive file public.
 return {image:dataUri,driveFileId:String(file.id)};
}
