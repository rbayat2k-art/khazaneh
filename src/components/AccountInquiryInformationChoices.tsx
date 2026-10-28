import React from 'react';
import {ACCOUNT_INFORMATION_LABELS,type AccountInformation} from '../types/account-inquiry';

export function AccountInquiryInformationChoices({value,onChange,required=false}:{value:AccountInformation[];onChange:(value:AccountInformation[])=>void;required?:boolean}){
 return <fieldset className="space-y-1">
  <legend className="text-xs font-semibold text-slate-700 mb-1">اطلاعات موردنیاز{required?' *':''}</legend>
  <div className="grid w-full max-w-xl grid-cols-1 sm:grid-cols-3 gap-2">
   {Object.entries(ACCOUNT_INFORMATION_LABELS).map(([key,label])=>{
    const choice=key as AccountInformation,selected=value.includes(choice);
    return <label key={key} className="relative block cursor-pointer">
     <input type="checkbox" aria-label={label} className="peer sr-only" checked={selected} onChange={e=>onChange(e.target.checked?[...value,choice]:value.filter(item=>item!==choice))}/>
     <span className={'flex min-h-8 w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-1 text-[11px] transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue-600 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 '+(selected?'border-emerald-300 bg-emerald-50 text-emerald-900 font-semibold':'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}>
      <span>{label}</span>
      {selected&&<span aria-hidden="true" className="text-[10px] font-normal">انتخاب‌شده</span>}
     </span>
    </label>;
   })}
  </div>
 </fieldset>;
}
