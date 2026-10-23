import {bankDigits} from './bank-identifiers';
export function rawRialInput(value:string):string{return bankDigits(value).replace(/[,٬]/g,'');}
export function formatRialInput(value:string|number):string {
  const raw=rawRialInput(String(value));return /^\d+$/.test(raw)?raw.replace(/\B(?=(\d{3})+(?!\d))/g,','):raw;
}
export function rialInputError(raw:string,min?:number|string,max?:number|string):string {
  if(!raw)return '';
  if(!/^\d+$/.test(raw)||!Number.isSafeInteger(Number(raw)))return 'مبلغ را به صورت عدد صحیح معتبر ریالی وارد کنید.';
  if(min!==undefined&&Number(raw)<Number(min))return `مبلغ نباید کمتر از ${formatRialInput(min)} ریال باشد.`;
  if(max!==undefined&&Number(raw)>Number(max))return `مبلغ نباید بیشتر از ${formatRialInput(max)} ریال باشد.`;
  return '';
}
