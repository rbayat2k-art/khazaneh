import {normalizeDateDigits,jalaliDateError} from './jalali-date';
export interface TimedRecord {createdAt?:string;createdAtIso?:string;createdAtIsValueDate?:boolean;paidAt?:string|null;paidDateJalali?:string|null;executedAt?:string;status?:string;paidAmount?:number;paidAmountSoFar?:number;paymentHistory?:Array<{paidAt?:string;executedAt?:string}>;paymentExecutions?:Array<{paidAt?:string;executedAt?:string}>;}
export interface RequestTimeFields {registrationDate:string;registrationTime:string;registrationOrder:string;registrationClockOrder:string;treasuryActionDate:string;treasuryActionTime:string;treasuryActionOrder:string;treasuryActionClockOrder:string;}
const clock=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Tehran',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
const calendar=new Intl.DateTimeFormat('en-US-u-ca-persian',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'});
function instant(value:unknown):number{
 if(typeof value!=='string')return NaN;
 const match=/^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.\d{1,3})?(Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(value);if(!match)return NaN;
 const date=new Date(Date.UTC(+match[1],+match[2]-1,+match[3]));if(date.getUTCFullYear()!==+match[1]||date.getUTCMonth()!==+match[2]-1||date.getUTCDate()!==+match[3])return NaN;
 return Date.parse(value);
}
function absolute(epoch:number){const date=new Date(epoch),parts=calendar.formatToParts(date),part=(kind:string)=>parts.find(p=>p.type===kind)?.value||'',day=`${part('year')}/${part('month')}/${part('day')}`,time=clock.format(date);return {date:day,time,order:`${day} ${time}.${String(date.getUTCMilliseconds()).padStart(3,'0')}`};}
function registration(row:TimedRecord){
 const epoch=instant(row.createdAtIso);if(Number.isFinite(epoch))return absolute(epoch);
 if(row.createdAtIsValueDate)return {date:'ثبت نشده',time:'ثبت نشده',order:''};
 const raw=normalizeDateDigits(row.createdAt||''),oldEpoch=instant(raw);if(Number.isFinite(oldEpoch))return absolute(oldEpoch);
 const match=/^(1\d{3}\/\d{2}\/\d{2})(?:\s*-\s*([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?)?$/.exec(raw);
 if(!match||jalaliDateError(match[1]))return {date:'ثبت نشده',time:'ثبت نشده',order:''};
 // A historical local clock has no offset; retain its recorded text, never convert/invent one.
 const time=match[2]?`${match[2]}:${match[3]}${match[4]?':'+match[4]:''}`:'';
 return {date:match[1],time:time||'ثبت نشده',order:match[1]+(time?' '+time:'')};
}
export function requestTimeFields(row:TimedRecord,paymentRows:TimedRecord[]=[row]):RequestTimeFields{
 const created=registration(row);let latest=NaN,hadPayment=false;
 for(const r of paymentRows){hadPayment||=r.status==='Paid'||Number(r.paidAmount)>0||Number(r.paidAmountSoFar)>0||!!r.paymentHistory?.length||!!r.paymentExecutions?.length;
  for(const record of [r,...r.paymentHistory||[],...r.paymentExecutions||[]])for(const value of [record.paidAt,record.executedAt]){const epoch=instant(value);if(Number.isFinite(epoch)&&(!Number.isFinite(latest)||epoch>latest))latest=epoch;}
 }
 const action=Number.isFinite(latest)?absolute(latest):{date:hadPayment?'ثبت نشده':'—',time:hadPayment?'ثبت نشده':'—',order:''};
 return {registrationDate:created.date,registrationTime:created.time,registrationOrder:created.order,registrationClockOrder:created.order,treasuryActionDate:action.date,treasuryActionTime:action.time,treasuryActionOrder:action.order,treasuryActionClockOrder:action.order};
}
/** Unknown clocks stay unranked after known clocks on the same day, in either direction. */
export function compareEventOrder(a:unknown,b:unknown,direction:'asc'|'desc'):number{
 const left=String(a||''),right=String(b||''),multiplier=direction==='asc'?1:-1;if(!left||!right)return left?-1:right?1:0;
 const day=left.slice(0,10).localeCompare(right.slice(0,10));if(day)return day*multiplier;
 const clockA=left.slice(11),clockB=right.slice(11);if(!clockA||!clockB)return clockA?-1:clockB?1:0;return clockA.localeCompare(clockB)*multiplier;
}
