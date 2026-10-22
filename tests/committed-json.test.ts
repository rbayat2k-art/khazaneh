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
