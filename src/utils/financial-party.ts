/** Personnel identity and a bank destination are different even when their names match. */
export function isPersonnelAdvance(kind:string,parent:any,row:any=parent){return kind==='ADVANCE'||(kind==='BATCH'||kind==='BATCH_ITEM')&&(parent.batchType==='ADVANCE'||row.itemType==='ADVANCE');}
export function personnelName(kind:string,parent:any,row:any=parent){return kind==='ADVANCE'?parent.requesterName||'':row.payeeName||'';}
export function currentBankPayeeName(row:any){const r=row.bankInquiry;return row.bankPayeeName&&(!r||r.status==='FOUND'&&r.ownerConfirmed===true&&!r.destinationReviewRequired&&r.code!=='STALE_RESULT')?row.bankPayeeName:'';}
export function destinationRecipient(kind:string,parent:any,row:any=parent){return currentBankPayeeName(row)||(isPersonnelAdvance(kind,parent,row)?'':row.payeeName||row.payee||'');}
/** Old confirmations may have replaced a group personnel name. Preserve and disclose, never infer a replacement. */
export function legacyPersonnelNameWarning(kind:string,parent:any,row:any=parent){const last=row.bankOwnerConfirmations?.at(-1);return kind==='BATCH_ITEM'&&isPersonnelAdvance(kind,parent,row)&&!row.bankPayeeName&&last?.bankName===row.payeeName?'نام این ردیف در سابقه با تأیید بانکی تغییر کرده است؛ نام پیش از تغییر را در گردش بررسی کنید.':'';}
export function paymentPurpose(row:any,parent:any=row){return String(row.description||parent.title||'').trim();}
export function purposeLines(value:string){const lines=value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);return{primary:lines[0]||'',additional:lines.slice(1).join('\n')};}

/** Presentation only: never persist this instruction as a card or bank holder. */
export const PERSONNEL_CARD_COMPLETION='شماره کارت از اطلاعات پرسنلی و طبق حساب اعلام‌شدهٔ نیرو تکمیل شود.';
export function isPersonnelDisbursement(kind:string,parent:any,row:any=parent){return isPersonnelAdvance(kind,parent,row)||kind==='PAYMENT'&&row.personnelBalanceRef?.schemaVersion===1;}
export function personnelCardCompletion(kind:string,parent:any,row:any=parent){return isPersonnelDisbursement(kind,parent,row)&&!String(row.accountOrCard||'').trim()?PERSONNEL_CARD_COMPLETION:'';}
