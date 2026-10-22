import {test} from 'node:test';
import assert from 'node:assert/strict';
import {StateSync} from '../src/server/state-sync';
import {StateSyncClient,createStateFetch} from '../src/utils/state-sync';
const wire=(v:any)=>JSON.parse(JSON.stringify(v));
const view=(count=600)=>({users:[{id:'TEST-user'}],paymentRequests:Array.from({length:count},(_,i)=>Object.freeze({id:'TEST-'+i,amount:100,description:'TEST synthetic'})),config:{enabled:true}});
function query(server:StateSync,current:()=>any,binding='TEST-session',authority='TEST-authority'){
  return async(route:string)=>{const u=new URL(route,'http://127.0.0.1');if(u.searchParams.get('sync')==='begin'){const v=current();return wire(server.reply(v,v,binding,authority,v,undefined));}if(u.searchParams.get('sync')==='finish')return wire(server.finish(u.searchParams.get('cursor'),binding,authority,current(),current()));if(u.searchParams.get('sync')==='bundle')return wire(server.bundle(u.searchParams.get('cursor'),binding,authority,current(),JSON.parse(u.searchParams.get('pages')!)));return wire(server.page(u.searchParams.get('sync'),binding,authority,current(),u.searchParams.get('collection'),u.searchParams.get('offset'),u.searchParams.get('limit')));};
}

test('server record-only delta avoids rebuilding full maps and order scans for immutable stable identifiers',async()=>{
 let reads=0;const count=1000,rows=Object.freeze(Array.from({length:count},(_,i)=>new Proxy(Object.freeze({id:'TEST-'+i,amount:100,history:Object.freeze(['TEST'])}),{get(target,key,receiver){if(key==='id')reads++;return Reflect.get(target,key,receiver);}}))),first={paymentRequests:rows},server=new StateSync(),client=new StateSyncClient();
 await client.accept(wire(server.reply(first,first,'TEST-session','TEST-authority',first,undefined)),query(server,()=>first));
 const changed={paymentRequests:Object.freeze([Object.freeze({...rows[0],amount:200}),...rows.slice(1)])};reads=0;const reply=server.reply({success:true,state:changed},changed,'TEST-session','TEST-authority',changed,client.headers()['X-Treasury-State-Cursor']);
 assert.ok(reads<=2*count+2,'same-order immutable edit must compare IDs once, not build full Maps and scan remove/order again');assert.deepEqual(reply.stateDelta.collections.paymentRequests.splice,{start:count,deleteCount:0,ids:[]});assert.equal(reply.stateDelta.collections.paymentRequests.upsert.length,1);
 const applied=await client.accept(wire(reply),query(server,()=>changed));assert.equal(applied.success,true);assert.deepEqual(applied.state,wire(changed));assert.equal(rows[0].amount,100);
});

test('immutable append with retained identifiers avoids full maps and preserves edited history and client order',async()=>{
 let reads=0;const count=1000,rows=Object.freeze(Array.from({length:count},(_,i)=>new Proxy(Object.freeze({id:'TEST-'+i,amount:100,history:Object.freeze(['TEST'])}),{get(target,key,receiver){if(key==='id')reads++;return Reflect.get(target,key,receiver);}}))),server=new StateSync(),client=new StateSyncClient(),first={rows};
 await client.accept(wire(server.reply(first,first,'TEST-session','TEST-authority',first,undefined)),query(server,()=>first));
 let current:{rows:readonly {id:string;amount:number;history:readonly string[]}[]}={rows:Object.freeze([Object.freeze({...rows[0],amount:200,history:Object.freeze(['TEST','TEST-edit'])}),...rows.slice(1),Object.freeze({id:'TEST-new-1',amount:300,history:Object.freeze(['TEST-create'])})])};reads=0;
 const reply=server.reply(current,current,'TEST-session','TEST-authority',current,client.headers()['X-Treasury-State-Cursor']);assert.ok(reads<=2*count+4,'append must not rebuild full maps and scan removals or order again');assert.deepEqual(reply.stateDelta.collections.rows.splice,{start:count,deleteCount:0,ids:['TEST-new-1']});assert.equal(reply.stateDelta.collections.rows.upsert.length,2);assert.deepEqual(await client.accept(wire(reply),query(server,()=>current)),wire(current));assert.equal(rows[0].amount,100);
 current={rows:Object.freeze([...current.rows,Object.freeze({id:'TEST-new-2',amount:400,history:Object.freeze(['TEST-create'])})])};assert.deepEqual(await client.accept(wire(server.reply(current,current,'TEST-session','TEST-authority',current,client.headers()['X-Treasury-State-Cursor'])),query(server,()=>current)),wire(current));
});

