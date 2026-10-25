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

 const refresh=useCallback(async()=>{
  if(running.current){dirty.current=true;await running.current;return;}
  const run=async()=>{
   do{
    dirty.current=false;
    try {
     if(kitchenToken)setKitchen(await api<KitchenSnapshot>('kitchen/snapshot','GET',undefined,kitchenToken));
     else setSnapshot(await api<Snapshot>('admin/snapshot'));
     if(mounted.current){setError('');setLastSync(Date.now());setHealth('Auto-sync');}
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

 useEffect(()=>{
  mounted.current=true;
  void refresh();
  const interval=setInterval(()=>{if(!document.hidden)void refresh();},2500);
  const online=()=>void refresh();
  const offline=()=>setHealth('Offline');
  const visibility=()=>{if(!document.hidden)void refresh();};
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
 },[refresh]);

 return {snapshot,kitchen,health,error,lastSync,revoked,refresh};
}
