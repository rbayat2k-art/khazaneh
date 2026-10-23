// Real Chromium + real built application API. No production URL or credential.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'C:/Users/reza/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const [root,out]=process.argv.slice(2),config=JSON.parse(fs.readFileSync(path.join(root,'staging.json'),'utf8'));
assert.equal(config.kind,'shahrah-private-staging');assert.equal(config.syntheticOnly,true);
const access=fs.readFileSync(path.join(root,'ACCESS.txt'),'utf8'),gate=/رمز دروازه خصوصی: (\S+)/.exec(access)[1],base=`http://127.0.0.1:${config.port}`;
const credentials=Object.fromEntries([...access.matchAll(/^(admin|requester|approver|accounting|treasury) : (\S+)$/gm)].map(m=>[m[1],m[2]]));
fs.mkdirSync(out,{recursive:false});
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});const results=[];let lastPage;try{
 for(const user of ['admin','requester','approver','accounting','treasury']){
  const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'}),page=await context.newPage();lastPage=page;page.setDefaultTimeout(12000);
  await context.route('**/*',route=>{const u=new URL(route.request().url());return u.origin===base||['data:','blob:'].includes(u.protocol)?route.continue():route.abort();});
  const errors=[];page.on('pageerror',()=>errors.push('pageerror'));
  await page.goto(base);await page.getByLabel('رمز دروازهٔ آزمایشی').fill(gate);await page.getByRole('button',{name:'ورود به محیط آزمایشی',exact:true}).click();
  await page.locator('#login-personnel-code').fill(user);await page.locator('#login-password').fill(credentials[user]);
  const loginResponse=page.waitForResponse(r=>r.url()===base+'/api/auth/login'&&r.request().method()==='POST');
  await page.getByRole('button',{name:'ورود به پرتال سازمانی',exact:true}).click();const response=await loginResponse;assert.equal(response.status(),200);
  const login=await response.json();assert.ok(login.token);await page.getByRole('button',{name:'خروج',exact:true}).waitFor();
  const stateResponse=await page.request.get(base+'/api/state',{headers:{authorization:'Bearer '+login.token}});assert.equal(stateResponse.status(),200);
  const state=await stateResponse.json();assert.ok(state.users.some(u=>u.personnelCode===user&&u.name.startsWith('TEST ')));
  if(user==='admin'){
    const saved=await page.request.post(base+'/api/master-data/companies/save',{headers:{authorization:'Bearer '+login.token},data:{name:'TEST STAGING PERSISTENCE'}});
    assert.equal(saved.status(),200);assert.ok((await saved.json()).state.companies.some(c=>c.name==='TEST STAGING PERSISTENCE'));
  }
  await page.reload({waitUntil:'networkidle'});await page.getByRole('button',{name:'خروج',exact:true}).waitFor();
  await page.getByRole('button',{name:'خروج',exact:true}).click();await page.locator('#login-personnel-code').waitFor();
  assert.equal((await page.request.get(base+'/api/state',{headers:{authorization:'Bearer '+login.token}})).status(),401);
  if(user==='admin'){
    await page.screenshot({path:path.join(out,'login-desktop.png'),fullPage:true});await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:path.join(out,'login-mobile.png'),fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
  }
  assert.equal(errors.length,0);results.push({user,realLogin:true,realScopedApi:true,reload:true,logoutRevoked:true});await context.close();
 }
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({status:'PASS',at:new Date().toISOString(),base,manifestSha256:config.manifestSha256,roles:results,privateGateUsed:true,noExternalBrowserRequests:true,desktopMobile:true,syntheticCompanyCreated:true,productionChanged:false},null,2),{flag:'wx'});
 console.log(JSON.stringify({status:'PASS',roles:results.length,output:out}));
}catch(e){if(lastPage&&!lastPage.isClosed())await lastPage.screenshot({path:path.join(out,'failure.png'),fullPage:true});throw e;}finally{await browser.close();}})().catch(e=>{console.error(JSON.stringify({status:'FAIL',error:e.name,frames:String(e.stack).split('\n').filter(s=>/^\s+at /.test(s)).slice(0,2),secretsNotPrinted:true}));process.exitCode=1;});
