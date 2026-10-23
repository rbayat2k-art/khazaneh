export type ReportCell=string|number;
export type ReportRow=Record<string,ReportCell>;
export function validateReportRows(rows:ReportRow[]){for(const row of rows)for(const value of Object.values(row))if(typeof value!=='string'&&(typeof value!=='number'||!Number.isSafeInteger(value)||value<0))throw Error('نوع داده گزارش معتبر نیست؛ خروجی تهیه نشد.');}
export function rialCell(value:number|bigint):ReportCell{if(typeof value==='number'&&(!Number.isSafeInteger(value)||value<0))throw Error('مبلغ گزارش باید ریال صحیح و در محدوده دقت مجاز باشد.');const n=BigInt(value);if(n<0n)throw Error('مبلغ گزارش منفی معتبر نیست.');return n>999999999999999n?String(n):Number(n);}
/** Never treat a card as an account number or a stale/unconfirmed lookup as current evidence. */
export function confirmedDestinationAccount(row:any):string{const r=row?.bankInquiry;return r?.status==='FOUND'&&r.ownerConfirmed&&!r.destinationReviewRequired&&['02','03'].includes(r.depositStatus)&&r.iban===row.iban&&r.deposit?String(r.deposit):'';}
