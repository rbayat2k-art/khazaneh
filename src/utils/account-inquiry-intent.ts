import type {AccountInquiryRow,AccountInquiryReply,InquiryFinancialIntent} from '../types/account-inquiry';
export const inquiryIntentAllows=(intent:InquiryFinancialIntent|undefined,kind:string)=>!intent||(intent==='ADVANCE'?kind.startsWith('ADVANCE'):kind.startsWith('PAYMENT'));
export const inquiryNeedsPersonnelConfirmation=(rows:Array<Pick<AccountInquiryRow,'subject'|'financialIntent'>>,kind:string)=>kind==='ADVANCE_BATCH'&&rows.some(row=>row.financialIntent==='ADVANCE'&&!row.subject.userId);
export function inquiryReplyMatchesRow(row:Pick<AccountInquiryRow,'subject'|'financialIntent'>,reply:AccountInquiryReply|undefined){
 if(!reply||reply.kind!=='COMPLETE'||row.financialIntent!==undefined&&reply.financialIntent!==row.financialIntent)return false;
 if(!reply.subjectSnapshot)return row.financialIntent===undefined;
 return(['kind','userId','name','code','department'] as const).every(key=>(row.subject[key]||'')===(reply.subjectSnapshot![key]||''));
}
