import {test} from 'node:test';import assert from 'node:assert/strict';
import {treasuryTargets,treasuryExpectedPaid} from '../src/utils/treasury-targets';
test('treasury action and balance target exactly the displayed children, not returned/rejected/unapproved siblings',()=>{
 const all=[{id:'TEST-visible',paidAmountSoFar:4},{id:'TEST-returned',status:'Needs_Revision'},{id:'TEST-unapproved',status:'Pending_Approver'}],items:any[]=[{type:'BATCH',id:'TEST-parent',batchItems:[all[0]],rawBatch:{items:all}},{type:'PAYMENT',id:'TEST-single',paidAmountSoFar:3},{type:'MANUAL',id:'TEST-manual'}];
 assert.deepEqual(treasuryTargets(items),[{type:'BATCH_ITEM',id:'TEST-visible',batchId:'TEST-parent'},{type:'PAYMENT',id:'TEST-single'}]);assert.deepEqual(treasuryExpectedPaid(items),{'BATCH_ITEM:TEST-parent:TEST-visible':4,'PAYMENT:TEST-single':3});
 assert.deepEqual(treasuryTargets([{type:'BATCH',id:'TEST-empty',rawBatch:{items:all}}] as any),[]);assert.deepEqual(treasuryExpectedPaid([{type:'BATCH',id:'TEST-empty',rawBatch:{items:all}}] as any),{});
});
