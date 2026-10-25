'use client';
import {useEffect,useRef,useState,useCallback} from 'react';
import {api,ApiError} from '@/lib/client';
import type {Snapshot,KitchenOrder} from '@/lib/domain';
type KitchenSnapshot={menu?:import('@/lib/domain').KitchenMenuItem[];orders:KitchenOrder[];name:string;timezone:string;realtimeConfigured:boolean};
export function useFeed(kitchenToken?:string) {
 const [snapshot,setSnapshot]=useState<Snapshot|null>(null),[kitchen,setKitchen]=useState<KitchenSnapshot|null>(null);
 const [health,setHealth]=useState('Connecting'),[error,setError]=useState(''),[lastSync,setLastSync]=useState(0),[revoked,setRevoked]=useState(false),[live,setLive]=useState(false);
 const running=useRef<Promise<void>|null>(null),dirty=useRef(false),mounted=useRef(true);
 const refresh=useCallback(async()=>{
  if(running.current){dirty.current=true;await running.current;return;}
  const run=async()=>{do{dirty.current=false;try {
   if(kitchenToken)setKitchen(await api<KitchenSnapshot>('kitchen/snapshot','GET',undefined,kitchenToken));
   else setSnapshot(await api<Snapshot>('admin/snapshot'));
   if(mounted.current){setError('');setLastSync(Date.now());setHealth('Auto-refresh');}
  }catch(e){if(mounted.current){setError(e instanceof Error?e.message:'Could not refresh the queue.');setHealth(navigator.onLine?'Reconnecting':'Offline');if(e instanceof ApiError&&e.status===403){setRevoked(true);setKitchen(null);}}}}while(dirty.current&&mounted.current);};
  running.current=run();try{await running.current;}finally{running.current=null;}
 },[kitchenToken]);
 useEffect(()=>{mounted.current=true;void refresh();const interval=setInterval(()=>{if(!document.hidden)void refresh();},live?15000:3000);const online=()=>void refresh();const offline=()=>setHealth('Offline');const visibility=()=>{if(!document.hidden)void refresh();};window.addEventListener('online',online);window.addEventListener('offline',offline);document.addEventListener('visibilitychange',visibility);return()=>{mounted.current=false;clearInterval(interval);window.removeEventListener('online',online);window.removeEventListener('offline',offline);document.removeEventListener('visibilitychange',visibility);};},[refresh,live]);
 const enabled=snapshot?.realtimeConfigured??kitchen?.realtimeConfigured;
 useEffect(()=>{
  if(!enabled||revoked)return;
  let closed=false;let client:import('ably').Realtime|undefined;const seen=new Set<string>();
  void (async()=>{try{const Ably=await import('ably');const authPath=kitchenToken?'kitchen/token':'admin/token';const initial=await api<{tokenRequest:import('ably').TokenRequest;channel:string}>(authPath,'GET',undefined,kitchenToken);if(closed)return;
   client=new Ably.Realtime({authCallback:(_params,callback)=>{void api<{tokenRequest:import('ably').TokenRequest}>(authPath,'GET',undefined,kitchenToken).then(r=>callback(null,r.tokenRequest)).catch(e=>{callback(e.message,null);void refresh();});},autoConnect:true});
   client.connection.on('connected',()=>{if(!closed){setLive(true);void refresh();}});for(const state of ['disconnected','suspended','failed'] as const)client.connection.on(state,()=>{if(!closed){setLive(false);setHealth('Reconnecting');}});
   await client.channels.get(initial.channel).subscribe('order-change',message=>{const id=String(message.data?.eventId);if(seen.has(id))return;seen.add(id);if(seen.size>256)seen.delete(seen.values().next().value!);void refresh();});
  }catch{if(!closed)setLive(false);}})();
  return()=>{closed=true;client?.close();};
 },[enabled,kitchenToken,revoked,refresh]);
 return {snapshot,kitchen,health:live&&!error?'Live':health,error,lastSync,revoked,refresh};
}
