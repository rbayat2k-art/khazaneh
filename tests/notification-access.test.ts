import {test} from 'node:test';import assert from 'node:assert/strict';import {notificationVisible} from '../src/server/notification-access';
const viewer:any={id:'TEST-A',role:'REQUESTER',isActive:true},db:any={advanceRequests:[],paymentRequests:[],batchPayments:[],receiptArchives:[{id:'TEST-MIXED',relatedPaymentIds:['TEST-A','TEST-B']},{id:'TEST-OWN',relatedPaymentIds:['TEST-A']}]};
const n:any={eventType:'PAYMENT_EXECUTED',requestId:'TEST-A',recipientRole:'REQUESTER',receiptId:'TEST-MIXED'};
test('payment notifications require all server receipt targets; one visible target or a legacy first target is not sufficient',()=>{
 assert.equal(notificationVisible(n,viewer,db,id=>id==='TEST-A'),false);assert.equal(notificationVisible({...n,receiptId:undefined},viewer,db,()=>true),false);assert.equal(notificationVisible({...n,receiptId:'MISSING'},viewer,db,()=>true),false);
 assert.equal(notificationVisible({...n,receiptId:'TEST-OWN'},viewer,db,id=>id==='TEST-A'),true);assert.equal(notificationVisible(n,{...viewer,role:'ADMIN'},db,()=>false),true);
});
test('notification and SMS audience must retain current identity, role, activity, and target permission',()=>{
 assert.equal(notificationVisible({...n,receiptId:'TEST-OWN'},viewer,db,()=>false),false);assert.equal(notificationVisible({...n,receiptId:'TEST-OWN'},{...viewer,isActive:false},db,()=>true),false);assert.equal(notificationVisible({...n,receiptId:'TEST-OWN'},{...viewer,mustChangePassword:true},db,()=>true),false);
 assert.equal(notificationVisible({...n,receiptId:'TEST-OWN',recipientUserId:'TEST-B'},viewer,db,()=>true),false);assert.equal(notificationVisible({...n,receiptId:'TEST-OWN'},{...viewer,role:'ACCOUNTING'},db,()=>true),false);
 assert.equal(notificationVisible({...n,eventType:'REQUEST_SUBMITTED',recipientUserId:viewer.id},viewer,db,()=>false),false);
});
