import {AppError} from './errors';
export interface GoogleIdentity {sub?:string;email?:string;email_verified?:boolean;nonce?:string;}
export function ownerEmail(){const email=process.env.OWNER_GOOGLE_EMAIL?.trim().toLowerCase();if(!email||!/^\S+@\S+\.\S+$/.test(email))throw new AppError(503,'The single owner Google account has not been configured.');return email;}
export function validateOwnerIdentity(identity:GoogleIdentity,nonce:string){if(!identity.sub||identity.email_verified!==true||identity.email?.toLowerCase()!==ownerEmail()||identity.nonce!==nonce)throw new AppError(403,`Only the configured owner Google account (${ownerEmail()}) can use Orders. You signed in as ${identity.email??'unknown'}.`);return {sub:identity.sub,email:identity.email.toLowerCase()};}
