import {test} from 'node:test';import assert from 'node:assert/strict';import {trackedPayment,readPendingPayments,paymentFingerprint,confirmedPayment,clearPendingPayment,type PaymentLock} from '../src/utils/pending-payment';
function storage(){const data=new Map<string,string>();return {getItem:(k:string)=>data.get(k)||null,setItem:(k:string,v:string)=>{data.set(k,v);},removeItem:(k:string)=>{data.delete(k);}};}
function mutex():PaymentLock{let tail=Promise.resolve();return (name,run)=>{assert.ok(name.startsWith('khazaneh:payment:'));const job=tail.then(run);tail=job.then(()=>{},()=>{});return job;};}
test('unknown outcomes retain only opaque metadata and reuse the same key after recreation',async()=>{
 const store=storage(),lock=mutex(),fingerprint=await paymentFingerprint({amount:5000}),keys:string[]=[];
 for(let i=0;i<2;i++)await trackedPayment(store,lock,'SYN-user',['PAY:SYN'],fingerprint,()=>true,async key=>{keys.push(key);return {ok:false,ambiguous:true};});
 assert.equal(keys[0],keys[1]);const entry=readPendingPayments(store,'SYN-user')[0];assert.deepEqual(Object.keys(entry).sort(),['fingerprint','key','targets']);assert.equal(JSON.stringify(entry).includes('5000'),false);assert.deepEqual(readPendingPayments(store,'SYN-other'),[]);
 let sent=false;const conflict=await trackedPayment(store,lock,'SYN-user',['PAY:SYN'],await paymentFingerprint({amount:6000}),()=>true,async()=>{sent=true;return {ok:true};});assert.equal(conflict.ok,false);assert.equal(sent,false);
 await clearPendingPayment(store,lock,'SYN-user',entry.key);assert.deepEqual(readPendingPayments(store,'SYN-user'),[]);
});
test('shared lock serializes tabs; an ambiguous overlapping attempt never receives a new key',async()=>{
 const store=storage(),lock=mutex(),fingerprint=await paymentFingerprint({amount:5000}),keys:string[]=[];
 await Promise.all([1,2].map(()=>trackedPayment(store,lock,'SYN',['PAY:SYN'],fingerprint,()=>true,async key=>{keys.push(key);await new Promise(r=>setTimeout(r,10));return {ok:false,ambiguous:true};})));
 assert.equal(keys.length,2);assert.equal(new Set(keys).size,1);let sent=false;await trackedPayment(store,lock,'SYN',['PAY:SYN','PAY:OTHER'],fingerprint,()=>true,async()=>{sent=true;return {ok:true};});assert.equal(sent,false);
});
test('failed storage and changed identity prevent sending; denied recovery never clears an old unknown handle',async()=>{
 const store=storage(),lock=mutex(),fingerprint=await paymentFingerprint({amount:5000});let sent=false;
 await assert.rejects(()=>trackedPayment({...store,setItem:()=>{throw Error('SYN quota');}},lock,'SYN',['PAY:SYN'],fingerprint,()=>true,async()=>{sent=true;return {ok:true};}));assert.equal(sent,false);
 await trackedPayment(store,lock,'SYN',['PAY:SYN'],fingerprint,()=>false,async()=>{sent=true;return {ok:true};});assert.equal(sent,false);
 await trackedPayment(store,lock,'SYN',['PAY:SYN'],fingerprint,()=>true,async()=>({ok:false,ambiguous:true}));
 await trackedPayment(store,lock,'SYN',['PAY:SYN'],fingerprint,()=>true,async()=>({ok:false,status:403}));assert.equal(readPendingPayments(store,'SYN').length,1);
});
test('only exact current-server actor, original targets and complete receipt allocations establish recovery',()=>{
 const entry={key:'pay-idem-'+crypto.randomUUID(),targets:['PAY:SYN'],fingerprint:'0'.repeat(64)},h={idempotencyKey:entry.key,treasuryUserId:'SYN',receiptId:'R',amount:5000,sourceBankAccountId:'B',bankRefNumber:'REF'},rows=[{target:'PAY:SYN',row:{id:'SYN',paymentHistory:[h]}}],receipt={id:'R',amount:5000,sourceBankAccountId:'B',bankRefNumber:'REF',relatedPaymentIds:['SYN']};
 assert.equal(confirmedPayment(entry,'SYN',rows,[receipt]),receipt);assert.equal(confirmedPayment(entry,'OTHER',rows,[receipt]),undefined);assert.equal(confirmedPayment(entry,'SYN',[],[receipt]),undefined);assert.equal(confirmedPayment({...entry,targets:['PAY:OTHER']},'SYN',rows,[receipt]),undefined);assert.equal(confirmedPayment(entry,'SYN',rows,[]),undefined);assert.equal(confirmedPayment(entry,'SYN',rows,[{...receipt,amount:10000}]),undefined);assert.equal(confirmedPayment(entry,'SYN',rows,[{...receipt,sourceBankAccountId:'OTHER'}]),undefined);
});
test('cleanup failure after a committed response does not imply the financial request was never sent',async()=>{
 const store=storage(),lock=mutex(),fingerprint=await paymentFingerprint({amount:5000});let writes=0,sent=0;
 const result=await trackedPayment({...store,setItem:(k,v)=>{if(++writes>1)throw Error('SYN quota');store.setItem(k,v);}},lock,'SYN',['PAY:SYN'],fingerprint,()=>true,async()=>{sent++;return {ok:true};});assert.equal(sent,1);assert.equal(result.ambiguous,true);assert.equal(readPendingPayments(store,'SYN').length,1);
});
