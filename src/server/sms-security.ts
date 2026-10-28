import type {SmsDispatchLogEntry} from '../types/treasury';
export const maskSmsPhone=(phone:string)=>/^09•••••\d{4}$/.test(phone)?phone:/^09\d{9}$/.test(phone)?'09•••••'+phone.slice(-4):'شماره ثبت‌شده';
export const privateSmsEvent=(event:string)=>['OTP_RECOVERY','ADMIN_PASSWORD_RESET','PASSWORD_RESET'].includes(event);
/** Also protects historical logs at the read boundary, without rewriting real data. */
export function safeSmsLog<T extends SmsDispatchLogEntry>(entry:T):T{
  if(['ADMIN_TEST','ADMIN_TEST_SMS'].includes(entry.eventType))return {...entry,recipientPhone:maskSmsPhone(entry.recipientPhone),messagePreview:'آزمون اتصال پیامک؛ متن آزمایشی ذخیره نمی‌شود.',messageSummary:'آزمون اتصال پیامک؛ متن آزمایشی ذخیره نمی‌شود.'};
  if(!privateSmsEvent(entry.eventType))return entry;
  const preview='پیام امنیتی حساب کاربری؛ متن و کد محرمانه ثبت یا نمایش داده نمی‌شود.';
  return {...entry,messagePreview:preview,messageSummary:preview,providerMessageId:null,errorDetail:entry.errorDetail?'ارسال پیام امنیتی ناموفق بود.':null,errorMessage:entry.errorMessage?'ارسال پیام امنیتی ناموفق بود.':null};
}
export async function readSmsProviderBody(response:Response):Promise<string>{
  if(!response.body)return '';const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;
  try{while(true){const result=await reader.read();if(result.done)break;size+=result.value.byteLength;if(size>65536){void reader.cancel().catch(()=>{});throw Error('provider body limit');}chunks.push(result.value);}return Buffer.concat(chunks).toString('utf8');}finally{reader.releaseLock();}
}
