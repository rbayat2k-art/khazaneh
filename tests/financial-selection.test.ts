import {test} from 'node:test';import assert from 'node:assert/strict';import {freeze} from 'immer';
import {FinancialSelectionCache,immutableScalarArray} from '../src/server/financial-selection';
const rows=()=>freeze([{id:'TEST-YES',company:'TEST'},{id:'TEST-NO',company:'OTHER'}],true) as any[];

test('raw selection cache has global row, entry and per-array policy budgets',()=>{
 for(const cache of [new FinancialSelectionCache(4,10),new FinancialSelectionCache(100,1)]){
  let reads=0;const visible=(r:any)=>{reads++;return r.company==='TEST';},a=rows(),b=rows();
  const first=cache.select(a,'TEST',visible);assert.equal(cache.select(a,'TEST',visible),first);assert.equal(reads,2);
  cache.select(b,'TEST',visible);cache.select(a,'TEST',visible);assert.equal(reads,6,'old array must be evicted under either global budget');
 }
 const cache=new FinancialSelectionCache(10000,100),a=rows();let reads=0;const visible=(r:any)=>{reads++;return r.company==='TEST';};
 for(let i=0;i<65;i++)cache.select(a,String(i),visible);
 cache.select(a,'64',visible);assert.equal(reads,130);cache.select(a,'0',visible);assert.equal(reads,132,'per-array policy budget evicts its oldest context');
 const small=new FinancialSelectionCache(2,10);small.select(a,'TEST',visible);small.select(a,'TEST',visible);assert.equal(reads,136,'oversized selection is never retained');
});

test('mutable, getter, sparse and malformed financial inputs cannot retain a visibility decision',()=>{
 let company='TEST';const getter=Object.freeze({id:'TEST-YES',get company(){return company;}});
 const accessor:any[]=[];Object.defineProperty(accessor,'0',{get:()=>({id:'TEST-YES',company}),enumerable:true});accessor[1]=Object.freeze({id:'TEST-NO',company:'OTHER'});Object.freeze(accessor);
 const inputs:any[][]=[[{id:'TEST-YES',company:'TEST'},{id:'TEST-NO',company:'OTHER'}],Object.freeze([{id:'TEST-YES',company:'TEST'},Object.freeze({id:'TEST-NO',company:'OTHER'})]) as any[],Object.freeze([getter,Object.freeze({id:'TEST-NO',company:'OTHER'})]) as any[],accessor,Object.freeze([,{id:'TEST-NO',company:'OTHER'}]) as any[],freeze([{id:null,company:'TEST'},{id:'TEST-NO',company:'OTHER'}],true) as any[]];
 for(const input of inputs){const cache=new FinancialSelectionCache();let reads=0;const visible=(r:any)=>{reads++;return r.company==='TEST';};cache.select(input,'TEST',visible);const before=reads;cache.select(input,'TEST',visible);assert.ok(reads>before,'invalid immutable contract must fall back to current filtering');}
 const cache=new FinancialSelectionCache();assert.equal(cache.select(inputs[2],'TEST',r=>r.company==='TEST').length,1);company='OTHER';assert.equal(cache.select(inputs[2],'TEST',r=>r.company==='TEST').length,0,'frozen accessor does not freeze its return value');
 assert.equal(immutableScalarArray(accessor,['id','company'],['id']),false);
});

test('derived membership follows exact authorized arrays and nested batch children without exposing a mutable set',()=>{
 const empty:any[]=[];Object.freeze(empty);const cache=new FinancialSelectionCache(),a=rows(),batches=freeze([{id:'SYN-GROUP',items:[{id:'SYN-CHILD'}]}],true) as any[];
 const first=cache.relatedIds(empty,a,batches);assert.equal(cache.relatedIds(empty,a,batches),first);assert.equal(first.has('SYN-CHILD'),true);assert.equal((first as any).add,undefined);
 const next=freeze([{id:'SYN-GROUP',items:[{id:'SYN-NEW'}]}],true) as any[],changed=cache.relatedIds(empty,a,next);assert.equal(changed.has('SYN-CHILD'),false);assert.equal(changed.has('SYN-NEW'),true);assert.equal(cache.relatedIds(empty,empty,empty).has('TEST-YES'),false);
 const mutable:any[]=Object.freeze([{id:'SYN-GROUP',items:[{id:'SYN-OLD'}]}]) as any[];cache.relatedIds(empty,a,mutable);mutable[0].items[0].id='SYN-MUTATED';assert.equal(cache.relatedIds(empty,a,mutable).has('SYN-OLD'),false);
 let children=[{id:'SYN-OLD'}];const getter=Object.freeze([Object.freeze({id:'SYN-GROUP',get items(){return children;}})]) as any[];cache.relatedIds(empty,a,getter);children=[{id:'SYN-NEW'}];assert.equal(cache.relatedIds(empty,a,getter).has('SYN-OLD'),false);
 const bounded=new FinancialSelectionCache(1,1);assert.notEqual(bounded.relatedIds(empty,a,batches),bounded.relatedIds(empty,a,batches),'oversized derived membership cannot retain row arrays');
});

