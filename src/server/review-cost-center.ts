import type {TreasuryDatabaseState,User} from '../types/treasury';import {companyPolicy} from './company-access';import {requestCostCenters} from '../utils/request-cost-center';
export class ReviewCostCenterError extends Error {status:number;constructor(status:number,message:string){super(message);this.status=status;}}
type Change={previous:string;next:string;version:number};
/** Runs before any comment/amount/history mutation inside the admitted command. */
export function prepareReviewCostCenter(db:TreasuryDatabaseState,viewer:User,body:any,parent:any,row:any):Change|undefined{
 if(body.newCostCenterId===undefined)return;
 if(!['UPDATE_AMOUNT_COMMENT','UPDATE_AND_APPROVE'].includes(body.action)||!['PAYMENT','BATCH_ITEM'].includes(body.itemType)||typeof body.newCostCenterId!=='string'||!body.newCostCenterId||!parent||!row)throw new ReviewCostCenterError(400,'مرکز هزینه فقط در ویرایش ردیف پرداختِ صریح مجاز است.');
 if(!Number.isSafeInteger(body.expectedVersion)||body.expectedVersion<1)throw new ReviewCostCenterError(400,'نسخهٔ معتبر ردیف برای ویرایش مرکز هزینه الزامی است.');
 if(body.expectedVersion!==(row.version||1))throw new ReviewCostCenterError(409,'نسخهٔ درخواست تغییر کرده است؛ فرم را تازه‌سازی کنید.');
 const center=db.costCenters?.find(c=>c.id===body.newCostCenterId);if(!center||center.isActive===false)throw new ReviewCostCenterError(400,'مرکز هزینه فعال را از فهرست انتخاب کنید.');
 const requester=db.users.find(u=>u.id===parent.requesterId),allowed=requestCostCenters(db.costCenters||[],db.companies||[],parent,requester?.company);
 if(!allowed.some(c=>c.id===center.id)||!companyPolicy(viewer,db).entity(center))throw new ReviewCostCenterError(403,'مرکز هزینه باید متعلق به شرکت همین درخواست و در محدودهٔ مجاز جاری باشد.');
 if(row.costCenter===center.name)return;
 return {previous:row.costCenter||'',next:center.name,version:row.version||1};
}
export function applyReviewCostCenter(row:any,change:Change|undefined,viewer:User,stage:'APPROVER'|'ACCOUNTING',at:string,reason:string){if(!change)return;row.costCenter=change.next;row.version=Math.max(row.version||1,change.version+1);(row.auditHistory||=[]).push({id:crypto.randomUUID(),action:'ویرایش مرکز هزینه',actorId:viewer.id,actorRole:viewer.role,stage,changedBy:viewer.name,changedAt:at,version:row.version,reason:reason.trim(),comment:`مرکز هزینه قبلی: ${change.previous||'ثبت نشده'} ← مرکز هزینه جدید: ${change.next}`});}
