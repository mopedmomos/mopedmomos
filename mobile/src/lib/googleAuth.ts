import {Platform,Linking} from 'react-native';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {readSecret,writeSecret,deleteSecret} from './storage';
const pendingKey='moped-oauth-pending-v1';
type Pending={origin:string;verifier:string;state:string;createdAt:number};
export type GoogleResult={token:string;expiresAt:number;email:string}|{driveConnected:true};
async function request<T>(origin:string,path:string,body:unknown,token?:string):Promise<T>{const r=await fetch(origin+'/api/'+path,{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});const json=await r.json();if(!r.ok)throw new Error(json.error??'Could not complete Google sign-in.');return json.data;}
export async function finishGoogleAuth(url:string):Promise<{origin:string;result:GoogleResult}|null>{
 const callback=new URL(url);const code=callback.searchParams.get('auth_code');if(!code)return null;
 // Web redirect needs temporary PKCE state across a full-page redirect; no bearer token is persisted here.
 const raw=Platform.OS==='web'?await AsyncStorage.getItem(pendingKey):await readSecret(pendingKey);if(!raw)throw new Error('This Google sign-in was not started on this device.');const p=JSON.parse(raw) as Pending;
 if(callback.searchParams.get('flow')!==p.state||Date.now()-p.createdAt>300000)throw new Error('Google sign-in expired. Try again.');
 try{return {origin:p.origin,result:await request<GoogleResult>(p.origin,'auth/google/exchange',{code,verifier:p.verifier})};}finally{if(Platform.OS==='web'){await AsyncStorage.removeItem(pendingKey);window.history.replaceState(null,'',window.location.pathname);}else await deleteSecret(pendingKey);}
}
export async function signInGoogle(origin:string,purpose:'login'|'drive'='login',token?:string):Promise<GoogleResult|null>{
 const verifier=Array.from(await Crypto.getRandomBytesAsync(32),b=>b.toString(16).padStart(2,'0')).join('');
 const digest=await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,verifier,{encoding:Crypto.CryptoEncoding.BASE64});const challenge=digest.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
 const wrapper=Platform.OS==='web'&&!!(window as unknown as {__MOPED_WRAPPER__?:boolean}).__MOPED_WRAPPER__;
 const returnUri=wrapper?'mopedmomos-wrapper://auth':Platform.OS==='web'?window.location.origin+'/':'mopedmomos-orders://auth';
 const flow=await request<{authorizationUrl:string;state:string}>(origin,'auth/google/start',{kind:'native',purpose,challenge,returnUri},token);
 const pending:Pending={origin,verifier,state:flow.state,createdAt:Date.now()};if(Platform.OS==='web')await AsyncStorage.setItem(pendingKey,JSON.stringify(pending));else await writeSecret(pendingKey,JSON.stringify(pending));
 if(Platform.OS==='web'){
  if(wrapper){(window as unknown as {ReactNativeWebView:{postMessage:(message:string)=>void}}).ReactNativeWebView.postMessage(JSON.stringify({type:'google-auth',url:flow.authorizationUrl}));return null;}
  window.location.assign(flow.authorizationUrl);return null;
 }
 const auth=await WebBrowser.openAuthSessionAsync(flow.authorizationUrl,returnUri);if(auth.type!=='success'){await deleteSecret(pendingKey);throw new Error('Google sign-in was cancelled.');}
 return (await finishGoogleAuth(auth.url))?.result??null;
}
