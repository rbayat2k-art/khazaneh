import type {Server} from 'node:http';

export class PendingWork {
 private readonly pending=new Set<Promise<unknown>>();
 run<T>(work:()=>T|Promise<T>):Promise<T>{
  const task=Promise.resolve().then(work);this.pending.add(task);
  void task.then(()=>this.pending.delete(task),()=>this.pending.delete(task));return task;
 }
 async drain():Promise<void>{while(this.pending.size)await Promise.allSettled([...this.pending]);}
}

/** Closing HTTP alone is not proof that a disconnected handler has finished. */
const stops=new WeakMap<Server,Promise<void>>();
export function stopServer(server:Server,mutations:{drain:()=>Promise<void>},background?:{drain:()=>Promise<void>}):Promise<void>{
 const previous=stops.get(server);if(previous)return previous;
 const drained=mutations.drain(),closed=new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
 const stopping=Promise.allSettled([closed,drained.then(()=>background?.drain())]).then(results=>{const failure=results.find(r=>r.status==='rejected');if(failure?.status==='rejected')throw failure.reason;});stops.set(server,stopping);return stopping;
}
