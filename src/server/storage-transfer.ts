import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {backup} from 'node:sqlite';
import {SqliteRecords} from './sqlite-records';
import {whileStopped} from './owner-lock';

function canonical(value:any):any {
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));
  return value;
}
export function stateHash(value:object):string{return crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');}
export function verifyTransfer(before:object,after:object):void {
  if(stateHash(before)!==stateHash(after))throw Error('Lossless state comparison failed; do not activate this store.');
}
export function importJson(source:string,destination:string):{stateSha256:string} {
 return whileStopped([source,destination],()=>{
  const value=JSON.parse(fs.readFileSync(source,'utf8'));
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('State must be an object.');
  const store=new SqliteRecords(destination,true);
  try{store.commit(value,undefined,store.signature());verifyTransfer(value,store.read());return {stateSha256:stateHash(value)};}
  finally{store.close();}
 });
}
export function exportJson(source:string,destination:string):{stateSha256:string} {
 return whileStopped([source,destination],()=>{
  const store=new SqliteRecords(source,false,true);
  try {
    const value=store.read(),fd=fs.openSync(destination,'wx',0o600);
    try{fs.writeFileSync(fd,JSON.stringify(value));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
    verifyTransfer(value,JSON.parse(fs.readFileSync(destination,'utf8')));
    return {stateSha256:stateHash(value)};
  }finally{store.close();}
 });
}
/** SQLite backup API includes committed WAL data, unlike copying the main file. */
export async function backupSqlite(source:string,destination:string):Promise<{stateSha256:string}> {
  if(fs.existsSync(destination))throw Error('Backup destination already exists.');
  const store=new SqliteRecords(source,false,true);
  try {
    await backup(store.connection,destination);fs.chmodSync(destination,0o600);
    const restored=new SqliteRecords(destination,false,true);
    try{const value=restored.read();return {stateSha256:stateHash(value)};}finally{restored.close();}
  }finally{store.close();}
}
