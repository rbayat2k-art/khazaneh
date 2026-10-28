import React from 'react';
import {adminSessionActor} from '../utils/admin-session';
import type {ItemAuditEntry,ReviewComment} from '../types/treasury';
type NotesRow={auditHistory?:ItemAuditEntry[];comments?:ReviewComment[];approverNote?:string|null;accountingNote?:string|null};
// Consumers receive already-scoped request rows, never a global comments store.
export function OfficialReviewNotes({row}:{row?:NotesRow}){
  if(!row)return null;
  const audit=(row.auditHistory||[]).filter(a=>a.reason||a.comment);
  const comments=(row.comments||[]).filter(c=>!audit.some(a=>a.comment===c.text&&a.actorId===c.authorId&&a.changedAt===c.createdAt));
  const legacy=[row.approverNote,row.accountingNote].filter((v):v is string=>!!v&&v!=='-'&&!audit.some(a=>a.comment===v)&&!comments.some(c=>c.text===v));
  const count=audit.length+comments.length+legacy.length;if(!count)return null;
  return <details className="mt-2 text-xs font-normal text-slate-700 break-words"><summary className="cursor-pointer font-semibold text-blue-700">یادداشت‌های رسمی و دلایل تغییر ({count})</summary><div className="mt-2 space-y-2 max-h-64 overflow-y-auto">
    {audit.map((a,i)=><div key={a.id||i} className="p-2 bg-slate-50 border border-slate-200 rounded-lg space-y-1"><div className="text-slate-500">{adminSessionActor(a.changedBy,a.adminSession)} · {a.stage==='ACCOUNTING'?'حسابداری':a.stage==='APPROVER'?'سرپرست':a.action} · {a.changedAt}</div>{a.reason&&<p>دلیل تغییر: {a.reason}</p>}{a.comment&&<p>یادداشت رسمی: {a.comment}</p>}{a.newAmount!==undefined&&<p className="font-mono-num">مبلغ: {a.previousAmount?.toLocaleString('fa-IR')} ← {a.newAmount.toLocaleString('fa-IR')} ریال</p>}</div>)}
    {comments.map(c=><div key={c.id} className="p-2 bg-slate-50 border border-slate-200 rounded-lg"><div className="text-slate-500">{adminSessionActor(c.authorName,c.adminSession)} · {c.createdAt}</div><p>یادداشت رسمی: {c.text}</p></div>)}
    {legacy.map((note,i)=><p key={i} className="p-2 bg-slate-50 border border-slate-200 rounded-lg">یادداشت ثبت‌شده: {note}</p>)}
  </div></details>;
}
