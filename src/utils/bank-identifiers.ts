// Shared boundary rules. Formatting must never truncate, pad or discard invalid letters.
export const CARD_ERROR='شماره کارت باید دقیقاً ۱۶ رقم باشد.';
export const IBAN_ERROR='شماره شبا باید IR و دقیقاً ۲۴ رقم باشد.';
export function bankDigits(value:string):string{return value.replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)));}
export function normalizeCard(value:string):string{return bankDigits(value).replace(/[\s-]/g,'');}
export function normalizeIban(value:string):string{const v=bankDigits(value).replace(/[\s-]/g,'').toUpperCase();return /^\d+$/.test(v)?'IR'+v:v;}
// Legacy non-string values are repairs, never evidence that the approved identifier is unchanged.
export function bankIdentifierChanged(next:string|undefined,previous:unknown,kind:'CARD'|'IBAN'):boolean{
  if(next===undefined)return false;
  if(previous!=null&&typeof previous!=='string')return true;
  const normalize=kind==='CARD'?normalizeCard:normalizeIban;
  return normalize(next)!==normalize(typeof previous==='string'?previous:'');
}
export function bankFieldsError(fields:{accountOrCard?:unknown;cardNumber?:unknown;iban?:unknown}):string|null{
  for(const key of ['accountOrCard','cardNumber'] as const){const v=fields[key];if(v!==undefined&&(typeof v!=='string'||(normalizeCard(v)!==''&&!/^\d{16}$/.test(normalizeCard(v)))))return CARD_ERROR;}
  const v=fields.iban;if(v!==undefined&&(typeof v!=='string'||(normalizeIban(v)!==''&&!/^IR\d{24}$/.test(normalizeIban(v)))))return IBAN_ERROR;
  return null;
}
export function normalizedBankFields<T extends {accountOrCard?:string;cardNumber?:string;iban?:string}>(fields:T):T{
  const result={...fields};for(const key of ['accountOrCard','cardNumber'] as const)if(typeof fields[key]==='string')(result as any)[key]=normalizeCard(fields[key]!);
  if(typeof fields.iban==='string')result.iban=normalizeIban(fields.iban);return result;
}
