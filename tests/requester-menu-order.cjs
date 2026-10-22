// Read-only navigation against the real built app and a disposable synthetic fixture.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const out=process.env.TREASURY_UI_OUTPUT,root=process.env.TREASURY_TEST_DIR,base='http://127.0.0.1:4322';if(!out||!root?.includes('/work/'))throw Error('explicit synthetic fixture required');
const expected=['مساعده حقوق تکی','مساعده گروهی پرسنل','دستور پرداخت تکی','دستور پرداخت گروهی (تجمیعی)'];
const headings=['ثبت درخواست مساعده حقوق تکی',/^ثبت مساعده گروهی پرسنل/,'ثبت دستور پرداخت تکی',/^ثبت دستور پرداخت گروهی و چندردیفی/];
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const errors=[],results=[];for(const width of [1440,390]){const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.locator('#login-personnel-code').fill('requester');await page.locator('#login-password').fill('Synthetic-Only!2026');await page.getByRole('button',{name:'ورود به پرتال سازمانی',exact:true}).click();await page.getByRole('button',{name:width<768?'باز کردن منوی کناری':'خروج',exact:true}).waitFor();
  for(let i=0;i<expected.length;i++){
   if(width<768)await page.getByRole('button',{name:'باز کردن منوی کناری',exact:true}).click();
   const menu=page.getByRole('button',{name:'ثبت درخواست‌های مالی و پرسنلی',exact:true}),group=menu.locator('..');
   if(!await group.getByRole('button',{name:expected[0],exact:true}).isVisible())await menu.click();
   assert.deepEqual((await group.getByRole('button').allTextContents()).slice(1).map(t=>t.trim()),expected);
   if(i===0)await group.screenshot({path:path.join(out,'menu-'+width+'.png')});
   await group.getByRole('button',{name:expected[i],exact:true}).click();await page.getByRole('heading',{name:headings[i],exact:typeof headings[i]==='string'}).waitFor();
   if(width<768)await page.waitForFunction(()=>document.querySelector('aside[aria-label="ناوبری اصلی پرتال"]').getBoundingClientRect().left>=innerWidth-1);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   if(i===2){
    const form=page.locator('form'),description=form.locator('textarea'),center=form.locator('select').first(),recipient=form.locator('input[type=text]').first();
    assert.deepEqual(await form.locator('textarea,select,input:not([type=file])').evaluateAll(els=>els.slice(0,3).map(el=>el.tagName)),['TEXTAREA','SELECT','INPUT']);
    assert.ok((await description.boundingBox()).y<(await center.boundingBox()).y);
    assert.ok((await center.boundingBox()).y<(await recipient.boundingBox()).y);
    await description.focus();await page.keyboard.press('Tab');assert.equal(await center.evaluate(el=>el===document.activeElement),true);
    await page.keyboard.press('Tab');assert.equal(await recipient.evaluate(el=>el===document.activeElement),true);
    await form.screenshot({path:path.join(out,'payment-form-'+width+'.png')});
   }
  }results.push({width,order:expected,allRoutesCorrect:true,paymentStartsWithDescriptionThenCostCenter:true,keyboardOrderMatchesLayout:true});await context.close();}
 assert.deepEqual(errors,[]);const result={status:'PASS',realBuiltUIAndAPI:true,results,requestSubmitted:false,errors};fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2),{flag:'wx'});console.log(JSON.stringify(result));
}finally{await browser.close();}})().catch(e=>{console.error(e.stack);process.exitCode=1;});
