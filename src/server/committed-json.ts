import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createDraft,current,isDraft,original,enableArrayMethods,type Draft} from 'immer';
import type {StateBacking} from './sqlite-records';

// Predicates in this adapter's callers only read fields. find/filter still return
// tracked drafts; avoid proxying every historical row just to search for its ID.
enableArrayMethods();

function freeze<T>(value:T):T {
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){
    for(const child of Object.values(value))freeze(child);
    Object.freeze(value);
  }
  return value;
}

function metadata(s:fs.BigIntStats):string{return `${s.dev}:${s.ino}:${s.size}:${s.mtimeNs}:${s.ctimeNs}`;}

/** One process owns the file. Readers never own a mutable committed object. */
export class CommittedJson<T extends object> {
  private committed:T|undefined;
  private stamp:string|undefined;
  private normalized=false;
  private drafts=new WeakMap<object,string|undefined>();
  private readonly file:string;
  private readonly backing:StateBacking<T>|undefined;
  constructor(file:string,backing?:StateBacking<T>){this.file=file;this.backing=backing;}
  private jsonContents():{stamp:string;bytes:Buffer;stats:fs.BigIntStats}|undefined {
    try{
      const before=fs.statSync(this.file,{bigint:true}),bytes=fs.readFileSync(this.file),after=fs.statSync(this.file,{bigint:true});
      if(metadata(before)!==metadata(after))throw Error('Database changed while reading.');
      // Windows may keep every metadata field unchanged on a rapid same-size
      // in-place write. Cache/CAS identity must also include the actual bytes.
      return {stamp:`${metadata(after)}:${createHash('sha256').update(bytes).digest('hex')}`,bytes,stats:after};
    }catch(e:any){if(e.code==='ENOENT')return undefined;throw e;}
  }
  private diskStamp():string|undefined {
    if(this.backing)return this.backing.signature();
    return this.jsonContents()?.stamp;
  }
  private refresh():void {
    const json=this.backing?undefined:this.jsonContents(),stamp=this.backing?this.backing.signature():json?.stamp;
    if(!stamp)throw Error('Committed database is missing; automatic reset is forbidden.');
    if(this.committed&&stamp===this.stamp)return;
    // Decode the same bytes that established the signature, never a second
    // unrelated read paired with the first read's identity.
    const value=this.backing?this.backing.read():JSON.parse(json!.bytes.toString('utf8')) as T;
    if(this.diskStamp()!==stamp)throw Error('Database changed while reading.');
    this.committed=freeze(value);this.stamp=stamp;this.normalized=false;
  }
  draft():{value:T;normalized:boolean}{
    this.refresh();const value=createDraft(this.committed!) as T;this.drafts.set(value,this.stamp);
    return {value,normalized:this.normalized};
  }
  view():T {this.refresh();if(!this.normalized)throw Error('Database normalization is required.');return this.committed!;}
  isNormalized():boolean {this.refresh();return this.normalized;}
  assertCurrent(value:T):void {
    const stamp=this.diskStamp();
    if(!this.drafts.has(value)){if(stamp)throw Error('Unowned database draft.');return;}
    if(this.drafts.get(value)!==stamp)throw Error('Stale database draft; no changes committed.');
  }
  /** Called only after the durable atomic rename, never before a failed commit. */
  snapshot<V extends object>(value:V):V{return isDraft(value)?current(value as Draft<V>) as V:value;}
  base(value:T):T|undefined{return isDraft(value)?original(value as Draft<T>) as T:undefined;}
  backup(destination:string):void{if(!this.backing)throw Error('No transactional backing');this.backing.backup(destination);}
  commitBacking(value:T,draft:T):void {
    if(!this.backing)throw Error('No transactional backing configured.');
    this.assertCurrent(draft);
    if(isDraft(value))throw Error('Detached committed snapshot required.');
    // Freeze the detached candidate, not the live draft. This is not publication:
    // a failed commit still leaves the previous committed snapshot authoritative.
    freeze(value);
    const stamp=this.backing.commit(value,this.base(draft),this.drafts.get(draft)!);
    if(this.backing.signature()!==stamp){this.committed=undefined;this.stamp=undefined;throw Error('Store changed after commit.');}
    this.committed=freeze(value);this.stamp=stamp;this.normalized=true;
  }
  publish(value:T,written:fs.BigIntStats,encoded=JSON.stringify(this.snapshot(value))):void {
    // encoded is the exact candidate serialized once before write/fsync/rename.
    // A new disk signature alone must not be attached to an older candidate.
    const disk=this.jsonContents(),current=disk?.stats;
    if(!current||['dev','ino','size','mtimeNs'].some(key=>current[key as keyof fs.BigIntStats]!==written[key as keyof fs.BigIntStats])||!disk!.bytes.equals(Buffer.from(encoded,'utf8'))){
      this.committed=undefined;this.stamp=undefined;this.normalized=false;
      throw Error('Committed file was replaced externally; snapshot invalidated.');
    }
    // Ownership transfers from a detached current(draft) snapshot; unchanged branches
    // are already frozen. The live draft remains private, never the committed value.
    this.committed=freeze(this.snapshot(value));
    this.stamp=disk!.stamp;this.normalized=true;
  }
  markNormalized(value:T,persisted:boolean):void {
    if(!persisted){this.assertCurrent(value);this.committed=freeze(this.snapshot(value));}
    this.normalized=true;this.drafts.set(value,this.stamp);
  }
}
