import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
import {SqliteRecords} from '../src/server/sqlite-records';import {CommittedJson} from '../src/server/committed-json';
import {importJson,exportJson,backupSqlite,verifyTransfer,stateHash} from '../src/server/storage-transfer';
import {whileStopped,STORE_LOCK_NAME} from '../src/server/owner-lock';
import {freeze} from 'immer';
const parent=process.env.TREASURY_TEST_DIR;
if(!parent||!path.resolve(parent).replaceAll('\\','/').startsWith('C:/Users/reza/Desktop/پروژه‌ها/انتشار موقت khazaneh/work/'))throw Error('explicit isolated store required');
// Other test files start the real API owner in the parent directory concurrently.
// The transfer-lease test must contend only with its own synthetic transfer.
const root=path.join(parent,'sqlite-record-units');
fs.mkdirSync(root,{recursive:true});
const sample={version:1,rows:[{id:'SYN-1',amount:9007199254740991,account:'00001',text:'آزمایش',history:[{id:'SYN-H',amount:123}],attachments:[{id:'SYN-F',url:'data:application/pdf;base64,VEVTVA=='}]},{id:'SYN-2',amount:20}],sessions:[{token:'SYN-session',userId:'SYN-user'}],unknown:{future:['003001',null]},empty:[]};
test('SQLite import, restart, current-data rollback and WAL backup preserve every field and ordered relation',async()=>{
 const json=path.join(root!,'unit-transfer.json'),sqlite=path.join(root!,'unit-transfer.sqlite'),rollback=path.join(root!,'unit-rollback.json');fs.writeFileSync(json,JSON.stringify(sample),{flag:'wx'});
 assert.equal(importJson(json,sqlite).stateSha256,stateHash(sample));assert.throws(()=>importJson(json,sqlite));
 const store=new SqliteRecords<any>(sqlite),before=store.read(),next=structuredClone(before);next.rows[0].amount=123;next.rows.unshift({id:'SYN-3',amount:13});next.empty=[{role:'SYN-role'}];delete next.unknown;store.commit(next,before,store.signature());
 const backup=path.join(root!,'unit-backup.sqlite');assert.equal((await backupSqlite(sqlite,backup)).stateSha256,stateHash(next));store.close();
 const restarted=new SqliteRecords<any>(sqlite);verifyTransfer(next,restarted.read());restarted.close();
 assert.equal(exportJson(sqlite,rollback).stateSha256,stateHash(next));assert.notEqual(stateHash(JSON.parse(fs.readFileSync(rollback,'utf8'))),stateHash(sample),'rollback must preserve post-migration writes');assert.throws(()=>exportJson(sqlite,rollback));
 fs.writeFileSync(path.join(root!,'.server-lock.json'),JSON.stringify({pid:process.pid}));try{assert.throws(()=>exportJson(sqlite,path.join(root!,'forbidden.json')),/Stop/);}finally{fs.unlinkSync(path.join(root!,'.server-lock.json'));}
});
test('SQLite rollback isolates failed multi-collection writes; stale drafts and external WAL commits fail closed',()=>{
 const file=path.join(root!,'unit-atomic.sqlite'),backing=new SqliteRecords<any>(file,true);backing.commit(sample,undefined,backing.signature());const snapshots=new CommittedJson<any>(file,backing),a=snapshots.draft().value;snapshots.markNormalized(a,false);const b=snapshots.draft().value;
 a.rows[0].amount=200;a.rows.push({...a.rows[0]});a.sessions=[];assert.throws(()=>snapshots.commitBacking(snapshots.snapshot(a),a),/Duplicate/);verifyTransfer(sample,backing.read());assert.equal(snapshots.view().rows[0].amount,sample.rows[0].amount);
 b.rows[1].amount=55;snapshots.commitBacking(snapshots.snapshot(b),b);assert.throws(()=>snapshots.commitBacking(snapshots.snapshot(a),a),/Stale/);
 const other=new SqliteRecords<any>(file),external=other.read();external.rows[1].amount=99;other.commit(external,other.read(),other.signature());assert.equal(snapshots.draft().value.rows[1].amount,99);assert.throws(()=>snapshots.assertCurrent(b),/Stale/);other.close();backing.close();
});
test('SQLite transaction trigger failure leaves records, ordering, revision and published state unchanged',()=>{
 const file=path.join(root!,'unit-write-failure.sqlite'),backing=new SqliteRecords<any>(file,true);backing.commit(sample,undefined,backing.signature());const before=backing.read(),stamp=backing.signature();
 backing.connection.exec("CREATE TRIGGER fail_revision BEFORE UPDATE ON store_version BEGIN SELECT RAISE(ABORT,'synthetic failure'); END");
 const next=structuredClone(before);next.rows[1].amount=300;next.sessions=[];assert.throws(()=>backing.commit(next,before,backing.signature()),/synthetic failure/);assert.equal(backing.signature(),stamp);verifyTransfer(before,backing.read());backing.close();
});
test('a foreign commit after COMMIT cannot publish our older snapshot under its revision',()=>{
 const file=path.join(root!,'unit-publish-race.sqlite'),owner=new SqliteRecords<any>(file,true);owner.commit(sample,undefined,owner.signature());const external=new SqliteRecords<any>(file),cache=new CommittedJson<any>(file,owner),draft=cache.draft().value;cache.markNormalized(draft,false);draft.rows[0].amount=200;
 const exec=owner.connection.exec.bind(owner.connection);let triggered=false;
 owner.connection.exec=function(sql:string){const result=exec(sql);if(sql.includes('COMMIT')&&!triggered){triggered=true;const next=external.read(),old=external.read();next.rows[0].amount=300;external.commit(next,old,external.signature());}return result;};
 assert.throws(()=>cache.commitBacking(cache.snapshot(draft),draft),/changed after commit/);assert.equal(cache.draft().value.rows[0].amount,300);external.close();owner.close();
});
test('a schema-only migration cannot be opened as operational state',()=>{
 const file=path.join(root!,'unit-incomplete.sqlite'),store=new SqliteRecords(file,true);store.close();assert.throws(()=>new SqliteRecords(file),/incomplete/);
});
test('transfer lease is held throughout the operation, rejects competing writers and is released on failure',()=>{
 const file=path.join(root!,'lease.json');assert.throws(()=>whileStopped([file],()=>{assert.equal(JSON.parse(fs.readFileSync(path.join(root!,STORE_LOCK_NAME),'utf8')).pid,process.pid);assert.throws(()=>whileStopped([file],()=>assert.fail('overlapping transfer')),/Stop/);throw Error('SYN transfer failed');}),/SYN transfer failed/);assert.equal(fs.existsSync(path.join(root!,STORE_LOCK_NAME)),false);
});

