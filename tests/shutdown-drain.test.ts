import {test} from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';import express from 'express';
import {createMutationRoutes} from '../src/server/mutation-queue';import {stopServer,PendingWork} from '../src/server/shutdown';
const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(done=>resolve=done);return {promise,resolve};};
const pause=()=>new Promise(done=>setTimeout(done,40));

test('graceful shutdown waits for a started disconnected writer rather than only HTTP close',async()=>{
 const app=express(),routes=createMutationRoutes(app,()=>true),gate=deferred(),started=deferred();let saved=false,stopped=false;
 routes.post('/test',async(_q,r)=>{started.resolve();await gate.promise;saved=true;r.end();});
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(done=>server.once('listening',done));
 const request=http.request({host:'127.0.0.1',port:(server.address() as any).port,path:'/test',method:'POST'});request.on('error',()=>{});request.end();await started.promise;request.destroy();await pause();
 const stopping=stopServer(server,routes,undefined).then(()=>stopped=true);
 try{await pause();assert.equal(saved,false);assert.equal(stopped,false,'HTTP close must not exit while the disconnected handler still owns the write turn');gate.resolve();await stopping;assert.equal(saved,true);assert.equal(stopped,true);}finally{gate.resolve();await stopping;server.closeAllConnections();}
});

test('shutdown includes background writes scheduled by an already accepted writer and is idempotent',async()=>{
 const app=express(),routes=createMutationRoutes(app,()=>true),background=new PendingWork(),gate=deferred(),started=deferred(),backgroundGate=deferred(),backgroundStarted=deferred();let saved=false,stopped=false;
 routes.post('/test',async(_q,r)=>{started.resolve();await gate.promise;void background.run(async()=>{backgroundStarted.resolve();await backgroundGate.promise;saved=true;});r.end();});
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(done=>server.once('listening',done));const request=http.request({host:'127.0.0.1',port:(server.address() as any).port,path:'/test',method:'POST'});request.on('error',()=>{});request.end();await started.promise;request.destroy();await pause();
 const stopping=stopServer(server,routes,background);assert.equal(stopServer(server,routes,background),stopping);void stopping.then(()=>stopped=true);
 try{gate.resolve();await backgroundStarted.promise;await pause();assert.equal(stopped,false);assert.equal(saved,false);backgroundGate.resolve();await stopping;assert.equal(saved,true);}finally{gate.resolve();backgroundGate.resolve();await stopping;server.closeAllConnections();}
});

test('background drain includes nested work and settles failed work without an unhandled rejection',async()=>{
 const background=new PendingWork(),gate=deferred();let saved=false,done=false;
 void background.run(async()=>{void background.run(async()=>{await gate.promise;saved=true;});throw Error('TEST failed write');});
 const stopping=background.drain().then(()=>done=true);await pause();assert.equal(done,false);gate.resolve();await stopping;assert.equal(saved,true);assert.equal(done,true);
});

test('an HTTP close error is reported only after the accepted mutation and background work have drained',async()=>{
 const gate=deferred(),background=new PendingWork();let settled=false;const failure=Error('TEST close failed'),server={close:(callback:Function)=>callback(failure)} as any;
 const stopped=stopServer(server,{drain:()=>gate.promise},background).catch(error=>{settled=true;assert.equal(error,failure);});await pause();assert.equal(settled,false);gate.resolve();await stopped;assert.equal(settled,true);
});

test('shutdown lets both connected and already queued HTTP writers finish',async()=>{
 const app=express(),routes=createMutationRoutes(app,()=>true),started=deferred(),gate=deferred(),queued=deferred(),events:string[]=[];
 app.use((q,_r,next)=>{if(q.path==='/two')queued.resolve();next();});routes.post('/one',async(_q,r)=>{started.resolve();await gate.promise;events.push('one');r.end();});routes.post('/two',(_q,r)=>{events.push('two');r.end();});
 const server=app.listen(0,'127.0.0.1');await new Promise<void>(done=>server.once('listening',done));const post=(path:string)=>new Promise<void>((resolve,reject)=>{const q=http.request({host:'127.0.0.1',port:(server.address() as any).port,path,method:'POST',agent:false},r=>{r.resume();r.once('end',resolve);});q.once('error',reject);q.end();});
 const first=post('/one');await started.promise;const second=post('/two');await queued.promise;await pause();const stopping=stopServer(server,routes);gate.resolve();await Promise.all([first,second,stopping]);assert.deepEqual(events,['one','two']);
});
