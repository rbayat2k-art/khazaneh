import {test} from 'node:test';import assert from 'node:assert/strict';
import {detectBankFromCard,formatCardNumber,IRANIAN_BANK_PREFIXES,DESTINATION_BANKS} from '../src/utils/bankCards';
import {catalog} from './bank-prefix-reference.cjs';
test('every referenced issuer BIN resolves uniquely and has a real selectable destination option',()=>{
 const reference=(catalog as [string,string[]][]).flatMap(([bank,prefixes])=>prefixes.map(prefix=>({prefix,bank})));
 assert.equal(reference.length,47);assert.equal(new Set(IRANIAN_BANK_PREFIXES.map(p=>p.prefix)).size,IRANIAN_BANK_PREFIXES.length);
 assert.deepEqual(IRANIAN_BANK_PREFIXES.map(p=>p.prefix).sort(),reference.map(p=>p.prefix).sort());
 for(const {prefix,bank} of reference){assert.equal(detectBankFromCard(prefix+'0'.repeat(10)),bank,prefix);assert.ok(DESTINATION_BANKS.includes(bank),prefix);}
});
test('Tejarat current and historical BINs are recognized and Ansar is never mislabeled Tejarat',()=>{
 for(const prefix of ['585983','627353'])assert.equal(detectBankFromCard(prefix+'0'.repeat(10)),'بانک تجارت');
 assert.notEqual(detectBankFromCard('627381'+'0'.repeat(10)),'بانک تجارت');
});
test('unknown, malformed and too-short input yields no issuer, with Persian/Arabic digit support',()=>{
 for(const card of ['','60379','999999'+'0'.repeat(10),'603799x','603799'+'0'.repeat(11)])assert.equal(detectBankFromCard(card),null);
 for(const card of ['۶۱۰۴۳۳۰۰۰۰۰۰۰۰۰۰','٦١٠٤٣٣٠٠٠٠٠٠٠٠٠٠',formatCardNumber('610433'+'0'.repeat(10))])assert.equal(detectBankFromCard(card),'بانک ملت');
});
