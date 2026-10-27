import test from 'node:test';
import assert from 'node:assert/strict';
import NuvemshopClient from '../services/nuvemshop.js';

for (const [status,connected,apiAvailable,paymentRequired] of [[402,true,false,true],[401,false,false,false],[403,false,false,false],[200,true,true,false]]) {
  test(`connection status distinguishes OAuth from API access (${status})`,async()=>{
    const client=new NuvemshopClient({storeId:'5255436',accessToken:'fixture',userAgent:'fixture'});
    client.request=async()=>{if(status!==200)throw Object.assign(new Error('provider detail'),{status});return [];};
    const result=await client.testConnection();
    assert.equal(result.connected,connected);
    assert.equal(result.apiAvailable,apiAvailable);
    assert.equal(result.paymentRequired,paymentRequired);
    assert.equal(result.platform,'nuvemshop');
    if(status===402)assert.match(result.message,/pagamento/i);
    assert.doesNotMatch(result.message,/provider detail/);
  });
}
