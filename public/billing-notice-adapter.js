'use strict';
/** Presentation only: commercial decisions come from /sync/access; platform API
 * refusals come from /auth/status. An active monthly trial has no demo batch quota.
 * Missing decisions are unverified, never inferred debts or unrestricted access.
 * Retry uses the app verification flow so notice and actions stay together.
 */
(function() {
  let lastState=null,retryHandler=null;
  function update(data) {
    const access=data.access,decision=data.connectionDecision;
    const verified=typeof access?.allowed==='boolean';
    const apiBlocked=decision?.allowed===false;
    const allowed=data.checking?null:!data.verificationFailed&&verified&&!apiBlocked&&access.allowed;
    const status=data.verificationFailed?'unverified':apiBlocked?decision.status:verified?access.accessStatus:'unverified';
    const detail={connected:Boolean(data.connected),storeId:data.storeId||null,
      platform:data.platform||'nuvemshop',allowed,status,
      state:apiBlocked?decision.reason:verified?access.accessReason:'unverified',supportUrl:'/support',billingUrl:null};
    const key=JSON.stringify(detail);
    if(key===lastState)return;
    lastState=key;
    window.ElunaBillingNotice?.update(detail);
    window.dispatchEvent(new CustomEvent('eluna:billing',{detail}));
  }
  window.addEventListener('eluna:billing-retry',()=>retryHandler?.());
  window.BillingNoticeAdapter={update,setRetryHandler:handler=>{retryHandler=handler;}};
})();
