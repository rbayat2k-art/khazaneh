import crypto from 'node:crypto';
import {inlineDocumentError} from './documents';
import type {TreasuryDatabaseState,User,PaymentRequest,ManualPayment} from '../types/treasury';
export type EntryOperation={key:string;fingerprint:string};
const text=(v:unknown)=>typeof v==='string'&&!!v.trim();
const common=['idempotencyKey','amount','description','orderedBy','actorId','actorUserId','treasuryUserId'];
export function externalInputError(body:any,manual:boolean):string|null{
 const allowed=[...common,...(manual?['payee','sourceBankAccountId','bankName','date','createdById','createdAtIso','bankRefNumber','receiptFileUrl','receiptFileName']:['payeeName','dueDate','costCenter','accountOrCard','iban','bankName','priority','invoiceNumber','attachments'])];
 if(Object.keys(body).some(k=>!allowed.includes(k)))return 'فیلد نامعتبر در ثبت خارج سامانه وجود دارد.';
 if(typeof body.idempotencyKey!=='string'||!/^pay-idem-[a-f0-9-]{36}$/.test(body.idempotencyKey))return 'شناسه ثابت پیگیری ثبت لازم است.';
 if(!((typeof body.amount==='number'||typeof body.amount==='string'&&/^\d+$/.test(body.amount))&&Number.isSafeInteger(Number(body.amount))&&Number(body.amount)>0))return 'مبلغ باید عدد صحیح مثبت و در محدوده دقت ریال باشد.';
 for(const k of ['description','orderedBy',manual?'payee':'payeeName',manual?'date':'dueDate'])if(!text(body[k])||body[k].length>4000)return 'شرح، گیرنده، مرجع دستور و تاریخ معتبر را کامل کنید.';
 if(manual){if(!text(body.sourceBankAccountId)||!text(body.bankRefNumber)||body.bankRefNumber.length>255)return 'حساب مبدأ و شماره پیگیری بانکی الزامی است.';return realReceiptError(body.receiptFileUrl,body.receiptFileName);}
 return null;
}
/** An uploaded supported file is required, not a generated SVG/internal receipt.
 * This validates the file format, not authenticity of the bank transaction. */
export function realReceiptError(value:unknown,name:unknown):string|null{
 const error='فیش واقعی پرداخت را با فایل معتبر PNG، JPG، WEBP، GIF یا PDF بارگذاری کنید.';
 if(!text(name)||(name as string).length>255||inlineDocumentError(value))return error;
 const match=/^data:([^;]+);base64,(.+)$/i.exec(value as string);if(!match)return error;const b=Buffer.from(match[2],'base64'),mime=match[1].toLowerCase();
 const good=mime==='image/png'?b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):mime==='image/jpeg'?b.length>=3&&b[0]===255&&b[1]===216&&b[2]===255:mime==='application/pdf'?b.subarray(0,5).toString()==='%PDF-':mime==='image/gif'?['GIF87a','GIF89a'].includes(b.subarray(0,6).toString()):mime==='image/webp'&&b.subarray(0,4).toString()==='RIFF'&&b.subarray(8,12).toString()==='WEBP';return good?null:error;
}
function canonical(v:any):any{return Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;}
export function entryOperation(body:any,manual:boolean,user:User):EntryOperation{
 const {idempotencyKey,actorId,actorUserId,treasuryUserId,createdById,createdAtIso,bankName,...payload}=body;
 // The selected source account, not a caller's display label, owns manual bank identity.
 const content={...payload,amount:Number(payload.amount),...(!manual?{bankName:bankName||''}:{})};
 return {key:idempotencyKey,fingerprint:crypto.createHash('sha256').update(JSON.stringify(canonical({kind:manual?'MANUAL':'EXTERNAL_ORDER',actor:user.id,company:user.company,content}))).digest('hex')};
}
export function previousEntry(db:TreasuryDatabaseState,operation:EntryOperation,manual:boolean,user:User):{row?:PaymentRequest|ManualPayment;status?:number;error?:string}{
 const found=[...db.paymentRequests,...db.manualPayments].find(r=>r.entryOperation?.key===operation.key);if(!found)return {};
 if(('createdById'in found?found.createdById:found.requesterId)!==user.id)return{status:403,error:'دسترسی به نتیجه این ثبت مجاز نیست.'};
 if(('createdById'in found)!==manual||found.entryOperation?.fingerprint!==operation.fingerprint)return{status:409,error:'این شناسه قبلاً با محتوای دیگری استفاده شده است؛ نتیجه قبلی را بررسی کنید.'};
 return{row:found};
}
