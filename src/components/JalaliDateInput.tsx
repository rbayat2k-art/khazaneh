import React,{useEffect,useId,useRef,useState} from 'react';
import {CalendarDays,ChevronLeft,ChevronRight} from 'lucide-react';
import {todayJalali} from '../utils/current-date';
import {jalaliDateError,jalaliEpoch,jalaliMonthDays,jalaliWeekday,normalizeDateDigits} from '../utils/jalali-date';
const months=['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
type Props=Omit<React.InputHTMLAttributes<HTMLInputElement>,'min'> & {minDate?:string};
export function JalaliDateInput({value='',onChange,className='',minDate,...props}:Props){
  const ref=useRef<HTMLInputElement>(null),[open,setOpen]=useState(false),[blocked,setBlocked]=useState(false),id=useId();
  const canonical=normalizeDateDigits(String(value));
  const initial=Number.isFinite(jalaliEpoch(canonical))?canonical:todayJalali();
  const [page,setPage]=useState(()=>initial.split('/').slice(0,2).map(Number));const [year,month]=page;
  useEffect(()=>{ref.current?.setCustomValidity(blocked?'تاریخ شمسی معتبر با قالب 1405/04/10 وارد کنید.':jalaliDateError(value,minDate)||'');},[value,minDate,blocked]);
  const choose=(date:string)=>{const input=ref.current!;setBlocked(false);input.value=date;input.setCustomValidity('');onChange?.({target:input,currentTarget:input} as React.ChangeEvent<HTMLInputElement>);setOpen(false);input.focus();};
  const changeMonth=(delta:number)=>{let m=month+delta,y=year;if(m<1){m=12;y--;}if(m>12){m=1;y++;}if(y>=1000&&y<=1999)setPage([y,m]);};
  return <div className="relative" onKeyDown={e=>{if(open&&e.key==='Escape'){e.stopPropagation();setOpen(false);ref.current?.focus();}}}>
    <input {...props} ref={ref} data-form-value="jalali" type="text" dir="ltr" inputMode="numeric" placeholder="1405/04/10" maxLength={10}
      pattern="1[0-9]{3}/(0[1-9]|1[0-2])/(0[1-9]|[12][0-9]|3[01])" value={canonical} className={`${className} pl-9`} onChange={e=>{setBlocked(false);e.target.value=normalizeDateDigits(e.target.value);e.target.setCustomValidity(jalaliDateError(e.target.value,minDate)||'');onChange?.(e);}}
      onPaste={e=>{e.preventDefault();const input=e.currentTarget,next=normalizeDateDigits(canonical.slice(0,input.selectionStart??0)+e.clipboardData.getData('text')+canonical.slice(input.selectionEnd??canonical.length));const error=jalaliDateError(next,minDate);if(error){setBlocked(true);input.setCustomValidity(error);input.reportValidity();}else choose(next);}}/>
    <button type="button" disabled={props.disabled} aria-label={`تقویم شمسی ${props['aria-label']||''}`.trim()} aria-expanded={open} aria-controls={id} onClick={()=>{if(!open){const date=Number.isFinite(jalaliEpoch(canonical))?canonical:todayJalali();setPage(date.split('/').slice(0,2).map(Number));}setOpen(v=>!v);}} className="absolute left-1.5 top-1.5 p-1 text-slate-500 hover:text-blue-700 rounded"><CalendarDays className="w-4 h-4"/></button>
    {open&&<div id={id} role="group" aria-label="تقویم شمسی" className="mt-2 p-3 bg-white border border-slate-200 rounded-xl shadow-lg max-w-sm space-y-3" dir="rtl">
      <div className="flex items-center gap-2"><button type="button" aria-label="ماه قبل" onClick={()=>changeMonth(-1)} className="p-1 rounded hover:bg-slate-100"><ChevronRight className="w-4 h-4"/></button>
        <select aria-label="ماه تقویم" value={month} onChange={e=>setPage([year,Number(e.target.value)])} className="min-w-0 flex-1 p-1 text-xs border border-slate-200 rounded">{months.map((m,i)=><option key={m} value={i+1}>{m}</option>)}</select>
        <select aria-label="سال تقویم" value={year} onChange={e=>setPage([Number(e.target.value),month])} className="min-w-0 flex-1 p-1 text-xs border border-slate-200 rounded">{Array.from({length:1000},(_,i)=>1000+i).map(y=><option key={y} value={y}>{y}</option>)}</select>
        <button type="button" aria-label="ماه بعد" onClick={()=>changeMonth(1)} className="p-1 rounded hover:bg-slate-100"><ChevronLeft className="w-4 h-4"/></button></div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs">{['ش','ی','د','س','چ','پ','ج'].map((d,i)=><span key={i} className="text-slate-500 p-1">{d}</span>)}
        {Array.from({length:jalaliWeekday(year,month)},(_,i)=><span key={`blank-${i}`}/>)}
        {Array.from({length:jalaliMonthDays(year,month)},(_,i)=>i+1).map(day=>{const date=`${year}/${String(month).padStart(2,'0')}/${String(day).padStart(2,'0')}`,disabled=!!minDate&&date<minDate;return <button key={day} type="button" disabled={disabled} aria-label={`انتخاب ${date}`} aria-pressed={canonical===date} onClick={()=>choose(date)} className={`p-2 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed ${canonical===date?'bg-blue-700 text-white':'hover:bg-blue-50 text-slate-800'}`}>{day}</button>;})}</div>
      <div className="flex justify-between text-xs"><button type="button" onClick={()=>choose(todayJalali())} className="text-blue-700 px-2 py-1">امروز</button><button type="button" onClick={()=>{setOpen(false);ref.current?.focus();}} className="text-slate-600 px-2 py-1">بستن تقویم</button></div>
    </div>}
  </div>;
}
