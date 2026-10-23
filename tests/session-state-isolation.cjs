const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base='http://127.0.0.1:4322',output=process.env.TREASURY_UI_OUTPUT;
if(!output||!process.env.TREASURY_TEST_DIR?.includes('/work/'))throw Error('isolated synthetic fixture required');
async function api(route,token,body){body=require('./request-fixture.cjs').requestFixture(route,body);const r=await fetch(base+'/api'+route,{method:body?'POST':'GET',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});assert.equal(r.status,200,'synthetic setup '+route);return r.json();}
async function login(page,code){await page.locator('#login-personnel-code').fill(code);await page.locator('#login-password').fill('Synthetic-Only!2026');const logged=page.waitForResponse(r=>r.url().endsWith('/api/auth/login')&&r.request().method()==='POST');await page.getByRole('button',{name:'ورود به پرتال سازمانی',exact:true}).click();assert.equal((await logged).status(),200);}
(async()=>{fs.mkdirSync(output,{recursive:true});const browser=await chromium.launch({channel:'msedge',headless:true});let held=[];
try{
 const admin=(await api('/auth/login',null,{personnelCode:'admin',password:'Synthetic-Only!2026'})).token;
 await api('/master-data/companies/save',admin,{name:'TEST PRIVATE'});
 const state=await api('/state',admin),role=state.roleConfigs.find(r=>r.role==='REQUESTER');
 const accountingRole=state.roleConfigs.find(r=>r.role==='ACCOUNTING');
 await api('/roles/save',admin,{...accountingRole,allowedCompanies:['TEST']});
 await api('/roles/save',admin,{...role,allowedCompanies:['TEST','TEST PRIVATE']});
 const other=state.users.find(u=>u.id==='other');await api('/users/save',admin,{...other,company:'TEST PRIVATE',supervisorId:null});
 const owner=(await api('/auth/login',null,{personnelCode:'other',password:'Synthetic-Only!2026'})).token;
 await api('/advance-requests',owner,{amount:700,reason:'TEST PRIVATE NEVER EXPOSE'});
 const ctx=await browser.newContext({viewport:{width:1440,height:1000}}),page=await ctx.newPage();await page.goto(base);await login(page,'admin');
 await page.getByRole('button',{name:/^کارتابل بررسی مالی حسابداری/}).waitFor();
 await page.getByRole('button',{name:'خروج',exact:true}).click();await page.locator('#login-personnel-code').waitFor();
 // Real login and real server remain untouched. Delay only the new user's GET
 // initialization, so any old state rendered during the gap is observable.
 let block=true;
 await page.route('**/api/state*',route=>block?new Promise(resolve=>held.push(async()=>{await route.continue();resolve();})):route.continue());
 await login(page,'accounting');await page.waitForTimeout(700);
 const isolation=await page.evaluate(()=>({loading:document.body.innerText.includes('در حال راه‌اندازی پرتال مالی'),privateText:document.body.innerText.includes('TEST PRIVATE NEVER EXPOSE'),portalVisible:document.body.innerText.includes('کارتابل بررسی مالی حسابداری')}));
 fs.writeFileSync(path.join(output,'isolation.json'),JSON.stringify({...isolation,held:held.length,body:await page.locator('body').innerText()},null,2));
 assert.equal(isolation.loading,true,'new session must wait for its own state, never render the previous privileged state');assert.equal(isolation.privateText,false);
 block=false;const pendingPages=held;held=[];await Promise.all(pendingPages.map(f=>f()));await page.unroute('**/api/state*');
 const menu=page.getByRole('button',{name:/^کارتابل بررسی مالی حسابداری/});await menu.waitFor();const pending=menu.locator('..').getByRole('button',{name:/در انتظار تأیید من/});if(!await pending.isVisible())await menu.click();await pending.click();
 assert.equal(await page.getByText('TEST PRIVATE NEVER EXPOSE',{exact:true}).count(),0);
 fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({status:'PASS',realLogin:true,oldStateHiddenDuringNewSession:true,otherCompanyNotVisible:true}));console.log('PASS session state isolation');
}finally{await Promise.allSettled(held.map(f=>f()));await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
