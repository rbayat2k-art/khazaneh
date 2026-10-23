import {test} from 'node:test';import assert from 'node:assert/strict';
import {requestTimeFields,compareEventOrder} from '../src/utils/record-time';
import {buildUnifiedTreasuryItems} from '../src/utils/excelExport';
test('registration instant uses Tehran Jalali date and 24h clock across midnight without host-zone dependence',()=>{
 const row=requestTimeFields({createdAt:'1405/07/30',createdAtIso:'2026-10-22T21:00:01.123Z'});
 assert.equal(row.registrationDate,'1405/08/01');assert.equal(row.registrationTime,'00:30:01');assert.equal(row.registrationOrder,'1405/08/01 00:30:01.123');
 assert.equal(requestTimeFields({createdAtIso:'2026-10-23T14:00:00+03:30'}).registrationTime,'14:00:00');
});
test('legacy dates never fabricate a midnight or infer a clock from identifiers or unrelated audit',()=>{
 const legacy=requestTimeFields({createdAt:'۱۴۰۵/۰۸/۰۱',auditHistory:[{changedAt:'1405/08/01 - 12:34'}]} as any);assert.equal(legacy.registrationDate,'1405/08/01');assert.equal(legacy.registrationTime,'ثبت نشده');assert.equal(legacy.registrationOrder,'1405/08/01');
 for(const createdAtIso of ['2026-02-30T01:00:00Z','2026-10-23T25:00:00Z','2026-10-23T12:00:00','invalid'])assert.equal(requestTimeFields({createdAt:'1405/08/01',createdAtIso}).registrationTime,'ثبت نشده');
 const manual=requestTimeFields({createdAt:'1405/07/01 - 12:34',createdAtIsValueDate:true});assert.equal(manual.registrationDate,'ثبت نشده');assert.equal(manual.registrationTime,'ثبت نشده');
});
test('treasury action is latest actual execution, never the entered value date or an unpaid sibling',()=>{
 const one={paidAt:'2026-10-23T09:00:00Z',paidDateJalali:'1403/01/01',paymentHistory:[{executedAt:'2026-10-23T08:00:00Z'},{executedAt:'2026-10-23T10:15:02.123Z'}]},row=requestTimeFields({createdAt:'1405/08/01'},[one]);
 assert.equal(row.treasuryActionDate,'1405/08/01');assert.equal(row.treasuryActionTime,'13:45:02');assert.equal(requestTimeFields({},[]).treasuryActionTime,'—');assert.equal(requestTimeFields({},[{status:'Paid',paidDateJalali:'1403/01/01'}]).treasuryActionTime,'ثبت نشده');
 const other=requestTimeFields({createdAt:'1405/08/01'},[{status:'Pending_Treasury'}]);assert.equal(other.treasuryActionDate,'—');assert.equal(other.treasuryActionTime,'—');
});
test('date and clock headers sort full chronology and keep unknown instants last, without guessing clock precision',()=>{
 const rows=['1405/08/02 01:00:00.000','1405/07/30 23:59:59.999','1405/08/01 09:30:00.000','1405/08/01',''];assert.deepEqual([...rows].sort((a,b)=>compareEventOrder(a,b,'desc')),[rows[0],rows[2],rows[3],rows[1],rows[4]]);assert.deepEqual([...rows].sort((a,b)=>compareEventOrder(a,b,'asc')),[rows[1],rows[2],rows[3],rows[0],rows[4]]);
});
test('legacy manual payments are known paid with unrecorded action time, never falsely shown as not acted on',()=>{
 const rows=buildUnifiedTreasuryItems({batchPayments:[],paymentRequests:[],advanceRequests:[],manualPayments:[{id:'TEST-manual',createdAt:'1403/01/01 - 08:00',date:'1403/01/01',amount:12000,trackingCode:'TEST-manual',payee:'TEST',description:'TEST',createdByName:'TEST'} as any],receiptArchives:[],targetStatuses:['Paid'],includeManuals:true});
 assert.equal(rows[0].registrationDate,'ثبت نشده');assert.equal(rows[0].treasuryActionDate,'ثبت نشده');assert.equal(rows[0].treasuryActionTime,'ثبت نشده');
});