test('immutable append cannot inherit uniqueness when its tail duplicates an existing or new identifier',async()=>{
 for(const duplicate of ['A','NEW']){const first={rows:Object.freeze(['A','B'].map(id=>Object.freeze({id,amount:100})))},server=new StateSync(),client=new StateSyncClient();await client.accept(wire(server.reply(first,first,'TEST-session','TEST-authority',first,undefined)),query(server,()=>first));const next={rows:Object.freeze([...first.rows,Object.freeze({id:'NEW',amount:200}),Object.freeze({id:duplicate,amount:300})])},reply=server.reply(next,next,'TEST-session','TEST-authority',next,client.headers()['X-Treasury-State-Cursor']);assert.deepEqual(reply.stateDelta.set.rows,wire(next.rows));assert.deepEqual(await client.accept(wire(reply),query(server,()=>next)),wire(next));}
});

test('immutable prepend with edited retained history avoids historical maps and keeps exact client order',async()=>{
 let reads=0;const count=1000,rows=Object.freeze(Array.from({length:count},(_,i)=>new Proxy(Object.freeze({id:'TEST-'+i,amount:100}),{get(target,key,receiver){if(key==='id')reads++;return Reflect.get(target,key,receiver);}}))),server=new StateSync(),client=new StateSyncClient(),first={rows};
 await client.accept(wire(server.reply(first,first,'TEST-session','TEST-authority',first,undefined)),query(server,()=>first));
 let current:{rows:readonly {id:string;amount:number}[]}={rows:Object.freeze([Object.freeze({id:'TEST-new-1',amount:200}),Object.freeze({id:'TEST-new-2',amount:300}),...rows.slice(0,500),Object.freeze({...rows[500],amount:400}),...rows.slice(501)])};reads=0;
 const reply=server.reply(current,current,'TEST-session','TEST-authority',current,client.headers()['X-Treasury-State-Cursor']);assert.ok(reads<=2*count+8,'prepend must not build historical Maps then scan removal and order again');assert.deepEqual(reply.stateDelta.collections.rows.splice,{start:0,deleteCount:0,ids:['TEST-new-1','TEST-new-2']});assert.equal(reply.stateDelta.collections.rows.upsert.length,3);assert.deepEqual(await client.accept(wire(reply),query(server,()=>current)),wire(current));assert.equal(rows[500].amount,100);
 for(const direction of ['prepend','append','prepend']){const row=Object.freeze({id:'TEST-'+direction+'-'+current.rows.length,amount:500});current={rows:Object.freeze(direction==='prepend'?[row,...current.rows]:[...current.rows,row])};assert.deepEqual(await client.accept(wire(server.reply(current,current,'TEST-session','TEST-authority',current,client.headers()['X-Treasury-State-Cursor'])),query(server,()=>current)),wire(current));}
 current={rows:Object.freeze([...current.rows.slice(2).reverse(),current.rows[0]])};assert.deepEqual(await client.accept(wire(server.reply(current,current,'TEST-session','TEST-authority',current,client.headers()['X-Treasury-State-Cursor'])),query(server,()=>current)),wire(current));
});

test('prepend proof rejects collisions, changed suffix order and unproven immutable baselines',async()=>{
 for(const mode of ['old-collision','prefix-collision','suffix-reordered','accessor','sparse','old-mutable','new-proven-reordered']){
  const frozen=Object.freeze(['A','B','C'].map(id=>Object.freeze({id,amount:100}))),first={rows:mode==='old-mutable'?[...frozen]:frozen},server=new StateSync(),client=new StateSyncClient();await client.accept(wire(server.reply(first,first,'TEST-session','TEST-authority',first,undefined)),query(server,()=>first));
  const prefix=mode==='old-collision'?[frozen[0]]:mode==='prefix-collision'?[Object.freeze({id:'NEW',amount:200}),Object.freeze({id:'NEW',amount:300})]:mode==='accessor'?[Object.freeze({get id(){return 'NEW';},amount:200})]:[Object.freeze({id:'NEW',amount:200})];
  const values=[...prefix,...(['suffix-reordered','new-proven-reordered'].includes(mode)?[frozen[0],frozen[2],frozen[1]]:frozen)];if(mode==='sparse')delete values[0];const next={rows:Object.freeze(values)};
  if(mode==='new-proven-reordered')server.reply(next,next,'TEST-other','TEST-other-authority',next,undefined);
  const reply=wire(server.reply(next,next,'TEST-session','TEST-authority',next,client.headers()['X-Treasury-State-Cursor']));assert.deepEqual(await client.accept(reply,query(server,()=>next)),wire(next));assert.deepEqual(first.rows.map(row=>row.amount),[100,100,100]);
 }
});

