import React from 'react';
import {companySelected,toggleRoleCompany,type CompanyChoice} from '../utils/role-companies';

export function RoleCompanyAccess({value,onChange,companies,admin}:{value:string[];onChange:React.Dispatch<React.SetStateAction<string[]>>;companies:CompanyChoice[];admin:boolean}){
 const known=new Set(companies.flatMap(c=>[c.id,c.name])),legacy=[...new Set(value.filter(v=>!known.has(v.trim())))];
 return <section aria-label="شرکت‌های مجاز نقش" className="border border-slate-200 rounded-xl p-3 sm:p-4 space-y-3 bg-white">
  <h3 className="text-xs font-bold text-slate-900">شرکت‌های مجاز نقش</h3>
  <p className="text-[11px] text-slate-500 leading-relaxed">شرکت پروفایل کاربر فقط انتساب سازمانی اوست؛ اجازهٔ مشاهده و اقدام از این فهرست می‌آید. در چندنقشی، شرکت‌های مجاز نقش‌ها با هم جمع می‌شوند. انتخاب شرکت به‌تنهایی مجوز تأیید یا پرداخت نمی‌دهد.</p>
  {admin?<p className="text-xs text-blue-900 bg-blue-50 border border-blue-200 rounded-lg p-3">مدیر کل طبق قاعدهٔ فعلی به همهٔ شرکت‌ها دسترسی دارد؛ فهرست ذخیره‌شدهٔ این نقش در این بخش تغییر نمی‌کند.</p>:<p className="text-[11px] text-slate-500">بدون انتخاب شرکت، این نقش به اطلاعات هیچ شرکتی دسترسی ندارد. تغییر روی همهٔ کاربران دارای همین نقش اعمال می‌شود.</p>}
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{companies.map(company=><label key={company.id} className="flex items-start gap-2 p-3 border border-slate-200 rounded-lg text-xs cursor-pointer min-w-0"><input type="checkbox" aria-label={`مجوز شرکت: ${company.name}`} disabled={admin} checked={admin||companySelected(value,company)} onChange={e=>{const checked=e.target.checked;onChange(v=>toggleRoleCompany(v,company,checked));}} className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"/><span className="min-w-0 break-words">{company.name}{company.isActive===false&&<span className="text-slate-500"> (غیرفعال)</span>}</span></label>)}</div>
  {companies.length===0&&<p role="status" className="text-xs text-slate-500">شرکتی در محدودهٔ قابل مدیریت شما موجود نیست.</p>}
  {!admin&&legacy.length>0&&<div className="border border-amber-200 bg-amber-50 rounded-lg p-3 space-y-2"><p className="text-[11px] text-amber-900">این مقادیر قدیمی در فهرست فعلی شرکت‌ها پیدا نشدند. خودکار حذف یا به شرکت دیگری تبدیل نمی‌شوند؛ در صورت نیاز تیک آن‌ها را بردارید.</p>{legacy.map(v=><label key={v} className="flex items-start gap-2 text-xs text-amber-900 min-w-0"><input type="checkbox" aria-label={`مقدار قدیمی شرکت: ${v}`} checked onChange={()=>onChange(values=>values.filter(x=>x!==v))} className="mt-0.5 rounded border-amber-300"/><span className="break-words min-w-0">{v}</span></label>)}</div>}
 </section>;
}
