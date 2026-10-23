import crypto from 'node:crypto';
const requestType='shahrah.cardinfo.request.v1',replyType='shahrah.cardinfo.reply.v1',limit=16*1024;
const keyValid=v=>typeof v==='string'&&/^Bearer [\x21-\x7e]{1,4096}$/.test(v);
export function validateCardinfoMessage(m){
 if(!m||Object.keys(m).some(k=>!['type','id','operation','card','authorization'].includes(k))||m.type!==requestType||typeof m.id!=='string'||!/^[-a-f0-9]{36}$/.test(m.id)||!keyValid(m.authorization))return false;
 return m.operation==='credits'&&m.card===undefined||m.operation==='lookup'&&typeof m.card==='string'&&/^\d{16}$/.test(m.card);
}
/** The existing supervisor is the only egress owner. No general URL/options API. */
export function installCardinfoBroker(child,enabled,transport=globalThis.fetch){
 if(!enabled)return;const seen=new Set(),active=new Set();
 const reply=(id,result)=>{if(child.connected)try{child.send({type:replyType,id,...result},()=>{});}catch{}};
 child.on('message',async m=>{
  if(m?.type!==requestType)return;if(!validateCardinfoMessage(m)){if(typeof m.id==='string')reply(m.id,{failed:true});return;}
  if(seen.has(m.id)||active.size>=4||seen.size>=20000){reply(m.id,{failed:true});return;}seen.add(m.id);active.add(m.id);
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);let response;
  try{const url=new URL('https://cardinfo.ir/inquiry/apiv1');if(m.operation==='credits')url.searchParams.set('action','listCredits');else{url.searchParams.set('api','card_sheba');url.searchParams.set('card',m.card);}
   response=await transport(url.href,{method:m.operation==='credits'?'GET':'POST',headers:{Authorization:m.authorization,Accept:'application/json'},redirect:'error',signal:controller.signal});
   if(response.status>=300&&response.status<400||Number(response.headers.get('content-length')||0)>limit)throw Error('RESPONSE_REJECTED');
   const reader=response.body?.getReader();if(!reader)throw Error('RESPONSE_REJECTED');const chunks=[];let size=0;try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw Error('RESPONSE_REJECTED');}chunks.push(Buffer.from(value));}}finally{reader.releaseLock();}
   reply(m.id,{status:response.status,body:Buffer.concat(chunks).toString('base64')});
  }catch{reply(m.id,{failed:true});}finally{clearTimeout(timer);controller.abort();if(response?.body&&!response.bodyUsed&&!response.body.locked)void response.body.cancel().catch(()=>{});active.delete(m.id);}
 });
}
/** Backend keeps its complete network-denial guard; only this private pipe works. */
export function createCardinfoIpcTransport(channel=process){
 const pending=new Map();channel.on('message',m=>{if(m?.type!==replyType||!pending.has(m.id))return;const p=pending.get(m.id);pending.delete(m.id);p.cleanup();if(m.failed||!Number.isInteger(m.status)||m.status<100||m.status>599||typeof m.body!=='string'||m.body.length>22000){p.reject(Error('CARDINFO_TRANSPORT_UNKNOWN'));return;}try{p.resolve(new Response(Buffer.from(m.body,'base64'),{status:m.status,headers:{'content-type':'application/json'}}));}catch{p.reject(Error('CARDINFO_TRANSPORT_UNKNOWN'));}});
 channel.on('disconnect',()=>{for(const p of pending.values()){p.cleanup();p.reject(Error('CARDINFO_TRANSPORT_UNKNOWN'));}pending.clear();});
 return (input,init)=>new Promise((resolve,reject)=>{let url;try{url=new URL(input);}catch{return reject(Error('CARDINFO_TRANSPORT_DENIED'));}
  if(url.origin!=='https://cardinfo.ir'||url.pathname!=='/inquiry/apiv1'||url.hash||url.username||url.password||init.redirect!=='error'||init.body!==undefined||pending.size>=4||!channel.connected)return reject(Error('CARDINFO_TRANSPORT_DENIED'));
  const keys=[...url.searchParams.keys()];let operation;if(init.method==='GET'&&keys.length===1&&url.searchParams.get('action')==='listCredits')operation='credits';else if(init.method==='POST'&&keys.length===2&&url.searchParams.get('api')==='card_sheba'&&/^\d{16}$/.test(url.searchParams.get('card')||''))operation='lookup';else return reject(Error('CARDINFO_TRANSPORT_DENIED'));
  const headers=new Headers(init.headers);if([...headers.keys()].some(k=>!['authorization','accept'].includes(k)))return reject(Error('CARDINFO_TRANSPORT_DENIED'));
  const m={type:requestType,id:crypto.randomUUID(),operation,...(operation==='lookup'?{card:url.searchParams.get('card')}:{}),authorization:headers.get('authorization')};if(!validateCardinfoMessage(m))return reject(Error('CARDINFO_TRANSPORT_DENIED'));
  const abort=()=>{if(!pending.has(m.id))return;pending.delete(m.id);cleanup();reject(Error('CARDINFO_TRANSPORT_UNKNOWN'));},timer=setTimeout(abort,9000),cleanup=()=>{clearTimeout(timer);init.signal?.removeEventListener('abort',abort);};pending.set(m.id,{resolve,reject,cleanup});if(init.signal?.aborted){abort();return;}init.signal?.addEventListener('abort',abort,{once:true});try{channel.send(m,error=>{if(error)abort();});}catch{abort();}
 });
}
