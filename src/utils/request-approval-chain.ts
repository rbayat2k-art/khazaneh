import type {RequestApprovalType} from '../types/treasury';
export type ApprovalChain={schemaVersion:1;type:RequestApprovalType;steps:{userId:string;name:string}[];cursor:number;round:number;decisions:{round:number;step:number;assignedUserId:string;actorId:string;actorName:string;at:string;version:number;amount:number}[]};
export type ChainRow={approvalChain?:ApprovalChain;status?:string;version?:number;amount?:number;approvedAmount?:number|null;approvedBySupervisorUserId?:string|null;approvedBySupervisorName?:string|null;approvedBySupervisorAt?:string|null;approverApprovedVersion?:number|null;[key:string]:any};
export function chainError(row:ChainRow):string|undefined{
 if(row.approvalChain===undefined)return;const c=row.approvalChain;
 if(!c||c.schemaVersion!==1||!['ADVANCE_SINGLE','ADVANCE_BATCH','PAYMENT_SINGLE','PAYMENT_BATCH'].includes(c.type)||!Array.isArray(c.steps)||c.steps.length<2||c.steps.length>256||c.steps.some(s=>!s||typeof s.userId!=='string'||!s.userId||typeof s.name!=='string')||new Set(c.steps.map(s=>s.userId)).size!==c.steps.length||!Number.isSafeInteger(c.cursor)||c.cursor<0||c.cursor>c.steps.length||!Number.isSafeInteger(c.round)||c.round<0||!Array.isArray(c.decisions))return 'مسیر تأیید ذخیره‌شده معتبر نیست؛ اقدام متوقف شد.';
 if(c.decisions.some(d=>!d||!Number.isSafeInteger(d.round)||d.round<0||d.round>c.round||!Number.isSafeInteger(d.step)||d.step<0||d.step>=c.steps.length||d.assignedUserId!==c.steps[d.step].userId||typeof d.actorId!=='string'||!d.actorId||typeof d.at!=='string'||!Number.isSafeInteger(d.version)||d.version<1))return 'سابقهٔ مراحل تأیید همساز نیست.';
 const current=c.decisions.filter(d=>d.round===c.round);if(current.length!==c.cursor||current.some((d,i)=>d.step!==i))return 'پیشرفت مسیر تأیید با سابقه همساز نیست.';
}
export function currentSupervisorId(parent:any,row:ChainRow=parent):string|undefined{if(row.approvalChain!==undefined){if(chainError(row))return;const c=row.approvalChain;return c.steps[Math.min(c.cursor,c.steps.length-1)]?.userId;}return parent.supervisorId||undefined;}
export function chainReviewerVisible(row:ChainRow,userId:string){const c=row.approvalChain;return !!c&&!chainError(row)&&(c.cursor<c.steps.length&&c.steps[c.cursor].userId===userId||c.decisions.some(d=>d.assignedUserId===userId||d.actorId===userId));}
export function advanceApprovalChain(row:ChainRow,actor:{id:string;name:string;role:string},at:string){
 if(row.approvalChain===undefined)return;const error=chainError(row);if(error)throw Error(error);const c=row.approvalChain;if(c.cursor>=c.steps.length)throw Error('همه مراحل سرپرستی قبلاً تأیید شده‌اند.');const step=c.steps[c.cursor];if(actor.role!=='ADMIN'&&actor.id!==step.userId)throw Error('این نوبت تأیید متعلق به شخص دیگری است.');
 row.version=(row.version||1)+1;c.decisions.push({round:c.round,step:c.cursor,assignedUserId:step.userId,actorId:actor.id,actorName:actor.name,at,version:row.version,amount:Number(row.approvedAmount??row.amount)});c.cursor++;row.status=c.cursor<c.steps.length?'Pending_Approver':'Pending_Accounting';Object.assign(row,{approverId:actor.id,approverName:actor.name,approverDecidedAt:at,approvedByApproverAt:at,approverDecisionVersion:row.version,approverApprovedVersion:row.version,approvedBySupervisorUserId:actor.id,approvedBySupervisorName:actor.name,approvedBySupervisorAt:at});
}
export function resumeApprovalChain(row:ChainRow,sensitiveChanged:boolean){if(row.approvalChain===undefined)return;const error=chainError(row);if(error)throw Error(error);const c=row.approvalChain;if(sensitiveChanged&&c.cursor>0){c.round++;c.cursor=0;for(const k of ['approvedBySupervisorUserId','approvedBySupervisorName','approvedBySupervisorAt','approverId','approverName','approverDecidedAt','approvedByApproverAt','approverDecisionVersion','approverApprovedVersion'])row[k]=null;}row.status=c.cursor<c.steps.length?'Pending_Approver':'Pending_Accounting';}
export function chainStepIds(row:ChainRow):string[]{return row.approvalChain&&!chainError(row)?row.approvalChain.steps.map(s=>s.userId):[];}

export function currentSupervisorName(parent:any,row:ChainRow=parent){return row.approvalChain&&!chainError(row)?row.approvalChain.steps[Math.min(row.approvalChain.cursor,row.approvalChain.steps.length-1)]?.name:parent.supervisorName;}

/** Admission checks the persisted state; transition helpers may briefly carry a legacy next-status. */
export function chainStateError(row:ChainRow):string|undefined{
 const error=chainError(row);if(error||row.approvalChain===undefined)return error;const c=row.approvalChain;
 if(!Number.isSafeInteger(row.version)||row.version!<1||c.decisions.some((d,i)=>d.version>row.version!||i>0&&d.version<=c.decisions[i-1].version||!Number.isSafeInteger(d.amount)||d.amount<=0))return 'نسخه یا مبلغ سابقهٔ تأیید همساز نیست.';
 const complete=c.cursor===c.steps.length;
 if((['Pending_Accounting','Pending_Treasury','In_Payment','Paid','Rejected_Treasury'].includes(row.status||'')||row.status==='Needs_Revision'&&!!row.treasuryCorrection||row.status==='Rejected'&&row.reviewRejection?.stage==='ACCOUNTING')&&!complete||row.status==='Pending_Approver'&&complete||row.status==='Rejected'&&row.reviewRejection?.stage==='APPROVER'&&complete)return 'وضعیت درخواست با مراحل تأیید همساز نیست؛ اقدام متوقف شد.';
}
