const test=require('node:test'),assert=require('node:assert/strict');
test('MP availability rejects native and unknown store IDs even when all live flags are on',async()=>{
 const loaded=await import('../services/yampiPaymentRuntime.js'),m=loaded.default||loaded;
 let calls=0;const pool={query:async()=>{calls++;throw Error('unexpected database call');},connect:async()=>{calls++;throw Error('unexpected database connection');}};
 const env={BASE_URL:'https://app.example',APP_URL:'https://app.example',DATABASE_URL:'postgres://test:test@localhost/unused',YAMPI_MP_ENABLED:'true',YAMPI_MP_MODE:'production',YAMPI_MP_PRODUCTION_ENABLED:'true',YAMPI_MP_ACCESS_TOKEN:'test-fixture-not-real',YAMPI_MP_WEBHOOK_SECRET:'test-fixture',YAMPI_MP_COLLECTOR_ID:'123',YAMPI_MP_APPLICATION_ID:'456'};
 const runtime=m.buildYampiPaymentRuntime({env,poolProvider:async()=>pool,sessionReader:()=>null});
 try{for(const id of ['123','shopify:one','',null,'yampi:../one'])assert.equal(runtime.available(id),false,String(id));assert.equal(runtime.available('yampi:one'),true);assert.equal(calls,0);}finally{await runtime.stop();}
});
