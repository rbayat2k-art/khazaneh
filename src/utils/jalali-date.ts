import {bankDigits} from './bank-identifiers';

const dayMs=86400000;
const formatter=new Intl.DateTimeFormat('en-US-u-ca-persian',{timeZone:'UTC',year:'numeric',month:'2-digit',day:'2-digit'});
export function jalaliFromEpoch(epoch:number):string {
  const parts=formatter.formatToParts(new Date(epoch)),part=(kind:string)=>parts.find(p=>p.type===kind)?.value||'';
  return `${part('year')}/${part('month')}/${part('day')}`;
}
const starts=new Map<number,number>();
// Calendar arithmetic is pure and public: retain only bounded canonical dates,
// never records, users, permissions or a decision about allowed request dates.
const epochs=new Map<string,number>();
function yearStart(year:number):number {
  if(!starts.has(year))for(let day=18;day<=23;day++){
    const epoch=Date.UTC(year+621,2,day,12);
    if(jalaliFromEpoch(epoch)===`${year}/01/01`){starts.set(year,epoch);break;}
  }
  return starts.get(year)??NaN;
}
export function normalizeDateDigits(value:string):string{return bankDigits(value).trim();}
export function jalaliEpoch(value:string):number {
  const canonical=normalizeDateDigits(value);
  if(!/^1\d{3}\/(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])$/.test(canonical))return NaN;
  if(epochs.has(canonical))return epochs.get(canonical)!;
  const [year,month,day]=canonical.split('/').map(Number);
  const epoch=yearStart(year)+((month<=6?(month-1)*31:186+(month-7)*30)+day-1)*dayMs;
  const result=jalaliFromEpoch(epoch)===canonical?epoch:NaN;
  if(epochs.size>=1024)epochs.delete(epochs.keys().next().value!);epochs.set(canonical,result);
  return result;
}
export function jalaliDateError(value:unknown,minimum?:string):string|null {
  if(value===undefined||value==='')return null;
  if(typeof value!=='string'||!Number.isFinite(jalaliEpoch(value)))return 'تاریخ شمسی معتبر با قالب 1405/04/10 وارد کنید.';
  if(minimum&&normalizeDateDigits(value)<minimum)return 'تاریخ درخواست جدید نمی‌تواند قبل از امروز باشد.';
  return null;
}
export function jalaliMonthDays(year:number,month:number):number {
  if(month<=6)return 31;if(month<12)return 30;
  return Number.isFinite(jalaliEpoch(`${year}/12/30`))?30:29;
}
export function jalaliWeekday(year:number,month:number):number{return (new Date(jalaliEpoch(`${year}/${String(month).padStart(2,'0')}/01`)).getUTCDay()+1)%7;}
