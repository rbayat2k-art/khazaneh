import React from 'react';
import {FileCheck2} from 'lucide-react';
import type {RolePermissionSet} from '../types/treasury';
import type {AccountInquirySummary,AccountInquiryTab} from '../types/account-inquiry';
import type {PersonnelBalanceSummary,PersonnelBalanceTab} from '../types/personnel-balance';
import {menuVisible} from '../utils/permission-registry';

export type WorkflowMenuGroup='forms'|'tracking'|'approver'|'accounting';
type Link={group:WorkflowMenuGroup;section:'ACCOUNT_INQUIRIES'|'PERSONNEL_BALANCES';tab:AccountInquiryTab|PersonnelBalanceTab;title:string};
const links:Link[]=[
 {group:'forms',section:'PERSONNEL_BALANCES',tab:'CREATE',title:'پرداخت پرسنلی'},
 {group:'forms',section:'ACCOUNT_INQUIRIES',tab:'CREATE',title:'ثبت استعلام شخصی یا گروهی'},
 {group:'tracking',section:'PERSONNEL_BALANCES',tab:'MINE',title:'پیگیری پرداخت پرسنلی'},
 {group:'tracking',section:'ACCOUNT_INQUIRIES',tab:'MINE',title:'پیگیری استعلام‌های من'},
 {group:'tracking',section:'ACCOUNT_INQUIRIES',tab:'HISTORY',title:'سوابق استعلام‌ها و مکاتبات مجاز'},
 {group:'approver',section:'ACCOUNT_INQUIRIES',tab:'APPROVAL',title:'تأیید و ارجاع استعلام به حسابداری'},
 {group:'approver',section:'ACCOUNT_INQUIRIES',tab:'RELEASE',title:'بررسی پاسخ استعلام و اجازه نمایش'},
 {group:'accounting',section:'PERSONNEL_BALANCES',tab:'ACCOUNTING',title:'بررسی و تأیید پرداخت پرسنلی'},
 {group:'accounting',section:'ACCOUNT_INQUIRIES',tab:'ACCOUNTING',title:'پاسخ‌گویی مانده و صورت‌حساب'},
];
export const workflowMenuGroup=(section:string,tab:string)=>links.find(l=>l.section===section&&l.tab===tab)?.group;
export const hasWorkflowSubmenus=(p:RolePermissionSet,group:WorkflowMenuGroup)=>links.some(l=>l.group===group&&menuVisible(p,l.section+'_'+l.tab));
type Props={group:WorkflowMenuGroup;permissions:RolePermissionSet;section:string;inquiryTab:AccountInquiryTab;balanceTab:PersonnelBalanceTab;inquirySummary?:AccountInquirySummary;balanceSummary?:PersonnelBalanceSummary;onInquiry:(t:AccountInquiryTab)=>void;onBalance:(t:PersonnelBalanceTab)=>void};
export function WorkflowSubmenus({group,permissions,section,inquiryTab,balanceTab,inquirySummary:inq,balanceSummary:bal,onInquiry,onBalance}:Props){
 const badgeTone=group==='accounting'?'bg-emerald-100 text-emerald-800':group==='approver'?'bg-indigo-100 text-indigo-800':'bg-blue-100 text-blue-800';
 const count=(l:Link)=>l.tab==='CREATE'?undefined:l.section==='PERSONNEL_BALANCES'?(l.tab==='MINE'?bal?.mine:bal?.accounting)||0:(l.tab==='MINE'?inq?.mine:l.tab==='HISTORY'?inq?.history:l.tab==='APPROVAL'?inq?.approval:l.tab==='RELEASE'?inq?.release:inq?.accounting)||0;
 return <>{links.filter(l=>l.group===group&&menuVisible(permissions,l.section+'_'+l.tab)).map(l=><button key={l.section+l.tab} type="button" onClick={()=>l.section==='PERSONNEL_BALANCES'?onBalance(l.tab as PersonnelBalanceTab):onInquiry(l.tab as AccountInquiryTab)} className={'w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-[11px] transition text-right '+(section===l.section&&(l.section==='PERSONNEL_BALANCES'?balanceTab:inquiryTab)===l.tab?'bg-blue-50 text-blue-950 font-bold border-r-2 border-blue-600':'text-slate-600 hover:text-slate-950 hover:bg-slate-50')}><span className="flex items-center gap-2 min-w-0"><FileCheck2 className="w-3.5 h-3.5 shrink-0 text-slate-500"/><span>{l.title}</span></span>{count(l)!==undefined&&<span className={'rounded-full px-1.5 text-[10px] shrink-0 '+badgeTone} aria-label={'تعداد ردیف: '+count(l)}>{count(l)!.toLocaleString('fa-IR')}</span>}</button>)}</>;
}
