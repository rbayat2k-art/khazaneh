import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {inquiryRuntimeClient} from '../src/server/bank-inquiry-runtime';

function fixture(){
 const parent=process.env.TREASURY_TEST_DIR;
 if(!parent?.replaceAll('\\','/').startsWith('C:/Users/reza/Desktop/پروژه‌ها/انتشار موقت khazaneh/work/'))throw Error('Synthetic work root required');
 fs.mkdirSync(parent,{recursive:true});const root=fs.mkdtempSync(path.join(parent,'inquiry-runtime-')),vault=root+'/secrets';
 fs.mkdirSync(vault+'/keys',{recursive:true,mode:0o700});fs.writeFileSync(vault+'/keys/master.key',crypto.randomBytes(32),{flag:'wx',mode:0o600});
 return {root,vault,env:{NODE_ENV:'production',TREASURY_DATA_DIR:root+'/data',DISABLE_EXTERNAL_INTEGRATIONS:'true',TREASURY_INQUIRY_VAULT_DIR:vault}};
}
test('Production-shaped runtime exposes secure connection management while all external I/O remains disabled',()=>{
 const {env}=fixture(),runtime=inquiryRuntimeClient(env);
 assert.equal(runtime.mode,'DISABLED');assert.equal(runtime.connections?.metadata().available,true);
 assert.equal(runtime.connections?.metadata().profiles.length,1);assert.equal(runtime.client.configured(),false);
 runtime.connections!.saveLegacyKey('SYNTHETIC-PRODUCTION-KEY',0);
 assert.equal(runtime.connections!.metadata().profiles[0].hasCredentials,true);
 assert.equal(runtime.client.configured(),true,'Key readiness is separate from dispatch permission');
});
test('dedicated network permission works with the global SMS guard still closed and never sends on save/select',()=>{
 const {env}=fixture();let calls=0;const previous=globalThis.fetch;globalThis.fetch=async()=>{calls++;throw Error('Synthetic network must not be called');};
 try{
  const runtime=inquiryRuntimeClient({...env,TREASURY_INQUIRY_NETWORK_ALLOWED:'true'});
  assert.equal(runtime.mode,'LIVE');assert.ok(runtime.connections);runtime.connections.saveLegacyKey('SYNTHETIC-KEY',0);
  const m=runtime.connections.metadata();runtime.connections.select(m.activeConnectionId,m.revision);
  assert.equal(runtime.snapshot!().context.source,'LIVE');assert.equal(runtime.client.configured(),true);assert.equal(calls,0);
 }finally{globalThis.fetch=previous;}
});
test('legacy environment credentials never bypass the dedicated LIVE network permission',()=>{
 const runtime=inquiryRuntimeClient({DISABLE_EXTERNAL_INTEGRATIONS:'false',CARDINFO_API_KEY:'SYNTHETIC-LEGACY'});
 assert.equal(runtime.mode,'DISABLED');
});
test('invalid Staging broker isolation cannot fall through into Production configuration or direct LIVE',()=>{
 const {env}=fixture(),runtime=inquiryRuntimeClient({...env,SHAHRAH_STAGING_ROOT:'/invalid-staging',SHAHRAH_STAGING_CARDINFO_REAL:'true',TREASURY_INQUIRY_NETWORK_ALLOWED:'true',CARDINFO_API_KEY:'SYNTHETIC-LEGACY'});
 assert.equal(runtime.mode,'DISABLED');assert.equal(runtime.connections,undefined);assert.equal(runtime.client.configured(),false);
});
test('existing explicit synthetic MOCK remains isolated from any Production network flag',()=>{
 const {env}=fixture(),runtime=inquiryRuntimeClient({...env,TREASURY_BANK_INQUIRY_MOCK:'true',TREASURY_INQUIRY_NETWORK_ALLOWED:'true'});
 assert.equal(runtime.mode,'MOCK');assert.equal(runtime.connections,undefined);
});
