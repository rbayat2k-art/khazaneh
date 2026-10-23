import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readConfig, childEnvironment } from './common.mjs';
import { makeGateway } from './gateway.mjs';
import {installCardinfoBroker} from './cardinfo-ipc.mjs';

const config = readConfig(process.argv[2]);
const guard = pathToFileURL(fileURLToPath(new URL('./outbound-guard.mjs', import.meta.url))).href;
const runtime = path.join(config.root, 'runtime.json');
let stopping = false, child;
let admitted = false;
let ready = false;
function record(status) { fs.writeFileSync(runtime, JSON.stringify({ status, pid: process.pid, backendPid: child?.pid, manifestSha256: config.manifestSha256, at: new Date().toISOString(), url: `http://127.0.0.1:${config.port}/` }, null, 2), { mode: 0o600 }); }
const gate = makeGateway(config, stop, () => ready && !stopping && child?.exitCode === null);
async function stop() {
  if (stopping) return; stopping = true;
  gate.close(); gate.closeIdleConnections();
  if (child?.exitCode === null) { child.kill('SIGTERM'); await new Promise(done => child.once('exit', done)); }
  record('STOPPED'); gate.closeAllConnections(); process.exitCode = 0;
}
process.on('SIGTERM', stop); process.on('SIGINT', stop);
gate.once('error', () => { record('FAILED'); process.exitCode = 1; });
// Acquire the public loopback listener first. Occupied ports never get fixture traffic.
gate.listen(config.port, '127.0.0.1', async () => {
  child = spawn(process.execPath, ['--import', guard, path.join(config.release, 'server.cjs'), '--host', '127.0.0.1', '--port', String(config.backendPort)],
    { cwd: config.release, env: childEnvironment(config.root), windowsHide: true, stdio: ['ignore', 'pipe', 'ignore','ipc'] });
  installCardinfoBroker(child,config.cardinfoRealTest===true);
  // The actual child must announce its own successful listen, not another process's health endpoint.
  let startup = '';
  child.stdout.on('data', value => { startup = (startup + value.toString()).slice(-2048); if (startup.includes(`Server listening on http://127.0.0.1:${config.backendPort}`)) admitted = true; });
  child.once('exit', () => { if (!stopping) { record('FAILED'); gate.close(); gate.closeAllConnections(); process.exitCode = 1; } });
  child.once('error', () => { record('FAILED'); gate.close(); process.exitCode = 1; });
  const deadline = Date.now() + 15000;
  while (!stopping && Date.now() < deadline && child.exitCode === null) {
    try { if (admitted && (await fetch(`http://127.0.0.1:${config.backendPort}/api/health`, { signal: AbortSignal.timeout(1000) })).ok) { ready = true; record('RUNNING'); return; } } catch {}
    await new Promise(done => setTimeout(done, 150));
  }
  await stop(); process.exitCode = 1;
});
