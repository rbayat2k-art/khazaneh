// Test-only outbound replacement. Never bundled into the application.
import fs from 'node:fs';import path from 'node:path';
const root=process.env.TREASURY_DATA_DIR,allowed='C:/Users/reza/Desktop/پروژه‌ها/انتشار موقت khazaneh/work/';
if(!root||!path.resolve(root).replaceAll('\\','/').startsWith(allowed)||process.env.TREASURY_SMS_PROVIDER_FAKE!=='true')throw Error('explicit disposable SMS test environment required');
globalThis.fetch=async(input,init)=>{
  const url=new URL(String(input));if(url.href!=='https://api.iranpayamak.com/ws/v1/sms/simple')throw Error('test outbound request blocked');
  const mode=fs.readFileSync(path.join(root,'test-sms-mode'),'utf8');
  if(mode==='hang')return new Response(new ReadableStream({start(controller){init.signal.addEventListener('abort',()=>controller.error(Object.assign(Error('synthetic abort'),{name:'AbortError'})),{once:true});}}),{status:201,headers:{'content-type':'application/json'}});
  if(mode==='throw')throw Error('TEST-NOT-A-KEY '+String(init.body));
  if(mode==='error')return new Response(JSON.stringify({echo:String(init.body),key:'TEST-NOT-A-KEY'}),{status:500});
  if(mode==='id-echo')return new Response(JSON.stringify({status:'success',data:'TEST-NOT-A-KEY'}),{status:201,headers:{'content-type':'application/json'}});
  return new Response(JSON.stringify({status:'success',data:'TEST-message-id'}),{status:201,headers:{'content-type':'application/json'}});
};
