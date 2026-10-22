const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {readCommittedResponse}=require('./browser-response.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base='http://127.0.0.1:4322',output=process.env.TREASURY_UI_OUTPUT;
if(!output||!process.env.TREASURY_TEST_DIR)throw Error('explicit isolated synthetic environment required');
const password='Synthetic-Only!2026',errors=[];
async function login(page,code){await page.goto(base);await page.locator('#login-personnel-code').fill(code);await page.locator('#login-password').fill(password);await page.getByRole('button',{name:'ورود به پرتال سازمانی',exact:true}).click();}
async function submit(page,route,name){const response=page.waitForResponse(r=>r.url().endsWith(route)&&r.request().method()==='POST');await page.getByRole('button',{name,exact:true}).click();const r=await response;assert.equal(r.status(),200,route);return readCommittedResponse(r);}
async function users(page){await page.getByRole('button',{name:/فهرست و مدیریت کاربران/}).click();}
function userRow(page,code){return page.getByRole('row').filter({has:page.getByRole('cell',{name:code,exact:true})});}
async function makeUser(page,{code,primary,extra,supervisor}){
  await page.getByPlaceholder('مثال: مهندس آرش کاظمی').fill('آزمون '+code);
  await page.getByPlaceholder('مثال: 01042').fill(code);
  await page.getByRole('combobox',{name:'نقش اصلی',exact:true}).selectOption(primary);
  await page.getByRole('group',{name:'نقش‌های تکمیلی — انتخاب چندتایی',exact:true}).getByRole('checkbox',{name:extra,exact:true}).check();
  await page.getByRole('combobox',{name:'محدوده دسترسی اطلاعات کاربر'}).selectOption('COMPANY_WIDE');
  await page.getByRole('combobox',{name:'سرپرست مستقیم کاربر'}).selectOption(supervisor||'');
  await page.getByPlaceholder('خالی = استفاده از سقف پیش‌فرض نقش').first().fill('1000000');
  await page.getByPlaceholder('حداقل ۵ کاراکتر',{exact:true}).fill(password);
  await page.getByRole('checkbox',{name:'الزام کاربر به تغییر رمز عبور در اولین ورود',exact:true}).uncheck();
  const saved=await submit(page,'/api/users/save','ایجاد حساب کاربری جدید');
  const user=saved.state.users.find(u=>u.personnelCode===code);assert.equal(user.role,primary);assert.deepEqual(user.additionalRoles,[extra]);await userRow(page,code).waitFor();return user;
}
async function openCartable(page,mode){const menu=page.getByRole('button',{name:mode==='APPROVER'?/^کارتابل تایید سرپرست واحد/:/^کارتابل بررسی مالی حسابداری/});const pending=menu.locator('..').getByRole('button',{name:/در انتظار تأیید من/});if(!await pending.isVisible())await menu.click();await pending.click();}
async function approve(page,tracking,stage){const row=page.getByRole('row').filter({has:page.getByText(tracking,{exact:true})});const response=page.waitForResponse(r=>r.url().endsWith('/api/review/row-action')&&r.request().method()==='POST');await row.getByRole('button',{name:'تأیید',exact:true}).click();const r=await response;assert.equal(r.request().postDataJSON().reviewStage,stage);assert.equal(r.status(),200);const result=await readCommittedResponse(r);await row.waitFor({state:'hidden'});return result;}
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const ctx=await browser.newContext({viewport:{width:1440,height:1000}}),admin=await ctx.newPage();admin.on('pageerror',e=>errors.push(e.message));await login(admin,'admin');
    await admin.getByRole('button',{name:'مدیریت اطلاعات پایه',exact:true}).click();await admin.getByRole('button',{name:/تعریف شرکت‌ها و سازمان‌ها/}).click();
    assert.equal(await admin.getByRole('textbox',{name:'کد یکتای شرکت',exact:true}).getAttribute('readonly'),'');await admin.getByPlaceholder('مثال: شرکت مهندسی و ساخت آریا').fill('شرکت آزمون نقش');await submit(admin,'/api/master-data/companies/save','ثبت شرکت جدید');
    await admin.getByRole('button',{name:/تعریف واحدهای سازمانی/}).click();assert.equal(await admin.getByRole('textbox',{name:'کد واحد سازمانی',exact:true}).getAttribute('readonly'),'');await admin.getByPlaceholder('مثال: برنامه‌ریزی و کنترل پروژه').fill('واحد آزمون نقش');await submit(admin,'/api/master-data/departments/save','ثبت واحد سازمانی');
    await users(admin);
    const reviewer=await makeUser(admin,{code:'multi-review-ui',primary:'ACCOUNTING',extra:'APPROVER'});
    const requester=await makeUser(admin,{code:'multi-request-ui',primary:'APPROVER',extra:'REQUESTER',supervisor:reviewer.id});
    const filter=admin.locator('select').filter({has:admin.getByRole('option',{name:'همه نقش‌ها',exact:true})});await filter.selectOption('REQUESTER');
    await userRow(admin,requester.personnelCode).waitFor();await filter.selectOption('ALL');
    await userRow(admin,reviewer.personnelCode).getByRole('button',{name:'ویرایش',exact:true}).click();
    const group=admin.getByRole('group',{name:'نقش‌های تکمیلی — انتخاب چندتایی',exact:true});assert.equal(await group.getByRole('checkbox',{name:'APPROVER',exact:true}).isChecked(),true);
    await admin.screenshot({path:path.join(output,'multi-role-desktop.png'),fullPage:true});
    await admin.reload();await users(admin);await userRow(admin,reviewer.personnelCode).getByRole('button',{name:'ویرایش',exact:true}).click();
    assert.equal(await group.getByRole('checkbox',{name:'APPROVER',exact:true}).isChecked(),true);
    const mobileContext=await browser.newContext({viewport:{width:390,height:844}}),mobile=await mobileContext.newPage();await login(mobile,'admin');await mobile.getByRole('button',{name:'باز کردن منوی کناری',exact:true}).click();await users(mobile);await userRow(mobile,reviewer.personnelCode).getByRole('button',{name:'ویرایش',exact:true}).click();
    const mobileGroup=mobile.getByRole('group',{name:'نقش‌های تکمیلی — انتخاب چندتایی',exact:true});await mobileGroup.scrollIntoViewIfNeeded();await mobile.screenshot({path:path.join(output,'multi-role-mobile.png'),fullPage:true});
    assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));const box=await mobileGroup.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=391);
    const requestContext=await browser.newContext({viewport:{width:1440,height:1000}}),requestPage=await requestContext.newPage();requestPage.on('pageerror',e=>errors.push(e.message));await login(requestPage,requester.personnelCode);
    const advanceForm=requestPage.getByRole('button',{name:'مساعده حقوق تکی',exact:true});if(!await advanceForm.isVisible())await requestPage.getByRole('button',{name:'ثبت درخواست‌های مالی و پرسنلی',exact:true}).click();
    await advanceForm.click();const form=requestPage.locator('form');await form.locator('input[type=text]').nth(0).fill('مهر ۱۴۰۵');await form.locator('input[type=number]').fill('10000');await form.locator('textarea').fill('آزمون گردش واقعی نقش ترکیبی');
    const sent=requestPage.waitForResponse(r=>r.url().endsWith('/api/advance-requests')&&r.request().method()==='POST');await form.locator('button[type=submit]').click();const r=await sent;assert.equal(r.status(),200);const row=(await r.json()).item;assert.equal(row.status,'Pending_Approver');
    const reviewContext=await browser.newContext({viewport:{width:1440,height:1000}}),page=await reviewContext.newPage();page.on('pageerror',e=>errors.push(e.message));await login(page,reviewer.personnelCode);
    await page.getByRole('button',{name:/^کارتابل بررسی مالی حسابداری/}).waitFor();await page.getByRole('button',{name:/^کارتابل تایید سرپرست واحد/}).waitFor();
    assert.equal(await page.getByRole('button',{name:/مدیریت نقش‌ها و حدود اختیار/}).count(),0);
    await openCartable(page,'APPROVER');const first=await approve(page,row.trackingCode,'APPROVER');assert.equal(first.state.advanceRequests.find(x=>x.id===row.id).status,'Pending_Accounting');
    await openCartable(page,'ACCOUNTING');const second=await approve(page,row.trackingCode,'ACCOUNTING');assert.equal(second.state.advanceRequests.find(x=>x.id===row.id).status,'Pending_Treasury');
    await page.reload();await page.getByRole('button',{name:/^کارتابل بررسی مالی حسابداری/}).waitFor();
    await group.getByRole('checkbox',{name:'APPROVER',exact:true}).uncheck();
    const saved=admin.waitForResponse(r=>r.url().endsWith('/api/users/save')&&r.request().method()==='POST');await admin.getByRole('button',{name:'ذخیره تغییرات مشخصات کاربر',exact:true}).click();
    const blocked=await saved;assert.equal(blocked.status(),409,'pending dependencies must require reassignment, not silently revoke');
    assert.deepEqual(errors,[]);console.log(JSON.stringify({status:'PASS',createdBothRoleCombinations:true,persistedAfterReload:true,filterIncludesSupplementary:true,realRequesterAndBothReviewStages:true,safeRevokeRequiresReassignment:true,mobileOverflow:false,errors}));
  }finally{await browser.close();}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
