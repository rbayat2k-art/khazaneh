import type {RequestApprovalType,RequestApprovers,User} from '../types/treasury';
export const REQUEST_APPROVAL_TYPES:ReadonlyArray<{key:RequestApprovalType;label:string}>=[
 {key:'ADVANCE_SINGLE',label:'مساعده حقوق تکی'}, {key:'ADVANCE_BATCH',label:'مساعده گروهی پرسنل'},
 {key:'PAYMENT_SINGLE',label:'دستور پرداخت تکی'}, {key:'PAYMENT_BATCH',label:'دستور پرداخت گروهی (تجمیعی)'},
];
export function isDirectAccountingRoute(value:unknown):value is {mode:'ACCOUNTING'}{return !!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===1&&Object.hasOwn(value,'mode')&&(value as {mode:unknown}).mode==='ACCOUNTING';}
export function parseRequestApprovers(value:unknown):{value?:RequestApprovers;error?:string}{
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!REQUEST_APPROVAL_TYPES.some(t=>t.key===k)))return {error:'ساختار تأییدکنندگان انواع درخواست معتبر نیست.'};
 const result:RequestApprovers={};for(const {key}of REQUEST_APPROVAL_TYPES)if(Object.hasOwn(value,key)){const route=(value as Record<string,unknown>)[key];if(isDirectAccountingRoute(route)){result[key]={mode:'ACCOUNTING'};continue;}if(typeof route!=='string'||!route.trim())return {error:'مسیر باید تأییدکننده معتبر یا مستقیم به حسابداری باشد؛ برای مسیر پیش‌فرض، انتخاب اختصاصی را بردارید.'};result[key]=route.trim();}
 return {value:result};
}
export function sameRequestApprovers(a:RequestApprovers|undefined,b:RequestApprovers|undefined){return REQUEST_APPROVAL_TYPES.every(({key})=>isDirectAccountingRoute(a?.[key])?isDirectAccountingRoute(b?.[key]):a?.[key]===b?.[key]);}
export function requestApproverId(user:Pick<User,'supervisorId'|'requestApprovers'>,type:RequestApprovalType):string|null{const route=user.requestApprovers?.[type];return isDirectAccountingRoute(route)?null:typeof route==='string'?route:user.supervisorId||null;}
