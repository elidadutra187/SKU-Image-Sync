// Recovers missing payment notification subscriptions after transient API errors.
// Registration runs at boot (covers APP_URL changes) and retries every 5 minutes only after a failure.
// A clean scan waits idleMs: the 5-minute rescan of every store kept the Neon compute awake 24h.
export function createBillingWebhookReconciler({refresh,onError=()=>{},intervalMs=300000,idleMs=86400000,initialDelayMs=15000,schedule=setTimeout,cancel=clearTimeout}){
 let stopped=true,timer=null,running=false;
 const tick=async()=>{
  if(stopped||running)return;
  running=true;let failed=false;
  try{await refresh();}catch{failed=true;onError();}
  finally{running=false;if(!stopped){timer=schedule(tick,failed?intervalMs:idleMs);timer.unref?.();}}
 };
 return {start(){if(!stopped)return;stopped=false;timer=schedule(tick,initialDelayMs);timer.unref?.();},stop(){stopped=true;cancel(timer);}};
}
