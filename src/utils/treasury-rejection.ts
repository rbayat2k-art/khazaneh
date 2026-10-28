import type {AdvanceRequest,PaymentRequest,BatchItem} from '../types/treasury';
import {fullyUnpaid} from './treasury-correction';
export type TreasuryRejectionTarget={itemType:'ADVANCE'|'PAYMENT'|'BATCH_ITEM';requestId:string;rowId?:string;expectedVersion:number;expectedStatus:string};
export type TreasuryRejectionCommand={action:'REJECT'|'RESTORE';reason:string;operationId:string;targets:TreasuryRejectionTarget[]};
export type RejectionRow=AdvanceRequest|PaymentRequest|BatchItem;
export function activeTreasuryRejection(row:Pick<RejectionRow,'treasuryRejections'>){const records=row.treasuryRejections||[];for(let i=records.length-1;i>=0;i--)if(!records[i].restoredAt)return records[i];}
export function treasuryRejectionEligible(row:RejectionRow){return fullyUnpaid(row)&&!activeTreasuryRejection(row);}
export function treasuryRestoreEligible(row:RejectionRow){return row.status==='Rejected_Treasury'&&!!activeTreasuryRejection(row)&&fullyUnpaid({...row,status:'Pending_Treasury'});}
