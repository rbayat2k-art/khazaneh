export const SMS_EVENTS = [
  ['OTP_RECOVERY','کد بازیابی رمز عبور'],['PASSWORD_RESET','رمز موقت صادرشده توسط مدیر'],
  ['PENDING_APPROVAL','ورود درخواست به کارتابل مرحلهٔ بعد'],
  ['APPROVAL_REMINDER','یادآوری کارهای منتظر سرپرست'],
  ['REVISION_OR_REJECT','بازگشت برای اصلاح یا رد درخواست'],
  ['PAYMENT_EXECUTED','ثبت پرداخت'],['ADMIN_TEST','پیامک آزمایشی مدیر'],
] as const;
export type SmsTemplateEvent = typeof SMS_EVENTS[number][0];
export interface SmsTemplateRule {mode:'TEXT'|'PATTERN';text:string;patternCode?:string;patternVariables?:Record<string,string>;}
export type SmsTemplates=Partial<Record<SmsTemplateEvent,SmsTemplateRule>>;
export const smsCanonicalEvent=(event:string)=>event==='ADMIN_PASSWORD_RESET'?'PASSWORD_RESET':event==='ADMIN_TEST_SMS'?'ADMIN_TEST':event;
export const SMS_VARIABLES:Record<string,string>={'تعداد_منتظر':'تعداد کارهای منتظر رسیدگی','متن_پیش_فرض':'متن استاندارد همین رویداد','نام':'نام مخاطب','کد_درخواست':'کد درخواست مرتبط','عنوان':'عنوان اعلان','پیوند':'نشانی پرتال','کد':'کد یک‌بارمصرف','رمز_موقت':'رمز موقت'};
export function smsAllowedVariables(event:string){return ['متن_پیش_فرض','نام','پیوند',...(event==='OTP_RECOVERY'?['کد']:event==='PASSWORD_RESET'?['رمز_موقت']:event==='APPROVAL_REMINDER'?['تعداد_منتظر','عنوان']:['کد_درخواست','عنوان'])];}
export function smsTemplatesError(value:unknown):string|undefined{
 if(!value||typeof value!=='object'||Array.isArray(value))return 'قالب پیامک معتبر نیست.';
 for(const[event,r]of Object.entries(value as Record<string,any>)){
  if(!SMS_EVENTS.some(([k])=>k===event)||!r||typeof r!=='object'||Array.isArray(r)||Object.keys(r).some(k=>!['mode','text','patternCode','patternVariables'].includes(k))||!['TEXT','PATTERN'].includes(r.mode)||typeof r.text!=='string'||r.text.length>1200)return 'رویداد یا متن قالب پیامک معتبر نیست (حداکثر ۱۲۰۰ نویسه).';
  const allowed=smsAllowedVariables(event),check=(text:string)=>{const matches=[...text.matchAll(/\{([^{}]+)\}/g)];return !/[{}]/.test(text.replace(/\{([^{}]+)\}/g,''))&&matches.every(m=>allowed.includes(m[1]));};
  if(!check(r.text))return 'قالب شامل متغیر ناشناخته یا آکولاد ناقص است.';
  const entries=Object.entries(r.patternVariables||{});if(r.mode==='PATTERN'){
   if(!/^[A-Za-z0-9_-]{1,100}$/.test(r.patternCode||'')||entries.length<1||entries.length>10)return 'کد پترن تأییدشده و یک تا ده متغیر آن را وارد کنید.';
   if(entries.some(([k,v])=>!Object.hasOwn(r.patternVariables,k)||!(/^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(k))||typeof v!=='string'||!/^\{[^{}]+\}$/.test(v)||!check(v)))return 'هر متغیر پترن باید به یکی از متغیرهای مجاز سامانه متصل شود.';
  }else if(!r.text.trim())return 'متن پیامک را وارد کنید؛ برای متن فعلی از {متن_پیش_فرض} استفاده کنید.';
  const content=r.mode==='PATTERN'?entries.map(([,v])=>v).join(' '):r.text;
  const mandatory=event==='OTP_RECOVERY'?'کد':event==='PASSWORD_RESET'?'رمز_موقت':null;
  if(mandatory&&!content.includes('{'+mandatory+'}')&&!content.includes('{متن_پیش_فرض}'))return 'قالب امنیتی باید کد یا رمز مربوط به همین رویداد را داشته باشد.';
 }
}
export function renderSmsTemplate(event:string,templates:SmsTemplates|undefined,values:Record<string,string>,fallback:string){
 const key=smsCanonicalEvent(event),rule=templates?.[key as SmsTemplateEvent];if(!rule)return {text:fallback};
 const err=smsTemplatesError({[key]:rule});if(err)throw Error(err);
 const fill=(text:string)=>text.replace(/\{([^{}]+)\}/g,(_,name:string)=>{const value=name==='متن_پیش_فرض'?fallback:values[name];if(value===undefined||value==='')throw Error('اطلاعات لازم برای متغیر قالب پیامک موجود نیست.');return value;});
 const text=fill(rule.text);if(text.length>3000)throw Error('متن نهایی پیامک بیش از حد طولانی است.');
 if(rule.mode==='TEXT')return {text};
 const variables=Object.fromEntries(Object.entries(rule.patternVariables||{}).map(([k,v])=>[k,fill(v)]));return {text,patternCode:rule.patternCode,variables};
}
