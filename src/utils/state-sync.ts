export type StateVersion={epoch:string;sequence:number};
export type StateSnapshot={cursor:string;version:StateVersion;fields:Record<string,any>;collections:Array<{key:string;total:number}>;pageSize:number;bundleSize?:number};
export type StateDelta={base:string;cursor:string;version:StateVersion;set:Record<string,any>;remove:string[];collections:Record<string,{upsert:any[];remove:string[];splice:{start:number;deleteCount:number;ids:string[]}}>};
type Entry={cursor:string;version:StateVersion;state:Record<string,any>};
const put=(object:object,key:string,value:any)=>Object.defineProperty(object,key,{value,enumerable:true,configurable:true,writable:true});

/** Operational state stays in memory and always originates from the server. */
export class StateSyncClient {
  private states=new Map<string,Entry>();
  private latest:Entry|undefined;
  private retired=new Set<string>();
  private confirmationCounter=0;
  private lastConfirmation=0;
  headers(){return {'X-Treasury-State-Mode':'delta-v1',...(this.latest?{'X-Treasury-State-Cursor':this.latest.cursor}:{})};}
  private publish(entry:Entry,confirmation=0):Entry {
    if(this.retired.has(entry.version.epoch))return this.latest!;
    if(this.latest&&entry.version.epoch!==this.latest.version.epoch){
      if(!confirmation)throw Error('تأیید نسخه جدید سرور لازم است.');
      if(confirmation<this.lastConfirmation){this.retired.add(entry.version.epoch);return this.latest;}
      this.retired.add(this.latest.version.epoch);this.states.clear();
    }
    this.lastConfirmation=Math.max(this.lastConfirmation,confirmation);
    this.states.set(entry.cursor,entry);while(this.states.size>16)this.states.delete(this.states.keys().next().value!);
    if(!this.latest||this.latest.version.epoch!==entry.version.epoch||entry.version.sequence>=this.latest.version.sequence)this.latest=entry;
    return this.latest;
  }
  private async materialize(data:any,query:(route:string)=>Promise<any>,retry=true,confirmation=0):Promise<Entry> {
    const delta=data.stateDelta as StateDelta|undefined,snapshot=data.stateSnapshot as StateSnapshot|undefined;
    if(delta){
      const base=this.states.get(delta.base);
      if(!base)return this.materialize(await query('/api/state?sync=begin'),query,false);
      const state={...base.state};for(const key of delta.remove)delete state[key];
      for(const [key,value] of Object.entries(delta.set))put(state,key,value);
      for(const [key,change] of Object.entries(delta.collections)){
        const old=base.state[key];
        if(!change.remove.length&&change.splice.start===old.length&&change.splice.deleteCount===0&&!change.splice.ids.length){
          // An ordinary amount/status update does not change order. Validate its
          // existing identifiers once, without allocating/rescanning full order,
          // membership and row maps on every response. No retained mutable index.
          const positions=new Map<string,number>();for(let i=0;i<old.length;i++)positions.set(old[i].id,i);
          if(positions.size!==old.length)throw Error('پاسخ تغییرات سرور کامل نیست؛ دریافت مجدد لازم است.');
          const updated=old.slice();for(const row of change.upsert){const index=positions.get(row.id);if(index===undefined)throw Error('پاسخ تغییرات سرور کامل نیست؛ دریافت مجدد لازم است.');updated[index]=row;}
          put(state,key,updated);continue;
        }
        const rows=new Map<string,any>(old.map((r:any)=>[r.id,r]));
        for(const id of change.remove)rows.delete(id);for(const row of change.upsert)rows.set(row.id,row);
        const ids=old.map((r:any)=>r.id),splice=change.splice,order=ids.slice(0,splice.start).concat(splice.ids,ids.slice(splice.start+splice.deleteCount));
        if(new Set(order).size!==order.length||order.some((id:string)=>!rows.has(id))||rows.size!==order.length)throw Error('پاسخ تغییرات سرور کامل نیست؛ دریافت مجدد لازم است.');
        put(state,key,order.map((id:string)=>rows.get(id)));
      }
      return this.publish({cursor:delta.cursor,version:delta.version,state},confirmation);
    }
    if(!snapshot)throw Error('پاسخ وضعیت سامانه کامل نیست.');
    const state={...snapshot.fields},jobs:Array<{key:string;offset:number;total:number}>=[];
    for(const collection of snapshot.collections){put(state,collection.key,new Array(collection.total));for(let offset=0;offset<collection.total;offset+=snapshot.pageSize)jobs.push({key:collection.key,offset,total:collection.total});}
    try{
      const consume=(job:typeof jobs[number],page:any)=>{
          if(!page||page.cursor!==snapshot.cursor||page.key!==job.key||page.offset!==job.offset||page.total!==job.total||page.rows.length!==Math.min(snapshot.pageSize,job.total-job.offset))throw Object.assign(Error('صفحه وضعیت منقضی یا ناقص است.'),{syncExpired:true});
          for(let i=0;i<page.rows.length;i++)state[job.key][job.offset+i]=page.rows[i];
      };
      const single=async(job:typeof jobs[number])=>consume(job,(await query('/api/state?sync='+encodeURIComponent(snapshot.cursor)+'&collection='+encodeURIComponent(job.key)+'&offset='+job.offset+'&limit='+snapshot.pageSize)).statePage);
      // One bounded bundle per actor in flight; no extra connections per user.
      const size=snapshot.bundleSize===4?4:1;
      for(let index=0;index<jobs.length;index+=size){const batch=jobs.slice(index,index+size);
        if(size===1){await single(batch[0]);continue;}
        let response:any;
        try{response=await query('/api/state?sync=bundle&cursor='+encodeURIComponent(snapshot.cursor)+'&pages='+encodeURIComponent(JSON.stringify(batch.map(({key,offset})=>({key,offset})))));}
        catch(error:any){if(!error?.bundleTooLarge)throw error;for(const job of batch)await single(job);continue;}
        if(!Array.isArray(response.statePages)||response.statePages.length!==batch.length)throw Object.assign(Error('صفحات وضعیت کامل نیست.'),{syncExpired:true});
        batch.forEach((job,index)=>consume(job,response.statePages[index]));
      }
      // Publish only after a current server check of the entire delivered view;
      // finish also reconciles writes made while its pages were being read.
      this.states.set(snapshot.cursor,{cursor:snapshot.cursor,version:snapshot.version,state});
      const confirmation=++this.confirmationCounter;
      const finished=await query('/api/state?sync=finish&cursor='+encodeURIComponent(snapshot.cursor));
      return this.materialize(finished,query,false,confirmation);
    }catch(error:any){
      this.states.delete(snapshot.cursor);
      if(retry&&error?.syncExpired)return this.materialize(await query('/api/state?sync=begin'),query,false);
      throw error;
    }
  }
  async accept(data:any,query:(route:string)=>Promise<any>):Promise<any> {
    if(!data?.stateDelta&&!data?.stateSnapshot)return data;
    const entry=await this.materialize(data,query);
    if(data.stateRoot)return entry.state;
    const result={...data,state:entry.state};delete result.stateSnapshot;delete result.stateDelta;return result;
  }
}

