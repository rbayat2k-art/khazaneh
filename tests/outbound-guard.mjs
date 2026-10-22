import path from 'node:path';import http from 'node:http';import https from 'node:https';import net from 'node:net';
const root=path.resolve(process.env.TREASURY_DATA_DIR||'').replaceAll('\\','/');
if(!root.startsWith('C:/Users/reza/Desktop/پروژه‌ها/انتشار موقت khazaneh/work/')||process.env.DISABLE_EXTERNAL_INTEGRATIONS!=='true')throw Error('explicit isolated fixture required');
const allowed=host=>['127.0.0.1','localhost','::1','[::1]'].includes(host);
const fetchOriginal=globalThis.fetch;globalThis.fetch=(input,...args)=>{if(!allowed(new URL(typeof input==='string'?input:input.url||String(input)).hostname))throw Error('Synthetic test outbound blocked');return fetchOriginal(input,...args);};
for(const module of [http,https])for(const key of ['request','get']){const original=module[key];module[key]=function(input,...args){const u=typeof input==='string'||input instanceof URL?new URL(input):input;if(!allowed(u.hostname||u.host||'localhost'))throw Error('Synthetic test outbound blocked');return original.call(this,input,...args);};}
const connect=net.Socket.prototype.connect;net.Socket.prototype.connect=function(...args){const o=Array.isArray(args[0])?args[0][0]:args[0],host=typeof o==='object'?o.host:typeof args[1]==='string'?args[1]:'localhost';if(host&&!allowed(host))throw Error('Synthetic test socket blocked');return connect.apply(this,args);};
