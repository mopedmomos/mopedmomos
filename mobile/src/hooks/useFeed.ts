import {useCallback,useEffect,useRef,useState} from 'react';
import {AppState} from 'react-native';
import {ApiError,type Repository,type KitchenSnapshot} from '../lib/repository';
import type {Snapshot} from '../lib/domain';

export function useFeed(repo:Repository,kitchenToken?:string){
  const [snapshot,setSnapshot]=useState<Snapshot|null>(null);
  const [kitchen,setKitchen]=useState<KitchenSnapshot|null>(null);
  const [error,setError]=useState('');
  const [lastSync,setLastSync]=useState(0);
  const [revoked,setRevoked]=useState(false);
  const running=useRef<Promise<void>|null>(null);
  const dirty=useRef(false);
  const alive=useRef(true);

  const refresh=useCallback(async()=>{
    if(running.current){dirty.current=true;return running.current;}
    const run=async()=>{
      do{
        dirty.current=false;
        try{
          const result=kitchenToken?await repo.kitchen(kitchenToken):await repo.snapshot();
          if(alive.current){
            if(kitchenToken)setKitchen(result as KitchenSnapshot);
            else setSnapshot(result as Snapshot);
            setError('');
            setLastSync(Date.now());
          }
        }catch(e){
          if(alive.current){
            setError(e instanceof Error?e.message:'Could not refresh.');
            if(e instanceof ApiError&&e.status===403&&kitchenToken){
              setRevoked(true);
              setKitchen(null);
            }
          }
        }
      }while(dirty.current&&alive.current);
    };
    running.current=run();
    try{await running.current;}finally{running.current=null;}
  },[repo,kitchenToken]);

  useEffect(()=>{
    alive.current=true;
    void refresh();
    // Fast automatic sync every 2.5 seconds when the app is active
    const timer=setInterval(()=>{
      if(AppState.currentState==='active')void refresh();
    },2500);
    const app=AppState.addEventListener('change',state=>{
      if(state==='active')void refresh();
    });
    const unsubscribe=repo.subscribe(()=>void refresh());
    return()=>{
      alive.current=false;
      clearInterval(timer);
      app.remove();
      unsubscribe();
    };
  },[repo,kitchenToken,refresh]);

  return {
    snapshot,
    kitchen,
    error,
    lastSync,
    revoked,
    health:error?'Reconnecting':'Auto-sync',
    refresh
  };
}
