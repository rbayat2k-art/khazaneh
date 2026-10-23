import {test} from 'node:test';import assert from 'node:assert/strict';
import {indexExecutionReceipts,executionReceipt} from '../src/utils/payment-execution-history';
test('receipt lookup index preserves membership and first matching duplicate without rescanning all receipts',()=>{
 let reads=0;const receipts:any[]=Array.from({length:10000},(_,i)=>new Proxy({id:'R'+i,relatedPaymentIds:['P'+i]},{get(o,k){if(k==='id')reads++;return Reflect.get(o,k);}}));
 receipts.push({id:'R0',relatedPaymentIds:['OTHER']},{id:'',relatedPaymentIds:['P0']});const lookup=indexExecutionReceipts(receipts);reads=0;
 for(let i=0;i<10000;i++)assert.equal(lookup({receiptId:'R'+i} as any,'P'+i),receipts[i]);
 assert.ok(reads<=10000,'indexed lookup must not repeatedly scan the whole receipt catalog');
 for(const [receiptId,rowId] of [['R0','P0'],['R0','OTHER'],['R0','FORGED'],['MISSING','P0'],[undefined,'P0'],[null,'P0'],['','P0']])assert.equal(lookup({receiptId} as any,rowId as string),executionReceipt(receipts,{receiptId} as any,rowId as string));
});
