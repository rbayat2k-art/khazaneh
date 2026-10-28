import type {TreasuryDatabaseState,User,RolePermissionSet} from '../types/treasury';
import {menuVisible} from './permission-registry';
import {isMyRevision} from './treasury-correction';

/** Counts existing authorized tracking views, not approval tasks or economic obligations. */
export function requesterTrackingCount(db:Pick<TreasuryDatabaseState,'paymentRequests'|'advanceRequests'|'batchPayments'|'accountInquirySummary'|'personnelBalanceSummary'>,user:Pick<User,'id'|'role'>,permissions:Partial<RolePermissionSet>){
 const nav=(id:string)=>menuVisible(permissions,id),all=nav('TRACK_ALL'),revisions=nav('TRACK_NEEDS_REVISION'),admin=user.role==='ADMIN',own=(id:string)=>admin||id===user.id,keys=new Set<string>();
 for(const p of db.paymentRequests)if(own(p.requesterId)&&(all||nav('TRACK_PAYMENT_SINGLE'))||revisions&&isMyRevision(p,p.requesterId,user.id,admin))keys.add('PAYMENT:'+p.id);
 for(const a of db.advanceRequests)if(own(a.requesterId)&&(all||nav('TRACK_ADVANCE_SINGLE'))||revisions&&isMyRevision(a,a.requesterId,user.id,admin))keys.add('ADVANCE:'+a.id);
 for(const b of db.batchPayments)if(own(b.requesterId)&&(all||nav(b.batchType==='ADVANCE'?'TRACK_ADVANCE_BATCH':'TRACK_PAYMENT_BATCH'))||revisions&&b.items.some(it=>isMyRevision(it,b.requesterId,user.id,admin)))keys.add('BATCH:'+b.id);
 const inquiry=nav('ACCOUNT_INQUIRIES_HISTORY')?db.accountInquirySummary?.history||0:nav('ACCOUNT_INQUIRIES_MINE')?db.accountInquirySummary?.mine||0:0;
 const personnel=nav('PERSONNEL_BALANCES_MINE')?db.personnelBalanceSummary?.mine||0:0;
 return keys.size+inquiry+personnel;
}
