// Real built UI/API, isolated synthetic store only; no operational data or API mocks.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const out=process.env.TREASURY_UI_OUTPUT,root=process.env.TREASURY_TEST_DIR,base='http://127.0.0.1:4322';
if(!out||!root?.includes('/work/'))throw Error('Explicit disposable synthetic fixture required');
const password='Synthetic-Only!2026',errors=[];
const labels=['همه درخواست‌ها و سوابق من','پیگیری مساعده تکی','پیگیری مساعده گروهی','پیگیری درخواست پرداخت تکی','پیگیری درخواست پرداخت گروهی','نیازمند اصلاح و بازنگری'];
const headings=['کارتابل جامع پیگیری و سوابق درخواست‌های من','پیگیری مساعده تکی','پیگیری مساعده گروهی','پیگیری دستور پرداخت‌های تکی','پیگیری درخواست‌های پرداخت گروهی (تجمیعی)','درخواست‌ها و ردیف‌های نیازمند اصلاح و بازنگری'];
async function api(route,token,body){body=require('./request-fixture.cjs').requestFixture(route,body);const r=await fetch(base+'/api'+route,{method:body?'POST':'GET',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});assert.equal(r.status,200,route);return r.json();}
async function token(personnelCode){return(await api('/auth/login',null,{personnelCode,password})).token;}
async function login(page,user){await page.goto(base);await page.locator('#login-personnel-code').fill(user);await page.locator('#login-password').fill(password);await page.getByRole('button',{name:'ورود به پرتال سازمانی',exact:true}).click();await page.getByRole('button',{name:page.viewportSize().width<768?'باز کردن منوی کناری':'خروج',exact:true}).waitFor();}
async function select(page,index,screenshot){
  const mobile=page.viewportSize().width<768;
  if(mobile)await page.getByRole('button',{name:'باز کردن منوی کناری',exact:true}).click();
  const menu=page.getByRole('button',{name:/^کارتابل پیگیری درخواست/}),group=menu.locator('..');
  if(!await group.getByRole('button',{name:labels[0],exact:true}).isVisible())await menu.click();
  const buttons=group.getByRole('button');
  assert.deepEqual((await buttons.allTextContents()).slice(1).map(t=>t.replace(/\d+$/,'').trim()),labels);
  if(screenshot)await group.screenshot({path:path.join(out,'tracking-menu-'+page.viewportSize().width+'.png')});
  await buttons.nth(index+1).click();
  await page.getByRole('heading',{name:headings[index],exact:true}).waitFor();
  if(mobile)await page.waitForFunction(()=>document.querySelector('aside[aria-label="ناوبری اصلی پرتال"]').getBoundingClientRect().left>=innerWidth-1);
}
async function visibleCodes(page,records,indices){for(let i=0;i<records.length;i++)assert.equal(await page.getByText(records[i].trackingCode,{exact:true}).count()>0,indices.includes(i),'category for '+i);}
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});let current;
 try{
  const requester=await token('requester'),admin=await token('admin'),reviewer=await token('approver');
  const singleAdvance=(await api('/advance-requests',requester,{amount:12000,reason:'TEST tracking single advance',requestedMonth:'آزمون'})).item;
  const batchAdvance=(await api('/batch-payments',requester,{title:'TEST tracking batch advance',batchType:'ADVANCE',items:[{amount:12000,payeeName:'TEST tracking advance recipient'}]})).batch;
  const singlePayment=(await api('/payment-requests',requester,{amount:12000,description:'TEST tracking single payment',payeeName:'TEST tracking payment recipient'})).item;
  const batchPayment=(await api('/batch-payments',requester,{title:'TEST tracking batch payment',batchType:'PAYMENT',items:[{amount:12000,payeeName:'TEST tracking batch recipient'}]})).batch;
  const foreign=(await api('/payment-requests',admin,{amount:12000,description:'TEST foreign tracking record',payeeName:'TEST foreign account holder'})).item;
  const records=[singleAdvance,batchAdvance,singlePayment,batchPayment];
  const state=await api('/state',requester);
  assert.ok(!state.paymentRequests.some(p=>p.id===foreign.id),'server ownership remains enforced');
  const legacy=state.batchPayments.find(b=>b.trackingCode==='TEST-TRACKING-LEGACY');
  assert.ok(legacy&&legacy.batchType==='PAYMENT','existing server normalization must retain the legacy payment group');
  const expectedBatchCount=state.batchPayments.filter(b=>b.batchType!=='ADVANCE').length;
  const expectedAdvanceBatchCount=state.batchPayments.filter(b=>b.batchType==='ADVANCE').length;
  for(const width of [1440,390]){
   const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();current=page;page.on('pageerror',e=>errors.push(e.message));await login(page,'requester');
   for(let i=0;i<5;i++){
    await select(page,i,i===0);await visibleCodes(page,records,i===0?[0,1,2,3]:[i-1]);
    assert.equal(await page.getByText(foreign.trackingCode,{exact:true}).count(),0);
    assert.equal(await page.getByText(legacy.trackingCode,{exact:true}).count()>0,i===0||i===4,'legacy group is payment only');
    if(i===2||i===4){const heading=page.getByRole('heading',{level:4}).filter({hasText:i===2?'درخواست‌های مساعده گروهی':'درخواست‌های پرداخت گروهی'});assert.ok((await heading.innerText()).includes('('+(i===2?expectedAdvanceBatchCount:expectedBatchCount)+' مورد)'));}
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    if(i===2)await page.screenshot({path:path.join(out,'advance-group-'+width+'.png'),fullPage:true});
   }
   await page.reload();await select(page,2);await visibleCodes(page,records,[1]);await context.close();
  }
  // Existing return flow remains reachable for every kind; no new review contract.
  for(const [i,record] of records.entries())await api('/review/row-action',reviewer,{itemType:i===0?'ADVANCE':i===2?'PAYMENT':'BATCH_ITEM',requestId:record.id,...(i===1||i===3?{rowId:record.items[0].id}:{}),action:'RETURN_FOR_REVISION',expectedVersion:record.version||1,returnReason:'TEST tracking revision '+i});
  const ctx=await browser.newContext({viewport:{width:1440,height:1000}}),page=await ctx.newPage();current=page;await login(page,'requester');await select(page,5);
  for(const r of records){const card=page.getByText(r.trackingCode,{exact:false}).locator('..').locator('..').locator('..');assert.equal(await card.getByRole('button',{name:'اصلاح و ارسال مجدد',exact:true}).count(),1);}
  assert.equal(await page.getByText(foreign.trackingCode,{exact:true}).count(),0);await page.screenshot({path:path.join(out,'revision-all-types.png'),fullPage:true});await ctx.close();
  // Empty payment category must remain empty despite this actor having an advance group.
  await api('/users/save',admin,{name:'TEST tracking empty',personnelCode:'tracking-empty',role:'REQUESTER',company:'TEST',department:'TEST',supervisorId:'approver',password,mustChangePassword:false});
  const empty=await token('tracking-empty');const onlyAdvance=(await api('/batch-payments',empty,{title:'TEST empty category advance',batchType:'ADVANCE',items:[{amount:12000,payeeName:'TEST empty category recipient'}]})).batch;
  const emptyCtx=await browser.newContext({viewport:{width:390,height:844}}),emptyPage=await emptyCtx.newPage();current=emptyPage;await login(emptyPage,'tracking-empty');await select(emptyPage,4);await emptyPage.getByText('درخواست پرداخت گروهی ثبت نشده است.',{exact:true}).waitFor();assert.equal(await emptyPage.getByText(onlyAdvance.trackingCode,{exact:true}).count(),0);assert.ok((await emptyPage.getByRole('heading',{level:4}).innerText()).includes('(0 مورد)'));await select(emptyPage,2);await emptyPage.getByText(onlyAdvance.trackingCode,{exact:true}).waitFor();await emptyCtx.close();
  assert.deepEqual(errors,[]);const result={status:'PASS',realBuiltUIAndAPI:true,order:labels,fourTypesSeparated:true,legacyMissingTypeIsPayment:true,groupCountsMatch:true,allAndRevisionsPreserved:true,emptyStateNotContaminated:true,ownershipUnchanged:true,reload:true,widths:[1440,390],errors};fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2),{flag:'wx'});console.log(JSON.stringify(result));
 }catch(e){if(current&&!current.isClosed())await current.screenshot({path:path.join(out,'failure.png'),fullPage:true});throw e;}finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
