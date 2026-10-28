/** Ordinary return-for-correction is not the initial form editor or a route editor. */
export function ordinaryRevisionInput(body:Record<string,unknown>):{status:number;error:string}|null {
 const fields=['requesterId','itemType','requestId','rowId','expectedVersion','amount','description','newAttachments',...(body.itemType==='ADVANCE'?[]:['accountOrCard','iban','bankName'])];
 if(typeof body.itemType!=='string'||!['PAYMENT','ADVANCE','BATCH_ITEM'].includes(body.itemType)||typeof body.requestId!=='string'||!body.requestId||(body.itemType==='BATCH_ITEM'?typeof body.rowId!=='string'||!body.rowId:body.rowId!==undefined)||Object.keys(body).some(k=>!fields.includes(k)))return {status:400,error:'فقط اطلاعات مجاز اصلاح همان درخواست قابل ارسال است؛ مالک، نوع، شرکت و مسیر تأیید تغییر نمی‌کنند.'};
 if(body.description!==undefined&&(typeof body.description!=='string'||body.description.length>4000)||body.bankName!==undefined&&(typeof body.bankName!=='string'||body.bankName.length>4000)||body.newAttachments!==undefined&&!Array.isArray(body.newAttachments))return {status:400,error:'شرح، بانک یا مدارک اصلاح معتبر نیست.'};
 return null;
}
