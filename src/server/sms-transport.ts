import type{SmsGatewayConfig}from'../types/treasury';
import{readSmsProviderBody}from'./sms-security';
import{smsCanonicalEvent}from'../utils/sms-templates';
export const FARAZ_LEGACY='https://api2.ippanel.com/api/v1/sms/send/webservice/single';
export const FARAZ_EDGE='https://edge.ippanel.com/v1/api/send';
export const FARAZ_PUBLIC='https://api.iranpayamak.com/ws/v1/sms/simple';
export function smsContract(cfg:Pick<SmsGatewayConfig,'provider'|'apiUrl'>){
 if(!['FARAZ_SMS','FARAZSMS'].includes(cfg.provider))return;
 try{const u=new URL(cfg.apiUrl);if(u.protocol!=='https:'||u.username||u.password||u.port||u.search||u.hash)return;if(u.href===FARAZ_LEGACY)return 'LEGACY';if(u.href===FARAZ_EDGE)return 'EDGE';if(u.href===FARAZ_PUBLIC)return 'FARAZ_PUBLIC';}catch{}
}
export function smsRuntime(cfg:SmsGatewayConfig,env:Record<string,string|undefined>=process.env){
 const mode:'LIVE'|'TEST_ONLY'|'OFF'=env.SHAHRAH_STAGING_ROOT?'OFF':env.TREASURY_SMS_MODE==='LIVE'?'LIVE':env.TREASURY_SMS_MODE==='TEST_ONLY'?'TEST_ONLY':'OFF',contract=smsContract(cfg),credentials=!!cfg.apiKey?.trim()&&!!cfg.senderNumber?.trim();
 const ready=cfg.enabled&&mode!=='OFF'&&!!contract&&credentials;
 const reason=!cfg.enabled?'ارسال پیامک در تنظیمات سامانه غیرفعال است.':mode==='OFF'?'تنظیمات ذخیره شده است؛ ارتباط واقعی پیامک در سرور هنوز فعال نیست.':!contract?'این نشانی یا ارائه‌دهنده، اتصال واقعی تأییدشدهٔ پیامک ندارد.':!credentials?'کلید وب‌سرویس یا خط فرستنده تکمیل نشده است.':mode==='TEST_ONLY'?'ارتباط سرور در حالت آزمون مدیر است؛ ارسال خودکار هنوز فعال نیست.':'ارتباط سرور برای رویدادهای انتخاب‌شده فعال است.';
 return {mode,ready,providerSupported:!!contract,reason};
}
export function smsEventEnabled(cfg:SmsGatewayConfig,event:string){
 if(event==='APPROVAL_REMINDER')return cfg.approvalReminders?.enabled===true;
 const e=smsCanonicalEvent(event),v=cfg.events;
 if(e==='ADMIN_TEST')return true;if(e==='OTP_RECOVERY')return !!v?.sendOtpOnRecovery;
 if(e==='PASSWORD_RESET')return !!(v?.sendOnPasswordReset??v?.sendOnAdminPasswordReset);
 if(e==='PENDING_APPROVAL')return !!v?.sendOnPendingApproval;if(e==='REQUEST_SUBMITTED')return !!v?.sendOnRequestSubmitted;
 if(e==='RETURNED_FOR_REVISION')return !!(v?.sendOnReturnedForRevision??v?.sendOnRevisionOrReject);
 if(e==='REVISION_OR_REJECT')return !!v?.sendOnRevisionOrReject;if(e==='FINAL_APPROVAL')return !!v?.sendOnFinalApproval;
 return e==='PAYMENT_EXECUTED'&&!!v?.sendOnPaymentExecuted;
}
const senderNumber=(v:string)=>{const s=v.trim();if(/^\+98\d{4,18}$/.test(s))return s;if(/^\d{4,18}$/.test(s))return '+98'+s;throw Error('شماره خط فرستنده معتبر نیست.');};
function providerError(status:number){return status===401?'کلید دسترسی توسط سرویس پذیرفته نشد.':status===403?'سرویس اجازهٔ این ارسال یا استفاده از این خط را نمی‌دهد.':status===402?'اعتبار سرویس برای ارسال کافی نیست.':status===422?'مشخصات ارسال با قرارداد سرویس مطابقت ندارد.':`سرویس پیامک درخواست را نپذیرفت (HTTP ${status}).`;}
export async function sendFarazSms(cfg:SmsGatewayConfig,recipient:string,message:{text:string;patternCode?:string;variables?:Record<string,string>},fetcher:typeof fetch=fetch){
 const contract=smsContract(cfg);if(!contract)throw Error('اتصال واقعی پیامک تأییدشده نیست.');if(!/^09\d{9}$/.test(recipient))throw Error('شماره گیرنده معتبر نیست.');
 const key=cfg.apiKey?.trim();if(!key||/[\r\n]/.test(key))throw Error('کلید سرویس پیامک معتبر نیست.');const from=senderNumber(cfg.senderNumber),to='+98'+recipient.slice(1);let url=cfg.apiUrl;
 const publicLine=cfg.senderNumber.trim().replace(/^\+98/,'');
 const body=contract==='FARAZ_PUBLIC'?message.patternCode?{code:message.patternCode,attributes:message.variables,recipient,line_number:publicLine,number_format:'english'}:{text:message.text,line_number:publicLine,recipients:[recipient],number_format:'english'}:contract==='EDGE'?message.patternCode?{sending_type:'pattern',from_number:from,code:message.patternCode,recipients:[to],params:message.variables}:{sending_type:'webservice',from_number:from,message:message.text,params:{recipients:[to]}}:message.patternCode?{code:message.patternCode,sender:from,recipient:to,variable:message.variables}:{sender:from,recipient:[to],message:message.text,description:{summary:'Shahrah',count_recipient:'1'}};
 if(contract==='LEGACY'&&message.patternCode)url='https://api2.ippanel.com/api/v1/sms/pattern/normal/send';
 if(contract==='FARAZ_PUBLIC'&&message.patternCode)url='https://api.iranpayamak.com/ws/v1/sms/pattern';
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),5000);
 try{const r=await fetcher(url,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json','Accept':'application/json',...(contract==='FARAZ_PUBLIC'?{'Api-Key':key}:contract==='EDGE'?{Authorization:key}:{Apikey:key})},body:JSON.stringify(body),signal:controller.signal});
  if(!r.ok){void r.body?.cancel().catch(()=>{});return {ok:false,error:providerError(r.status)};}
  const j=JSON.parse(await readSmsProviderBody(r));const id=contract==='FARAZ_PUBLIC'?j?.data:contract==='EDGE'?j?.data?.message_outbox_ids?.length===1?j.data.message_outbox_ids[0]:null:j?.data?.message_id;
  const success=contract==='FARAZ_PUBLIC'?[200,201].includes(r.status)&&j?.status==='success':contract==='EDGE'?j?.meta?.status===true:j?.code===200&&['OK','SUCCESS'].includes(String(j?.status).toUpperCase());
  const cleanId=String(id??''),validId=contract==='FARAZ_PUBLIC'?/^[A-Za-z0-9._:-]{1,100}$/.test(cleanId)&&!(typeof id==='number'&&(!Number.isSafeInteger(id)||id<0)):/^\d{1,30}$/.test(cleanId)&&!/^0+$/.test(cleanId);
  if(!success||!['string','number'].includes(typeof id)||!validId||cleanId.includes(key))return {ok:false,error:'سرویس، پذیرش معتبر پیامک و شناسهٔ پیگیری برنگرداند؛ موفقیت ثبت نشد.'};
  return {ok:true,messageId:cleanId};
 }catch(e:any){return {ok:false,error:e?.name==='AbortError'?'مهلت پاسخ سرویس پیامک تمام شد؛ نتیجهٔ ارسال نامشخص است. پیش از تکرار، پنل سرویس را بررسی کنید.':'ارتباط یا پاسخ سرویس پیامک معتبر نبود؛ پیش از تکرار، وضعیت ارسال در پنل سرویس بررسی شود.'};}finally{clearTimeout(timeout);}
}