test('an already proven prepended array still binds to exact suffix order and current authority',async()=>{
 let reads=0;const rows=Object.freeze(Array.from({length:1000},(_,i)=>new Proxy(Object.freeze({id:'TEST-'+i,amount:100}),{get(target,key,receiver){if(key==='id')reads++;return Reflect.get(target,key,receiver);}}))),server=new StateSync(),client=new StateSyncClient(),first={rows};await client.accept(wire(server.reply(first,first,'TEST-session','TEST-authority',first,undefined)),query(server,()=>first));
 const cursor=client.headers()['X-Treasury-State-Cursor'],next={rows:Object.freeze([Object.freeze({id:'TEST-new',amount:200}),...rows])};server.reply(next,next,'TEST-other','TEST-other-authority',next,undefined);reads=0;
 const reply=server.reply(next,next,'TEST-session','TEST-authority',next,cursor);assert.ok(reads<=2,'exact proven prepend skips unchanged ID reads, not suffix reference/order checks');assert.deepEqual(reply.stateDelta.collections.rows.splice,{start:0,deleteCount:0,ids:['TEST-new']});assert.deepEqual(await client.accept(wire(reply),query(server,()=>next)),wire(next));
 const denied=server.reply(next,next,'TEST-session','TEST-revoked',next,cursor);assert.ok(denied.stateSnapshot&&!denied.stateDelta);
});

test('an already proven new array reuses immutable row identities without rescanning unchanged identifiers',async()=>{
 let reads=0;const rows=Object.freeze(Array.from({length:1000},(_,i)=>new Proxy(Object.freeze({id:'TEST-'+i,amount:100}),{get(target,key,receiver){if(key==='id')reads++;return Reflect.get(target,key,receiver);}}))),server=new StateSync(),client=new StateSyncClient(),first={rows};await client.accept(wire(server.reply(first,first,'TEST-session','TEST-authority',first,undefined)),query(server,()=>first));const cursor=client.headers()['X-Treasury-State-Cursor'],next={rows:Object.freeze([...rows,Object.freeze({id:'TEST-tail',amount:200})])};const other=server.reply(next,next,'TEST-other','TEST-other-authority',next,undefined);
 reads=0;const reply=server.reply(next,next,'TEST-session','TEST-authority',next,cursor);assert.ok(reads<=2,'proven immutable identity must avoid unchanged-ID rescans across readers');assert.deepEqual(await client.accept(wire(reply),query(server,()=>next)),wire(next));
 const foreign=server.reply(next,next,'TEST-session','TEST-revoked-authority',next,other.stateSnapshot.cursor);assert.ok(foreign.stateSnapshot&&!foreign.stateDelta,'array proof never authorizes another binding or revoked authority');
});

test('a proven new array still requires the old immutable proof and exact prefix order',async()=>{
 for(const mode of ['reordered','deleted','old-mutable']){const frozen=Object.freeze(['A','B','C'].map(id=>Object.freeze({id,amount:100}))),old=mode==='old-mutable'?[...frozen]:frozen,first={rows:old},server=new StateSync(),client=new StateSyncClient();await client.accept(wire(server.reply(first,first,'TEST-session','TEST-authority',first,undefined)),query(server,()=>first));const next={rows:mode==='reordered'?Object.freeze([frozen[2],frozen[0],frozen[1]]):mode==='deleted'?Object.freeze(frozen.slice(1)):Object.freeze([...frozen,Object.freeze({id:'D',amount:200})])};server.reply(next,next,'TEST-other','TEST-other-authority',next,undefined);const reply=server.reply(next,next,'TEST-session','TEST-authority',next,client.headers()['X-Treasury-State-Cursor']);assert.deepEqual(await client.accept(wire(reply),query(server,()=>next)),wire(next));}
});

