const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const source=fs.readFileSync(require.resolve('../public/billing-notice-adapter.js'),'utf8');
function setup(){const w=new JSDOM('<html><body><main></main></body></html>',{url:'https://app.example/',runScripts:'outside-only'}).window;let detail;w.ElunaBillingNotice={update:d=>detail=d};w.eval(source);return {w,current:()=>detail};}
for(const [name,access,allowed,status] of [
 ['demo',{allowed:true,accessStatus:'demo_available',accessReason:'demo_available'},true,'demo_available'],
 ['demo consumed',{allowed:false,accessStatus:'payment_unconfirmed',accessReason:'demo_exhausted'},false,'payment_unconfirmed'],
 ['paid',{allowed:true,accessStatus:'paid',accessReason:'paid'},true,'paid'],
 ['monthly trial with consumed legacy demo',{allowed:true,accessStatus:'trial_active',accessReason:'trial_active',trialActive:true,demoUsed:true},true,'trial_active'],
 ['expired trial',{allowed:false,accessStatus:'payment_unconfirmed',accessReason:'trial_expired'},false,'payment_unconfirmed'],
 ['missing decision',{purchaseMode:'platform_monthly'},false,'unverified'],
 ['missing access',null,false,'unverified'],
 ['official suspension',{allowed:false,accessStatus:'suspended',accessReason:'platform_blocked',paid:true},false,'suspended']
])test(`adapter presents backend decision: ${name}`,()=>{const {w,current}=setup();try{w.BillingNoticeAdapter.update({connected:true,storeId:'42',access});assert.equal(current().allowed,allowed);assert.equal(current().status,status);}finally{w.close();}});
test('platform API refusal overrides ledger without treating temporary errors as payment',()=>{const {w,current}=setup();try{for(const [status,reason] of [['payment_required','platform_api_restricted'],['unverified','verification_unavailable']]){w.BillingNoticeAdapter.update({connected:true,storeId:'42',access:{allowed:true,accessStatus:'trial_active'},connectionDecision:{allowed:false,status,reason}});assert.equal(current().allowed,false);assert.equal(current().status,status);}}finally{w.close();}});
test('retry delegates to the app instead of maintaining a second authorization state',()=>{const {w}=setup();let calls=0;try{w.BillingNoticeAdapter.setRetryHandler(()=>calls++);w.dispatchEvent(new w.CustomEvent('eluna:billing-retry'));assert.equal(calls,1);}finally{w.close();}});
test('partial startup state is pending and does not open a financial warning',()=>{const {w,current}=setup();try{w.BillingNoticeAdapter.update({connected:true,storeId:'42',checking:true});assert.equal(current().allowed,null);}finally{w.close();}});
test('failed verification is shown without claiming a debt',()=>{const {w,current}=setup();try{w.BillingNoticeAdapter.update({connected:true,storeId:'42',verificationFailed:true});assert.equal(current().allowed,false);assert.equal(current().status,'unverified');}finally{w.close();}});
test('notice renders backend financial refusal and support in all languages',()=>{
 for(const [lang,title] of [['pt-BR','Pagamento não confirmado'],['en','Payment not confirmed'],['es','Pago no confirmado']]){
  const {w}=setup();try{w.document.documentElement.lang=lang;delete w.ElunaBillingNotice;w.eval(fs.readFileSync(require.resolve('../public/billing-notice.js'),'utf8'));w.BillingNoticeAdapter.update({connected:true,storeId:'42',access:{allowed:false,accessStatus:'payment_unconfirmed',accessReason:'demo_exhausted'}});assert.equal(w.document.querySelector('[data-billing-title]').textContent,title);assert.equal(w.document.querySelector('[data-billing-action]').getAttribute('href'),'/support');}finally{w.close();}
 }
});
