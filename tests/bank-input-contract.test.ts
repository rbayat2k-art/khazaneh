import {test} from 'node:test';import assert from 'node:assert/strict';
import {bankFieldsError} from '../src/utils/bank-identifiers';
import {ibanInputProps} from '../src/components/bank-input';
import {currentJalaliMonth} from '../src/utils/current-date';
import {requestFixture} from './request-fixture.cjs';
test('positive fixture defaults never repair explicit missing/blank/invalid cards or advance requests',()=>{for(const accountOrCard of [undefined,'','123'])assert.equal(requestFixture('/payment-requests',{accountOrCard}).accountOrCard,accountOrCard);const advance={batchType:'ADVANCE',items:[{}]};assert.equal(requestFixture('/batch-payments',advance),advance);assert.equal(requestFixture('/payment-requests',{}).accountOrCard.length,16);});
test('IBAN UI admits only IR plus twenty-four digits, never a longer native input',()=>assert.equal(ibanInputProps.maxLength,26));
test('payment cards are required while advance cards and every IBAN remain optional',()=>{
 assert.ok(bankFieldsError({},true));assert.ok(bankFieldsError({accountOrCard:'',iban:'IR'+'0'.repeat(24)},true));
 assert.equal(bankFieldsError({accountOrCard:'0'.repeat(16),iban:''},true),null);assert.equal(bankFieldsError({},false),null);
 for(const count of [15,17])assert.ok(bankFieldsError({accountOrCard:'0'.repeat(count)},false));
 for(const count of [23,25])assert.ok(bankFieldsError({iban:'IR'+'0'.repeat(count)},false));
 assert.equal(bankFieldsError({iban:'IR'+'0'.repeat(24)},false),null);
});
test('editable advance month default uses the current Tehran Persian month at rollover',()=>{
 assert.match(currentJalaliMonth(new Date('2026-10-22T20:29:59Z')),/مهر/);
 assert.match(currentJalaliMonth(new Date('2026-10-22T20:30:00Z')),/آبان/);
});
