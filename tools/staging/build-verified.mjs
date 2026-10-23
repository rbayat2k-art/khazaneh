// Fail closed on type errors, edits during build, and stale frontend/server inputs.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';import {pathToFileURL} from 'node:url';import {sha} from './common.mjs';
export function captureSources(root){
 const files=['server.ts','package.json','package-lock.json','tsconfig.json','vite.config.ts','index.html'];
 for(const dir of ['src','public','tools/staging']){if(!fs.existsSync(path.join(root,dir)))continue;function scan(p){for(const e of fs.readdirSync(path.join(root,p),{withFileTypes:true})){const next=p+'/'+e.name;assert.ok(!e.isSymbolicLink(),'Symlinked build input is unsupported');if(e.isDirectory())scan(next);else files.push(next);}}scan(dir);}
 return files.sort().map(file=>({path:file,sha256:sha(fs.readFileSync(path.join(root,file)))}));
}
export function assertSources(root,expected){assert.deepEqual(captureSources(root),expected,'Build sources changed; rebuild and retest, never replace them automatically');}
export function captureOutputs(root){const files=[];function scan(dir){for(const e of fs.readdirSync(path.join(root,'dist',dir),{withFileTypes:true})){const p=dir?dir+'/'+e.name:e.name;assert.ok(!e.isSymbolicLink());if(e.isDirectory())scan(p);else if(p!=='build-proof.json')files.push({path:p,sha256:sha(fs.readFileSync(path.join(root,'dist',p)))});}}scan('');return files.sort((a,b)=>a.path.localeCompare(b.path));}
export function verifyBuildProof(root,artifact,manifest){
 const proof=JSON.parse(fs.readFileSync(path.join(artifact,'dist','build-proof.json'),'utf8'));
 assert.equal(proof.status,'PASS','A successful typechecked stable build is required');
 assertSources(root,proof.sourceFiles);
 assert.deepEqual(captureOutputs(artifact),proof.outputFiles,'Frontend output differs from its successful build proof');
 for(const file of manifest.sourceFiles)assert.ok(proof.sourceFiles.some(p=>p.path===file.path&&p.sha256===file.sha256),'Frontend/server source mismatch: '+file.path);
 return proof;
}
export function build(root){
 const before=captureSources(root);fs.mkdirSync(path.join(root,'dist'),{recursive:true});
 fs.writeFileSync(path.join(root,'dist','build-proof.json'),JSON.stringify({status:'BUILDING'}));
 for(const [cli,args] of [['node_modules/typescript/bin/tsc',['--noEmit']],['node_modules/vite/bin/vite.js',['build']]]){
  const result=spawnSync(process.execPath,[path.join(root,cli),...args],{cwd:root,stdio:'inherit',windowsHide:true});
  if(result.error||result.status!==0)throw Error('Verified build failed; no successful build proof');assertSources(root,before);
 }
 const proof={status:'PASS',at:new Date().toISOString(),sourceFiles:before,outputFiles:captureOutputs(root)};
 fs.writeFileSync(path.join(root,'dist','build-proof.json'),JSON.stringify(proof,null,2));return proof;
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){try{const proof=build(process.cwd());console.log(JSON.stringify({verifiedBuild:'PASS',sourceFiles:proof.sourceFiles.length}));}catch(e){console.error(e.message);process.exitCode=1;}}
