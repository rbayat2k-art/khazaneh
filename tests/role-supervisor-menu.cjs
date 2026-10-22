const {readFixture}=require('./fixture-store.cjs');
// Only the synthetic access-test store on loopback. Never run against Production.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const data=process.env.TREASURY_TEST_DIR,output=process.env.TREASURY_UI_OUTPUT;
if(!data||!output||path.resolve(data)===path.resolve('data'))throw Error('explicit isolated test data and output required');
const base='http://127.0.0.1:4322',title='منوی کارتابل تأیید سرپرست واحد',permission='نمایش منوی کارتابل تأیید سرپرست واحد';
const state=()=>JSON.parse(readFixture(path.join(data,'treasury-db.json')));
async function login(page,code){await page.goto(base);await page.locator('#login-personnel-code').fill(code);await page.locator('#login-password').fill('Synthetic-Only!2026');await page.getByRole('button',{name:'ورود به پرتال سازمانی',exact:true}).click();}
async function settings(page){await page.getByRole('button',{name:/مدیریت نقش‌ها و حدود اختیار/}).click();await page.getByRole('heading',{name:/مدیریت دسترسی‌ها و تنظیمات پیش‌فرض/}).waitFor();}
async function save(page){const wait=page.waitForResponse(r=>r.url().endsWith('/api/roles/save')&&r.request().method()==='POST');await page.getByRole('button',{name:/^ذخیره تنظیمات و دسترسی‌های/}).click();assert.equal((await wait).status(),200);}
(async()=>{
  fs.mkdirSync(output,{recursive:true});const browser=await chromium.launch({channel:'msedge',headless:true});const errors=[];
  try{
    const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await login(page,'admin');await settings(page);
    await page.screenshot({path:path.join(output,'permissions-desktop.png'),fullPage:true});
    const group=page.getByRole('group',{name:title,exact:true});
    assert.equal(await group.count(),1,'supervisor menu must have a distinct settings card');
    assert.equal(await group.getByRole('checkbox').count(),1,'reuse one existing permission, do not duplicate it');
    const before=structuredClone(state().roleConfigs.find(r=>r.role==='APPROVER').permissions);
    await group.getByRole('checkbox',{name:new RegExp(permission)}).uncheck();await save(page);
    const disabled=state().roleConfigs.find(r=>r.role==='APPROVER');
    assert.equal(disabled.permissions.canAccessApproverCartable,false);
    for(const key of Object.keys(before).filter(k=>k!=='canAccessApproverCartable'&&k!=='canAccessApproverWorkspace'))assert.equal(disabled.permissions[key],before[key],`unrelated permission changed: ${key}`);
    await page.reload();await settings(page);assert.equal(await page.getByRole('group',{name:title,exact:true}).getByRole('checkbox').isChecked(),false);
    await page.getByRole('group',{name:title,exact:true}).getByRole('checkbox').check();
    const landing=page.locator('select').filter({has:page.getByRole('option',{name:'کارتابل تأیید سرپرست واحد',exact:true})});
    await landing.selectOption('APPROVER');await save(page);
    assert.equal(state().roleConfigs.find(r=>r.role==='APPROVER').defaultLandingSection,'APPROVER');
    await page.getByRole('group',{name:title,exact:true}).screenshot({path:path.join(output,'supervisor-card.png')});
    await context.close();
    const mobileContext=await browser.newContext({viewport:{width:390,height:844}}),mobile=await mobileContext.newPage();
    await login(mobile,'admin');await mobile.getByRole('button',{name:'باز کردن منوی کناری',exact:true}).click();await settings(mobile);
    await mobile.waitForFunction(()=>document.querySelector('aside[aria-label="ناوبری اصلی پرتال"]').getBoundingClientRect().left>=window.innerWidth-1);
    const mobileCard=mobile.getByRole('group',{name:title,exact:true});await mobileCard.scrollIntoViewIfNeeded();
    await mobile.screenshot({path:path.join(output,'permissions-mobile.png')});
    assert.ok(await mobileCard.evaluate(e=>e.scrollWidth<=e.clientWidth+1),'supervisor card overflows on mobile');
    console.log(JSON.stringify(await mobileCard.evaluate(e=>({mobileLayout:{width:window.innerWidth,documentWidth:document.documentElement.scrollWidth,scrollX:window.scrollX,cardLeft:e.getBoundingClientRect().left,cardRight:e.getBoundingClientRect().right,mainWidth:document.querySelector('main')?.getBoundingClientRect().width}}))));
    await mobileContext.close();
    const approverContext=await browser.newContext({viewport:{width:1440,height:1000}}),approverPage=await approverContext.newPage();await login(approverPage,'approver');
    await approverPage.getByRole('button',{name:/^کارتابل تایید سرپرست واحد/}).waitFor();
    assert.equal(await approverPage.getByRole('button',{name:/مدیریت نقش‌ها و حدود اختیار/}).count(),0);
    await approverContext.close();assert.deepEqual(errors,[]);
    const result={status:'PASS',distinctCard:true,persistedToggleAndReload:true,unrelatedPermissionsUnchanged:true,existingDefaultLandingOption:true,approverSidebarAvailable:true,adminMenuDeniedForApprover:true,desktopAndMobile:true};
    fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
  }finally{await browser.close();}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
