import React,{useState,useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import {LogIn,ArrowRight,ShieldCheck,X} from 'lucide-react';
import type {User} from '../types/treasury';
import {ADMIN_ENTRY_TOKEN,ADMIN_ENTRY_CONTEXT,endAdminEntry} from '../utils/admin-session';

export function AdminUserEntry({user}:{user:User}){
 const [open,setOpen]=useState(false),[reason,setReason]=useState(''),[operationId,setOperationId]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const launch=useRef<HTMLButtonElement>(null),dialog=useRef<HTMLFormElement>(null);
 useEffect(()=>{if(!open)return;dialog.current=document.querySelector<HTMLFormElement>('form[role="dialog"]');const trap=(event:KeyboardEvent)=>{if(event.key!=='Tab')return;const controls=Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),textarea:not(:disabled)')||[]);if(!controls.length)return;const first=controls[0],last=controls.at(-1)!;if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}};document.addEventListener('keydown',trap);return()=>{document.removeEventListener('keydown',trap);launch.current?.focus();};},[open]);
 async function enter(e:React.FormEvent){e.preventDefault();if(busy)return;setBusy(true);setError('');try{
  const token=localStorage.getItem('treasury_auth_session_token');
  const res=await fetch('/api/auth/impersonation/start',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({targetUserId:user.id,reason,operationId})});
  const data=await res.json();if(!res.ok)throw Error(data.error||'ورود انجام نشد.');
  sessionStorage.setItem(ADMIN_ENTRY_CONTEXT,JSON.stringify(data.impersonation));sessionStorage.setItem('treasury_auth_user_session',JSON.stringify(data.user));sessionStorage.setItem(ADMIN_ENTRY_TOKEN,data.token);window.location.reload();
 }catch(e){setError(e instanceof Error?e.message:'نتیجه ورود مشخص نیست؛ با همین فرم دوباره تلاش کنید.');setBusy(false);}}
 return <><button ref={launch} type="button" disabled={user.isActive===false} onClick={()=>{setOperationId(crypto.randomUUID());setReason('');setError('');setOpen(true);}} title={user.isActive===false?'ورود به حساب غیرفعال مجاز نیست':'ورود مدیر به پرتال این کاربر'} className="px-2 py-1 text-[11px] font-bold text-indigo-700 hover:bg-indigo-50 border border-indigo-200 rounded-lg transition cursor-pointer flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"><LogIn className="w-3.5 h-3.5"/><span>ورود به این دسترسی</span></button>
 {open&&createPortal(<div dir="rtl" className="fixed inset-0 z-[70] bg-slate-950/50 flex items-center justify-center p-4" onKeyDown={e=>{if(e.key==='Escape'&&!busy)setOpen(false);}}><form role="dialog" aria-modal="true" aria-label={'ورود مدیریتی به پرتال '+user.name} onSubmit={enter} className="bg-white border border-slate-200 rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4"><div className="flex justify-between gap-3"><h2 className="font-bold text-sm">ورود به پرتال {user.name}</h2><button type="button" disabled={busy} aria-label="بستن ورود مدیریتی" onClick={()=>setOpen(false)}><X className="w-4 h-4"/></button></div><p className="text-xs leading-6 text-slate-600">پرتال با دسترسی‌های همین کاربر باز می‌شود. اقدامات واقعی هستند و نام شما به‌عنوان مدیر در تاریخچهٔ آن‌ها ثبت می‌شود. این ورود حداکثر ۳۰ دقیقه معتبر است.</p><label className="block text-xs font-bold text-slate-700">دلیل ورود <span className="text-rose-600">*</span><textarea autoFocus required minLength={3} maxLength={500} value={reason} disabled={busy} onChange={e=>setReason(e.target.value)} className="mt-2 w-full border border-slate-300 rounded-lg p-2 text-sm" rows={3}/></label>{error&&<p role="alert" className="text-xs text-rose-700">{error}</p>}<div className="flex gap-2"><button disabled={busy} className="bg-indigo-700 text-white rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-50">{busy?'در حال ورود...':'ورود به این دسترسی'}</button><button type="button" disabled={busy} onClick={()=>setOpen(false)} className="border border-slate-300 rounded-lg px-3 py-2 text-xs">انصراف</button></div></form></div>,document.body)}</>;
}
export function AdminEntryBanner(){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 let info:any;try{if(sessionStorage.getItem(ADMIN_ENTRY_TOKEN))info=JSON.parse(sessionStorage.getItem(ADMIN_ENTRY_CONTEXT)||'null');}catch{}
 if(!info)return null;
 async function leave(){if(busy)return;setBusy(true);setError('');try{
  await endAdminEntry();
 }catch(e){setError(e instanceof Error?e.message:'ارتباط برقرار نشد؛ دوباره تلاش کنید.');setBusy(false);}}
 return <aside dir="rtl" aria-label="ورود مدیریتی فعال" className="fixed bottom-0 inset-x-0 z-[45] bg-amber-50 text-amber-950 border-t-2 border-amber-300 px-4 py-3 flex flex-wrap items-center justify-between gap-2 shadow-lg"><div className="text-xs leading-5"><p className="font-bold flex items-center gap-2"><ShieldCheck className="w-4 h-4"/>ورود مدیریتی — پرتال {info.targetName}</p><p>{info.adminName} · اقدامات به نام هر دو نفر ثبت می‌شود.</p>{error&&<p role="alert" className="text-rose-700">{error}</p>}</div><button type="button" disabled={busy} onClick={leave} className="flex items-center gap-2 border border-amber-400 rounded-lg bg-white px-3 py-2 text-xs font-bold disabled:opacity-50"><ArrowRight className="w-4 h-4"/>{busy?'در حال بازگشت...':'بازگشت به حساب مدیر'}</button></aside>;
}
