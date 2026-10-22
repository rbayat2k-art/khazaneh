import type {ItemAuditEntry,User} from '../types/treasury';
export function reviewEditError(action:unknown,amount:unknown,reason:unknown,comment:unknown):string|null{
  if(comment!==undefined&&(typeof comment!=='string'||comment.length>4000))return 'یادداشت رسمی باید متن معتبر، حداکثر۴۰۰۰کاراکتر باشد.';
  if(!['UPDATE_AMOUNT_COMMENT','UPDATE_AND_APPROVE'].includes(String(action)))return null;
  if(!Number.isSafeInteger(amount)||Number(amount)<=0)return 'مبلغ باید عدد صحیح مثبت به ریال باشد.';
  if(typeof reason!=='string'||!reason.replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g,'').trim()||reason.length>2000)return 'ثبت دلیل تغییر مبلغ الزامی است؛ حداکثر۲۰۰۰کاراکتر.';
  return null;
}
export function reviewEditEntry(reviewer:User,stage:'APPROVER'|'ACCOUNTING',date:string,oldAmount:number,newAmount:number,reason:string,comment?:string):ItemAuditEntry{
  return {id:crypto.randomUUID(),action:'ویرایش مبلغ و ثبت یادداشت رسمی',actorId:reviewer.id,actorRole:reviewer.role,stage,decision:'UPDATE_AMOUNT',changedBy:reviewer.name,changedAt:date,previousAmount:oldAmount,newAmount,reason:reason.trim(),comment:comment?.trim()||undefined};
}
