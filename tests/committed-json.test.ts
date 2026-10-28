import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {CommittedJson} from '../src/server/committed-json';
const root=process.env.TREASURY_TEST_DIR;if(!root||!path.resolve(root).replaceAll('\\','/').startsWith('C:/Users/reza/Desktop/پروژه‌ها/انتشار موقت khazaneh/work/'))throw Error('explicit isolated store required');
test('committed snapshot isolates failed drafts and reads; stale drafts cannot overwrite a newer commit',()=>{
 fs.mkdirSync(root,{recursive:true});const file=path.join(root,'unit-committed.json');fs.writeFileSync(file,JSON.stringify({rows:[{id:'TEST',amount:10}]}),{flag:'wx'});const store=new CommittedJson<any>(file),a=store.draft().value;store.markNormalized(a,false);
 assert.throws(()=>{store.view().rows[0].amount=999;},TypeError);a.rows[0].amount=20;assert.equal(store.view().rows[0].amount,10);
 const b=store.draft().value;b.rows[0].amount=30;store.assertCurrent(b);fs.writeFileSync(file+'.tmp',JSON.stringify(b));const written=fs.statSync(file+'.tmp',{bigint:true});fs.renameSync(file+'.tmp',file);store.publish(store.snapshot(b),written);store.markNormalized(b,true);b.rows[0].amount=999;assert.equal(store.view().rows[0].amount,30);assert.throws(()=>store.assertCurrent(a),/Stale/);
 fs.writeFileSync(file,JSON.stringify({rows:[{id:'TEST',amount:40}]}));assert.equal(store.draft().value.rows[0].amount,40);assert.equal(store.isNormalized(),false);
 fs.writeFileSync(file,'broken');assert.throws(()=>store.draft());
});
test('external replacement between rename and publish cannot pair old data with a new file stamp',()=>{
 const file=path.join(root!,'unit-replacement.json');fs.writeFileSync(file,'{"rows":[1]}',{flag:'wx'});const store=new CommittedJson<any>(file),draft=store.draft().value;
 fs.writeFileSync(file+'.own','{"rows":[2]}');const own=fs.statSync(file+'.own',{bigint:true});fs.renameSync(file+'.own',file);fs.writeFileSync(file+'.external','{"rows":[3]}');fs.renameSync(file+'.external',file);
 assert.throws(()=>store.publish({rows:[2]},own),/replaced externally/);assert.deepEqual(store.draft().value.rows,[3]);assert.throws(()=>store.assertCurrent(draft),/Stale/);
});

test('same-size external bytes invalidate the cache and reject stale drafts even when every metadata field collides',t=>{
 const file=path.join(root!,'unit-colliding-stamp.json');fs.writeFileSync(file,'{"amount":10}',{flag:'wx'});
 const stat=fs.statSync,unchanged=stat(file,{bigint:true});t.mock.method(fs,'statSync',(target:any,...args:any[])=>target===file?unchanged:(stat as any)(target,...args));
 const store=new CommittedJson<any>(file),old=store.draft().value;store.markNormalized(old,false);assert.equal(store.view().amount,10);
 fs.writeFileSync(file,'{"amount":20}');assert.throws(()=>store.assertCurrent(old),/Stale/);assert.equal(fs.readFileSync(file,'utf8'),'{"amount":20}');
 const fresh=store.draft();assert.equal(fresh.value.amount,20);assert.equal(fresh.normalized,false);assert.equal(store.isNormalized(),false);store.markNormalized(fresh.value,false);assert.equal(store.view().amount,20);
 assert.throws(()=>store.assertCurrent(old),/Stale/);
});

test('same-stamp in-place change after rename cannot publish the old candidate under the new content signature',t=>{
 const file=path.join(root!,'unit-publish-content-race.json');fs.writeFileSync(file,'{"amount":10}',{flag:'wx'});const store=new CommittedJson<any>(file),draft=store.draft().value;
 draft.amount=20;const encoded=JSON.stringify(store.snapshot(draft));fs.writeFileSync(file+'.tmp',encoded);const written=fs.statSync(file+'.tmp',{bigint:true});fs.renameSync(file+'.tmp',file);
 const stat=fs.statSync,unchanged=stat(file,{bigint:true});t.mock.method(fs,'statSync',(target:any,...args:any[])=>target===file?unchanged:(stat as any)(target,...args));fs.writeFileSync(file,'{"amount":30}');
 assert.throws(()=>store.publish(store.snapshot(draft),written,encoded),/replaced externally/);assert.equal(store.draft().value.amount,30);assert.equal(store.isNormalized(),false);assert.throws(()=>store.assertCurrent(draft),/Stale/);
});

test('same-stamp malformed external contents fail closed instead of serving normalized cached data',t=>{
 const file=path.join(root!,'unit-colliding-corruption.json');fs.writeFileSync(file,'{"amount":10}',{flag:'wx'});const stat=fs.statSync,unchanged=stat(file,{bigint:true});t.mock.method(fs,'statSync',(target:any,...args:any[])=>target===file?unchanged:(stat as any)(target,...args));
 const store=new CommittedJson<any>(file),draft=store.draft().value;store.markNormalized(draft,false);fs.writeFileSync(file,'!'.repeat(Buffer.byteLength('{"amount":10}')));
 assert.throws(()=>store.view(),SyntaxError);assert.throws(()=>store.assertCurrent(draft),/Stale/);assert.equal(fs.readFileSync(file,'utf8'),'!'.repeat(Buffer.byteLength('{"amount":10}')));
});

test('a same-stamp change while reading cannot pair parsed old bytes with the newer signature',t=>{
 const file=path.join(root!,'unit-read-content-race.json');fs.writeFileSync(file,'{"amount":10}',{flag:'wx'});const stat=fs.statSync,read=fs.readFileSync,unchanged=stat(file,{bigint:true});let changed=false;
 t.mock.method(fs,'statSync',(target:any,...args:any[])=>target===file?unchanged:(stat as any)(target,...args));
 t.mock.method(fs,'readFileSync',(target:any,...args:any[])=>{const bytes=(read as any)(target,...args);if(target===file&&!changed){changed=true;fs.writeFileSync(file,'{"amount":20}');}return bytes;});
 const store=new CommittedJson<any>(file);assert.throws(()=>store.draft(),/changed while reading/);assert.equal(store.draft().value.amount,20);assert.equal(store.isNormalized(),false);
});

test('publication checks the exact serialized candidate without requiring compact JSON formatting',()=>{
 const file=path.join(root!,'unit-encoded-publish.json');fs.writeFileSync(file,'{"amount":10}',{flag:'wx'});const store=new CommittedJson<any>(file),draft=store.draft().value;draft.amount=20;
 const encoded=JSON.stringify(store.snapshot(draft),null,2);fs.writeFileSync(file+'.tmp',encoded);const written=fs.statSync(file+'.tmp',{bigint:true});fs.renameSync(file+'.tmp',file);store.publish(store.snapshot(draft),written,encoded);
 assert.equal(store.view().amount,20);assert.equal(fs.readFileSync(file,'utf8'),encoded);assert.equal(store.isNormalized(),true);
});
