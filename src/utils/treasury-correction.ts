import {chainError} from './request-approval-chain';
import type {AdvanceRequest,PaymentRequest,BatchItem,TreasuryCorrection} from '../types/treasury';
export type CorrectionRow=AdvanceRequest|PaymentRequest|BatchItem;
export type CorrectionTarget={itemType:'PAYMENT'|'ADVANCE'|'BATCH_ITEM';requestId:string;rowId?:string;expectedVersion:number};
export type TreasuryReturn=CorrectionTarget&{recipientStage:TreasuryCorrection['toStage'];reason:string};
/** Preserve the pinned supervisor; only an evidenced case-specific ADMIN decision can supply another actual approver. */
export function correctionApproverId(parent:any,row:CorrectionRow):string|undefined{
 const id=row.approvedBySupervisorUserId,evidence=row.adminSupervisorApproval;
 if(row.approvalChain&&!chainError(row)){const c=row.approvalChain,d=c.decisions.filter(d=>d.round===c.round).at(-1);return c.cursor===c.steps.length&&d&&d.actorId===id? id||undefined:undefined;}
 return id&&(id===parent.supervisorId||evidence?.actorId===id&&evidence.at===row.approvedBySupervisorAt&&!!evidence.rejectionId)?id:undefined;
}
export function openTreasuryCorrection(row:Pick<CorrectionRow,'status'|'treasuryCorrection'>):boolean{
  return row.status==='Needs_Revision'&&!!row.treasuryCorrection&&!row.treasuryCorrection.resolvedAt;
}
/** Same correction inbox, but assignment (not request ownership) chooses the technical editor. */
export function isMyRevision(row:Pick<CorrectionRow,'status'|'treasuryCorrection'>,requesterId:string,userId:string,isAdmin=false):boolean{
  return row.status==='Needs_Revision'&&(openTreasuryCorrection(row)?row.treasuryCorrection!.toUserId===userId:requesterId===userId||isAdmin);
}
export function fullyUnpaid(row:CorrectionRow):boolean{
  return !row.requesterDeletedAt&&['Pending_Treasury','In_Payment'].includes(row.status||'')&&
    [row.paidAmount,row.paidAmountSoFar].every(n=>n===undefined||n===null||n===0)&&
    !row.paymentExecutions?.length&&!row.paymentHistory?.length&&!row.receiptId&&!row.paidAt&&!row.paidDateJalali&&!row.sourceAccountSnapshot&&!row.sourceBankAccountId;
}