test('a record-only edit never rewrites unchanged historical collection order or untouched rows',()=>{
 const file=path.join(root,'unit-write-amplification.sqlite'),store=new SqliteRecords<any>(file,true),before=freeze(structuredClone(sample),true);
 try{
  store.commit(before,undefined,store.signature());
  store.connection.exec("CREATE TRIGGER unchanged_order BEFORE UPDATE ON collections BEGIN SELECT RAISE(ABORT,'TEST historical order unnecessarily rewritten'); END; CREATE TRIGGER unchanged_record BEFORE UPDATE ON records WHEN OLD.row_key='id:SYN-2' BEGIN SELECT RAISE(ABORT,'TEST untouched row unnecessarily rewritten'); END;");
  const next=freeze({...before,rows:[{...before.rows[0],amount:77},before.rows[1]]},true);
  assert.doesNotThrow(()=>store.commit(next,before,store.signature()));verifyTransfer(next,store.read());
  store.connection.exec('DROP TRIGGER unchanged_order; DROP TRIGGER unchanged_record');
  const reordered=freeze({...next,rows:[next.rows[1],next.rows[0]]},true);store.commit(reordered,next,store.signature());verifyTransfer(reordered,store.read());
 }finally{store.close();}
});
test('a mismatched SQLite payload identity never becomes a trusted immutable baseline',()=>{
 const file=path.join(root,'unit-corrupt-identity.sqlite'),store=new SqliteRecords<any>(file,true);
 try{store.commit(sample,undefined,store.signature());store.connection.prepare("UPDATE records SET payload=json_set(payload,'$.id','SYN-1') WHERE collection='rows' AND row_key='id:SYN-2'").run();
  assert.throws(()=>store.read(),/identity/);
 }finally{store.close();}
});

test('a validated immutable same-order edit does not rebuild the historical record key array',()=>{
 const file=path.join(root,'unit-proven-same-order.sqlite'),store=new SqliteRecords<any>(file,true);let historicalKeyMaps=0;
 const rows=Array.from({length:1000},(_,i)=>({id:'TEST-KEY-'+i,amount:10}));
 const before=freeze({rows},true);
 try{
  store.commit(before,undefined,store.signature());
  const next=freeze({rows:before.rows.map((row,i)=>i===500?{id:'TEST-KEY-500',amount:20}:row)},true);
  const map=Array.prototype.map;
  Array.prototype.map=function(...args:any[]){if(this===next.rows)historicalKeyMaps++;return Reflect.apply(map,this,args);};
  try{store.commit(next,before,store.signature());}finally{Array.prototype.map=map;}
  assert.equal(historicalKeyMaps,0,'validated same-order edits must reuse canonical keys, not rebuild the full historical key/Set index');
  verifyTransfer(next,store.read());
 }finally{store.close();}
});

