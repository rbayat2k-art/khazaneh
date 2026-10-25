// Read-only navigation on the real built UI and an isolated synthetic server.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE),assert=require('node:assert/strict'),fs=require('node:fs');
const base='http://127.0.0.1:4322',out=process.env.TREASURY_UI_OUTPUT;
assert.ok(out&&process.env.TREASURY_TEST_DIR);
const groups=[
 ['ثبت درخواست‌های مالی و پرسنلی',['مساعده حقوق تکی','مساعده گروهی پرسنل','دستور پرداخت تکی','دستور پرداخت گروهی (تجمیعی)']],
 ['کارتابل پیگیری درخواست‌ها',['همه درخواست‌ها و سوابق من','پیگیری مساعده تکی','پیگیری مساعده گروهی','پیگیری درخواست پرداخت تکی','پیگیری درخواست پرداخت گروهی','نیازمند اصلاح و بازنگری']],
 ...['کارتابل تایید سرپرست واحد','کارتابل بررسی مالی حسابداری'].map(title=>[title,['در انتظار تأیید من','تأییدشده توسط من','برگشت‌داده‌شده برای اصلاح','همه سوابق من','ردشده توسط من']]),
 ['خزانه‌داری و عملیات پرداخت',['صف انتظار پرداخت','مخزن در حال پرداخت','پرداختی‌های انجام‌شده','تکمیل و استعلام شبا','بانک‌ها و شماره‌حساب‌ها','ثبت پرداخت انجام‌شده','ثبت دستور پرداخت خارج سامانه','روکش روزانه','بایگانی فیش‌ها']],
 ['گزارش‌ها و خروجی‌ها',['گزارش جامع درخواست‌ها و پرداخت‌ها']],
 ['مدیریت اطلاعات پایه',['تعریف شرکت‌ها و سازمان‌ها','تعریف واحدهای سازمانی','تعریف مراکز هزینه','تنظیمات استعلام کارت و شبا','سامانه پیامک و اطلاع‌رسانی']],
 ['مدیریت کاربران و دسترسی‌ها',['فهرست و مدیریت کاربران','مدیریت نقش‌ها و حدود اختیار','درخواست‌های بازیابی رمز عبور','تاریخچه امنیتی و تغییرات دسترسی']],
 ['تنظیمات و حساب کاربری',['تنظیمات امنیتی و کارتابل من']],
];
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});let p;try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
 await context.route('**/*',r=>r.request().url().startsWith(base+'/')||/^(blob:|data:)/.test(r.request().url())?r.continue():r.abort());
 p=await context.newPage();p.setDefaultTimeout(8000);const errors=[],routes=[];p.on('pageerror',()=>errors.push('pageerror'));
 await p.goto(base);await p.locator('#login-personnel-code').fill('admin');await p.locator('#login-password').fill('Synthetic-Only!2026');await p.getByRole('button',{name:'ورود به پرتال سازمانی',exact:true}).click();await p.getByRole('button',{name:'خروج',exact:true}).waitFor();
 const nav=p.getByRole('complementary',{name:'ناوبری اصلی پرتال'}),main=p.locator('main');
 for(const [title,labels] of groups){
  const header=nav.getByRole('button').filter({has:p.getByText(title,{exact:true})}),card=header.locator('..');
  assert.equal(await header.count(),1,title);
  for(const label of labels){const name=new RegExp('^'+label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?:\\s+[0-9۰-۹]+)?$');const button=card.getByRole('button',{name});
   if(!await button.isVisible())await header.click();await button.click();
   await p.waitForFunction(({title,label})=>{const a=document.querySelector('aside'),hasText=(e,text)=>e.textContent.trim()===text||[...e.querySelectorAll('span')].some(s=>s.textContent.trim()===text),header=[...a.querySelectorAll('button')].find(e=>hasText(e,title)),b=header&&[...header.parentElement.querySelectorAll('button')].find(e=>hasText(e,label));return !!b&&/bg-blue-50|bg-emerald-50|border-r-2|bg-slate-900\/10/.test(b.className);},{title,label});
   assert.ok((await main.innerText()).trim().length>100,'nonempty page '+label);
   const headings=await main.locator('h1,h2,h3,h4').allTextContents();assert.ok(headings.length,'page headings '+label);
   assert.equal(await main.getByRole('alert').filter({hasText:/مجوز.*(ندارید|فعال نیست)/}).count(),0,'admin navigation denied '+label);
   routes.push({mainMenu:title,submenu:label,headings:headings.map(x=>x.trim())});
  }
 }
 assert.equal(routes.length,40);assert.deepEqual(errors,[]);await p.screenshot({path:out+'/settings-last-route.png',fullPage:true});
 fs.writeFileSync(out+'/result.json',JSON.stringify({status:'PASS',mainMenus:9,submenus:40,readOnlyNavigation:true,externalCalls:false,routes,errors},null,2));console.log('PASS 9 main menus / 40 submenu routes on real built UI');
}catch(e){if(p&&!p.isClosed())await p.screenshot({path:out+'/failure.png',fullPage:true});throw e;}finally{await browser.close();}})().catch(e=>{console.error(e.stack);process.exitCode=1;});