test('server immutable fast path preserves frozen reorder, append, deletion and invalid-identifier fallback',async()=>{
 for(const kind of ['reorder','append','delete','duplicate','missing','accessor']){
  const first={rows:Object.freeze(['A','B','C'].map(id=>Object.freeze({id,amount:100})))},server=new StateSync(),client=new StateSyncClient();await client.accept(wire(server.reply(first,first,'TEST-session','TEST-authority',first,undefined)),query(server,()=>first));
  const values=kind==='reorder'?[first.rows[2],first.rows[0],first.rows[1]]:kind==='append'?[...first.rows,Object.freeze({id:'D',amount:200})]:kind==='delete'?first.rows.slice(1):kind==='duplicate'?[first.rows[0],first.rows[0],first.rows[2]]:kind==='missing'?[Object.freeze({amount:200}),...first.rows.slice(1)]:[Object.freeze({get id(){return 'A';},amount:200}),...first.rows.slice(1)],next={rows:Object.freeze(values)};
  const reply=wire(server.reply(next,next,'TEST-session','TEST-authority',next,client.headers()['X-Treasury-State-Cursor']));if(['duplicate','missing'].includes(kind)){assert.deepEqual(reply.stateDelta.set.rows,wire(next.rows));continue;}
  const applied=await client.accept(reply,query(server,()=>next));assert.deepEqual(applied,wire(next));assert.deepEqual(first.rows.map(r=>r.amount),[100,100,100]);
 }
});

test('a baseline inheriting stable-ID proof still builds the exact lazy map after consecutive edits then reorder and deletion',async()=>{
 const server=new StateSync(),client=new StateSyncClient();let current:{rows:readonly {id:string;amount:number}[]}={rows:Object.freeze(Array.from({length:20},(_,i)=>Object.freeze({id:'TEST-'+i,amount:100})))};
 await client.accept(wire(server.reply(current,current,'TEST-session','TEST-authority',current,undefined)),query(server,()=>current));
 for(const amount of [200,300]){current={rows:Object.freeze(current.rows.map((r,i)=>i===0?Object.freeze({...r,amount}):r))};const reply=server.reply(current,current,'TEST-session','TEST-authority',current,client.headers()['X-Treasury-State-Cursor']);assert.equal(reply.stateDelta.collections.rows.upsert.length,1);assert.deepEqual(reply.stateDelta.collections.rows.splice,{start:20,deleteCount:0,ids:[]});assert.deepEqual(await client.accept(wire(reply),query(server,()=>current)),wire(current));}
 current={rows:Object.freeze([...current.rows.slice(2).reverse(),current.rows[0]])};const reply=server.reply(current,current,'TEST-session','TEST-authority',current,client.headers()['X-Treasury-State-Cursor']);assert.deepEqual(reply.stateDelta.collections.rows.remove,['TEST-1']);assert.deepEqual(await client.accept(wire(reply),query(server,()=>current)),wire(current));
});

