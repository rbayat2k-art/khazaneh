import type{PersonnelBalanceFinancialValues as Values}from'../types/personnel-balance';
export type FinancialDraft={[K in keyof Values]:string};
export const financialDraftKeys=['amount','costCenter','payeeName','accountOrCard','iban','bankName','note']as const;
export type FinancialConflicts=Partial<Record<keyof Values,{before:string;latest:string}>>;
export function financialDraft(v?:Values):FinancialDraft{return{amount:v?String(v.amount):'',costCenter:v?.costCenter||'',payeeName:v?.payeeName||'',accountOrCard:v?.accountOrCard||'',iban:v?.iban||'',bankName:v?.bankName||'',note:v?.note||''};}
/** A refresh advances the server baseline, never silently overwrites another edit.
 * Untouched fields follow the server; conflicting local edits require a choice. */
export function rebaseFinancialDraft(draft:FinancialDraft,base:FinancialDraft,latest:FinancialDraft,unresolved:FinancialConflicts={}){
 const next={...draft},conflicts:FinancialConflicts={};
 for(const key of financialDraftKeys){if(unresolved[key]&&draft[key]!==latest[key])conflicts[key]={before:unresolved[key]!.before,latest:latest[key]};else if(draft[key]===base[key])next[key]=latest[key];else if(latest[key]!==base[key]&&draft[key]!==latest[key])conflicts[key]={before:base[key],latest:latest[key]};}
 return{draft:next,conflicts};
}
