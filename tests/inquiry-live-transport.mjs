// Test preload only. Actual auth/API/SQLite execute; only the provider is synthetic.
import './outbound-guard.mjs';
import fs from 'node:fs';import path from 'node:path';
const root=process.env.TREASURY_TEST_DIR;
if(!root?.replaceAll('\\','/').startsWith('C:/Users/reza/Desktop/پروژه‌ها/انتشار موقت khazaneh/work/')||path.resolve(process.env.TREASURY_DATA_DIR||'')!==path.resolve(root)||path.resolve(process.env.TREASURY_INQUIRY_VAULT_DIR||'')!==path.join(path.resolve(root),'secrets'))throw Error('Explicit isolated Production-shaped inquiry fixture required');
const counts={credits:0,lookup:0},file=root+'/provider-calls.json',guarded=globalThis.fetch;
fs.writeFileSync(file,JSON.stringify(counts));
globalThis.fetch=async(input,init={})=>{
 const url=new URL(typeof input==='string'?input:String(input));if(url.origin!=='https://cardinfo.ir')return guarded(input,init);
 if(url.pathname!=='/inquiry/apiv1'||url.username||url.password||url.hash||init.redirect!=='error'||!/^Bearer SYNTHETIC[-A-Z0-9]*$/.test(new Headers(init.headers).get('authorization')||''))throw Error('Synthetic provider input rejected');
 const expected=root+'/provider-expected-key-label';if(fs.existsSync(expected)){const label=fs.readFileSync(expected,'utf8'),headersByLabel={BROWSER_B:'Bearer SYNTHETIC-BROWSER-KEY-B'};if(new Headers(init.headers).get('authorization')!==headersByLabel[label])throw Error('Wrong synthetic connection selected');}
 const credit=init.method==='GET'&&url.searchParams.get('action')==='listCredits';
 if(!credit&&!(init.method==='POST'&&url.searchParams.get('api')==='card_sheba'&&url.searchParams.get('card')==='0'.repeat(16)))throw Error('Synthetic provider target rejected');
 counts[credit?'credits':'lookup']++;fs.writeFileSync(file,JSON.stringify(counts));
 const marker=root+(credit?'/provider-hold-credit':'/provider-hold');
 if(fs.existsSync(marker)){const until=Date.now()+5000;while(fs.existsSync(marker)){if(Date.now()>until)throw Error('Synthetic held request deadline');await new Promise(r=>setTimeout(r,20));}}
 if(credit)return new Response(JSON.stringify([{package_name:'TEST PRIVATE CONNECTION',credit:100,order_time:'TEST',expire_time:'TEST'}]));
 const bban='017'+'0'.repeat(19),iban='IR'+String(98n-BigInt(bban+'182700')%97n).padStart(2,'0')+bban;
 return new Response(JSON.stringify({IBAN:iban,card:'0'.repeat(16),bankName:'TEST BANK',deposit:'00000',depositOwners:'TEST BANK OWNER',depositStatus:'03'}));
};
