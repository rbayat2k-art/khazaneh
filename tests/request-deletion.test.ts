import {test} from 'node:test';import assert from 'node:assert/strict';import {freeze} from 'immer';
import {canDeleteSubmittedRequest,activeRequestProjection} from '../src/utils/request-deletion';import {notificationVisible} from '../src/server/notification-access';
test('private archive is never a public DTO; obsolete group totals/child notices are suppressed even for admin and deferred SMS',()=>{
 const child:any={id:'TEST-deleted',amount:20000,status:'Closed',requesterDeletedAt:'TEST',attachments:[{id:'TEST-private-file'}]},active:any={id:'TEST-active',status:'Paid',amount:10000};
 const db:any=freeze({users:[],advanceRequests:[],paymentRequests:[],batchPayments:[{id:'TEST-group',items:[active],deletedItems:[child],totalAmount:10000,itemCount:1}],notifications:[{id:'TEST-old-submit',eventType:'REQUEST_SUBMITTED',requestId:'TEST-group'},{id:'TEST-old-child',eventType:'APPROVED_SUPERVISOR',requestId:'TEST-group',rowId:child.id},{id:'TEST-active-notice',eventType:'PAYMENT_EXECUTED',requestId:'TEST-group',rowId:active.id}],receiptArchives:[]},true);
 const view=activeRequestProjection(db);assert.ok(!('deletedItems'in view.batchPayments[0]));assert.deepEqual(view.notifications!.map(n=>n.id),['TEST-active-notice']);assert.ok(db.batchPayments[0].deletedItems[0].attachments.length);
 const admin:any={id:'TEST-admin',role:'ADMIN'};assert.equal(notificationVisible(db.notifications[0],admin,db,()=>true),false);assert.equal(notificationVisible(db.notifications[1],admin,db,()=>true),false);assert.equal(notificationVisible(db.notifications[2],admin,db,()=>true),true);
});
test('deletion cannot hide legacy financial evidence even if its stage/history looks untouched',()=>{
 const row:any={id:'TEST',status:'Pending_Approver',auditHistory:[{actorId:'TEST-owner',stage:'REQUESTER',decision:'SUBMIT'}]};assert.equal(canDeleteSubmittedRequest(row,'TEST-supervisor','TEST-owner'),true);
 for(const extra of [{paymentHistory:[{}]},{paymentExecutions:[{}]},{receiptId:'TEST-receipt'},{sourceAccountSnapshot:{}},{paidDateJalali:'TEST'},{requesterDeletedAt:'TEST'}])assert.equal(canDeleteSubmittedRequest({...row,...extra},'TEST-supervisor','TEST-owner'),false);
});
