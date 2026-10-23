const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base='http://127.0.0.1:4322',output=process.env.TREASURY_UI_OUTPUT;
if(!output||!process.env.TREASURY_TEST_DIR)throw Error('explicit isolated synthetic environment required');
const password='Synthetic-Only!2026',errors=[];
async function login(page,user){await page.goto(base);await page.locator('#login-personnel-code').fill(user);await page.locator('#login-password').fill(password);await page.getByRole('button',{name:'ورود به پرتال سازمانی',exact:true}).click();await page.getByRole('button',{name:page.viewportSize().width<768?'باز کردن منوی کناری':'خروج',exact:true}).waitFor();}
async function api(route,token,body){body=require('./request-fixture.cjs').requestFixture(route,body);const r=await fetch(base+'/api'+route,{method:body?'POST':'GET',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});assert.equal(r.status,200,route);return r.json();}
async function cartable(page,mode,category='در انتظار تأیید من'){
  const mobile=page.getByRole('button',{name:'باز کردن منوی کناری',exact:true});if(await mobile.isVisible())await mobile.click();
  const menu=page.getByRole('button',{name:mode==='APPROVER'?/^کارتابل تایید سرپرست واحد/:/^کارتابل بررسی مالی حسابداری/});await menu.waitFor();
  const sub=menu.locator('..').getByRole('button',{name:new RegExp('^'+category)});if(!await sub.isVisible())await menu.click();await sub.click();
  await page.getByRole('heading',{name:mode==='APPROVER'?/^کارتابل تأیید سرپرست واحد/:/^کارتابل بررسی مالی حسابداری/}).waitFor();
  if(page.viewportSize().width<768)await page.waitForFunction(()=>document.querySelector('aside[aria-label="ناوبری اصلی پرتال"]').getBoundingClientRect().left>=innerWidth-1);
}
const row=(page,code)=>page.getByRole('row').filter({has:page.getByText(code,{exact:true})});
async function detailReason(page,tr,reason){await tr.getByRole('button',{name:'مشاهده کامل فرم',exact:true}).click();const d=page.getByRole('dialog',{name:'مشاهده کامل فرم',exact:true});await d.locator('dd').filter({hasText:reason}).first().waitFor();await page.keyboard.press('Escape');await d.waitFor({state:'hidden'});}
async function action(page,button,expectedAction){const waiting=page.waitForResponse(r=>r.url().endsWith('/api/review/row-action')&&r.request().method()==='POST');await button.click();const response=await waiting;assert.equal(response.status(),200);assert.equal(response.request().postDataJSON().action,expectedAction);return response.json();}
async function reason(page,target,label,actionName){await target.getByRole('button',{name:label,exact:true}).click();const dialog=page.getByRole('dialog',{name:new RegExp('^'+label)});await dialog.waitFor();const submit=dialog.getByRole('button',{name:'ثبت '+label,exact:true});assert.equal(await submit.isDisabled(),true);await dialog.getByRole('textbox').fill('علت مصنوعی '+label);await action(page,submit,actionName);await dialog.waitFor({state:'hidden'});}
(async()=>{
  const browser=await chromium.launch({headless:true,channel:'msedge'});let lastPage;
  try{
    const requesterToken=(await api('/auth/login',null,{personnelCode:'requester',password})).token;
    const ctx=await browser.newContext({viewport:{width:1440,height:1000}});
    const requester=await ctx.newPage(),supervisor=await(await browser.newContext({viewport:{width:1440,height:1000}})).newPage(),accounting=await(await browser.newContext({viewport:{width:1440,height:1000}})).newPage();
    for(const page of [requester,supervisor,accounting])page.on('pageerror',e=>errors.push(e.message));
    lastPage=requester;await login(requester,'requester');
    const menu=requester.getByRole('button',{name:'ثبت درخواست‌های مالی و پرسنلی',exact:true}),advance=requester.getByRole('button',{name:'مساعده حقوق تکی',exact:true});await menu.waitFor();if(!await advance.isVisible())await menu.click();await advance.click();
    await requester.getByText('ثبت درخواست مساعده حقوق تکی',{exact:true}).waitFor();
    const form=requester.locator('form');await form.locator('input[type=text]:not([data-form-value=rial])').nth(0).fill('مهر ۱۴۰۵');await form.locator('input[data-form-value=rial]').fill('10000');await form.locator('textarea').fill('آزمون واقعی رد و تأیید مجدد');
    const submitted=requester.waitForResponse(r=>r.url().endsWith('/api/advance-requests')&&r.request().method()==='POST');await form.locator('button[type=submit]').click();const created=await submitted;assert.equal(created.status(),200);const single=(await created.json()).item;
    const payment=(await api('/payment-requests',requesterToken,{amount:11000,payeeName:'TEST rejection recipient',description:'TEST payment rejection'})).item;
    const batches=[];for(const batchType of ['PAYMENT','ADVANCE'])batches.push((await api('/batch-payments',requesterToken,{title:'TEST UI rejection '+batchType,batchType,items:[{amount:12000,payeeName:'TEST held '+batchType},{amount:13000,payeeName:'TEST untouched '+batchType}]})).batch);
    const codes=[single.trackingCode,payment.trackingCode,...batches.map(b=>b.trackingCode+' (ردیف 1)')];
    await login(supervisor,'approver');await login(accounting,'accounting');
    for(const [page,stage] of [[supervisor,'APPROVER'],[accounting,'ACCOUNTING']]){
      lastPage=page;await page.reload();await cartable(page,stage);
      for(const code of codes)await reason(page,row(page,code),'رد درخواست','REJECT');
      await cartable(page,stage,'ردشده توسط من');await row(page,single.trackingCode).waitFor();
      assert.equal(await row(page,single.trackingCode).getByRole('button',{name:'ویرایش',exact:true}).count(),0);
      await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(output,stage.toLowerCase()+'-rejected-desktop.png')});
      await page.reload();await cartable(page,stage,'ردشده توسط من');await detailReason(page,row(page,single.trackingCode),/علت مصنوعی/);
      // The requester sees the explanation but cannot edit or resubmit a rejected row.
      await requester.reload();const ownMenu=requester.getByRole('button',{name:/^کارتابل پیگیری درخواست/});await ownMenu.waitFor();const all=ownMenu.locator('..').getByRole('button',{name:/همه درخواست/});if(!await all.isVisible())await ownMenu.click();await all.click();
      const own=row(requester,single.trackingCode);await own.getByRole('button',{name:'مشاهده کامل فرم',exact:true}).click();await requester.getByRole('dialog',{name:'مشاهده کامل فرم',exact:true}).getByText(/ردشده توسط/).waitFor();await requester.keyboard.press('Escape');assert.equal(await own.getByRole('button',{name:'ویرایش',exact:true}).count(),0);assert.equal(await own.getByRole('button',{name:/ارسال مجدد/}).count(),0);
      if(stage==='APPROVER'){
        for(const code of codes)await action(page,row(page,code).getByRole('button',{name:'تأیید و ارسال به مرحله بعد',exact:true}),'APPROVE');
      }else{
        await reason(page,row(page,single.trackingCode),'بستن نهایی درخواست','CLOSE_REJECTED');
        assert.equal(await row(page,single.trackingCode).getByRole('button',{name:'تأیید و ارسال به مرحله بعد',exact:true}).count(),0);await row(page,single.trackingCode).getByText('بسته و بایگانی‌شده',{exact:true}).first().waitFor();
        for(const code of codes.slice(1))await action(page,row(page,code).getByRole('button',{name:'تأیید و ارسال به مرحله بعد',exact:true}),'APPROVE');
      }
    }
    const state=await api('/state',requesterToken);assert.equal(state.advanceRequests.find(r=>r.id===single.id).status,'Closed');assert.equal(state.paymentRequests.find(r=>r.id===payment.id).status,'Pending_Treasury');
    for(const batch of batches){const saved=state.batchPayments.find(b=>b.id===batch.id);assert.equal(saved.items[0].status,'Pending_Treasury');assert.equal(saved.items[1].status,'Pending_Approver');}
    // Mobile: real menu, rejection dialog, keyboard escape and required reason, no document overflow.
    const mobileCtx=await browser.newContext({viewport:{width:390,height:844}}),mobile=await mobileCtx.newPage();lastPage=mobile;mobile.on('pageerror',e=>errors.push(e.message));await login(mobile,'approver');await cartable(mobile,'APPROVER');
    const target=row(mobile,batches[0].trackingCode+' (ردیف 2)');await target.getByRole('button',{name:'رد درخواست',exact:true}).click();const dialog=mobile.getByRole('dialog',{name:/^رد درخواست/});await dialog.waitFor();assert.equal(await dialog.getByRole('textbox').evaluate(e=>e===document.activeElement),true);assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await mobile.screenshot({path:path.join(output,'reject-mobile-dialog.png')});await mobile.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
    await reason(mobile,target,'رد درخواست','REJECT');await cartable(mobile,'APPROVER','ردشده توسط من');await row(mobile,batches[0].trackingCode+' (ردیف 2)').getByRole('button',{name:'بستن نهایی درخواست',exact:true}).waitFor();assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await mobile.screenshot({path:path.join(output,'rejected-mobile.png')});assert.deepEqual(errors,[]);
    lastPage=supervisor;
    const extras=[];for(let i=0;i<2;i++)extras.push((await api('/payment-requests',requesterToken,{amount:100,payeeName:'TEST bulk UI '+i,description:'TEST bulk reject'})).item);
    await supervisor.reload();await cartable(supervisor,'APPROVER');for(const extra of extras)await row(supervisor,extra.trackingCode).getByRole('checkbox').check();
    await supervisor.getByRole('button',{name:'رد درخواست (2)',exact:true}).click();const bulkDialog=supervisor.getByRole('dialog',{name:/^رد درخواست/});await bulkDialog.getByRole('textbox').fill('TEST atomic bulk UI');
    const bulkResponse=supervisor.waitForResponse(r=>r.url().endsWith('/api/review/bulk-action')&&r.request().method()==='POST');await bulkDialog.getByRole('button',{name:'ثبت رد درخواست',exact:true}).click();const bulk=await bulkResponse;assert.equal(bulk.status(),200);assert.equal((await bulk.json()).successCount,2);await bulkDialog.waitFor({state:'hidden'});
    await cartable(supervisor,'APPROVER','ردشده توسط من');for(const extra of extras)await detailReason(supervisor,row(supervisor,extra.trackingCode),/TEST atomic bulk UI/);
    await row(supervisor,extras[0].trackingCode).getByRole('button',{name:'بستن نهایی درخواست',exact:true}).click();const closeDialog=supervisor.getByRole('dialog',{name:/^بستن نهایی درخواست/});await closeDialog.getByRole('textbox').fill('TEST retain on denied decision');
    const adminToken=(await api('/auth/login',null,{personnelCode:'admin',password})).token,role=(await api('/state',adminToken)).roleConfigs.find(r=>r.role==='APPROVER');
    await api('/roles/save',adminToken,{...role,permissions:{...role.permissions,canReturnForRevision:false}});
    const deniedResponse=supervisor.waitForResponse(r=>r.url().endsWith('/api/review/row-action')&&r.request().method()==='POST');await closeDialog.getByRole('button',{name:'ثبت بستن نهایی درخواست',exact:true}).click();assert.equal((await deniedResponse).status(),403);assert.equal(await closeDialog.isVisible(),true);assert.equal(await closeDialog.getByRole('textbox').inputValue(),'TEST retain on denied decision');
    await api('/roles/save',adminToken,role);await action(supervisor,closeDialog.getByRole('button',{name:'ثبت بستن نهایی درخواست',exact:true}),'CLOSE_REJECTED');await closeDialog.waitFor({state:'hidden'});assert.deepEqual(errors,[]);
    const result={status:'PASS',realFormSubmission:true,fourFormsBothReviewStages:true,reasonRequired:true,reloadPersistence:true,requesterExplanationAndReadOnly:true,sameReviewerRecovery:true,terminalClosure:true,independentGroupRows:true,mobileKeyboardAndRtl:true,atomicBulkThroughUi:true,revokedPermissionRetainsReason:true,errors};fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(result,null,2),{flag:'wx'});console.log(JSON.stringify(result));
  }catch(error){if(lastPage&&!lastPage.isClosed())await lastPage.screenshot({path:path.join(output,'failure.png'),fullPage:true});throw error;}finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
