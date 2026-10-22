import {test} from 'node:test';import assert from 'node:assert/strict';import {authorizeRequest} from '../src/server/access-control';import {getDefaultPermissionsForRole} from '../src/types/treasury';
import {treasuryInput} from '../src/server/treasury-input';
const viewer:any={id:'SYN-user',role:'REQUESTER',company:'SYN',department:'SYN'},db:any={users:[viewer],roleConfigs:[{role:'REQUESTER',allowedCompanies:['SYN']}],paymentRequests:[],advanceRequests:[],batchPayments:[]},auth:any={effectivePermissions:getDefaultPermissionsForRole('REQUESTER'),effectiveAccessScope:'SELF_ONLY',effectiveApprovalLimitRial:100000,effectivePaymentLimitRial:100000};
for(const [name,amount]of [['boolean',true],['array',[1]],['fraction',1.5],['unsafe',9007199254740992],['exponent','1e3']] as const)test('money rejects '+name,()=>{
 assert.equal(authorizeRequest({path:'/payment-requests',method:'POST',body:{amount}},viewer,db,auth)?.status,400);
});
test('money rejects group sum overflow even when individual amounts are safe',()=>{
 assert.equal(authorizeRequest({path:'/batch-payments',method:'POST',body:{batchType:'PAYMENT',items:[{amount:Number.MAX_SAFE_INTEGER},{amount:1}]}},viewer,db,auth)?.status,400);
});
test('a stale financial form cannot register another partial under a new operation key',()=>{
 const state:any={paymentRequests:[{id:'SYN-PAY',amount:12000,approvedAmount:12000,paidAmountSoFar:5000,status:'In_Payment'}],advanceRequests:[],batchPayments:[]};
 const result=treasuryInput({items:[{type:'PAYMENT',id:'SYN-PAY'}],paymentAmount:5000,idempotencyKey:'SYN-NEW-KEY',expectedPaidAmounts:{'PAYMENT:SYN-PAY':0}},state,true);
 assert.equal('error' in result,true);assert.equal((result as any).status,409);
});
