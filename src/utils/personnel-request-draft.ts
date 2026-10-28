import type {PersonnelBalanceRequest} from '../types/personnel-balance';
export type PersonnelRequestDraft={description:string;requestedAmount:string};
export type PersonnelRequestConflicts=Partial<Record<keyof PersonnelRequestDraft,{before:string;latest:string}>>;
export const personnelRequestDraft=(q:Pick<PersonnelBalanceRequest,'description'|'requestedAmount'>):PersonnelRequestDraft=>({description:q.description,requestedAmount:q.requestedAmount===undefined?'':String(q.requestedAmount)});
/** Refresh follows untouched server fields; local conflicts remain explicit until resolved. */
export function rebasePersonnelRequestDraft(draft:PersonnelRequestDraft,base:PersonnelRequestDraft,latest:PersonnelRequestDraft,unresolved:PersonnelRequestConflicts={}){
 const next={...draft},conflicts:PersonnelRequestConflicts={};
 for(const key of ['description','requestedAmount'] as const){if(unresolved[key]&&draft[key]!==latest[key])conflicts[key]={before:unresolved[key]!.before,latest:latest[key]};else if(draft[key]===base[key])next[key]=latest[key];else if(latest[key]!==base[key]&&draft[key]!==latest[key])conflicts[key]={before:base[key],latest:latest[key]};}
 return{draft:next,conflicts};
}
