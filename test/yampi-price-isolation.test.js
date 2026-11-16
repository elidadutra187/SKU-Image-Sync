import test from 'node:test';
import assert from 'node:assert/strict';
import {createCommercialAccess,validateBatchAccess} from '../services/commercialAccess.js';

test('Imagem keeps approved Yampi monthly price separate from the native price',async()=>{
 const access=createCommercialAccess({async status(){return {paid:false,demoBatchesUsed:1};}});
 const yampi=await access.status('yampi:demo'),native=await access.status('123');
 assert.equal(yampi.oneTimePriceCents,null);assert.equal(yampi.monthlyPriceCents,3990);assert.equal(yampi.purchaseMode,'mercadopago_monthly');
 assert.equal(native.oneTimePriceCents,7999);assert.equal(native.paymentProvider,'nuvemshop');
 assert.throws(()=>validateBatchAccess(yampi,1,1),error=>error.status===402&&error.message.includes('Mercado Pago')&&!error.message.includes('79,99'));
 assert.throws(()=>validateBatchAccess(native,1,1),error=>error.status===402&&error.message.includes('79,99'));
});
