// Separate from the production bundle. No credentials or production env inherited.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import dgram from 'node:dgram';
import dns from 'node:dns';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import {createCardinfoIpcTransport} from './cardinfo-ipc.mjs';

const root = fs.realpathSync(process.env.SHAHRAH_STAGING_ROOT || '');
const config = JSON.parse(fs.readFileSync(path.join(root, 'staging.json'), 'utf8'));
if (config.kind !== 'shahrah-private-staging' || config.syntheticOnly !== true ||
    fs.realpathSync(config.root) !== root || process.env.DISABLE_EXTERNAL_INTEGRATIONS !== 'true' ||
    process.env.TREASURY_STORAGE_MODE !== 'sqlite' || path.resolve(process.env.TREASURY_DATA_DIR || '') !== path.join(root, 'data')) throw Error('Staging isolation required');
if(config.cardinfoRealTest===true&&process.env.SHAHRAH_STAGING_CARDINFO_REAL==='true'){
 if(!process.connected||typeof process.send!=='function'||path.resolve(process.env.TREASURY_CARDINFO_VAULT_DIR||'')!==path.join(root,'secrets'))throw Error('Private Cardinfo test pipe required');
 Object.defineProperty(globalThis,Symbol.for('shahrah.cardinfo.transport'),{value:createCardinfoIpcTransport(),writable:false,configurable:false});
}
const denied = () => { throw Error('Staging outbound disabled'); };
// No outbound network at all, including loopback services such as live SSH tunnels.
globalThis.fetch = denied;
net.Socket.prototype.connect = denied;
net.connect = denied; net.createConnection = denied;
for (const m of [http, https]) { m.request = denied; m.get = denied; }
const lookup = dns.lookup, lookupAsync = dns.promises.lookup;
// Node's loopback listen itself calls lookup; literal IP resolution makes no DNS request.
dns.lookup = (host, ...args) => { if (!['127.0.0.1', '::1'].includes(host)) return denied(); return lookup(host, ...args); };
dns.promises.lookup = (host, ...args) => { if (!['127.0.0.1', '::1'].includes(host)) return denied(); return lookupAsync(host, ...args); };
const queryNames = ['lookupService', 'reverse', ...Object.keys(dns).filter(name => name.startsWith('resolve'))];
for (const target of [dns, dns.promises, dns.Resolver.prototype, dns.promises.Resolver.prototype]) {
  for (const name of queryNames) if (typeof target[name] === 'function') target[name] = denied;
}
dgram.createSocket = denied;
for (const name of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']) childProcess[name] = denied;
syncBuiltinESMExports();
