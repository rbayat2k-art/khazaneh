import fs from 'node:fs';import {DatabaseSync} from 'node:sqlite';import {types} from 'node:util';

export interface StateBacking<T extends object>{signature():string;read():T;commit(value:T,baseline:T|undefined,expected:string):string;backup(destination:string):void;}
function keyFor(value:any,index:number):string {
  if(value&&typeof value==='object'&&!Array.isArray(value))for(const field of ['id','token','role'])if(typeof value[field]==='string'&&value[field])return field+':'+value[field];
  return 'position:'+index;
}
type ValidatedCollection={rows:readonly any[];keys:readonly string[]};

/** Single-owner record store. Relations inside a record remain lossless version-1 JSON. */
export class SqliteRecords<T extends object> implements StateBacking<T>{
  readonly connection:DatabaseSync;
  private identity:string;
  private file:string;
  private validatedStamp:string|undefined;
  private validatedCollections=new Map<string,ValidatedCollection>();
  private immutableValues=new WeakSet<object>();
  private immutable(value:any):boolean {
    if(value===null||typeof value!=='object')return typeof value!=='function';
    if(types.isProxy(value))return false;
    if(this.immutableValues.has(value))return true;
    if(!Object.isFrozen(value))return false;
    const prototype=Object.getPrototypeOf(value);
    if(prototype!==null&&prototype!==Object.prototype&&prototype!==Array.prototype)return false;
    // No getters, proxies over mutable IDs, shallow-frozen descendants or custom
    // serialization may establish a historical payload/identity proof.
    if('toJSON' in value)return false;
    for(const key of Reflect.ownKeys(value)){
      if(typeof key!=='string')return false;
      const descriptor=Object.getOwnPropertyDescriptor(value,key)!;
      if(!('value' in descriptor)||!this.immutable(descriptor.value))return false;
    }
    this.immutableValues.add(value);return true;
  }
  private stableId(value:any):string|undefined {
    if(!value||typeof value!=='object'||Array.isArray(value))return;
    const descriptor=Object.getOwnPropertyDescriptor(value,'id');
    if(descriptor&&'value' in descriptor&&!descriptor.writable&&!descriptor.configurable&&descriptor.enumerable&&typeof descriptor.value==='string'&&descriptor.value)return 'id:'+descriptor.value;
  }
  private proof(rows:any[],keys:readonly string[]):ValidatedCollection|undefined {
    if(types.isProxy(rows)||!Object.isFrozen(rows)||Object.getPrototypeOf(rows)!==Array.prototype)return;
    for(let i=0;i<rows.length;i++){
      const descriptor=Object.getOwnPropertyDescriptor(rows,String(i));
      if(!descriptor||!('value' in descriptor)||!this.immutable(descriptor.value)||this.stableId(descriptor.value)!==keys[i])return;
    }
    return {rows,keys};
  }
  private sameOrder(rows:any[],before:ValidatedCollection):{proof:ValidatedCollection;updates:number[]}|undefined {
    if(types.isProxy(rows)||rows.length!==before.rows.length||!Object.isFrozen(rows)||Object.getPrototypeOf(rows)!==Array.prototype)return;
    const updates:number[]=[];
    for(let i=0;i<rows.length;i++){
      const descriptor=Object.getOwnPropertyDescriptor(rows,String(i));
      if(!descriptor||!('value' in descriptor))return;
      if(descriptor.value===before.rows[i])continue;
      if(!this.immutable(descriptor.value)||this.stableId(descriptor.value)!==before.keys[i])return;
      updates.push(i);
    }
    return {proof:{rows,keys:before.keys},updates};
  }
  constructor(file:string,create=false,readOnly=false){
    this.file=file;
    if(create){const fd=fs.openSync(file,'wx',0o600);fs.closeSync(fd);}else if(!fs.existsSync(file))throw Error('SQLite database missing; JSON fallback is forbidden.');
    const stat=fs.statSync(file,{bigint:true});this.identity=`${stat.dev}:${stat.ino}`;
    this.connection=new DatabaseSync(file,{readOnly});
    if(!readOnly)this.connection.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=3000;');
    if(create)this.connection.exec(`BEGIN IMMEDIATE;
      CREATE TABLE store_version(id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL CHECK(revision>=0));
      INSERT INTO store_version VALUES(1,0);
      CREATE TABLE collections(name TEXT PRIMARY KEY, ordinal INTEGER NOT NULL, is_array INTEGER NOT NULL CHECK(is_array IN(0,1)), payload TEXT NOT NULL CHECK(json_valid(payload))) STRICT;
      CREATE TABLE records(collection TEXT NOT NULL REFERENCES collections(name) ON DELETE CASCADE, row_key TEXT NOT NULL, payload TEXT NOT NULL CHECK(json_valid(payload)), PRIMARY KEY(collection,row_key)) STRICT;
      PRAGMA user_version=1; COMMIT;`);
    if(Number((this.connection.prepare('PRAGMA user_version').get() as any).user_version)!==1)throw Error('Unsupported SQLite schema.');
    if(!create&&Number((this.connection.prepare('SELECT revision FROM store_version WHERE id=1').get() as any)?.revision)<1){this.close();throw Error('SQLite migration incomplete; activation forbidden.');}
  }
  signature():string {
    const stat=fs.statSync(this.file,{bigint:true});if(`${stat.dev}:${stat.ino}`!==this.identity)throw Error('SQLite file replaced while open; restart under maintenance is required.');
    const revision=Number((this.connection.prepare('SELECT revision FROM store_version WHERE id=1').get() as any)?.revision);
    if(!Number.isSafeInteger(revision)||revision<0)throw Error('Invalid store revision.');
    const version=(this.connection.prepare('PRAGMA data_version').get() as any).data_version;
    return `${this.identity}:${revision}:${version}`;
  }
  read():T {
    this.signature();this.connection.exec('BEGIN');
    try{const result:any={};
      for(const col of this.connection.prepare('SELECT * FROM collections ORDER BY ordinal').all() as any[]){let value=JSON.parse(col.payload);
        if(col.is_array){const rows=new Map((this.connection.prepare('SELECT row_key,payload FROM records WHERE collection=?').all(col.name) as any[]).map(row=>[row.row_key,row.payload]));
          if(!Array.isArray(value)||value.length!==rows.size||new Set(value).size!==value.length)throw Error('Record order/integrity mismatch.');
          value=value.map((key:string,index:number)=>{if(!rows.has(key))throw Error('Missing stored record.');const row=JSON.parse(rows.get(key)!);if(keyFor(row,index)!==key)throw Error('Stored record identity mismatch.');return row;});}
        Object.defineProperty(result,col.name,{value,writable:true,enumerable:true,configurable:true});
      }
      this.connection.exec('COMMIT');return result as T;
    }catch(e){this.connection.exec('ROLLBACK');throw e;}
  }
  commit(value:T,baseline:T|undefined,expected:string):string {
    this.connection.exec('BEGIN IMMEDIATE');
    try{
      if(this.signature()!==expected)throw Error('Stale SQLite transaction.');
      const before:any=baseline||{},next:any=value;
      const validated=this.validatedStamp===expected?this.validatedCollections:undefined,pending=new Map<string,ValidatedCollection>();
      const putCol=this.connection.prepare('INSERT INTO collections(name,ordinal,is_array,payload) VALUES(?,?,?,?) ON CONFLICT(name) DO UPDATE SET ordinal=excluded.ordinal,is_array=excluded.is_array,payload=excluded.payload');
      const put=this.connection.prepare('INSERT INTO records(collection,row_key,payload) VALUES(?,?,?) ON CONFLICT(collection,row_key) DO UPDATE SET payload=excluded.payload');
      const remove=this.connection.prepare('DELETE FROM records WHERE collection=? AND row_key=?');
      const names=Object.keys(next).filter(name=>next[name]!==undefined);
      const oldNames=Object.keys(before).filter(name=>before[name]!==undefined),oldOrdinals=new Map(oldNames.map((name,index)=>[name,index]));
      for(const name of Object.keys(before))if(!names.includes(name))this.connection.prepare('DELETE FROM collections WHERE name=?').run(name);
      for(const [ordinal,name]of names.entries()){
        const rows=next[name],old=before[name];
        const sameOrdinal=oldOrdinals.get(name)===ordinal;
        // Only immutable identity can prove an untouched collection. Do not turn
        // a small record edit into a rewrite of every historical order payload.
        if(rows===old&&(rows===null||typeof rows!=='object'||Object.isFrozen(rows))){
          if(!sameOrdinal)this.connection.prepare('UPDATE collections SET ordinal=? WHERE name=?').run(ordinal,name);
          const proof=validated?.get(name);if(proof&&proof.rows===rows)pending.set(name,proof);
          continue;
        }
        if(Array.isArray(rows)){
          const proof=validated?.get(name),unchangedOrder=proof&&proof.rows===old?this.sameOrder(rows,proof):undefined;
          if(unchangedOrder){
            if(!sameOrdinal)this.connection.prepare('UPDATE collections SET ordinal=? WHERE name=?').run(ordinal,name);
            for(const i of unchangedOrder.updates)put.run(name,unchangedOrder.proof.keys[i],JSON.stringify(rows[i]));
            pending.set(name,unchangedOrder.proof);continue;
          }
          const keys=rows.map(keyFor);if(new Set(keys).size!==keys.length)throw Error('Duplicate record identity; no data merged.');
          const sameOrder=Array.isArray(old)&&old.length===rows.length&&old.every((row:any,index:number)=>row===rows[index]||keyFor(row,index)===keys[index]);
          // Order is stored once per collection, not by rewriting every shifted row.
          if(!sameOrder)putCol.run(name,ordinal,1,JSON.stringify(keys));
          else if(!sameOrdinal)this.connection.prepare('UPDATE collections SET ordinal=? WHERE name=?').run(ordinal,name);
          if(sameOrder){
            for(let i=0;i<rows.length;i++)if(old[i]!==rows[i])put.run(name,keys[i],JSON.stringify(rows[i]));
          }else{
            const oldRows=new Map<string,any>((Array.isArray(old)?old:[]).map((row:any,i:number)=>[keyFor(row,i),row]));
            for(const [i,row]of rows.entries()){const key=keys[i];if(oldRows.get(key)!==row)put.run(name,key,JSON.stringify(row));oldRows.delete(key);}
            for(const key of oldRows.keys())remove.run(name,key);
          }
          const checked=this.proof(rows,keys);if(checked)pending.set(name,checked);
        }else{
          if(Array.isArray(old))this.connection.prepare('DELETE FROM records WHERE collection=?').run(name);
          putCol.run(name,ordinal,0,JSON.stringify(rows));
        }
      }
      this.connection.exec('UPDATE store_version SET revision=revision+1 WHERE id=1');
      const committedStamp=this.signature(); // Captured while BEGIN IMMEDIATE still excludes other writers.
      this.connection.exec('COMMIT');
      if(this.signature()!==committedStamp)throw Error('Store changed after commit; snapshot publication forbidden.');
      // Only this store's verified successful revision owns these proofs. Failed
      // writes, caller-supplied frozen baselines and external WAL revisions cannot.
      this.validatedCollections=pending;this.validatedStamp=committedStamp;
      return committedStamp;
    }catch(e){try{this.connection.exec('ROLLBACK');}catch{}throw e;}
  }
  close():void{this.connection.close();}
  backup(destination:string):void {
    if(fs.existsSync(destination))return;
    const temporary=destination+'.'+process.pid+'.pending';
    this.connection.prepare('VACUUM INTO ?').run(temporary);
    const check=new SqliteRecords<T>(temporary,false,true);
    try{check.read();}finally{check.close();}
    fs.chmodSync(temporary,0o600);fs.renameSync(temporary,destination);
  }
}