export function createStateFetch(nativeFetch:typeof fetch,currentToken:()=>string|null):typeof fetch {
  let token:string|null=null,client=new StateSyncClient();
  return (async(input:RequestInfo|URL,init?:RequestInit)=>{
    const active=currentToken();if(active!==token){token=active;client=new StateSyncClient();}
    const instance=client,headers=new Headers(init?.headers),authorization=headers.get('Authorization');
    const authenticated=!!active&&authorization==='Bearer '+active;
    if(authenticated)for(const [key,value] of Object.entries(instance.headers()))headers.set(key,value);
    const response=await nativeFetch(input,{...init,headers});
    const original=response.json.bind(response);let parsed:Promise<any>|undefined;
    response.json=()=>parsed??=(async()=>{
      const data=await original();
      if(!authenticated)return data;
      const check=()=>{if(currentToken()!==active)throw new DOMException('نشست تغییر کرده است.','AbortError');};check();
      const query=async(route:string)=>{
        check();const result=await nativeFetch(route,{headers:{Authorization:'Bearer '+active,...instance.headers()},cache:'no-store'}),body=await result.json();check();
        if(!result.ok)throw Object.assign(Error('دریافت وضعیت سامانه کامل نشد.'),{syncExpired:body.syncExpired===true,bundleTooLarge:body.bundleTooLarge===true,status:result.status});
        return body;
      };
      const result=await instance.accept(data,query);check();return result;
    })();
    return response;
  }) as typeof fetch;
}
