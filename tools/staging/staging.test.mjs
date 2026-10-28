import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn,spawnSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { childEnvironment, sha } from './common.mjs';
import { makeGateway } from './gateway.mjs';
import {installCardinfoBroker} from './cardinfo-ipc.mjs';

const guard = pathToFileURL(fileURLToPath(new URL('./outbound-guard.mjs', import.meta.url))).href;
function fixture() {
  const parent = process.env.SHAHRAH_STAGING_TEST_OUTPUT || 'C:/Users/reza/Desktop/پروژه‌ها/انتشار موقت khazaneh/work/permanent-staging-20261022/test-fixtures';
  fs.mkdirSync(parent, { recursive: true });
  const root = fs.mkdtempSync(path.join(parent, 'guard-'));
  fs.mkdirSync(path.join(root, 'data'));
  fs.writeFileSync(path.join(root, 'staging.json'), JSON.stringify({ kind: 'shahrah-private-staging', syntheticOnly: true, root: fs.realpathSync(root) }));
  return root;
}
test('guard allows the real application loopback listener, without allowing an outbound socket', () => {
  const root = fixture();
  const code = `import net from 'node:net'; const s=net.createServer(); s.listen(0,'127.0.0.1',()=>{try{net.connect({host:'127.0.0.1',port:1});process.exitCode=1}catch{s.close()}});`;
  const result = spawnSync(process.execPath, ['--import', guard, '--input-type=module', '-e', code], { env: childEnvironment(root), encoding: 'utf8', timeout: 5000, windowsHide: true });
  assert.equal(result.status, 0, 'A guarded application must bind its loopback listener');
});
test('guard blocks external fetch, raw sockets, UDP, DNS, child programs and loopback tunnels', () => {
  const root = fixture();
  const code = `import net from 'node:net';import http from 'node:http';import dns from 'node:dns';import dgram from 'node:dgram';import cp from 'node:child_process';let count=0;const calls=[()=>fetch('https://example.invalid'),()=>http.get('http://127.0.0.1:1'),()=>net.connect({host:'203.0.113.1',port:443}),()=>new net.Socket().connect(1,'127.0.0.1'),()=>dns.resolve4('example.invalid'),()=>dgram.createSocket('udp4'),()=>cp.spawn('echo')];for(const f of calls){try{f()}catch{count++}}if(count!==calls.length)process.exitCode=1;`;
  const result = spawnSync(process.execPath, ['--import', guard, '--input-type=module', '-e', code], { env: childEnvironment(root), encoding: 'utf8', timeout: 5000, windowsHide: true });
  assert.equal(result.status, 0);
  assert.equal(childEnvironment(root).GEMINI_API_KEY, undefined);
});
test('every DNS query API and Resolver variant is disabled before a query can be emitted', () => {
  const root = fixture();
  const code = `import dns from 'node:dns';const targets=[dns,dns.promises,new dns.Resolver(),new dns.promises.Resolver()];let failed=false;for(const target of targets)for(const key of ['resolveTxt','resolveMx','resolveAny','resolveCaa','resolveCname','resolveNaptr','resolveNs','resolvePtr','resolveSoa','resolveSrv','reverse']){let denied=false;try{target[key]('example.invalid',()=>{})}catch(e){denied=e.message==='Staging outbound disabled'}if(!denied)failed=true;}process.exit(failed?1:0);`;
  const result = spawnSync(process.execPath, ['--import', guard, '--input-type=module', '-e', code], { env: childEnvironment(root), encoding: 'utf8', timeout: 5000, windowsHide: true });
  assert.equal(result.status, 0, 'All DNS query paths must fail synchronously before networking');
});

test('real Cardinfo test keeps general networking blocked and permits only its private typed IPC pipe',async()=>{
 const root=fixture(),config=JSON.parse(fs.readFileSync(path.join(root,'staging.json'),'utf8'));config.cardinfoRealTest=true;fs.writeFileSync(path.join(root,'staging.json'),JSON.stringify(config));
 const code=`import net from 'node:net';import dns from 'node:dns';let denied=0;for(const run of [()=>fetch('https://cardinfo.ir'),()=>net.connect({host:'127.0.0.1',port:1}),()=>dns.lookup('cardinfo.ir')])try{run()}catch{denied++}if(denied!==3)process.exit(1);const f=globalThis[Symbol.for('shahrah.cardinfo.transport')];await f('https://other.invalid',{}).then(()=>process.exit(2),()=>{});const r=await f('https://cardinfo.ir/inquiry/apiv1?action=listCredits',{method:'GET',redirect:'error',headers:{Authorization:'Bearer SYNTHETIC-ONLY'}});process.exit(r.status===200?0:3);`;
 const child=spawn(process.execPath,['--import',guard,'--input-type=module','-e',code],{env:childEnvironment(root),stdio:['ignore','ignore','ignore','ipc'],windowsHide:true});let calls=0;installCardinfoBroker(child,true,async()=>{calls++;return new Response('[]');});const exit=await new Promise((resolve,reject)=>{child.once('exit',resolve);child.once('error',reject);});assert.equal(exit,0);assert.equal(calls,1);
});
test('non-ASCII control input is denied without crashing the gateway', async () => {
  const script = `import http from 'node:http';import{makeGateway}from ${JSON.stringify(new URL('./gateway.mjs', import.meta.url).href)};const c={port:0,backendPort:1,gateHash:'0'.repeat(64),controlNonce:'a'.repeat(48)};const g=makeGateway(c,()=>{});g.listen(0,'127.0.0.1',()=>{c.port=g.address().port;const r=http.request({host:'127.0.0.1',port:c.port,path:'/__staging/control/stop',method:'POST',headers:{'x-staging-control':'é'.repeat(48)}},res=>{if(res.statusCode!==403)process.exitCode=1;res.resume();res.on('end',()=>g.close())});r.end()});`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8', timeout: 5000, windowsHide: true });
  assert.equal(result.status, 0);
});
test('wrong gate password returns a UTF-8 Persian retry form without accepting a session', async () => {
  const config={port:0,backendPort:1,gateHash:sha('SYNTHETIC-GATE-TEST'),controlNonce:'synthetic-control'};
  const gateway=makeGateway(config,()=>{});await new Promise(r=>gateway.listen(0,'127.0.0.1',r));config.port=gateway.address().port;
  try{
    const response=await fetch(`http://127.0.0.1:${config.port}/__staging/login`,{method:'POST',body:'password=wrong',redirect:'manual'});
    assert.equal(response.status,401);assert.equal(response.headers.get('set-cookie'),null);assert.equal(response.headers.get('location'),null);
    assert.equal(response.headers.get('content-type'),'text/html; charset=utf-8');
    const body=await response.text();assert.ok(body.includes('رمز دروازه نادرست است.'));assert.match(body,/<meta charset="utf-8">/);assert.match(body,/role="alert"/);assert.match(body,/<form method="post" action="\/__staging\/login">/);
  }finally{gateway.closeAllConnections();await new Promise(r=>gateway.close(r));}
});

