import React,{useEffect,useRef,useState} from 'react';
import {X,Upload,Download,FileSpreadsheet,AlertCircle,CheckCircle2} from 'lucide-react';
import type {BankImportInput,BankImportReply,BankImportReport} from '../utils/bank-account-import';
import type {BankWorkbookResult} from '../utils/bank-account-workbook';

export type ImportBankAccounts=(payload:{rows:BankImportInput[];previewToken?:string},commit:boolean)=>Promise<BankImportReply>;
export function BankAccountImportDialog({onClose,onImport}:{onClose:()=>void;onImport:ImportBankAccounts}){
  const [rows,setRows]=useState<BankImportInput[]>([]),[fileName,setFileName]=useState(''),[errors,setErrors]=useState<string[]>([]);
  const [report,setReport]=useState<BankImportReport|null>(null),[token,setToken]=useState<string|undefined>(),[busy,setBusy]=useState<'PARSE'|'REVIEW'|'COMMIT'|null>(null);
  const [complete,setComplete]=useState<{created:number;skipped:number}|null>(null),[dragging,setDragging]=useState(false);
  const dialog=useRef<HTMLDivElement>(null),input=useRef<HTMLInputElement>(null),cancelParser=useRef<(()=>void)|null>(null),busyRef=useRef(false),mounted=useRef(true);
  useEffect(()=>{
    mounted.current=true;const previous=document.activeElement as HTMLElement|null;
    dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const key=(event:KeyboardEvent)=>{
      if(event.key==='Escape'&&!busyRef.current){event.preventDefault();onClose();}
      if(event.key==='Tab'){
        const controls=Array.from(dialog.current?.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),input:not(:disabled)')||[]).filter(el=>el.getClientRects().length>0),first=controls[0],last=controls.at(-1);
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
      }
    };
    document.addEventListener('keydown',key);return()=>{mounted.current=false;cancelParser.current?.();document.removeEventListener('keydown',key);previous?.focus();};
  },[onClose]);
  const working=(value:typeof busy)=>{busyRef.current=!!value;setBusy(value);};
  async function choose(file?:File){
    if(!file||busyRef.current)return;
    setRows([]);setReport(null);setToken(undefined);setComplete(null);setErrors([]);setFileName(file.name);
    if(!/\.xlsx$/i.test(file.name)||file.size>1024*1024){setErrors(['فقط فایل xlsx تا۱مگابایت مجاز است. از قالب سامانه استفاده کنید.']);return;}
    working('PARSE');
    try{
      const buffer=await file.arrayBuffer();if(!mounted.current)return;
      const result=await new Promise<BankWorkbookResult>((resolve,reject)=>{
        const worker=new Worker(new URL('../utils/bank-account-workbook.worker.ts',import.meta.url),{type:'module'});
        const finish=()=>{clearTimeout(timer);worker.terminate();cancelParser.current=null;};
        const timer=setTimeout(()=>{finish();reject(Error('خواندن فایل بیش از حد طول کشید؛ فایل را با قالب سامانه دوباره ذخیره کنید.'));},7000);
        cancelParser.current=()=>{finish();reject(Error('خواندن فایل لغو شد.'));};
        worker.onmessage=(event:MessageEvent<BankWorkbookResult>)=>{finish();resolve(event.data);};
        worker.onerror=()=>{finish();reject(Error('فایل قابل خواندن نیست؛ آن را با قالب سامانه دوباره ذخیره کنید.'));};
        worker.postMessage(buffer,[buffer]);
      });
      if(mounted.current){setErrors(result.errors);setRows(result.errors.length?[]:result.rows);}
    }catch(error){if(mounted.current)setErrors([(error as Error).message]);}
    finally{if(mounted.current)working(null);}
  }
  async function review(){
    if(busyRef.current||!rows.length)return;working('REVIEW');setErrors([]);setToken(undefined);setComplete(null);
    try{const result=await onImport({rows},false);if(result.ok&&result.report){setReport(result.report);setToken(result.previewToken);}else setErrors([result.error||'بازبینی انجام نشد؛ دوباره تلاش کنید.']);}
    catch{setErrors(['ارتباط با سرور برقرار نشد؛ فایل و اطلاعات شما حفظ شده‌اند.']);}finally{working(null);}
  }
  async function commit(){
    if(busyRef.current||!token||!report?.newCount||report.errorCount)return;working('COMMIT');setErrors([]);
    try{
      const result=await onImport({rows,previewToken:token},true);setToken(undefined);
      if(result.ok){setComplete({created:result.createdCount||0,skipped:result.skippedCount||0});}
      else{if(result.report)setReport(result.report);setErrors([result.error||'نتیجه ثبت دریافت نشد؛ پیش از تلاش مجدد، بازبینی کنید.']);}
    }catch{setToken(undefined);setErrors(['نتیجه ثبت دریافت نشد؛ ثبت خودکار تکرار نمی‌شود. دوباره بازبینی کنید.']);}finally{working(null);}
  }
  return <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="bank-import-title" aria-describedby="bank-import-description">
    <div ref={dialog} className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full max-h-[92dvh] overflow-y-auto p-5 space-y-4 shadow-2xl text-xs">
      <header className="flex items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-2.5"><div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center"><FileSpreadsheet className="w-5 h-5" /></div><div><h3 id="bank-import-title" className="font-bold text-slate-900 text-sm">ورود گروهی حساب‌های بانکی</h3><p id="bank-import-description" className="text-[11px] text-slate-500 mt-0.5">حساب‌های قبلی و پیش‌فرض تغییر نمی‌کنند؛ فقط حساب جدید اضافه می‌شود.</p></div></div>
        <button type="button" onClick={onClose} disabled={!!busy} aria-label="بستن پنجره ورود گروهی" className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer disabled:opacity-50"><X className="w-4 h-4" /></button>
      </header>
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-lg p-3"><span className="font-semibold text-slate-700">۱. قالب اکسل را پر کنید؛ هر حساب یک ردیف</span><a href="/templates/bank-accounts-template.xlsx?v=b1d0d78d6fd5" download="قالب ورود حساب‌های بانکی.xlsx" className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-blue-800 bg-white border border-blue-200 rounded-lg hover:bg-blue-50"><Download className="w-4 h-4" />دانلود قالب اکسل</a></div>
      {!complete&&<div onDragOver={e=>{e.preventDefault();if(!busy)setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);if(e.dataTransfer.files.length!==1){setErrors(['هر بار فقط یک فایل اکسل انتخاب کنید.']);return;}void choose(e.dataTransfer.files[0]);}} className={`border border-dashed rounded-xl p-4 text-center space-y-2 ${dragging?'border-blue-500 bg-blue-50':'border-slate-300 bg-slate-50'}`}>
        <Upload className="w-6 h-6 mx-auto text-blue-700" /><p className="font-semibold text-slate-800">۲. فایل اکسل را اینجا بکشید یا انتخاب کنید</p><p className="text-[11px] text-slate-500">فقط xlsx · حداکثر۲۰۰حساب و۱مگابایت · شماره‌ها به صورت Text</p>
        <input ref={input} type="file" accept=".xlsx" disabled={!!busy} className="hidden" aria-label="فایل اکسل حساب‌های بانکی" onChange={e=>{void choose(e.target.files?.[0]);e.target.value='';}} />
        <button type="button" disabled={!!busy} onClick={()=>input.current?.click()} className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 font-semibold cursor-pointer disabled:opacity-50">انتخاب فایل اکسل</button>
        {fileName&&<p className="text-[11px] text-slate-600 break-all">{fileName}</p>}
      </div>}
      {!!errors.length&&<div role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-1"><div className="flex items-center gap-2 font-bold"><AlertCircle className="w-4 h-4 shrink-0" />ورود کامل نشده است</div><ul className="list-disc pr-5">{errors.slice(0,20).map((error,i)=><li key={i}>{error}</li>)}</ul>{errors.length>20&&<p>{errors.length-20} خطای دیگر؛ همهٔ ردیف‌های فایل را بررسی کنید.</p>}</div>}
      <div aria-live="polite" className="text-xs text-slate-600">{busy?busy==='PARSE'?'در حال خواندن فایل…':busy==='REVIEW'?'در حال بازبینی حساب‌ها…':'در حال ثبت حساب‌های جدید…':rows.length&&!report?`${rows.length} ردیف خوانده شد؛ برای کنترل با حساب‌های موجود، بازبینی کنید.`:''}</div>
      {report&&<section className="space-y-2"><h4 className="font-bold text-slate-900">۳. بازبینی پیش از ثبت</h4><p className="text-slate-600">{report.newCount} حساب جدید · {report.duplicateCount} تکراری بدون تغییر · {report.errorCount} خطا</p><div className="border border-slate-200 rounded-lg overflow-x-auto"><table className="w-full min-w-[620px] text-right border-collapse text-xs"><thead className="bg-slate-100 text-slate-700"><tr><th className="p-2">ردیف اکسل</th><th className="p-2">حساب / صاحب حساب</th><th className="p-2">شماره حساب</th><th className="p-2">نتیجه بررسی</th></tr></thead><tbody>{report.rows.map(row=><tr key={row.rowNumber} className="border-t border-slate-200"><td className="p-2 font-mono-num">{row.rowNumber}</td><td className="p-2"><div className="font-semibold">{row.bankName} · {row.accountTitle}</div><div className="text-[11px] text-slate-500">{row.companyName}</div></td><td className="p-2 font-mono-num" dir="ltr">{row.accountNumber}</td><td className="p-2"><span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${row.status==='ERROR'?'bg-rose-100 text-rose-900':row.status==='DUPLICATE'?'bg-amber-100 text-amber-900':'bg-emerald-100 text-emerald-900'}`}>{row.status==='NEW'?'آمادهٔ ثبت':row.status==='DUPLICATE'?'تکراری؛ بدون تغییر':'نیازمند اصلاح'}</span><div className="text-[11px] text-slate-600 mt-1">{row.reason}</div></td></tr>)}</tbody></table></div>{!!report.errorCount&&<p className="text-rose-800">تا اصلاح همهٔ خطاها، هیچ ردیفی ثبت نمی‌شود. فایل اصلاح‌شده را دوباره انتخاب کنید.</p>}{!report.errorCount&&!report.newCount&&<p className="text-slate-700">همه حساب‌ها قبلاً ثبت شده‌اند؛ ثبت دوباره لازم نیست.</p>}</section>}
      {complete&&<div role="status" className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900"><CheckCircle2 className="w-5 h-5 shrink-0" /><p>{complete.created} حساب جدید ثبت شد؛ {complete.skipped} تکراری بدون تغییر ماند. حساب‌ها و پیش‌فرض قبلی تغییر نکردند.</p></div>}
      <footer className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-200">
        <button type="button" onClick={onClose} disabled={!!busy} className="px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer disabled:opacity-50">{complete?'بستن و مشاهده حساب‌ها':'انصراف'}</button>
        {!complete&&<><button type="button" disabled={!!busy||!rows.length} onClick={()=>void review()} className="px-3 py-2 bg-white border border-blue-300 rounded-lg font-semibold text-blue-800 cursor-pointer disabled:opacity-50">{report?'بازبینی مجدد':'بازبینی فایل'}</button><button type="button" disabled={!!busy||!token||!report?.newCount||!!report.errorCount} onClick={()=>void commit()} className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-blue-700 hover:bg-blue-800 text-white rounded-lg cursor-pointer disabled:opacity-50">ثبت حساب‌های جدید{report?.newCount?` (${report.newCount})`:''}</button></>}
      </footer>
    </div>
  </div>;
}
