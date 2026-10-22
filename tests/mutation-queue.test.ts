import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import {createMutationRoutes} from '../src/server/mutation-queue';

const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(done=>{resolve=done;});return {promise,resolve};};
const pause=()=>new Promise(done=>setTimeout(done,40));
async function fixture(guard=(_q:express.Request,_r:express.Response)=>true){
  const app=express(),routes=createMutationRoutes(app,guard),server=app.listen(0,'127.0.0.1');
  await new Promise<void>(done=>server.once('listening',done));
  const port=(server.address() as {port:number}).port;
  app.use((error:unknown,_q:express.Request,r:express.Response,_n:express.NextFunction)=>{r.status(500).json({error:'synthetic failure'});});
  const request=(path:string)=>{const req=http.request({host:'127.0.0.1',port,path,method:'POST'});req.on('error',()=>{});req.end();return req;};
  return {app,routes,request,post:(path:string)=>fetch(`http://127.0.0.1:${port}${path}`,{method:'POST',signal:AbortSignal.timeout(3000)}),close:()=>{server.closeAllConnections();server.close();}};
}

test('disconnect after start does not release the write turn before its handler ends',async()=>{
  const f=await fixture(),started=deferred(),gate=deferred();let second=false;
  f.routes.post('/first',async(_q,r)=>{started.resolve();await gate.promise;r.end();});
  f.routes.post('/second',(_q,r)=>{second=true;r.end();});
  try{const first=f.request('/first');await started.promise;first.destroy();const next=f.post('/second');await pause();assert.equal(second,false);gate.resolve();assert.equal((await next).status,200);assert.equal(second,true);}finally{gate.resolve();f.close();}
});

test('a disconnected waiting request is skipped without poisoning the following turn',async()=>{
  const f=await fixture(),started=deferred(),gate=deferred(),arrived=deferred();let writes=0;
  f.app.use((q,_r,next)=>{if(q.path==='/aborted')arrived.resolve();next();});
  f.routes.post('/first',async(_q,r)=>{started.resolve();await gate.promise;r.end();});
  f.routes.post('/aborted',(_q,r)=>{writes++;r.end();});
  f.routes.post('/third',(_q,r)=>{r.end();});
  try{const first=f.post('/first');await started.promise;const waiting=f.request('/aborted');await arrived.promise;waiting.destroy();await pause();gate.resolve();await first;assert.equal((await f.post('/third')).status,200);assert.equal(writes,0);}finally{gate.resolve();f.close();}
});

test('current authorization is checked when the request takes its turn',async()=>{
  let revoked=false,executed=false;const gate=deferred(),started=deferred();
  const f=await fixture((q,r)=>{if(q.path==='/protected'&&revoked){r.status(403).end();return false;}return true;});
  f.routes.post('/first',async(_q,r)=>{started.resolve();await gate.promise;r.end();});
  f.routes.post('/protected',(_q,r)=>{executed=true;r.end();});
  try{const first=f.post('/first');await started.promise;const next=f.post('/protected');await pause();revoked=true;gate.resolve();await first;assert.equal((await next).status,403);assert.equal(executed,false);}finally{gate.resolve();f.close();}
});

test('a failed handler does not prevent the next request from running',async()=>{
  const f=await fixture();
  f.routes.post('/fail',async()=>{throw Error('synthetic failure');});f.routes.post('/ok',(_q,r)=>{r.end();});
  // Express error handling follows the registered route.
  f.app.use((_error:unknown,_q:express.Request,r:express.Response,_n:express.NextFunction)=>{r.status(500).end();});
  try{assert.equal((await f.post('/fail')).status,500);assert.equal((await f.post('/ok')).status,200);}finally{f.close();}
});

test('queued mutations yield to transport and timers without releasing a live handler early',async()=>{
 const handlers:Function[]=[],app={post:(_p:string,h:Function)=>handlers.push(h),delete:()=>{}};
 const routes=createMutationRoutes(app as any,()=>true),events:string[]=[];
 routes.post('/one',(_q,r)=>{events.push('one');setImmediate(()=>events.push('transport'));r.end();});
 routes.post('/two',(_q,r)=>{events.push('two');r.end();});
 const {EventEmitter}=await import('node:events');const response=()=>Object.assign(new EventEmitter(),{destroyed:false,end:()=>{}});
 handlers[0]({aborted:false},response(),(e:unknown)=>{throw e;});handlers[1]({aborted:false},response(),(e:unknown)=>{throw e;});
 await new Promise(r=>setTimeout(r,20));assert.deepEqual(events,['one','transport','two']);
});

test('drain closes admission without dropping already queued work or treating a failed write as committed',async()=>{
 const handlers:Function[]=[],app={post:(_p:string,h:Function)=>handlers.push(h),delete:()=>{}};
 const routes=createMutationRoutes(app as any,()=>true),gate=deferred(),started=deferred(),events:string[]=[];
 routes.post('/one',async()=>{started.resolve();await gate.promise;events.push('first');throw Error('TEST write failed');});routes.post('/two',(_q,r)=>{events.push('second');r.end();});
 const {EventEmitter}=await import('node:events');const response=()=>Object.assign(new EventEmitter(),{destroyed:false,statusCode:200,end:()=>{},status(code:number){this.statusCode=code;return this;},json:()=>{}});
 handlers[0]({aborted:false},response(),()=>{events.push('failed');});await started.promise;handlers[1]({aborted:false},response(),()=>{});
 let done=false;const draining=routes.drain().then(()=>done=true),late=response();handlers[1]({aborted:false},late,()=>{});assert.equal(late.statusCode,503);await pause();assert.equal(done,false);gate.resolve();await draining;assert.deepEqual(events,['first','failed','second']);assert.equal(done,true);
});
