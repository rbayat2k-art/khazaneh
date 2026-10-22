import React,{useEffect,useRef,useState} from 'react';
import {Plus,Save,Trash2,X} from 'lucide-react';
import type {BulkMasterDataKind,BulkMasterDataRow,OrganizationCompany,OrganizationalDepartment} from '../types/treasury';
type Props={kind:BulkMasterDataKind;companies:OrganizationCompany[];departments:OrganizationalDepartment[];initialCompanyId:string;onClose:()=>void;onSave:(kind:BulkMasterDataKind,rows:BulkMasterDataRow[])=>Promise<{ok:boolean;error?:string}>};
type Draft={key:string;name:string;description:string};
const blank=():Draft=>({key:crypto.randomUUID(),name:'',description:''});
const control='w-full min-w-0 px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600';
export function MasterDataBulkDialog({kind,companies,departments,initialCompanyId,onClose,onSave}:Props){
  const centers=kind==='cost-centers',label=centers?'مراکز هزینه':'واحدهای سازمانی';
  const activeCompanies=companies.filter(c=>c.isActive!==false);
  const [companyId,setCompanyId]=useState(activeCompanies.some(c=>c.id===initialCompanyId)?initialCompanyId:''),[departmentId,setDepartmentId]=useState(''),[category,setCategory]=useState('عملیاتی');
  const [rows,setRows]=useState<Draft[]>(()=>[blank(),blank(),blank()]),[paste,setPaste]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const panel=useRef<HTMLDivElement>(null),company=useRef<HTMLSelectElement>(null);
  useEffect(()=>{const previous=document.activeElement as HTMLElement;company.current?.focus();return()=>{if(previous?.isConnected)previous.focus();};},[]);
  const filled=rows.filter(r=>r.name.trim()||r.description.trim());
  function change(key:string,field:'name'|'description',value:string){setRows(previous=>{const next=previous.map(r=>r.key===key?{...r,[field]:value}:r);if(next.length<200&&next.at(-1)?.name.trim())next.push(blank());return next;});}
  function addPasted(){
    const lines=paste.split(/\r?\n/).filter(line=>line.trim());
    if(!lines.length){setError('ابتدا نام‌ها را وارد یا پیست کنید.');return;}
    if(lines.some(line=>line.split('\t').length>2)){setError('حداکثر دو ستون پیست کنید: نام و توضیحات.');return;}
    if(filled.length+lines.length>200){setError('هر گروه حداکثر۲۰۰ردیف است.');return;}
    const added=lines.map(line=>{const [name,description='']=line.split('\t');return {...blank(),name:name.trim(),description:description.trim()};});
    setRows([...filled,...added,...(filled.length+added.length<200?[blank()]:[])]);setPaste('');setError('');
  }
  async function save(event:React.FormEvent){
    event.preventDefault();if(busy)return;setError('');
    if(!companyId||!filled.length){setError('شرکت و حداقل یک ردیف دارای نام الزامی است.');return;}
    const invalid=rows.findIndex(r=>(r.name.trim()||r.description.trim())&&!r.name.trim());
    if(invalid>=0){setError(`نام ردیف ${invalid+1} را تکمیل کنید.`);return;}
    setBusy(true);
    try {const result=await onSave(kind,filled.map(row=>({name:row.name.trim(),description:row.description.trim(),companyId,...(centers?{departmentId:departmentId||null,budgetCategory:category}:{})})));if(result.ok)onClose();else setError(result.error||'ثبت گروه انجام نشد.');}
    catch{setError('پاسخ ثبت دریافت نشد؛ پیش از تلاش دوباره فهرست را تازه‌سازی و بررسی کنید.');}
    finally{setBusy(false);}
  }
  return <div role="dialog" aria-modal="true" aria-labelledby="master-bulk-title" className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4" onKeyDown={event=>{
    if(event.key==='Escape'&&!busy){event.stopPropagation();onClose();}
    if(event.key==='Tab'){const controls=panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)');if(!controls?.length)return;const first=controls[0],last=controls[controls.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}
  }}>
    <div ref={panel} className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full p-5 space-y-4 shadow-xl max-h-[90dvh] overflow-y-auto">
      <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200"><h3 id="master-bulk-title" className="text-sm font-bold text-slate-900">تعریف گروهی {label}</h3><button type="button" disabled={busy} onClick={onClose} aria-label="بستن تعریف گروهی" className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"><X className="w-4 h-4"/></button></div>
      <p className="text-xs text-slate-600 leading-relaxed">کدها هنگام ثبت خودکار تخصیص می‌یابند. همهٔ ردیف‌ها فعال و برای شرکت انتخاب‌شده ثبت می‌شوند؛ اگر ردیفی خطا داشته باشد، هیچ ردیفی ثبت نمی‌شود.</p>
      {error&&<p role="alert" className="p-3 text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-lg">{error}</p>}
      <form onSubmit={save} className="space-y-4"><fieldset disabled={busy} className="space-y-4">
        <label className="block text-xs font-semibold text-slate-700 space-y-1"><span>شرکت مشترک این گروه</span><select ref={company} aria-label="شرکت مشترک این گروه" required value={companyId} onChange={e=>{setCompanyId(e.target.value);setDepartmentId('');}} className={control}><option value="">انتخاب شرکت</option>{activeCompanies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        {!activeCompanies.length&&<p className="text-xs text-slate-600">ابتدا یک شرکت فعال تعریف کنید.</p>}
        {centers&&<div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><label className="block text-xs font-semibold text-slate-700 space-y-1"><span>واحد مرتبط این گروه (اختیاری)</span><select aria-label="واحد مرتبط این گروه" value={departmentId} onChange={e=>setDepartmentId(e.target.value)} className={control}><option value="">عمومی / مشترک بین واحدها</option>{departments.filter(d=>d.companyId===companyId&&d.isActive!==false).map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label className="block text-xs font-semibold text-slate-700 space-y-1"><span>طبقه بودجه‌ای این گروه</span><select aria-label="طبقه بودجه‌ای این گروه" value={category} onChange={e=>setCategory(e.target.value)} className={control}>{['عملیاتی','سرمایه‌ای','پشتیبانی','بازرگانی'].map(c=><option key={c}>{c}</option>)}</select></label></div>}
        <details className="text-xs text-slate-700"><summary className="cursor-pointer font-semibold">ورود سریع نام‌ها / پیست از اکسل</summary><div className="space-y-2 mt-2"><label className="block space-y-1"><span>هر خط یک نام؛ ستون دوم توضیحات اختیاری</span><textarea aria-label="نام‌های گروهی" value={paste} onChange={e=>setPaste(e.target.value)} rows={4} className={control}/></label><button type="button" onClick={addPasted} className="px-3 py-2 text-xs bg-slate-100 border border-slate-300 rounded-lg">افزودن به جدول</button></div></details>
        <div className="space-y-2">{rows.map((row,index)=><div key={row.key} className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_1fr_auto] gap-2 items-end">
          <label className="block text-xs text-slate-700 space-y-1"><span>نام ردیف {index+1}</span><input aria-label={`نام ردیف ${index+1}`} maxLength={2000} value={row.name} onChange={e=>change(row.key,'name',e.target.value)} className={control}/></label>
          <label className="block text-xs text-slate-700 space-y-1 col-start-1 sm:col-start-auto"><span>توضیح ردیف {index+1}</span><input aria-label={`توضیح ردیف ${index+1}`} maxLength={2000} value={row.description} onChange={e=>change(row.key,'description',e.target.value)} className={control}/></label>
          <button type="button" aria-label={`حذف ردیف ${index+1}`} onClick={()=>setRows(previous=>previous.length===1?[blank()]:previous.filter(r=>r.key!==row.key))} className="col-start-2 row-start-1 row-span-2 sm:col-start-auto sm:row-start-auto sm:row-span-1 p-2 rounded-lg border border-rose-200 text-rose-700"><Trash2 className="w-4 h-4"/></button>
        </div>)}</div>
        <button type="button" disabled={rows.length>=200} onClick={()=>setRows(previous=>[...previous,blank()])} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs bg-slate-100 border border-slate-300 rounded-lg disabled:opacity-50"><Plus className="w-3.5 h-3.5"/>افزودن ردیف</button>
      </fieldset><div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200"><span className="text-xs text-slate-500">{filled.length} ردیف آمادهٔ ثبت — کد خودکار</span><button type="submit" disabled={busy||!activeCompanies.length} className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-lg disabled:opacity-50"><Save className="w-3.5 h-3.5"/>{busy?'در حال ثبت…':'ثبت گروهی'}</button></div></form>
    </div>
  </div>;
}