test('dynamic Proxy serialization and Proxy arrays cannot receive a SQLite key proof',()=>{
 const file=path.join(root,'unit-key-proof-proxy.sqlite'),store=new SqliteRecords<any>(file,true);
 try{
  const dynamic=new Proxy(Object.freeze({id:'TEST-A',amount:1}),{get(target,key,receiver){if(key==='toJSON')return ()=>({id:target.id,amount:1});return Reflect.get(target,key,receiver);}});
  assert.equal('toJSON' in dynamic,false);
  let before:{rows:readonly {id:string;amount:number}[]}={rows:Object.freeze([dynamic,Object.freeze({id:'TEST-B',amount:2})])};store.commit(before,undefined,store.signature());
  for(const proxyArray of [false,true]){
   if(proxyArray){before=freeze({rows:[{id:'TEST-A',amount:1},{id:'TEST-B',amount:2}]},true);store.commit(before,store.read(),store.signature());}
   const plain=Object.freeze([proxyArray?before.rows[0]:dynamic,Object.freeze({id:'TEST-B',amount:3})]),rows=proxyArray?new Proxy(plain,{}):plain,next={rows};let maps=0;
   const map=Array.prototype.map;Array.prototype.map=function(...args:any[]){if(this===rows)maps++;return Reflect.apply(map,this,args);};
   try{store.commit(next,before,store.signature());}finally{Array.prototype.map=map;}
   assert.equal(maps,1,'Proxy candidates must use the complete canonical-key/duplicate validation path');before=next;
  }
 }finally{store.close();}
});

test('SQLite key proof rejects forged baselines, mutable descendants and dynamic identity precedence',()=>{
 const file=path.join(root,'unit-key-proof-boundaries.sqlite'),store=new SqliteRecords<any>(file,true);
 try{
  const before=freeze({rows:[{id:'TEST-A',amount:1},{id:'TEST-B',amount:2}]},true);store.commit(before,undefined,store.signature());
  const forged=freeze(structuredClone(before),true),duplicate=freeze({rows:[forged.rows[0],{...forged.rows[1],id:'TEST-A'}]},true);
  assert.throws(()=>store.commit(duplicate,forged,store.signature()),/Duplicate/);verifyTransfer(before,store.read());
  const nested={note:'TEST'},shallow={rows:Object.freeze([Object.freeze({id:'TEST-A',nested}),before.rows[1]])};
  store.commit(shallow,before,store.signature());nested.note='TEST changed';
  const edited={rows:Object.freeze([Object.freeze({id:'TEST-A',nested}),Object.freeze({id:'TEST-B',amount:3})])};
  store.commit(edited,shallow,store.signature());verifyTransfer(edited,store.read());
  let dynamic='TEST-C';const accessor=Object.freeze({get id(){return dynamic;},token:'TEST-token',amount:1});
  const dynamicState={rows:Object.freeze([accessor,Object.freeze({id:'TEST-D',amount:2})])};store.commit(dynamicState,edited,store.signature());dynamic='TEST-D';
  assert.throws(()=>store.commit({rows:Object.freeze([...dynamicState.rows])},dynamicState,store.signature()),/Duplicate/);
  const prior=store.read(),precedence=freeze({rows:[{id:'',token:'TEST-token',amount:1},{id:'TEST-D',amount:3}]},true);
  store.commit(precedence,prior,store.signature());verifyTransfer(precedence,store.read());
 }finally{store.close();}
});

test('failed or externally superseded commits cannot establish a new SQLite key proof',()=>{
 const file=path.join(root,'unit-key-proof-failure.sqlite'),store=new SqliteRecords<any>(file,true);
 try{
  const before=freeze({rows:[{id:'TEST-A',amount:1},{id:'TEST-B',amount:2}]},true);store.commit(before,undefined,store.signature());
  const next=freeze({rows:[{...before.rows[0],amount:3},before.rows[1]]},true),stamp=store.signature();
  store.connection.exec("CREATE TRIGGER fail_proof BEFORE UPDATE ON store_version BEGIN SELECT RAISE(ABORT,'TEST proof commit failure'); END");
  assert.throws(()=>store.commit(next,before,stamp),/TEST proof commit failure/);verifyTransfer(before,store.read());
  store.connection.exec('DROP TRIGGER fail_proof');store.commit(next,before,store.signature());verifyTransfer(next,store.read());
  const other=new SqliteRecords<any>(file);try{const state=other.read();state.rows[0].amount=4;other.commit(state,other.read(),other.signature());assert.throws(()=>store.commit(before,next,stamp),/Stale/);verifyTransfer(state,store.read());}finally{other.close();}
 }finally{store.close();}
});