test('derived membership LRU has a cumulative reference and entry budget across interleaved policies',()=>{
 const empty=freeze([],true) as any[],a=freeze([{id:'A'}],true) as any[],b=freeze([{id:'B'}],true) as any[],c=freeze([{id:'C'}],true) as any[];
 for(const cache of [new FinancialSelectionCache(2,64),new FinancialSelectionCache(100,2)]){const first=cache.relatedIds(empty,a,empty),second=cache.relatedIds(empty,b,empty);assert.equal(cache.relatedIds(empty,a,empty),first);cache.relatedIds(empty,c,empty);assert.notEqual(cache.relatedIds(empty,b,empty),second,'least-recent entry must leave every lookup index');assert.notEqual(cache.relatedIds(empty,a,empty),first,'global budget evicts, not an unbounded per-source index');}
});

test('all-receipt proof is branded, positive-only and rejects empty sparse mutable inherited or accessor references',()=>{
 const cache=new FinancialSelectionCache(),empty=freeze([],true) as any[],financial=freeze([{id:'A'}],true) as any[],lookup=cache.relatedIds(empty,financial,empty),none=cache.relatedIds(empty,empty,empty),valid=freeze([{id:'R',relatedPaymentIds:['A']}],true) as any[];
 assert.equal(cache.allRelatedVisible(valid,lookup),true);assert.equal(cache.allRelatedVisible(valid,lookup),true);assert.equal(cache.allRelatedVisible(valid,none),false);assert.equal(cache.allRelatedVisible(valid,Object.freeze({has:()=>true})),false);assert.equal(cache.allRelatedVisible(valid,new FinancialSelectionCache().relatedIds(empty,financial,empty)),false);
 const inherited=Object.freeze(Object.assign(Object.create({relatedPaymentIds:freeze(['A'])}),{id:'R'})),getter=Object.freeze({id:'R',get relatedPaymentIds(){return ['A'];}}),bad=[[],Object.freeze(new Array(1)),['A'],freeze([123],true),freeze(['OTHER'],true)];
 for(const refs of bad)assert.equal(cache.allRelatedVisible(Object.freeze([Object.freeze({id:'R',relatedPaymentIds:refs})]) as any[],lookup),false);
 for(const row of [inherited,getter,{id:'R',relatedPaymentIds:freeze(['A'])}])assert.equal(cache.allRelatedVisible(Object.freeze([row]) as any[],lookup),false);assert.equal(cache.allRelatedVisible(Object.freeze(new Array(1)) as any[],lookup),false);
});

test('an immutable receipt shape is validated once across new arrays without caching current membership grants',()=>{
 const cache=new FinancialSelectionCache(),empty=freeze([],true) as any[],financial=freeze([{id:'A'},{id:'B'}],true) as any[],lookup=cache.relatedIds(empty,financial,empty);
 const old=freeze(Array.from({length:1000},(_,i)=>({id:'TEST-RECEIPT-'+i,relatedPaymentIds:['A']})),true) as any[];
 assert.equal(cache.allRelatedVisible(old,lookup),true);
 const next=freeze([...old,{id:'TEST-RECEIPT-NEW',relatedPaymentIds:['B']}],true) as any[],historical=new Set(old),descriptor=Object.getOwnPropertyDescriptor;let historicalShapeReads=0;
 Object.getOwnPropertyDescriptor=function(value:any,key:any){if(historical.has(value))historicalShapeReads++;return descriptor(value,key);};
 try{assert.equal(cache.allRelatedVisible(next,lookup),true);}finally{Object.getOwnPropertyDescriptor=descriptor;}
 assert.equal(historicalShapeReads,0,'unchanged frozen receipt fields must not be revalidated for each new collection');
 const revoked=cache.relatedIds(empty,freeze([{id:'A'}],true) as any[],empty);
 assert.equal(cache.allRelatedVisible(next,revoked),false,'shape proof is never a grant for a new current lookup');
 const replaced=freeze([...old,{id:'TEST-RECEIPT-NEW',relatedPaymentIds:['OTHER']}],true) as any[];
 assert.equal(cache.allRelatedVisible(replaced,lookup),false,'new row identity/reference must validate and recheck membership');
});
