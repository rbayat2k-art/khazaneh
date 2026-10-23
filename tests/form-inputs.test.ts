import {test} from 'node:test';
import assert from 'node:assert/strict';
import {jalaliDateError,jalaliEpoch,jalaliFromEpoch,jalaliMonthDays,jalaliWeekday} from '../src/utils/jalali-date';
import {formatRialInput,rawRialInput,rialInputError} from '../src/utils/rial-input';
import {todayJalali} from '../src/utils/current-date';
import {normalizeFormDates} from '../src/server/form-dates';
test('Jalali dates validate real months, leap Esfand and canonical format, not Gregorian lookalikes',()=>{
 for(const date of ['1405/04/10','۱۴۰۵/۰۴/۱۰','١٤٠٥/٠٤/١٠','1403/12/30','1404/12/29'])assert.equal(jalaliDateError(date),null,date);
 for(const date of ['2026/10/23','1405/07/31','1404/12/30','1405/13/01','1405/00/10','1405/01/00','1405/4/10','1405-04-10','1405/04/100',7,null])assert.ok(jalaliDateError(date),String(date));
 assert.equal(jalaliMonthDays(1403,12),30);assert.equal(jalaliMonthDays(1404,12),29);
});
test('calendar round trips month boundaries through the runtime Persian calendar',()=>{
 for(const year of [1000,1300,1399,1400,1403,1404,1405,1410,1499,1999])for(let month=1;month<=12;month++)for(const day of [1,jalaliMonthDays(year,month)]){
  const text=`${year}/${String(month).padStart(2,'0')}/${String(day).padStart(2,'0')}`;
  assert.equal(jalaliFromEpoch(jalaliEpoch(text)),text);assert.ok(jalaliWeekday(year,month)>=0&&jalaliWeekday(year,month)<=6);
 }
});
test('minimum applies to new request fields only and Tehran midnight is authoritative',()=>{
 assert.equal(todayJalali(new Date('2026-10-22T20:29:59Z')),'1405/07/30');
 assert.equal(todayJalali(new Date('2026-10-22T20:30:00Z')),'1405/08/01');
 assert.ok(jalaliDateError('1405/04/10','1405/04/11'));assert.equal(jalaliDateError('1405/04/10'),null);
 const historical={date:'۱۴۰۳/۰۱/۰۱'};assert.equal(normalizeFormDates(historical,['date']),null);assert.equal(historical.date,'1403/01/01');
 assert.ok(normalizeFormDates({dueDate:'1403/01/01'},['dueDate'],true));
 const unknown={date:'2026-10-23'};assert.ok(normalizeFormDates(unknown,['date']));assert.equal(unknown.date,'2026-10-23');
});
test('rial grouping preserves exact safe digits, strips only separators and rejects unsafe numeric spellings',()=>{
 assert.equal(formatRialInput('200000000'),'200,000,000');assert.equal(rawRialInput('۲۰۰٬۰۰۰٬۰۰۰'),'200000000');
 assert.equal(formatRialInput(Number.MAX_SAFE_INTEGER),'9,007,199,254,740,991');
 for(const value of ['1.5','1e3','-1','NaN','9007199254740992','abc'])assert.ok(rialInputError(rawRialInput(value)),value);
 assert.equal(rialInputError('',1),'');assert.ok(rialInputError('0',1));assert.equal(rialInputError('0',0),'');assert.ok(rialInputError('101',0,100));
});
