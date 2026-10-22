import {randomBytes} from 'node:crypto';
import type {StateDelta,StateSnapshot,StateVersion} from '../utils/state-sync';
import {immutableScalars} from './financial-selection';

type View=Record<string,any>;
type Entry={cursor:string;binding:string;authority:string;view:View;version:StateVersion;at:number;rows:number;paging:boolean;served:Set<string>;keyed:Set<string>};
type PreparedPage={entry:Entry;key:string;start:number;total:number;rows:any[]};
const equal=(a:any,b:any)=>a===b||JSON.stringify(a)===JSON.stringify(b);
const expired=()=>Object.assign(new Error('اطلاعات بارگذاری تغییر کرده است؛ دوباره دریافت کنید.'),{status:409,syncExpired:true});

/** Cursor data is only a diff baseline. Authorization is supplied fresh by the caller. */
export class StateSync {
  private entries=new Map<string,Entry>();
  private source:object|undefined;
  private sequence=0;
  private readonly epoch=randomBytes(12).toString('hex');
  private indices=new WeakMap<any[],Map<string,any>|null>();
  private encodedBundles=new WeakMap<object,string>();
  private stableRows=new WeakSet<object>();
  private stableCollections=new WeakSet<any[]>();
  private uniqueStableCollections=new WeakSet<any[]>();
  private readonly limits:{entries:number;rows:number;ttlMs:number};
  private readonly clock:()=>number;
  constructor(limits={entries:384,rows:8_000_000,ttlMs:300_000},clock=()=>Date.now()){this.limits=limits;this.clock=clock;}
  private stableRow(row:any):boolean {
    if(this.stableRows.has(row))return true;if(!immutableScalars(row,['id'],['id']))return false;this.stableRows.add(row);return true;
  }
  private stableCollection(rows:any[]):boolean {
    if(!Object.isFrozen(rows)||Object.getPrototypeOf(rows)!==Array.prototype)return false;if(this.stableCollections.has(rows))return true;
    for(let i=0;i<rows.length;i++){const cell=Object.getOwnPropertyDescriptor(rows,i);if(!cell||!('value'in cell)||!this.stableRow(cell.value))return false;}this.stableCollections.add(rows);return true;
  }
  private stableUpdate(old:any[],rows:any[]):StateDelta['collections'][string]|undefined {
    if(old.length>rows.length||!this.uniqueStableCollections.has(old)||!Object.isFrozen(rows)||Object.getPrototypeOf(rows)!==Array.prototype)return;
    const prepend=this.stablePrepend(old,rows);if(prepend)return prepend;
    // Another authorized response may already have proved this EXACT immutable
    // array. That proves IDs/own indices/uniqueness, NOT prefix order or access.
    if(this.uniqueStableCollections.has(rows)){
      const changed=[];for(let i=0;i<old.length;i++)if(old[i]!==rows[i]){if(old[i].id!==rows[i].id)return;if(!equal(old[i],rows[i]))changed.push(rows[i]);}
      const tail=rows.slice(old.length);return {upsert:[...changed,...tail],remove:[],splice:{start:old.length,deleteCount:0,ids:tail.map(row=>row.id)}};
    }
    const added=new Set<string>(),ids:string[]=[],changed=[];
    for(let i=old.length;i<rows.length;i++){const cell=Object.getOwnPropertyDescriptor(rows,i);if(!cell||!('value'in cell)||!this.stableRow(cell.value))return;const id=cell.value.id;if(added.has(id))return;added.add(id);ids.push(id);}
    for(let i=0;i<old.length;i++){const cell=Object.getOwnPropertyDescriptor(rows,i);if(!cell||!('value'in cell))return;const id=old[i].id;if(added.has(id)||cell.value!==old[i]&&(!this.stableRow(cell.value)||cell.value.id!==id))return;if(!equal(old[i],cell.value))changed.push(cell.value);}
    for(let i=old.length;i<rows.length;i++)changed.push(rows[i]);
    // The previous keyed collection proved uniqueness; exact, immutable IDs in
    // the retained order plus a disjoint, unique tail inherit that proof without
    // allocating full Maps. Deleted/reordered/accessor/mutable inputs fall back.
    this.stableCollections.add(rows);this.uniqueStableCollections.add(rows);return {upsert:changed,remove:[],splice:{start:old.length,deleteCount:0,ids}};
  }
  private stablePrepend(old:any[],rows:any[]):StateDelta['collections'][string]|undefined {
    const offset=rows.length-old.length;if(offset<=0||!old.length)return;
    // The caller already proved the old immutable keyed baseline. A proof of
    // the new array only removes shape/uniqueness work, never suffix order checks.
    if(this.uniqueStableCollections.has(rows)){
      const changed=[];for(let i=0;i<old.length;i++){const row=rows[i+offset];if(old[i]!==row){if(old[i].id!==row.id)return;if(!equal(old[i],row))changed.push(row);}}
      const prefix=rows.slice(0,offset);return {upsert:[...prefix,...changed],remove:[],splice:{start:0,deleteCount:0,ids:prefix.map(row=>row.id)}};
    }
    const added=new Set<string>(),ids:string[]=[],prefix=[],changed=[];
    for(let i=0;i<offset;i++){const cell=Object.getOwnPropertyDescriptor(rows,i);if(!cell||!('value'in cell)||!this.stableRow(cell.value))return;const id=cell.value.id;if(added.has(id))return;added.add(id);ids.push(id);prefix.push(cell.value);}
    for(let i=0;i<old.length;i++){const cell=Object.getOwnPropertyDescriptor(rows,i+offset);if(!cell||!('value'in cell))return;const id=old[i].id;if(added.has(id)||cell.value!==old[i]&&(!this.stableRow(cell.value)||cell.value.id!==id))return;if(!equal(old[i],cell.value))changed.push(cell.value);}
    this.stableCollections.add(rows);this.uniqueStableCollections.add(rows);return {upsert:[...prefix,...changed],remove:[],splice:{start:0,deleteCount:0,ids}};
  }
  private index(rows:any[]):Map<string,any>|null {
    if(Object.isFrozen(rows)&&this.indices.has(rows))return this.indices.get(rows)!;
    let result:Map<string,any>|null=new Map();
    for(const row of rows){if(!row||typeof row!=='object'||typeof row.id!=='string'||result.has(row.id)){result=null;break;}result.set(row.id,row);}
    // A mutable collection cannot acquire this proof later merely by freezing:
    // its caller may have changed IDs since the old uniqueness scan.
    if(result&&this.stableCollection(rows))this.uniqueStableCollections.add(rows);
    if(Object.isFrozen(rows))this.indices.set(rows,result);return result;
  }

