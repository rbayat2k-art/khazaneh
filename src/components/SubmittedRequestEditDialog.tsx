import {RialInput} from './RialInput';
import {CardInput} from './CardInput';
import {IbanInput} from './IbanInput';
import {JalaliDateInput} from './JalaliDateInput';
import React, { useEffect, useRef, useState } from 'react';
import { Save, X, Upload } from 'lucide-react';
import {cardInputProps,ibanInputProps} from './bank-input';
import {cleanIban,formatCardNumber,detectBankFromCard,DESTINATION_BANKS} from '../utils/bankCards';
import {bankFieldsError} from '../utils/bank-identifiers';
import { type AttachmentFile, type CostCenterItem } from '../types/treasury';
import type { EditableRequestRow, SubmittedEditKind, SubmittedRequestChanges, SubmittedRequestEdit } from '../utils/request-edit';

export type SubmittedEditTarget = { itemType: SubmittedEditKind; requestId: string; rowId?: string; trackingCode: string; row: EditableRequestRow };
type Props = { target: SubmittedEditTarget; requesterId: string; costCenters: CostCenterItem[]; canEditAttachments: boolean; onClose: () => void; onSave: (edit: SubmittedRequestEdit) => Promise<{ok:boolean;error?:string}> };
const control='w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600';

