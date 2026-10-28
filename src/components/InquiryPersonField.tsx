import React,{useEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {ChevronDown,Check} from 'lucide-react';
import type {User} from '../types/treasury';
import type {AccountSubject,InquiryFinancialIntent} from '../types/account-inquiry';
import {matchingInquiryPeople} from '../utils/account-inquiry-form';
import {inquiryField} from './AccountInquiryFormUi';

export function InquiryPersonField({value,onChange,people,intent,label,readOnly=false,disabled=false}:{value:AccountSubject;onChange:(v:AccountSubject)=>void;people:User[];intent:InquiryFinancialIntent;label:string;readOnly?:boolean;disabled?:boolean}){
 const id=useId(),input=useRef<HTMLInputElement>(null),panel=useRef<HTMLDivElement>(null);
 const[open,setOpen]=useState(false),[active,setActive]=useState(0),[position,setPosition]=useState<React.CSSProperties>({});
 const choices=matchingInquiryPeople(people,value.userId?'':value.name);
 function choose(person:User){if(disabled||readOnly||input.current?.matches(':disabled'))return;onChange({kind:'EMPLOYEE',userId:person.id,name:person.name,code:person.personnelCode||'',department:person.department});setOpen(false);input.current?.focus();}
 useEffect(()=>{if(disabled||readOnly)setOpen(false);},[disabled,readOnly]);
 useEffect(()=>{if(!open||readOnly)return;const field=input.current!;
  const place=()=>{const r=field.getBoundingClientRect(),width=Math.min(Math.max(r.width,260),420,innerWidth-16),below=innerHeight-r.bottom-8,above=r.top-8,height=Math.min(280,Math.max(below,above));setPosition({position:'fixed',zIndex:10000,width,left:Math.max(8,Math.min(r.right-width,innerWidth-width-8)),top:below>=Math.min(200,above)?r.bottom+4:Math.max(8,r.top-height-4),maxHeight:height});};
  const outside=(e:PointerEvent)=>{if(!panel.current?.contains(e.target as Node)&&!field.parentElement?.contains(e.target as Node))setOpen(false);};
  place();document.addEventListener('pointerdown',outside);window.addEventListener('resize',place);window.addEventListener('scroll',place,true);
  return()=>{document.removeEventListener('pointerdown',outside);window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true);};
 },[open,readOnly]);
 useEffect(()=>{setActive(0);},[value.name,people.map(person=>person.id).join('|')]);
 useEffect(()=>{if(open)panel.current?.querySelector('[data-inquiry-active="true"]')?.scrollIntoView({block:'nearest'});},[active,open]);
 return <div className="min-w-0 space-y-1">
  <div className="relative">
   <input ref={input} aria-label={label} role={readOnly?undefined:'combobox'} aria-expanded={readOnly?undefined:open} aria-controls={open?id:undefined} aria-autocomplete={readOnly?undefined:'list'} aria-activedescendant={open&&choices[active]?id+'-'+active:undefined} autoComplete="off" maxLength={200} disabled={disabled} readOnly={readOnly} required value={value.name} placeholder="نام را بنویسید یا از فهرست انتخاب کنید" className={inquiryField+' pl-8'} onFocus={()=>{if(!readOnly)setOpen(true);}} onBlur={e=>{if(!panel.current?.contains(e.relatedTarget as Node))setOpen(false);}} onChange={e=>{onChange({kind:intent==='ADVANCE'?'EMPLOYEE':'SUPPLIER',name:e.target.value,code:''});setOpen(true);}} onKeyDown={e=>{
    if(readOnly)return;
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();setOpen(true);setActive(i=>choices.length?(i+(e.key==='ArrowDown'?1:-1)+choices.length)%choices.length:0);}
    else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();setOpen(false);}
    else if(e.key==='Enter'){e.preventDefault();if(open&&choices[active])choose(choices[active]);else{setOpen(false);input.current?.closest('[data-inquiry-row]')?.querySelector('textarea')?.focus();}}
    else if(e.key==='Tab')setOpen(false);
   }}/>
   {!readOnly&&<button type="button" disabled={disabled} aria-label={'نمایش نام‌های '+label} onMouseDown={e=>e.preventDefault()} onClick={()=>{input.current?.focus();setOpen(!open);}} className="absolute left-2 top-2.5 text-slate-500"><ChevronDown className="w-4 h-4"/></button>}
  </div>
  {value.userId&&!readOnly&&<span className="inline-flex gap-1 items-center text-[11px] text-blue-700"><Check className="w-3 h-3"/>انتخاب‌شده از فهرست</span>}
  {open&&!readOnly&&!disabled&&createPortal(<div ref={panel} style={position} dir="rtl" id={id} role="listbox" aria-label={'پیشنهاد نام برای '+label} className="overflow-y-auto rounded-lg border border-slate-300 bg-white shadow-xl p-1" onMouseDown={e=>e.preventDefault()}>
   {choices.map((person,index)=><button key={person.id} type="button" role="option" id={id+'-'+index} data-inquiry-active={active===index?'true':undefined} aria-selected={value.userId===person.id} tabIndex={-1} onMouseEnter={()=>setActive(index)} onClick={()=>choose(person)} className={'w-full text-right rounded-md px-3 py-2 text-xs '+(active===index?'bg-blue-50 text-blue-900':'text-slate-700 hover:bg-slate-50')}><strong className="block font-semibold">{person.name}</strong><span className="block mt-1 text-[11px] text-slate-500">{[person.department,person.personnelCode&&'نام کاربری: '+person.personnelCode].filter(Boolean).join(' · ')}</span></button>)}
   <p role="status" className="px-3 py-2 text-[11px] text-slate-500 border-t border-slate-100">{choices.length?'انتخاب از فهرست اختیاری است؛ نام جدید را هم می‌توانید بنویسید.':'نامی پیدا نشد؛ نام واردشده به‌صورت دستی ثبت می‌شود.'}</p>
  </div>,input.current?.closest('[role="dialog"]')||document.body)}
 </div>;
}
