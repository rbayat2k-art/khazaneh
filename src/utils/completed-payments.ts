import{destinationRecipient}from'./financial-party';
import {buildUnifiedTreasuryItems,type UnifiedTreasuryItem} from './excelExport';
import type {TreasuryDatabaseState,RequestStatus} from '../types/treasury';
import {paymentExecutionHistory,indexExecutionReceipts} from './payment-execution-history';
import {requestTimeFields} from './record-time';
type State=Pick<TreasuryDatabaseState,'batchPayments'|'paymentRequests'|'advanceRequests'|'manualPayments'|'receiptArchives'>;
export function completedReportSummary(items:UnifiedTreasuryItem[]){const issues=items.filter(i=>i.completedEntry?.issue).length,legacy=items.filter(i=>i.completedEntry?.legacy&&!i.completedEntry.issue).length;return {rows:items.length,issues,legacy,total:issues?null:items.reduce((sum,i)=>sum+BigInt(i.amount),0n)};}
/** Read-only ledger: one row per committed execution, including partials, never one row per request. */
export function buildCompletedTreasuryItems(state:State):UnifiedTreasuryItem[]{
 const receiptLookup=indexExecutionReceipts(state.receiptArchives);
 const statuses=[...new Set([...state.paymentRequests,...state.advanceRequests,...state.batchPayments,...state.batchPayments.flatMap(b=>b.items)].map(r=>r.status).filter(Boolean))] as RequestStatus[];
 const bases=buildUnifiedTreasuryItems({...state,targetStatuses:statuses,includeManuals:true}),result:UnifiedTreasuryItem[]=[];
 for(const base of bases){
  if(base.type==='MANUAL'){result.push({...base,completedEntry:{approvedAmount:base.amount,index:1,count:1}});continue;}
  const raw=base.rawPayment||base.rawAdvance;
  for(const row of base.type==='BATCH'?base.batchItems||[]:raw?[raw]:[]){
   if(row.requesterDeletedAt)continue;
   const {entries,paid,approved,issue}=paymentExecutionHistory({...row,status:row.status||base.rawBatch?.status});if(!paid&&!entries.length&&!issue)continue;
   const child=base.type==='BATCH',common:UnifiedTreasuryItem={...base,...(child?{batchItems:[row as any],payeeName:destinationRecipient('BATCH_ITEM',base.rawBatch,row),description:(row as any).description||base.description,costCenter:(row as any).costCenter||'',accountOrCard:row.accountOrCard||'',iban:row.iban||'',destinationBank:row.bankName||'',initialAmount:row.initialAmount??row.amount,status:row.status||base.rawBatch!.status,invoiceNumber:(row as any).invoiceNumber||'-',requestedMonth:(row as any).requestedMonth||'-',approverNote:(row as any).approverNote||base.approverNote,accountingNote:(row as any).accountingNote||base.accountingNote,inPaymentAt:row.inPaymentAt||base.inPaymentAt}:{}),paidAmountSoFar:paid,remainingAmount:Math.max(0,approved-paid)};
   const validEntries=issue?[]:entries;
   if(!validEntries.length){result.push({...common,uid:base.uid+':'+(child?row.id+':':'')+'legacy',amount:paid,completedEntry:{rowId:child?row.id:undefined,approvedAmount:approved,index:1,count:1,legacy:true,issue:issue||undefined},sourceBankAccountId:null,sourceAccountSnapshot:null,paidBankName:null,paidDateJalali:null,paidAt:null,bankRefNumber:null,treasuryName:null,receiptId:null,receiptObj:null,...requestTimeFields(base.rawBatch||row,[{status:'Paid'}])});continue;}
   validEntries.forEach((event,index)=>result.push({...common,uid:base.uid+':'+(child?row.id+':':'')+event.id,amount:event.amount,paymentExecution:event,completedEntry:{executionId:event.id,rowId:child?row.id:undefined,approvedAmount:approved,index:index+1,count:validEntries.length},sourceBankAccountId:event.sourceBankAccountId||null,sourceAccountSnapshot:event.sourceAccountSnapshot||null,paidBankName:event.sourceAccountSnapshot?.bankName||event.paidBankName||null,paidDateJalali:event.paidDateJalali||event.executedDateJalali||event.dateJalali||null,paidAt:event.paidAt||event.executedAt||null,bankRefNumber:event.bankRefNumber||null,treasuryName:event.treasuryUserName||event.executedByUserName||event.executedByName||null,receiptId:event.receiptId||null,receiptObj:receiptLookup(event,row.id),...requestTimeFields(base.rawBatch||row,[{...event,status:'Paid'}])}));
  }
 }
 return result;
}