export function SubmittedRequestEditDialog({target,requesterId,costCenters,canEditAttachments,onClose,onSave}:Props){
  const row=target.row as any,advance=target.itemType==='ADVANCE',batch=target.itemType==='BATCH_ITEM',requireCard=!advance&&(!batch||row.itemType!=='ADVANCE');
  const [draft,setDraft]=useState<Record<string,string>>(()=>Object.fromEntries(['amount','payeeName','accountOrCard','iban','bankName','invoiceNumber','costCenter','requestedMonth','suggestedDate','dueDate','priority'].map(key=>[key,key==='iban'&&row[key]==='IR'?'':String(row[key]??(key==='priority'?'Normal':''))])));
  const [description,setDescription]=useState(advance?row.reason||'':row.description||'');
  const [files,setFiles]=useState<AttachmentFile[]>(row.attachments||[]);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const [readingFiles,setReadingFiles]=useState(false);
  const panel=useRef<HTMLDivElement>(null),amount=useRef<HTMLInputElement>(null);
  useEffect(()=>{const previous=document.activeElement as HTMLElement;amount.current?.focus();return()=>{if(previous?.isConnected)previous.focus();};},[]);
  const set=(key:string,value:string)=>setDraft(prev=>({...prev,[key]:value,...(key==='accountOrCard'?{bankName:detectBankFromCard(value)||''}:{})}));
  async function addFiles(e:React.ChangeEvent<HTMLInputElement>){
    const input=e.currentTarget,selected=Array.from(input.files||[]);
    if(selected.some(file=>file.size>10*1024*1024)){setError('حداکثر اندازه هر مدرک۱۰مگابایت است.');input.value='';return;}
    setReadingFiles(true);
    try{
      const added=await Promise.all(selected.map(async file=>({id:crypto.randomUUID(),name:file.name,size:file.size,type:file.type,url:await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(file);}),uploadedAt:new Date().toISOString(),uploadedBy:requesterId})));
      setFiles(prev=>[...prev,...added]);
    }catch{setError('خواندن مدرک ناموفق بود.');}
    finally{input.value='';setReadingFiles(false);}
  }
  const field=(key:string,label:string,required=false)=>{const Control=key==='accountOrCard'?CardInput:key==='iban'?IbanInput:['dueDate','suggestedDate'].includes(key)?JalaliDateInput:'input';return <label className="block text-xs font-semibold text-slate-700 space-y-1" key={key}><span>{label}</span><Control aria-label={label} value={draft[key]} required={required} {...(key==='iban'?ibanInputProps:{})} onChange={e=>set(key,key==='accountOrCard'?formatCardNumber(e.target.value):key==='iban'?cleanIban(e.target.value):e.target.value)} className={control} dir={['accountOrCard','iban'].includes(key)?'ltr':undefined}/></label>;};
  async function save(e:React.FormEvent){
    e.preventDefault();if(busy||readingFiles)return;setError('');
    const value=Number(draft.amount);if(!Number.isSafeInteger(value)||value<=0){setError('مبلغ باید عدد صحیح مثبت به ریال باشد.');return;}
    if(!advance){const error=bankFieldsError({accountOrCard:draft.accountOrCard,iban:draft.iban},requireCard);if(error){setError(error);return;}}
    const changes:SubmittedRequestChanges={amount:value,description,...(canEditAttachments?{attachments:files}:{})};
    if(advance){changes.requestedMonth=draft.requestedMonth;changes.suggestedDate=draft.suggestedDate;}
    else {for(const key of ['payeeName','accountOrCard','iban','bankName','invoiceNumber','costCenter']) (changes as any)[key]=draft[key];if(!batch){changes.dueDate=draft.dueDate;changes.priority=draft.priority as 'Normal'|'Urgent';}else if(row.itemType==='ADVANCE')changes.requestedMonth=draft.requestedMonth;}
    setBusy(true);
    try{const result=await onSave({requesterId,itemType:target.itemType,requestId:target.requestId,rowId:target.rowId,expectedVersion:row.version||1,changes});if(result.ok)onClose();else setError(result.error||'ویرایش ثبت نشد.');}
    catch{setError('ارتباط برقرار نشد؛ فرم بسته نشده است. پیش از تلاش دوباره، وضعیت درخواست را بررسی کنید.');}
    finally{setBusy(false);}
  }
  return <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="submitted-edit-title" onKeyDown={e=>{
    if(e.key==='Escape'&&!busy){e.stopPropagation();onClose();}
    if(e.key==='Tab'){const focusable=panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)');if(!focusable?.length)return;const first=focusable[0],last=focusable[focusable.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
  }}>
    <div ref={panel} className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-5 space-y-4 shadow-xl max-h-[90dvh] overflow-y-auto">
      <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200"><div><h3 id="submitted-edit-title" className="font-bold text-slate-900 text-sm">ویرایش پیش از شروع بررسی</h3><p className="text-xs text-slate-500 break-words">{target.trackingCode}</p></div><button type="button" aria-label="بستن پنجره ویرایش" disabled={busy} onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"><X className="w-4 h-4"/></button></div>
      <p className="text-xs text-slate-600 leading-relaxed">فقط تا پیش از اقدام بررسی‌کننده می‌توانید ویرایش کنید. وضعیت و مسیر تأیید تغییر نمی‌کند.{batch?' این تغییر فقط برای همین ردیف است؛ عنوان و پیوست‌های عمومی گروه ثابت می‌مانند.':''}</p>
      {error&&<p role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">{error}</p>}
      <form onSubmit={save} className="space-y-3">
        <fieldset disabled={busy||readingFiles} className="space-y-3">
          <label className="block text-xs font-semibold text-slate-700 space-y-1"><span>مبلغ (ریال)</span><RialInput ref={amount} aria-label="مبلغ (ریال)" min={1} step={1} required value={draft.amount} onChange={e=>set('amount',e.target.value)} className={control}/></label>
          {!advance&&field('payeeName','نام دریافت‌کننده (صاحب حساب)',true)}
          <label className="block text-xs font-semibold text-slate-700 space-y-1"><span>شرح درخواست</span><textarea aria-label="شرح درخواست" required rows={3} value={description} onChange={e=>setDescription(e.target.value)} className={control}/></label>
          {advance?<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{field('requestedMonth','ماه مورد تقاضا',true)}{field('suggestedDate','تاریخ پیشنهادی (شمسی)')}</div>:<>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{field('accountOrCard','شماره کارت (۱۶ رقم)',requireCard)}{field('iban','شماره شبا')}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><label className="block text-xs font-semibold text-slate-700 space-y-1"><span>بانک مقصد</span><select aria-label="بانک مقصد" value={draft.bankName} onChange={e=>set('bankName',e.target.value)} className={control}>{[...new Set(['',draft.bankName,...DESTINATION_BANKS])].map(bank=><option key={bank} value={bank}>{bank||'انتخاب بانک (اختیاری)'}</option>)}</select></label>
              <label className="block text-xs font-semibold text-slate-700 space-y-1"><span>مرکز هزینه</span><select aria-label="مرکز هزینه" value={draft.costCenter} onChange={e=>set('costCenter',e.target.value)} className={control}>
                <option value="">انتخاب مرکز هزینه</option>
                {draft.costCenter&&!costCenters.some(cc=>cc.name===draft.costCenter)&&<option value={draft.costCenter} disabled>{draft.costCenter} (ثبت قبلی؛ خارج از فهرست فعال)</option>}
                {costCenters.map(cc=><option key={cc.id} value={cc.name}>{cc.name} — کد: {cc.code} ({cc.companyName})</option>)}
              </select>{!costCenters.length&&<span className="block font-normal text-slate-500">مرکز هزینهٔ فعالی تعریف نشده است.</span>}</label>
              {field('invoiceNumber','شماره فاکتور')}{!batch&&field('dueDate','تاریخ نیاز (شمسی)')}{batch&&row.itemType==='ADVANCE'&&field('requestedMonth','ماه مورد تقاضا')}</div>
            {!batch&&<label className="block text-xs font-semibold text-slate-700 space-y-1"><span>اولویت</span><select aria-label="اولویت" value={draft.priority} onChange={e=>set('priority',e.target.value)} className={control}><option value="Normal">عادی</option><option value="Urgent">فوری</option></select></label>}
          </>}
          {canEditAttachments&&<div className="space-y-2"><span className="block text-xs font-semibold text-slate-700">مدارک همین درخواست</span>{files.map((file,index)=><div key={file.id} className="flex items-center justify-between gap-2 text-xs text-slate-700"><span className="break-all">{file.name}</span><button type="button" aria-label={`حذف پیوست ${index+1}`} onClick={()=>setFiles(prev=>prev.filter(f=>f.id!==file.id))} className="text-rose-600 px-2 py-1 shrink-0">حذف از درخواست</button></div>)}<label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-100 border border-slate-300 rounded-lg cursor-pointer"><Upload className="w-3.5 h-3.5"/><span>افزودن مدرک</span><input aria-label="افزودن مدرک" type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif,application/pdf" className="hidden" onChange={addFiles}/></label></div>}
        </fieldset>
        {readingFiles&&<p role="status" className="text-xs text-slate-600">در حال خواندن مدرک…</p>}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200"><button type="button" disabled={busy} onClick={onClose} className="px-3 py-2 text-xs text-slate-700 rounded-lg hover:bg-slate-100">انصراف</button><button type="submit" disabled={busy||readingFiles} className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 rounded-lg disabled:opacity-50"><Save className="w-3.5 h-3.5"/>{busy?'در حال ذخیره…':'ذخیره ویرایش'}</button></div>
      </form>
    </div>
  </div>;
}