test('gateway protects pages/API/files, rejects wrong hosts and cross-site access, and preserves real app auth', async () => {
  let received;
  const backend = http.createServer((req, res) => { received = req.headers; res.end('synthetic application'); });
  await new Promise(resolve => backend.listen(0, '127.0.0.1', resolve));
  const config = { port: 0, backendPort: backend.address().port, gateHash: sha('SYNTHETIC-GATE-TEST'), controlNonce: 'synthetic-control' };
  const gate = makeGateway(config, () => {}); await new Promise(resolve => gate.listen(0, '127.0.0.1', resolve));
  config.port = gate.address().port;
  // makeGateway pins its origin at construction; use an explicit known port after allocation.
  await new Promise(resolve => gate.close(resolve));
  let ready = false;
  const active = makeGateway(config, () => {}, () => ready); await new Promise(resolve => active.listen(config.port, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${config.port}`;
  try {
    for (const route of ['/api/state', '/assets/private.js', '/data/treasury.sqlite']) assert.equal((await fetch(base + route, { redirect: 'manual' })).status, 401);
    assert.equal((await fetch(base + '/', { redirect: 'manual' })).status, 303);
    const wrongHost = await new Promise((resolve, reject) => { const req = http.get(base + '/', { headers: { host: 'attacker.invalid' } }, res => { res.resume(); resolve(res.statusCode); }); req.on('error', reject); });
    assert.equal(wrongHost, 403);
    assert.equal((await fetch(base + '/__staging/login', { method: 'POST', headers: { origin: 'https://attacker.invalid' }, body: 'password=SYNTHETIC-GATE-TEST' })).status, 403);
    assert.equal((await fetch(base + '/__staging/login', { method: 'POST', body: 'password=wrong' })).status, 401);
    const login = await fetch(base + '/__staging/login', { method: 'POST', body: 'password=SYNTHETIC-GATE-TEST', redirect: 'manual' });
    assert.equal(login.status, 303); const cookie = login.headers.get('set-cookie');
    assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Strict/);
    assert.ok(cookie.startsWith(`shahrah_staging_${config.port}=`));
    assert.equal((await fetch(base + '/api/state', { headers: { cookie: cookie.split(';')[0] } })).status, 503);
    assert.equal(received, undefined, 'No request may reach an unverified backend listener');
    ready = true;
    const response = await fetch(base + '/api/state', { headers: { cookie: cookie.split(';')[0], authorization: 'Bearer SYNTHETIC-APP-TOKEN' } });
    assert.equal(await response.text(), 'synthetic application');
    assert.equal(received.authorization, 'Bearer SYNTHETIC-APP-TOKEN'); assert.equal(received.cookie, undefined);
    assert.match(response.headers.get('content-security-policy'), /connect-src 'self'/);
    assert.equal((await fetch(base + '/__staging/control/stop', { method: 'POST' })).status, 403);
  } finally { active.closeAllConnections(); backend.closeAllConnections(); await Promise.all([new Promise(r => active.close(r)), new Promise(r => backend.close(r))]); }
});

test('parallel private staging gateways keep separate cookies on the same loopback host',async()=>{
 const active=[];
 try{
  for(let i=0;i<2;i++){
   const probe=http.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
   const gateway=makeGateway({port,backendPort:port+1,gateHash:sha('SYNTHETIC-GATE-TEST'),controlNonce:'synthetic'},()=>{});await new Promise(r=>gateway.listen(port,'127.0.0.1',r));
   const base=`http://127.0.0.1:${port}`,response=await fetch(base+'/__staging/login',{method:'POST',body:'password=SYNTHETIC-GATE-TEST',redirect:'manual'});assert.equal(response.status,303);active.push({gateway,base,cookie:response.headers.get('set-cookie').split(';')[0]});
  }
  assert.notEqual(active[0].cookie.split('=')[0],active[1].cookie.split('=')[0]);
  const cookie=active.map(g=>g.cookie).join('; ');
  for(const g of active)assert.equal((await fetch(g.base+'/api/state',{headers:{cookie}})).status,503,'Each gate retains its own session; unready upstream stays closed');
 }finally{await Promise.all(active.map(({gateway})=>{gateway.closeAllConnections();return new Promise(r=>gateway.close(r));}));}
});
