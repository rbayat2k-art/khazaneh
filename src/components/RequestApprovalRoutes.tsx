import React from 'react';
import type {RequestApprovers,User} from '../types/treasury';
import {REQUEST_APPROVAL_TYPES,isDirectAccountingRoute} from '../utils/request-approval-routing';

export function RequestApprovalRoutes({value,onChange,candidates,users,supervisorId,disabled,saving}:{value:RequestApprovers;onChange:(value:RequestApprovers)=>void;candidates:(User&{supervisorSelectionIssue?:string})[];users:User[];supervisorId:string;disabled:boolean;saving:boolean}){
 const supervisor=users.find(u=>u.id===supervisorId);
 return <fieldset disabled={disabled||saving} className="border border-slate-200 rounded-xl p-3 space-y-3" aria-label="تأییدکننده انواع درخواست کاربر">
  <legend className="text-xs font-bold text-slate-700 px-1">مسیر تأیید انواع درخواست</legend>
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{REQUEST_APPROVAL_TYPES.map(({key,label})=>{const selected=value[key],selectedId=typeof selected==='string'?selected:null;return <label key={key} className="block text-xs font-semibold text-slate-700">{label}
   <select aria-label={'تأییدکننده '+label} value={isDirectAccountingRoute(selected)?'ACCOUNTING':selectedId?'USER:'+selectedId:''} onChange={e=>{const next={...value};if(e.target.value==='ACCOUNTING')next[key]={mode:'ACCOUNTING'};else if(e.target.value.startsWith('USER:'))next[key]=e.target.value.slice(5);else delete next[key];onChange(next);}} className="block mt-1 w-full min-w-0 px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600">
    <option value="">{supervisorId?`پیش‌فرض: ${supervisor?.name||'سرپرست مستقیم'}`:'پیش‌فرض: مستقیم به حسابداری'}</option>
    <option value="ACCOUNTING">مستقیم به حسابداری</option>
    {selectedId&&!candidates.some(u=>u.id===selectedId)&&<option value={'USER:'+selectedId} disabled>{users.find(u=>u.id===selectedId)?.name||'تأییدکننده فعلی'} (انتخاب فعلی؛ نیازمند بررسی صلاحیت)</option>}
    {candidates.map(u=><option key={u.id} value={'USER:'+u.id} disabled={!!u.supervisorSelectionIssue}>{u.name} — {u.department}{u.supervisorSelectionIssue?' — '+u.supervisorSelectionIssue:''}</option>)}
   </select>
  </label>;})}</div>
  <p className="text-[11px] text-slate-500 leading-relaxed">فقط ثبت‌های جدید از این تنظیم استفاده می‌کنند؛ درخواست‌های قبلی جابه‌جا نمی‌شوند. پیش‌فرض، مسیر سرپرست سازمانی است؛ «مستقیم به حسابداری» فقط برای همان نوع درخواست تأیید سرپرست را حذف می‌کند. سرپرست سازمانی و مسیر انواع دیگر تغییر نمی‌کنند.</p>
  {disabled&&<p className="text-[11px] text-slate-600">مسیر تأیید حساب خودتان قابل تغییر نیست؛ مدیر مجاز دیگری باید آن را تنظیم کند.</p>}
 </fieldset>;
}
