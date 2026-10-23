import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readConfig, childEnvironment } from './common.mjs';

const [command, root] = process.argv.slice(2), config = readConfig(root), runtime = path.join(config.root, 'runtime.json');
if (command === 'start') {
  for (const port of [config.port, config.backendPort]) await new Promise((resolve, reject) => {
    const probe = net.createServer(); probe.once('error', reject); probe.listen(port, '127.0.0.1', () => probe.close(resolve));
  });
  const child = spawn(process.execPath, [fileURLToPath(new URL('./service.mjs', import.meta.url)), config.root],
    { env: childEnvironment(config.root), cwd: config.root, detached: true, stdio: 'ignore', windowsHide: true });
  child.unref(); const deadline = Date.now() + 18000;
  while (Date.now() < deadline) {
    const value = fs.existsSync(runtime) ? JSON.parse(fs.readFileSync(runtime, 'utf8')) : {};
    if (value.pid === child.pid && value.status === 'RUNNING') { console.log(JSON.stringify(value)); process.exit(0); }
    if (value.pid === child.pid && value.status === 'FAILED') throw Error('Staging failed closed');
    await new Promise(done => setTimeout(done, 150));
  }
  throw Error('Staging readiness not proved');
} else if (command === 'stop') {
  const response = await fetch(`http://127.0.0.1:${config.port}/__staging/control/stop`, { method: 'POST', headers: { 'X-Staging-Control': config.controlNonce } });
  assert.equal(response.status, 202); console.log('Staging stop requested; Production is not targeted.');
} else if (command === 'status') {
  console.log(fs.readFileSync(runtime, 'utf8'));
} else throw Error('Use start|stop|status and explicit Staging root');
