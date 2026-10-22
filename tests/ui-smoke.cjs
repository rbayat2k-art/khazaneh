const {readFixture}=require('./fixture-store.cjs');
// Run against the synthetic store started by the access tests, never the live server.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = `http://127.0.0.1:${Number(process.env.TREASURY_TEST_PORT || 4322)}`;
const output = process.env.TREASURY_UI_OUTPUT;
if (!output) throw new Error('Set TREASURY_UI_OUTPUT to a disposable test artifact directory.');
fs.mkdirSync(output, { recursive:true });
async function login(page, code, password) {
  await page.goto(base);
  await page.locator('#login-personnel-code').fill(code);
  await page.locator('#login-password').fill(password);
  await page.getByRole('button',{name:'ورود به پرتال سازمانی',exact:true}).click();
}
async function submit(page, route, name) {
  const response = page.waitForResponse(r=>r.url().endsWith(route) && r.request().method()==='POST');
  await page.getByRole('button',{name,exact:true}).click();
  const r=await response; const data=await r.json();
  assert.equal(r.status(),200,JSON.stringify(data)); return data;
}
(async()=>{
  const browser = await chromium.launch({headless:true,channel:'msedge'});
  const errors=[]; const report=[];
  try {
    const ctx=await browser.newContext({viewport:{width:1440,height:1000}});
    const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base);await page.locator('#login-personnel-code').waitFor();
    for(const width of [390,768,1024,1440]){
      await page.setViewportSize({width,height:1000});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),`Login horizontal overflow at ${width}`);
    }
    await login(page,'admin','Synthetic-Only!2026');
    await page.getByRole('button',{name:'مدیریت اطلاعات پایه',exact:true}).click();
    await page.getByRole('button',{name:/تعریف شرکت‌ها و سازمان‌ها/}).click();
    assert.equal(await page.getByRole('textbox',{name:'کد یکتای شرکت',exact:true}).getAttribute('readonly'),'');
    await page.getByPlaceholder('مثال: شرکت مهندسی و ساخت آریا').fill('شرکت آزمون مرورگر');
    await submit(page,'/api/master-data/companies/save','ثبت شرکت جدید');
    await page.getByRole('button',{name:/تعریف واحدهای سازمانی/}).click();
    assert.equal(await page.getByRole('textbox',{name:'کد واحد سازمانی',exact:true}).getAttribute('readonly'),'');
    await page.getByPlaceholder('مثال: برنامه‌ریزی و کنترل پروژه').fill('واحد آزمون مرورگر');
    await submit(page,'/api/master-data/departments/save','ثبت واحد سازمانی');
    await page.getByRole('button',{name:/فهرست و مدیریت کاربران/}).click();
    await page.getByPlaceholder('مثال: مهندس آرش کاظمی').fill('کاربر آزمون مرورگر');
    await page.getByPlaceholder('مثال: 01042').fill('ui-user');
    const initialPassword = page.getByPlaceholder('حداقل ۵ کاراکتر',{exact:true});
    await initialPassword.fill('Ab123');
    await submit(page,'/api/users/save','ایجاد حساب کاربری جدید');
    report.push('PASS: admin created company, department and requester through UI.');
    await page.screenshot({path:path.join(output,'admin-users.png'),fullPage:true});
    await ctx.close();
    const userContext=await browser.newContext({viewport:{width:1440,height:1000}});
    const userPage=await userContext.newPage();userPage.on('pageerror',e=>errors.push(e.message));
    await login(userPage,'ui-user','Ab123');
    await userPage.getByText('الزام تغییر رمز عبور موقت در اولین ورود',{exact:true}).waitFor();
    const fields=userPage.locator('input[type=password]');
    assert.equal(await fields.nth(1).getAttribute('minlength'),'5');
    assert.equal(await fields.nth(2).getAttribute('minlength'),'5');
    await fields.nth(0).fill('Ab123');await fields.nth(1).fill('Cd456');await fields.nth(2).fill('Cd456');
    const changed=userPage.waitForResponse(r=>r.url().endsWith('/api/auth/change-password'));
    await userPage.locator('button[type=submit]').click();assert.equal((await changed).status(),200);
    await userPage.getByRole('button',{name:'مساعده حقوق تکی',exact:true}).click();
    await userPage.getByText('ثبت درخواست مساعده حقوق تکی',{exact:true}).waitFor();
    const form=userPage.locator('form');
    await form.locator('input[type=text]').nth(0).fill('مهر ۱۴۰۵');
    await form.locator('input[type=number]').fill('10000');
    await form.locator('textarea').fill('درخواست آزمایشی از مسیر واقعی مرورگر');
    const create=userPage.waitForResponse(r=>r.url().endsWith('/api/advance-requests'));
    await form.locator('button[type=submit]').click();const created=await create;assert.equal(created.status(),200);
    const state=JSON.parse(readFixture(path.join(process.env.TREASURY_TEST_DIR,'treasury-db.json')));
    assert.ok(state.advanceRequests.some(r=>r.reason==='درخواست آزمایشی از مسیر واقعی مرورگر' && r.requesterPersonnelCode==='ui-user'));
    await userPage.reload();await userPage.getByText('کاربر آزمون مرورگر',{exact:true}).first().waitFor();
    assert.equal(await userPage.getByRole('button',{name:/فهرست و مدیریت کاربران/}).count(),0);
    report.push('PASS: five-character alphanumeric passwords work for account creation and forced change; requester persisted a request and refreshed without admin menus.');
    await userPage.screenshot({path:path.join(output,'requester-after-submit.png'),fullPage:true});
    assert.deepEqual(errors,[]);
    report.push('PASS: no uncaught browser errors.');
    fs.writeFileSync(path.join(output,'ui-report.txt'),report.join('\n'));console.log(report.join('\n'));
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
