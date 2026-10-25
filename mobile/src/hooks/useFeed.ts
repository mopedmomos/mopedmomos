import {useCallback,useEffect,useRef,useState} from 'react';
import {AppState,type AppStateStatus} from 'react-native';
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
  const lastKnownTimestamp=useRef<number>(0);

  const fetchFull=useCallback(async()=>{
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
            const orders=(result as {orders?:Array<{updatedAt?:number}>}).orders??[];
            const latest=orders.reduce((max,o)=>Math.max(max,o.updatedAt??0),0);
            if(latest>0)lastKnownTimestamp.current=latest;
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

  const poll=useCallback(async()=>{
    if(AppState.currentState!=='active'||!alive.current)return;
    try{
      const {latest}=await repo.check(kitchenToken);
      if(latest>lastKnownTimestamp.current||!lastKnownTimestamp.current){
        await fetchFull();
      }else if(alive.current){
        setLastSync(Date.now());
        setError('');
      }
    }catch{
      void fetchFull();
    }
  },[repo,kitchenToken,fetchFull]);

  useEffect(()=>{
    alive.current=true;
    let timer:ReturnType<typeof setInterval>|null=null;

    const startTimer=()=>{
      if(timer)clearInterval(timer);
      timer=setInterval(()=>{
        if(AppState.currentState==='active')void poll();
      },8000);
    };

    const stopTimer=()=>{
      if(timer){
        clearInterval(timer);
        timer=null;
      }
    };

    if(AppState.currentState==='active'){
      void fetchFull();
      startTimer();
    }

    const app=AppState.addEventListener('change',(state:AppStateStatus)=>{
      if(state==='active'){
        void fetchFull();
        startTimer();
      }else{
        // Stop timer when backgrounded or locked: zero calls, zero DB reads
        stopTimer();
      }
    });

    const unsubscribe=repo.subscribe(()=>void fetchFull());

    return()=>{
      alive.current=false;
      stopTimer();
      app.remove();
      unsubscribe();
    };
  },[repo,kitchenToken,fetchFull,poll]);

  return {
    snapshot,
    kitchen,
    error,
    lastSync,
    revoked,
    health:error?'Reconnecting':'Auto-sync',
    refresh:fetchFull
  };
}
