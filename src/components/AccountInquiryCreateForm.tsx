import React,{useState} from 'react';
import {Plus,Trash2} from 'lucide-react';
import type {TreasuryDatabaseState,User,RolePermissionSet} from '../types/treasury';
import type {AccountInformation,FinancialInquiryTarget,InquiryFinancialIntent} from '../types/account-inquiry';
import {AccountInquiryInformationChoices} from './AccountInquiryInformationChoices';
import {todayJalali} from '../utils/current-date';
import {inquiryDraftPayload,inquiryPeople,newInquiryRow,linkedInquiryIdentity,type InquiryDraftRow} from '../utils/account-inquiry-form';
import {JalaliDateInput} from './JalaliDateInput';
import {InquiryPersonField} from './InquiryPersonField';
import {inquiryField,inquiryButton,primary,InquiryField,useCommand,CommandStatus} from './AccountInquiryFormUi';

type Props={user:User;state:TreasuryDatabaseState;onSaved:(r:any)=>void;linkedTargets?:FinancialInquiryTarget[];linkedCompany?:string};
export function CreateAccountInquiryForm(props:Props){
 const p:Partial<RolePermissionSet>=props.user.effectivePermissions||{};
 const key=[props.user.id,p.canRequestOwnAccountInquiry,p.canRequestOthersAccountInquiry,props.user.effectiveAccessScope,props.user.company,JSON.stringify(props.linkedTargets||[])].join('|');
 return <InquiryCreateEditor key={key} {...props}/>;
}
function InquiryCreateEditor({user,state,onSaved,linkedTargets,linkedCompany}:Props){
 const p:Partial<RolePermissionSet>=user.effectivePermissions||{},linked=!!linkedTargets?.length,canOthers=!!p.canRequestOthersAccountInquiry;
 const command=useCommand(),[intent,setIntent]=useState<InquiryFinancialIntent>('ADVANCE'),[companyId,setCompany]=useState(()=>(state.companies||[]).find(c=>c.name===(linkedCompany||user.company))?.id||''),[information,setInformation]=useState<AccountInformation[]>(['BALANCE']),[asOf,setAsOf]=useState(todayJalali()),[fromDate,setFrom]=useState(''),[toDate,setTo]=useState(''),[localError,setLocalError]=useState('');
 const makeRows=()=>linked?linkedTargets!.map(target=>{const info=linkedInquiryIdentity(state,target);return{...newInquiryRow(info.advance?'ADVANCE':'PAYMENT'),subject:{kind:info.advance?'EMPLOYEE' as const:'SUPPLIER' as const,name:info.name}};}):[newInquiryRow(intent,!canOthers?user:undefined)];
 const[rows,setRows]=useState<InquiryDraftRow[]>(makeRows),companies=(state.companies||[]).filter(c=>c.isActive!==false),people=inquiryPeople(state,user,companyId).filter(person=>person.id!==user.id||p.canRequestOwnAccountInquiry),ownSelected=!linked&&rows.some(row=>row.subject.userId===user.id);
 const update=(key:string,patch:Partial<InquiryDraftRow>)=>{setLocalError('');setRows(current=>current.map(row=>row.key===key?{...row,...patch}:row));};
 return <form aria-label={linked?'ثبت استعلام متصل به درخواست مالی':'ثبت استعلام مانده و صورت‌حساب'} className="space-y-4" onSubmit={e=>{e.preventDefault();setLocalError('');let body;try{body=inquiryDraftPayload({user,companyId,intent,information,asOf,fromDate,toDate,rows,linkedTargets});}catch(error){setLocalError(error instanceof Error?error.message:'ردیف‌ها را بررسی کنید.');return;}void command.run('/create',body,result=>{setRows(makeRows());onSaved(result);});}}>
  <fieldset disabled={command.busy||command.uncertain} className="space-y-4">
   <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
    <InquiryField label="نوع استعلام"><select aria-label="نوع استعلام" value={linked?'LINKED':intent} disabled={linked} onChange={e=>{const next=e.target.value as InquiryFinancialIntent;setIntent(next);setRows(current=>current.map(row=>({...row,subject:row.subject.userId?row.subject:{...row.subject,kind:next==='ADVANCE'?'EMPLOYEE':'SUPPLIER'}})));}} className={inquiryField}>{linked?<option value="LINKED">ردیف‌های مالی انتخاب‌شده</option>:<><option value="ADVANCE">پرسنل (مساعده)</option><option value="PAYMENT">طرف‌حساب (دستور پرداخت)</option></>}</select></InquiryField>
    <InquiryField label="شرکت *"><select aria-label="شرکت استعلام" required value={companyId} disabled={linked||ownSelected||companies.length===1} onChange={e=>{setCompany(e.target.value);setLocalError('');setRows(current=>current.map(row=>({...row,subject:{kind:intent==='ADVANCE'?'EMPLOYEE':'SUPPLIER',name:'',code:''}})));}} className={inquiryField}><option value="">انتخاب شرکت</option>{companies.map(company=><option key={company.id} value={company.id}>{company.name}</option>)}</select></InquiryField>
   </div>
   <AccountInquiryInformationChoices value={information} onChange={setInformation} required/>
   <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
    <InquiryField label="تاریخ مبنا"><JalaliDateInput aria-label="تاریخ مبنای استعلام" value={asOf} onChange={e=>setAsOf(e.target.value)} className={inquiryField}/></InquiryField>
    <InquiryField label="از تاریخ (اختیاری)"><JalaliDateInput aria-label="ابتدای بازه صورت‌حساب" value={fromDate} onChange={e=>setFrom(e.target.value)} className={inquiryField}/></InquiryField>
    <InquiryField label="تا تاریخ (اختیاری)"><JalaliDateInput aria-label="انتهای بازه صورت‌حساب" value={toDate} onChange={e=>setTo(e.target.value)} className={inquiryField}/></InquiryField>
   </div>
   <div className="border border-slate-200 rounded-xl overflow-hidden">
    <div className="hidden sm:grid grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)_2rem] gap-2 bg-slate-50 border-b border-slate-200 px-3 py-3 text-xs font-semibold text-slate-700"><span>ردیف</span><span>{linked?'نام پرسنل / طرف‌حساب استعلام':intent==='ADVANCE'?'نام پرسنل':'نام شخص / شرکت طرف‌حساب'}</span><span>توضیح درخواست استعلام</span><span className="sr-only">حذف</span></div>
    {rows.map((row,index)=><div key={row.key} data-inquiry-row className="grid grid-cols-[1.5rem_minmax(0,1fr)_2rem] sm:grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)_2rem] gap-2 items-start border-b last:border-b-0 border-slate-200 px-3 py-3">
     <span className="text-xs text-slate-500 pt-3">{index+1}</span>
     <div className="min-w-0"><span className="block sm:sr-only text-xs font-semibold mb-1">{(linked?row.subject.kind==='EMPLOYEE':intent==='ADVANCE')?'نام پرسنل *':'نام شخص / شرکت طرف‌حساب *'}</span><InquiryPersonField label={'نام ردیف '+(index+1)} value={row.subject} onChange={subject=>update(row.key,{subject})} people={people} intent={intent} disabled={command.busy||command.uncertain} readOnly={linked||!canOthers}/>{linked&&!linkedInquiryIdentity(state,linkedTargets![index]).advance&&<p className="text-[11px] text-slate-500 mt-1 break-words">بابت پرداخت: {linkedInquiryIdentity(state,linkedTargets![index]).purpose||'ثبت نشده'}</p>}</div>
     <label className="col-start-2 col-span-1 sm:col-start-3 sm:col-span-1 min-w-0"><span className="block sm:sr-only text-xs font-semibold mb-1">توضیح درخواست استعلام</span><textarea aria-label={'توضیحات ردیف '+(index+1)} rows={1} maxLength={4000} value={row.question} onChange={e=>update(row.key,{question:e.target.value})} placeholder="مثلاً آخرین مانده یا صورت‌حساب این فرد را می‌خواهم…" className={inquiryField+' block resize-y min-h-8'}/></label>
     <button type="button" aria-label={'حذف ردیف '+(index+1)} disabled={linked||rows.length===1} onClick={()=>{setRows(current=>current.filter(r=>r.key!==row.key));setLocalError('');}} className="col-start-3 row-start-1 sm:col-start-4 text-rose-700 rounded-md border border-rose-200 p-2 hover:bg-rose-50 disabled:opacity-30 disabled:cursor-not-allowed"><Trash2 className="w-3.5 h-3.5"/></button>
    </div>)}
   </div>
   <div className="flex flex-wrap items-center gap-3 justify-between">
    {!linked&&canOthers&&<button type="button" disabled={rows.length>=50||ownSelected} onClick={()=>{setRows(current=>[...current,newInquiryRow(intent)]);setLocalError('');}} className={inquiryButton+' inline-flex gap-1 items-center'}><Plus className="w-3.5 h-3.5"/>افزودن ردیف</button>}
    <p className="text-[11px] text-slate-500">{linked?'نام‌ها از ردیف‌های مالی خوانده می‌شوند؛ بابت پرداخت، نام شخص یا شرکت نیست.':ownSelected?'این استعلام برای خود شما است؛ حساب دیگران را جداگانه ثبت کنید.':'برای هر فرد یا طرف‌حساب یک ردیف وارد کنید؛ حداکثر ۵۰ ردیف.'}</p>
   </div>
  </fieldset>
  {localError&&<p role="alert" className="text-xs text-rose-800 border border-rose-200 bg-rose-50 p-3 rounded-lg">{localError}</p>}
  {!linked&&intent==='PAYMENT'&&<p className="text-[11px] text-slate-500">نام صاحب حساب حسابداری را وارد کنید؛ مثلاً نام فروشنده. بابت خرید، هنگام ساخت دستور پرداخت جدا ثبت می‌شود.</p>}
  <CommandStatus command={command}/>
  <div className="flex flex-wrap items-center gap-3"><button type="submit" disabled={command.busy||!information.length} className={primary}>{command.busy?'در حال ثبت…':command.uncertain?'پیگیری ثبت قبلی':'ثبت و ارسال استعلام'}</button><span className="text-[11px] text-slate-500">استعلام، پرداخت ایجاد نمی‌کند.</span></div>
 </form>;
}