  private find(cursor:unknown,binding:string,authority:string):Entry|undefined {
    if(typeof cursor!=='string'||cursor.length>100)return;
    const e=this.entries.get(cursor);
    if(!e||e.binding!==binding||e.authority!==authority||this.clock()-e.at>this.limits.ttlMs)return;
    return e;
  }
  private capture(view:View,binding:string,authority:string,source:object,knownKeyed?:Set<string>):Entry {
    if(source!==this.source){this.source=source;this.sequence++;}
    const entry:Entry={cursor:randomBytes(24).toString('hex'),binding,authority,view,version:{epoch:this.epoch,sequence:this.sequence},at:this.clock(),rows:Object.values(view).reduce((n,v)=>n+(Array.isArray(v)?v.length:0),0),paging:false,served:new Set(),keyed:new Set(Object.keys(view).filter(key=>Array.isArray(view[key])&&(knownKeyed?.has(key)||this.index(view[key]))))};
    if(entry.rows>this.limits.rows)throw Object.assign(Error('حجم نمای درخواستی از سقف همگام‌سازی بیشتر است.'),{status:413});
    // Per-session retained states cover concurrent responses, not unbounded history.
    const own=[...this.entries.values()].filter(e=>e.binding===binding);
    for(const old of own.slice(0,Math.max(0,own.length-2)))this.entries.delete(old.cursor);
    for(const old of this.entries.values())if(this.clock()-old.at>this.limits.ttlMs)this.entries.delete(old.cursor);
    this.entries.set(entry.cursor,entry);
    let rows=[...this.entries.values()].reduce((n,e)=>n+e.rows,0);
    while(this.entries.size>1&&(this.entries.size>this.limits.entries||rows>this.limits.rows)){
      const old=this.entries.values().next().value!;rows-=old.rows;this.entries.delete(old.cursor);
    }
    return entry;
  }
  private snapshot(e:Entry):StateSnapshot {
    e.paging=true;
    return {cursor:e.cursor,version:e.version,fields:Object.fromEntries(Object.entries(e.view).filter(([,v])=>!Array.isArray(v))),collections:Object.entries(e.view).filter(([,v])=>Array.isArray(v)).map(([key,rows])=>({key,total:rows.length})),pageSize:250,bundleSize:4};
  }
  reply(body:View,view:View,binding:string,authority:string,source:object,cursor:unknown):View {
    const previous=this.find(cursor,binding,authority),stableChanges=new Map<string,StateDelta['collections'][string]>();
    if(previous)for(const [key,rows]of Object.entries(view))if(Array.isArray(rows)&&Array.isArray(previous.view[key])&&previous.keyed.has(key)&&rows!==previous.view[key]){const changed=this.stableUpdate(previous.view[key],rows);if(changed)stableChanges.set(key,changed);}
    const next=this.capture(view,binding,authority,source,new Set(stableChanges.keys()));
    const envelope:View=body===view?{stateRoot:true}:{...body};delete envelope.state;
    if(!previous)return {...envelope,stateSnapshot:this.snapshot(next)};
    const delta:StateDelta={base:previous.cursor,cursor:next.cursor,version:next.version,set:{},remove:[],collections:{}};
    for(const key of Object.keys(previous.view))if(!(key in view))delta.remove.push(key);
    for(const [key,value] of Object.entries(view)){
      const old=previous.view[key];
      if(value===old)continue;
      if(value===undefined){if(old!==undefined)delta.remove.push(key);}
      else if(stableChanges.has(key)){
        const changed=stableChanges.get(key)!;if(changed.upsert.length)delta.collections[key]=changed;
      }else if(Array.isArray(old)&&Array.isArray(value)&&previous.keyed.has(key)&&next.keyed.has(key)){
        const oldMap=this.index(old)!,newMap=this.index(value)!;
        const upsert=value.filter(r=>!equal(oldMap.get(r.id),r)),remove=old.filter(r=>!newMap.has(r.id)).map(r=>r.id);
        let start=0;while(start<old.length&&start<value.length&&old[start].id===value[start].id)start++;
        let suffix=0;while(suffix<old.length-start&&suffix<value.length-start&&old[old.length-1-suffix].id===value[value.length-1-suffix].id)suffix++;
        if(upsert.length||remove.length||start!==old.length||start!==value.length)delta.collections[key]={upsert,remove,splice:{start,deleteCount:old.length-start-suffix,ids:value.slice(start,value.length-suffix).map(r=>r.id)}};
      }else if(!equal(old,value))Object.defineProperty(delta.set,key,{value,enumerable:true});
    }
    return {...envelope,stateDelta:delta};
  }
  private preparePage(cursor:unknown,binding:string,authority:string,current:View,key:unknown,offset:unknown,limit:unknown):PreparedPage {
    const entry=this.find(cursor,binding,authority);
    if(!entry||!entry.paging||typeof key!=='string'||!Object.hasOwn(entry.view,key)||!Array.isArray(entry.view[key]))throw expired();
    const start=Number(offset),size=Number(limit);
    if(!/^\d+$/.test(String(offset))||!/^\d+$/.test(String(limit))||!Number.isSafeInteger(start)||start%250!==0||size!==250||start>=entry.view[key].length||entry.served.has(key+':'+start))throw expired();
    const stored=entry.view[key] as any[],now=current[key];
    if(!Array.isArray(now))throw expired();
    let rows=stored.slice(start,start+size);
    // Read CURRENT authorized values. Retain exactly what was handed to this
    // one-shot page as the diff baseline; never mutate a committed source tree.
    // finish reconciles writes between pages before any view is published.
    const allowed=this.index(now);
    if(entry.keyed.has(key)&&allowed){
      if(rows.some(r=>!allowed.has(r.id)))throw expired();rows=rows.map(r=>allowed.get(r.id));
    }else{if(stored.length!==now.length)throw expired();rows=now.slice(start,start+size);}
    return {entry,key,start,total:stored.length,rows};
  }
  private consume(page:PreparedPage){
    const {entry,key,start,rows}=page,stored=entry.view[key];
    if(rows.some((row,index)=>row!==stored[start+index])){const updated=stored.slice();for(let i=0;i<rows.length;i++)updated[start+i]=rows[i];entry.view={...entry.view,[key]:updated};}
    entry.served.add(key+':'+start);entry.at=this.clock();
  }
  private wirePage(page:PreparedPage){return {cursor:page.entry.cursor,key:page.key,offset:page.start,total:page.total,rows:page.rows};}
  page(cursor:unknown,binding:string,authority:string,current:View,key:unknown,offset:unknown,limit:unknown):View {
    const page=this.preparePage(cursor,binding,authority,current,key,offset,limit);this.consume(page);return {statePage:this.wirePage(page)};
  }
  bundle(cursor:unknown,binding:string,authority:string,current:View,jobs:unknown):View {
    if(!Array.isArray(jobs)||!jobs.length||jobs.length>4||jobs.some(j=>!j||typeof j.key!=='string')||new Set(jobs.map(j=>j.key+':'+j.offset)).size!==jobs.length)throw expired();
    const pages=jobs.map(j=>this.preparePage(cursor,binding,authority,current,j.key,j.offset,250)),reply={statePages:pages.map(p=>this.wirePage(p))};
    // No page is consumed on validation/size failure. Single canonical pages
    // remain available for large existing documents; nothing is truncated.
    const encoded=JSON.stringify(reply);
    if(Buffer.byteLength(encoded,'utf8')>8*1024*1024)throw Object.assign(Error('صفحات حجیم باید جدا دریافت شوند.'),{status:413,bundleTooLarge:true});
    for(const page of pages)this.consume(page);this.encodedBundles.set(reply,encoded);return reply;
  }
  encodedBundle(reply:object):string{const encoded=this.encodedBundles.get(reply);if(encoded===undefined)throw Error('Only a validated bundle can be sent.');return encoded;}
  finish(cursor:unknown,binding:string,authority:string,current:View,source:object):View {
    const entry=this.find(cursor,binding,authority);if(!entry||!entry.paging||entry.served.size!==Object.values(entry.view).reduce((n,v)=>n+(Array.isArray(v)?Math.ceil(v.length/250):0),0))throw expired();
    // Also validate collections already delivered on earlier pages. No partial
    // old snapshot becomes visible after reassignment or authority revocation.
    for(const [key,rows] of Object.entries(entry.view))if(entry.keyed.has(key)){
      const now=current[key];if(!Array.isArray(now))throw expired();const ids=this.index(now);if(!ids||rows.some((r:any)=>!ids.has(r.id)))throw expired();
    }
    entry.paging=false;return this.reply(current,current,binding,authority,source,cursor);
  }
}