test('freezing a formerly mutable baseline cannot retroactively grant its old identifier uniqueness proof',async()=>{
 for(const topFrozen of [false,true]){const server=new StateSync(),client=new StateSyncClient(),first={rows:[{id:'A',amount:100},{id:'B',amount:100}]};if(topFrozen)Object.freeze(first.rows);await client.accept(wire(server.reply(first,first,'TEST-session','TEST-authority',first,undefined)),query(server,()=>first));
 first.rows[1].id='A';for(const row of first.rows)Object.freeze(row);Object.freeze(first.rows);const next={rows:Object.freeze([first.rows[0],Object.freeze({...first.rows[1],amount:200})])};
 const reply=server.reply(next,next,'TEST-session','TEST-authority',next,client.headers()['X-Treasury-State-Cursor']);assert.deepEqual(reply.stateDelta.set.rows,wire(next.rows),'uniqueness must have been proven while immutable, not after caller mutation');}
});
test('record-only delta scans baseline identifiers once, preserves history/order and never mutates it',async()=>{
 let reads=0;const count=1000,rows=Array.from({length:count},(_,i)=>Object.freeze({get id(){reads++;return 'TEST-'+i;},amount:100,history:Object.freeze(['TEST'])})),client=new StateSyncClient();
 const initial={stateRoot:true,stateSnapshot:{cursor:'TEST-initial',version:{epoch:'TEST',sequence:1},fields:{},collections:[{key:'rows',total:count}],pageSize:250}};
 const data=await client.accept(initial,async route=>{const u=new URL(route,'http://127.0.0.1');if(u.searchParams.get('sync')==='finish')return {stateRoot:true,stateDelta:{base:'TEST-initial',cursor:'TEST-ready',version:{epoch:'TEST',sequence:1},set:{},remove:[],collections:{}}};const offset=Number(u.searchParams.get('offset'));return {statePage:{cursor:'TEST-initial',key:'rows',offset,total:count,rows:rows.slice(offset,offset+250)}};});
 reads=0;const response=await client.accept({stateRoot:true,stateDelta:{base:'TEST-ready',cursor:'TEST-updated',version:{epoch:'TEST',sequence:2},set:{},remove:[],collections:{rows:{upsert:[{id:'TEST-0',amount:200,history:['TEST']}],remove:[],splice:{start:count,deleteCount:0,ids:[]}}}}},async()=>{throw Error('TEST no bootstrap expected');});
 assert.ok(reads<=count+2,'record-only update must not build and rescan a second full identifier/order representation');assert.equal(response.rows[0].amount,200);assert.equal(data.rows[0].amount,100);assert.equal(response.rows[1],data.rows[1]);assert.equal(response.rows.at(-1),data.rows.at(-1));
 await assert.rejects(client.accept({stateRoot:true,stateDelta:{base:'TEST-updated',cursor:'TEST-invalid',version:{epoch:'TEST',sequence:3},set:{},remove:[],collections:{rows:{upsert:[{id:'TEST-not-in-order',amount:100}],remove:[],splice:{start:count,deleteCount:0,ids:[]}}}}},async()=>{throw Error('TEST no bootstrap');}));
});
test('bounded bundles validate every page and byte budget before consuming any page',()=>{
 const server=new StateSync(),state=view(),snapshot=server.reply(state,state,'TEST-session','TEST-authority',state,undefined).stateSnapshot;
 const valid=[{key:'users',offset:0},{key:'paymentRequests',offset:0}],invalid=[...valid,{key:'paymentRequests',offset:1}];
 assert.throws(()=>server.bundle(snapshot.cursor,'TEST-session','TEST-authority',state,invalid));
 const response=server.bundle(snapshot.cursor,'TEST-session','TEST-authority',state,valid);assert.equal(response.statePages.length,2);assert.equal(response.statePages[1].rows.length,250);
 assert.equal(server.encodedBundle(response),JSON.stringify(response),'send reuses exactly the native JSON already measured, not a second serializer');assert.throws(()=>server.encodedBundle({statePages:[]}));
 assert.throws(()=>server.bundle(snapshot.cursor,'TEST-session','TEST-authority',state,valid));
 const huge={...state,paymentRequests:[{id:'TEST-huge',text:'x'.repeat(8*1024*1024)}]},large=server.reply(huge,huge,'TEST-session','TEST-authority',huge,undefined).stateSnapshot;
 assert.throws(()=>server.bundle(large.cursor,'TEST-session','TEST-authority',huge,[{key:'paymentRequests',offset:0}]),(e:any)=>e.status===413&&e.bundleTooLarge);
 assert.equal(server.page(large.cursor,'TEST-session','TEST-authority',huge,'paymentRequests',0,250).statePage.rows[0].id,'TEST-huge','oversized bundle consumed nothing; original single-page path remains lossless');
});
test('paged initialization returns every authorized record without a full-state envelope',async()=>{
  const server=new StateSync(),client=new StateSyncClient(),state=view(10000),reply=wire(server.reply(state,state,'TEST-session','TEST-authority',state,undefined));
  assert.ok(reply.stateSnapshot&&!reply.paymentRequests&&!reply.state);assert.ok(JSON.stringify(reply).length<1500);
  let calls=0;const get=query(server,()=>state);
  const received=await client.accept(reply,async route=>{calls++;const response=await get(route);for(const page of response.statePages||[response.statePage].filter(Boolean))assert.ok(page.rows.length<=250);return response;});
  assert.deepEqual(received,state);assert.equal(calls,12,'four bounded pages share a request, without dropping any rows');
});
test('delta preserves upserts, deletion, exact order, nullable fields and untouched history',async()=>{
  const server=new StateSync(),client=new StateSyncClient(),first=view();
  await client.accept(wire(server.reply(first,first,'TEST-session','TEST-authority',first,undefined)),query(server,()=>first));
  const changed={...first,config:undefined,paymentRequests:[{id:'TEST-new',amount:200},...first.paymentRequests.slice(2),{...first.paymentRequests[0],amount:150}]};
  const reply=wire(server.reply({success:true,state:changed},changed,'TEST-session','TEST-authority',changed,client.headers()['X-Treasury-State-Cursor']));
  assert.equal(reply.stateDelta.collections.paymentRequests.upsert.length,2);assert.deepEqual(reply.stateDelta.collections.paymentRequests.remove,['TEST-1']);assert.ok(!reply.state);
  const result=await client.accept(reply,query(server,()=>changed));assert.equal(result.success,true);assert.deepEqual(result.state,wire(changed));
});
test('scope, identity, authority revocation and stale records cannot retrieve a cached page',()=>{
  const server=new StateSync(),state=view(),reply=server.reply(state,state,'TEST-session','TEST-authority',state,undefined),cursor=reply.stateSnapshot.cursor;
  const denied:Array<[string,string,any]>=[['TEST-other','TEST-authority',state],['TEST-session','revoked',state],['TEST-session','TEST-authority',{...state,paymentRequests:[]}],['TEST-session','TEST-authority',{...state,paymentRequests:[{...state.paymentRequests[0],amount:999}]}]];
  for(const args of denied)assert.throws(()=>server.page(cursor,...args,'paymentRequests',0,250),(e:any)=>e.status===409);
  const restricted={users:[],paymentRequests:[]};const fresh=server.reply(restricted,restricted,'TEST-other','TEST-authority',restricted,cursor);assert.ok(fresh.stateSnapshot&&!fresh.stateDelta);assert.equal(fresh.stateSnapshot.collections.find((r:any)=>r.key==='paymentRequests').total,0);
  for(const key of ['__proto__','constructor','missing'])assert.throws(()=>server.page(cursor,'TEST-session','TEST-authority',state,key,0,250));
  for(const size of [0,-1,251,Infinity])assert.throws(()=>server.page(cursor,'TEST-session','TEST-authority',state,'paymentRequests',0,size));
});
test('out-of-order responses do not rewind a newer committed state; no baseline means GET only',async()=>{
  const server=new StateSync(),client=new StateSyncClient(),first=view(2);
  await client.accept(wire(server.reply(first,first,'TEST-session','TEST-authority',first,undefined)),query(server,()=>first));
  const cursor=client.headers()['X-Treasury-State-Cursor'],second={...first,paymentRequests:[{...first.paymentRequests[0],amount:200},first.paymentRequests[1]]},third={...second,paymentRequests:[{...second.paymentRequests[0],amount:300},first.paymentRequests[1]]};
  const a=wire(server.reply({success:true,state:second},second,'TEST-session','TEST-authority',second,cursor)),b=wire(server.reply({success:true,state:third},third,'TEST-session','TEST-authority',third,cursor));
  assert.equal((await client.accept(b,query(server,()=>third))).state.paymentRequests[0].amount,300);
  assert.equal((await client.accept(a,query(server,()=>third))).state.paymentRequests[0].amount,300);
  const empty=new StateSyncClient(),routes:string[]=[];const received=await empty.accept(b,async route=>{routes.push(route);return query(server,()=>third)(route);});
  assert.deepEqual(received.state,third);assert.ok(routes.every(r=>r.startsWith('/api/state?')));
});
test('incomplete pages never publish a partial state, retry only GET and remain bounded',async()=>{
  const server=new StateSync(),client=new StateSyncClient(),state=view(),reply=wire(server.reply(state,state,'TEST-session','TEST-authority',state,undefined));let restarts=0;
  await assert.rejects(client.accept(reply,async route=>{if(route.endsWith('begin')){restarts++;return reply;}return {syncExpired:true};}));
  assert.equal(restarts,1);assert.ok(!client.headers()['X-Treasury-State-Cursor']);
  let time=0;const limited=new StateSync({entries:2,rows:1000,ttlMs:2},()=>time),first=limited.reply(state,state,'TEST-session','TEST-authority',state,undefined);time=3;
  assert.throws(()=>limited.page(first.stateSnapshot.cursor,'TEST-session','TEST-authority',state,'paymentRequests',0,1));
  assert.throws(()=>limited.reply(view(1001),view(1001),'TEST-session','TEST-authority',{},undefined),(e:any)=>e.status===413);
});
test('revocation after an earlier page is rejected at finish and never published',async()=>{
  const server=new StateSync(),client=new StateSyncClient(),state=view(),reply=wire(server.reply(state,state,'TEST-session','TEST-authority',state,undefined));
  let finishes=0;
  await assert.rejects(client.accept(reply,async route=>{
    if(route.includes('sync=finish')){finishes++;return wire(server.finish(reply.stateSnapshot.cursor,'TEST-session','TEST-authority',{...state,paymentRequests:[]},{}));}
    if(route.endsWith('begin'))throw Error('TEST no second snapshot admitted');
    return query(server,()=>state)(route);
  }));
  assert.equal(finishes,1);assert.ok(!client.headers()['X-Treasury-State-Cursor']);
});
test('browser transport cannot apply another sessions result and never replays a command',async()=>{
  let token:string|null='TEST-token',finish:(r:Response)=>void=()=>{},posts=0;
  const fetcher=createStateFetch((async(_url,init)=>{if(init?.method==='POST')posts++;return new Promise<Response>(resolve=>{finish=resolve;});}) as typeof fetch,()=>token);
  const pending=fetcher('/api/payment-requests',{method:'POST',headers:{Authorization:'Bearer TEST-token'}});token='TEST-other';finish(new Response(JSON.stringify({success:true}),{status:200,headers:{'content-type':'application/json'}}));
  await assert.rejects((await pending).json(),(e:any)=>e.name==='AbortError');assert.equal(posts,1);
});
test('a delayed older server bootstrap cannot retire the freshly confirmed restart epoch',async()=>{
  const oldServer=new StateSync(),newServer=new StateSync(),client=new StateSyncClient(),oldState=view(1),newState={...oldState,paymentRequests:[{id:'TEST-0',amount:200}]};
  const old=wire(oldServer.reply(oldState,oldState,'TEST-session','TEST-authority',oldState,undefined)),fresh=wire(newServer.reply(newState,newState,'TEST-session','TEST-authority',newState,undefined));
  let finishOld:(value:any)=>void=()=>{},began:()=>void=()=>{};const waiting=new Promise<void>(resolve=>{began=resolve;});
  const pending=client.accept(old,async route=>{if(route.includes('sync=finish')){began();return new Promise(resolve=>{finishOld=resolve;});}return query(oldServer,()=>oldState)(route);});
  await waiting;assert.equal((await client.accept(fresh,query(newServer,()=>newState))).paymentRequests[0].amount,200);
  finishOld(wire(oldServer.finish(old.stateSnapshot.cursor,'TEST-session','TEST-authority',oldState,oldState)));
  assert.equal((await pending).paymentRequests[0].amount,200);
});
test('writes between pages are reconciled against the exact delivered baseline, not an older snapshot',async()=>{
  const server=new StateSync(),client=new StateSyncClient(),first=view();let current=first,changed=false;
  const reply=wire(server.reply(first,first,'TEST-session','TEST-authority',first,undefined));
  const result=await client.accept(reply,async route=>{
    const received=await query(server,()=>current)(route);
    if((received.statePages||[received.statePage]).some((p:any)=>p?.key==='paymentRequests'&&p.offset===0)&&!changed){changed=true;current={...first,paymentRequests:[{...first.paymentRequests[0],amount:321},...first.paymentRequests.slice(1)]} as any;}
    return received;
  });
  assert.equal(result.paymentRequests[0].amount,321);assert.deepEqual(result,current);
  assert.equal(first.paymentRequests[0].amount,100,'committed source is never modified by paging');
});
test('oversized bundles fall back to lossless single GET pages, not to command replay',async()=>{
 const server=new StateSync(),client=new StateSyncClient(),state={...view(1),paymentRequests:[{id:'TEST-big',text:'x'.repeat(8*1024*1024)}]},routes:string[]=[];
 const received=await client.accept(wire(server.reply(state,state,'TEST-session','TEST-authority',state,undefined)),async route=>{routes.push(route);return query(server,()=>state)(route);});
 assert.deepEqual(received,state);assert.ok(routes.some(route=>route.includes('sync=bundle')));assert.ok(routes.some(route=>route.includes('collection=paymentRequests')));assert.ok(routes.every(route=>route.startsWith('/api/state?')));
});
