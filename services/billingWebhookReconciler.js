// Recovers missing payment notification subscriptions after transient API errors.
export function createBillingWebhookReconciler({refresh,onError=()=>{},intervalMs=300000,initialDelayMs=15000,schedule=setTimeout,cancel=clearTimeout}){
 let stopped=true,timer=null,running=false;
 const tick=async()=>{
  if(stopped||running)return;
  running=true;
  try{await refresh();}catch{onError();}
  finally{running=false;if(!stopped){timer=schedule(tick,intervalMs);timer.unref?.();}}
 };
 return {start(){if(!stopped)return;stopped=false;timer=schedule(tick,initialDelayMs);timer.unref?.();},stop(){stopped=true;cancel(timer);}};
}
