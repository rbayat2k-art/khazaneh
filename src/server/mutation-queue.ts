import type {Express,Request,Response,NextFunction} from 'express';

type Handler=(request:Request,response:Response)=>unknown|Promise<unknown>;

/** Retain the write turn until the handler finishes, even if its client leaves. */
export function createMutationRoutes(app:Pick<Express,'post'|'delete'>,authorize:(request:Request,response:Response)=>boolean){
  let tail=Promise.resolve();
  let accepting=true;
  const wrap=(handler:Handler)=>(request:Request,response:Response,next:NextFunction)=>{
    if(!accepting){response.status(503).json({error:'سامانه در حال توقف ایمن است؛ بعداً دوباره وارد شوید.'});return;}
    const arrived=performance.now();
    let disconnected=request.aborted||response.destroyed;
    const closed=()=>{disconnected=true;};response.once('close',closed);
    const operation=tail.then(async()=>{
      try{
        if(disconnected||request.aborted||response.destroyed)return;
        const started=performance.now(),json=response.json?.bind(response);
        if(json)response.json=(body:any)=>{
          if(!response.headersSent)response.setHeader('Server-Timing',`queue;dur=${(started-arrived).toFixed(2)}, execution;dur=${(performance.now()-started).toFixed(2)}`);
          return json(body);
        };
        // Sessions and permissions may change while this request waits.
        if(!authorize(request,response))return;
        await handler(request,response);
      }finally{
        response.off('close',closed);
        // A long Promise chain must not starve response compression, sockets or timers.
        await new Promise<void>(resolve=>setImmediate(resolve));
      }
    });
    tail=operation.catch(()=>{});
    void operation.catch(next);
  };
  return {
    drain:()=>{accepting=false;return tail;},
    post:(path:string,handler:Handler)=>app.post(path,wrap(handler)),
    delete:(path:string,handler:Handler)=>app.delete(path,wrap(handler)),
  };
}
