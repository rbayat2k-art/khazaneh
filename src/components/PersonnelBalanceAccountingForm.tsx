import React,{useEffect,useRef,useState}from'react';
import type{TreasuryDatabaseState}from'../types/treasury';
import type{PersonnelBalanceRequest as Balance,PersonnelBalanceFinancialValues as Values}from'../types/personnel-balance';
import{inquiryField as field,inquiryButton as button,primary,InquiryField as Field}from'./AccountInquiryFormUi';
import{CostCenterSelect}from'./CostCenterSelect';import{RialInput}from'./RialInput';import{CardInput}from'./CardInput';import{IbanInput}from'./IbanInput';
import{requestCostCenters}from'../utils/request-cost-center';import{formatRial}from'../utils/sorting';
import{financialDraft,rebaseFinancialDraft,type FinancialConflicts,type FinancialDraft}from'../utils/personnel-balance-draft';

export function PersonnelBalanceAccountingForm({q,state,mode,initial,locked,onSubmit,onCancel}:{q:Balance;state:TreasuryDatabaseState;mode:'approve'|'amend';initial?:Values;locked:boolean;onSubmit:(body:Values&{identityVerified:boolean;reason?:string;amountReason?:string})=>void;onCancel?:()=>void}){
 const starting=initial??(mode==='approve'&&q.requestedAmount!==undefined?{amount:q.requestedAmount,costCenter:'',payeeName:'',accountOrCard:'',iban:'',bankName:'',note:''}:undefined);
 const[draft,setDraft]=useState(()=>financialDraft(starting)),[conflicts,setConflicts]=useState<FinancialConflicts>({}),[reason,setReason]=useState(''),[amountReason,setAmountReason]=useState(''),[verified,setVerified]=useState(false);
 const initialKey=JSON.stringify(starting),baseline=useRef(financialDraft(starting)),baselineKey=useRef(initialKey),currentDraft=useRef(draft),currentConflicts=useRef(conflicts);currentDraft.current=draft;currentConflicts.current=conflicts;
 const rebasePending=initialKey!==baselineKey.current;
 useEffect(()=>{if(initialKey===baselineKey.current)return;const latest=financialDraft(starting),merged=rebaseFinancialDraft(currentDraft.current,baseline.current,latest,currentConflicts.current);baseline.current=latest;baselineKey.current=initialKey;setDraft(merged.draft);setConflicts(merged.conflicts);setVerified(false);},[initialKey,mode]);
 const set=(key:keyof FinancialDraft,value:string)=>setDraft(old=>({...old,[key]:value}));
 const{amount,payeeName,accountOrCard,iban,bankName,costCenter,note}=draft;
 const setAmount=(v:string)=>set('amount',v),setPayee=(v:string)=>set('payeeName',v),setCard=(v:string)=>set('accountOrCard',v),setIban=(v:string)=>set('iban',v),setBank=(v:string)=>set('bankName',v),setCenter=(v:string)=>set('costCenter',v),setNote=(v:string)=>set('note',v);
 const resolve=(key:keyof Values,useLatest:boolean)=>{if(useLatest)set(key,conflicts[key]!.latest);setConflicts(old=>{const next={...old};delete next[key];return next;});setVerified(false);};
 const amend=mode==='amend',different=!amend&&q.requestedAmount!==undefined&&amount!==''&&Number(amount)!==q.requestedAmount;
 const blocked=locked||rebasePending||Object.keys(conflicts).length>0;
 return <form aria-label={amend?'اصلاح اطلاعات حسابداری پرداخت پرسنلی':'تعیین مبلغ و تأیید حسابداری'} className="space-y-4 border-t border-slate-200 pt-4" onSubmit={e=>{e.preventDefault();if(!blocked)onSubmit({amount:Number(amount),payeeName,accountOrCard,iban,bankName,costCenter,note,identityVerified:verified,...amend?{reason}:{amountReason}});}}>
  <h4 className="text-sm font-bold">{amend?'ویرایش اطلاعات ثبت‌شدهٔ حسابداری':'تعیین مبلغ و تأیید حسابداری'}</h4>
  {Object.keys(conflicts).length>0&&<section role="alert" className="border border-amber-200 bg-amber-50 p-3 rounded-lg text-xs space-y-3"><p>این فیلدها هم‌زمان تغییر کرده‌اند؛ مقدار تازه و اصلاح خودتان را مقایسه و برای هر مورد انتخاب کنید. سپس تطبیق هویت و مبلغ را دوباره تأیید کنید.</p>{(Object.keys(conflicts)as Array<keyof Values>).map(key=><div key={key} className="space-y-2"><strong>{fields.find(f=>f[0]===key)?.[1]}</strong><p className="whitespace-pre-wrap break-words">مقدار تازه: {conflicts[key]!.latest||'خالی'} · اصلاح شما: {draft[key]||'خالی'}</p><div className="flex flex-wrap gap-2"><button disabled={locked} type="button" className={button} onClick={()=>resolve(key,true)}>استفاده از مقدار تازهٔ {fields.find(f=>f[0]===key)?.[1]}</button><button disabled={locked} type="button" className={button} onClick={()=>resolve(key,false)}>حفظ اصلاح من برای {fields.find(f=>f[0]===key)?.[1]}</button></div></div>)}</section>}
  {!amend&&<p className="text-xs border border-slate-200 bg-slate-50 rounded-lg p-3">{q.requestedAmount!==undefined?'مبلغ اعلامی درخواست‌کننده: '+formatRial(q.requestedAmount)+' ریال. همین مبلغ برای بررسی درج شده است؛ مبلغ قطعی را کنترل و تأیید کنید.':'ثبت‌کننده مبلغی اعلام نکرده است؛ مبلغ قطعی قابل پرداخت را حسابداری تعیین می‌کند.'}</p>}
  <fieldset disabled={locked} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
   <Field label="مبلغ قطعی قابل پرداخت (ریال) *"><RialInput required min={1} className={field} value={amount} onChange={e=>setAmount(e.target.value)}/></Field>
   <Field label="مرکز هزینه *"><CostCenterSelect required className={field} value={costCenter} onChange={e=>setCenter(e.target.value)}><option value="">انتخاب مرکز هزینه</option>{requestCostCenters(state.costCenters||[],state.companies||[],q).map(c=><option key={c.id} value={c.name}>{c.name}{c.code?' ('+c.code+')':''}</option>)}</CostCenterSelect></Field>
   <Field label="نام گیرنده وجه / صاحب حساب مقصد (اختیاری)"><input maxLength={200} className={field} value={payeeName} onChange={e=>setPayee(e.target.value)}/></Field>
   <Field label="شماره کارت مقصد (اختیاری)"><CardInput className={field} value={accountOrCard} onChange={e=>setCard(e.target.value)}/></Field>
   <Field label="شبا (اختیاری)"><IbanInput className={field} value={iban} onChange={e=>setIban(e.target.value)}/></Field>
   <Field label="بانک مقصد (اختیاری)"><input maxLength={200} className={field} value={bankName} onChange={e=>setBank(e.target.value)}/></Field>
   <div className="sm:col-span-2"><Field label="توضیح حسابداری (اختیاری)"><textarea maxLength={4000} rows={2} className={field} value={note} onChange={e=>setNote(e.target.value)}/></Field></div>
   {different&&<div className="sm:col-span-2"><Field label="دلیل تفاوت مبلغ قطعی با مبلغ اعلامی *"><textarea required maxLength={4000} rows={2} className={field} value={amountReason} onChange={e=>setAmountReason(e.target.value)}/></Field></div>}
   {amend&&<div className="sm:col-span-2"><Field label="دلیل اصلاح حسابداری *"><textarea required maxLength={4000} rows={2} className={field} value={reason} onChange={e=>setReason(e.target.value)}/></Field></div>}
   <label className="sm:col-span-2 flex gap-2 items-start text-xs"><input type="checkbox" required checked={verified} onChange={e=>setVerified(e.target.checked)}/>هویت پرسنل، حساب مربوط به تسویه و مبلغ قطعی را تطبیق و تأیید کرده‌ام.</label>
  </fieldset>
  <p className="text-xs text-slate-600">نام گیرنده و کارت برای حسابداری اختیاری‌اند. مقصد ثبت‌نشده را خزانه از اطلاعات پرسنلی و طبق حساب اعلام‌شدهٔ نیرو تکمیل می‌کند.</p>
  {amend&&<p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-3">مقادیر قبلی در سابقه حفظ می‌شوند؛ پس از اصلاح، درخواست به صف انتظار خزانه برمی‌گردد. برای پرداخت یا خروجی، نسخهٔ تازه را استفاده کنید.</p>}
  <div className="flex flex-wrap gap-2"><button type="submit" disabled={blocked} className={primary}>{amend?'ثبت اصلاح و ارسال دوباره به صف خزانه':'تأیید مبلغ و ارسال مستقیم به خزانه'}</button>{amend&&onCancel&&<button type="button" disabled={locked} className={button} onClick={onCancel}>انصراف از ویرایش</button>}</div>
 </form>;
}

const fields:Array<[keyof Values,string]>=[['amount','مبلغ (ریال)'],['costCenter','مرکز هزینه'],['payeeName','نام صاحب حساب'],['accountOrCard','شماره کارت'],['iban','شبا'],['bankName','بانک'],['note','توضیح حسابداری']];
export function PersonnelBalanceRevisionHistory({q}:{q:Balance}){
 if(!q.accountingRevisions?.length)return null;
 return <details className="border-t border-slate-200 pt-3 text-xs"><summary className="cursor-pointer font-bold">نسخه‌های اصلاح اطلاعات حسابداری ({q.accountingRevisions.length.toLocaleString('fa-IR')})</summary><div className="space-y-4 mt-3">{q.accountingRevisions.map(r=><article key={r.id} className="border border-slate-200 rounded-lg p-3 space-y-3"><p>{r.actorName} · {new Date(r.at).toLocaleString('fa-IR')}{r.adminSession?' · ورود مدیریتی توسط '+r.adminSession.adminName:''}</p><p className="whitespace-pre-wrap break-words">دلیل: {r.reason}</p><div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{(['before','after']as const).map(side=><section key={side} className="bg-slate-50 rounded-lg p-3 space-y-2"><h5 className="font-semibold">{side==='before'?'قبل از اصلاح':'بعد از اصلاح'}</h5><dl className="space-y-2">{fields.map(([key,label])=><div key={key}><dt className="text-slate-500">{label}</dt><dd className="whitespace-pre-wrap break-words">{key==='amount'?formatRial(r[side].amount):r[side][key]||'ثبت نشده'}</dd></div>)}</dl></section>)}</div></article>)}</div></details>;
}
