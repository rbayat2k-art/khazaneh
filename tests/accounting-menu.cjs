const {readFixture}=require('./fixture-store.cjs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base='http://127.0.0.1:4322',output=process.env.TREASURY_UI_OUTPUT,data=process.env.TREASURY_TEST_DIR;
if(!output||!data||path.resolve(data)===path.resolve('data'))throw Error('isolated synthetic fixture required');
async function api(route,token,body){const response=await fetch(base+'/api'+route,{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});const result=await response.json();assert.equal(response.status,200,'synthetic API setup failed: '+route);return result;}
async function token(code){return(await api('/auth/login',null,{personnelCode:code,password:'Synthetic-Only!2026'})).token;}
async function login(page,code){await page.goto(base);await page.locator('#login-personnel-code').fill(code);await page.locator('#login-password').fill('Synthetic-Only!2026');await page.getByRole('button',{name:'ورود به پرتال سازمانی',exact:true}).click();}
(async()=>{
  fs.mkdirSync(output,{recursive:true});const browser=await chromium.launch({channel:'msedge',headless:true}),errors=[];let diagnostic={};
  try{
    const requester=await token('requester'),approver=await token('approver');
    await api('/advance-requests',requester,{amount:700,reason:'Synthetic accounting reachability'});
    const state=JSON.parse(readFixture(path.join(data,'treasury-db.json'))),row=state.advanceRequests.find(r=>r.reason==='Synthetic accounting reachability'&&r.status==='Pending_Approver');
    await api('/review/row-action',approver,{itemType:'ADVANCE',requestId:row.id,action:'APPROVE'});
    const adminContext=await browser.newContext({viewport:{width:1440,height:1000}}),admin=await adminContext.newPage();
    await login(admin,'admin');await admin.getByRole('button',{name:/مدیریت نقش‌ها و حدود اختیار/}).click();
    await admin.getByRole('button',{name:/^ACCOUNTING/}).click();
    const readPermission=admin.getByRole('checkbox',{name:/^مشاهده (سوابق و پیگیری وضعیت درخواست‌ها|درخواست‌ها در کارتابل‌های مجاز)/});
    await readPermission.uncheck();
    await admin.getByRole('checkbox',{name:/^زیرمنوی کارتابل بررسی مالی حسابداری/}).check();
    const saved=admin.waitForResponse(r=>r.url().endsWith('/api/roles/save')&&r.request().method()==='POST');await admin.getByRole('button',{name:/^ذخیره تنظیمات و دسترسی‌های/}).click();assert.equal((await saved).status(),200);
    const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await login(page,'accounting');
    const menu=page.getByRole('button',{name:/^کارتابل بررسی مالی حسابداری/});await menu.waitFor();
    const card=menu.locator('..'),pending=card.getByRole('button',{name:/در انتظار تأیید من/});
    if(!await pending.isVisible())await menu.click();await pending.click();
    await page.screenshot({path:path.join(output,'accounting.png'),fullPage:true});
    const latest=JSON.parse(readFixture(path.join(data,'treasury-db.json')));const cfg=latest.roleConfigs.find(r=>r.role==='ACCOUNTING');
    diagnostic={menuVisible:true,submenuClicked:true,canViewRequests:cfg.permissions.canViewRequests,canAccessAccountingCartable:cfg.permissions.canAccessAccountingCartable,errors};
    const visible=page.getByText(row.trackingCode,{exact:true}).first();
    assert.equal(await visible.count(),0,'explicit read denial must not be bypassed');
    await page.getByRole('alert').filter({hasText:'مجوز مشاهده درخواست‌ها'}).waitFor();
    // The administrator grants the prerequisite through the real UI, not a DB write.
    await readPermission.check();
    const allowed=admin.waitForResponse(r=>r.url().endsWith('/api/roles/save')&&r.request().method()==='POST');await admin.getByRole('button',{name:/^ذخیره تنظیمات و دسترسی‌های/}).click();assert.equal((await allowed).status(),200);
    await visible.waitFor({timeout:10000});assert.deepEqual(errors,[]);
    await page.screenshot({path:path.join(output,'accounting-after-explicit-grant.png'),fullPage:true});
    console.log(JSON.stringify({status:'PASS',...diagnostic,accountingRowVisibleAfterExplicitGrant:true,autoGrant:false,reloginRequired:false}));
  }finally{fs.writeFileSync(path.join(output,'diagnostic.json'),JSON.stringify(diagnostic,null,2));await browser.close();}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
