'use client';
import {useEffect,useRef,useState,useCallback} from 'react';
import {api,ApiError} from '@/lib/client';
import type {Snapshot,KitchenOrder} from '@/lib/domain';

type KitchenSnapshot={menu?:import('@/lib/domain').KitchenMenuItem[];orders:KitchenOrder[];name:string;timezone:string;realtimeConfigured:boolean};

export function useFeed(kitchenToken?:string) {
 const [snapshot,setSnapshot]=useState<Snapshot|null>(null);
 const [kitchen,setKitchen]=useState<KitchenSnapshot|null>(null);
 const [health,setHealth]=useState('Connecting');
 const [error,setError]=useState('');
 const [lastSync,setLastSync]=useState(0);
 const [revoked,setRevoked]=useState(false);
 const running=useRef<Promise<void>|null>(null);
 const dirty=useRef(false);
 const mounted=useRef(true);
 const lastKnownTimestamp=useRef<number>(0);

 const fetchFull=useCallback(async()=>{
  if(running.current){dirty.current=true;await running.current;return;}
  const run=async()=>{
   do{
    dirty.current=false;
    try {
     const result=kitchenToken
      ? await api<KitchenSnapshot>('kitchen/snapshot','GET',undefined,kitchenToken)
      : await api<Snapshot>('admin/snapshot');
     if(mounted.current){
      if(kitchenToken)setKitchen(result as KitchenSnapshot);
      else setSnapshot(result as Snapshot);
      setError('');
      setLastSync(Date.now());
      setHealth('Auto-sync');
      const orders=(result as {orders?:Array<{updatedAt?:number}>}).orders??[];
      const latest=orders.reduce((max,o)=>Math.max(max,o.updatedAt??0),0);
      if(latest>0)lastKnownTimestamp.current=latest;
     }
    }catch(e){
     if(mounted.current){
      setError(e instanceof Error?e.message:'Could not refresh the queue.');
      setHealth(navigator.onLine?'Reconnecting':'Offline');
      if(e instanceof ApiError&&e.status===403){setRevoked(true);setKitchen(null);}
     }
    }
   }while(dirty.current&&mounted.current);
  };
  running.current=run();
  try{await running.current;}finally{running.current=null;}
 },[kitchenToken]);

 const poll=useCallback(async()=>{
  if(document.hidden||!mounted.current)return;
  try{
   const {latest}=await api<{latest:number}>(kitchenToken?'kitchen/check':'admin/check','GET',undefined,kitchenToken);
   if(latest>lastKnownTimestamp.current||!lastKnownTimestamp.current){
    await fetchFull();
   }else if(mounted.current){
    setLastSync(Date.now());
    setError('');
    setHealth('Auto-sync');
   }
  }catch{
   void fetchFull();
  }
 },[kitchenToken,fetchFull]);

 useEffect(()=>{
  mounted.current=true;
  void fetchFull();
  // Smart 8s poll when tab is visible
  const interval=setInterval(()=>{if(!document.hidden)void poll();},8000);
  const online=()=>void fetchFull();
  const offline=()=>setHealth('Offline');
  const visibility=()=>{if(!document.hidden)void fetchFull();};
  window.addEventListener('online',online);
  window.addEventListener('offline',offline);
  document.addEventListener('visibilitychange',visibility);
  return()=>{
   mounted.current=false;
   clearInterval(interval);
   window.removeEventListener('online',online);
   window.removeEventListener('offline',offline);
   document.removeEventListener('visibilitychange',visibility);
  };
 },[fetchFull,poll]);

 return {snapshot,kitchen,health,error,lastSync,revoked,refresh:fetchFull};
}
