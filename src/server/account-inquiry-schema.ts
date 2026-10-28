import type {TreasuryDatabaseState as DB} from '../types/treasury';
import {ACCOUNT_INQUIRY_PERMISSIONS} from '../types/account-inquiry';

/** Version 2 adds a financial purpose that older binaries must not ignore. */
export function initializeAccountInquiries(db:DB,enabled:boolean){
 const version=db.accountInquirySchemaVersion;
 if(version!==undefined&&version!==1&&version!==2)throw Error('Unsupported account inquiry schema');
 if(version===1||version===2){
  if(!Array.isArray(db.accountInquiries)||!Array.isArray(db.accountInquiryFiles)||!Array.isArray(db.accountInquiryOperations))throw Error('Incomplete account inquiry schema');
  if(version===2)return false;
  if(db.accountInquiries.some(q=>q.rows.some(row=>row.financialIntent!==undefined||row.replies.some(reply=>reply.financialIntent!==undefined))))throw Error('Inquiry version 1 contains newer fields; reconciliation required');
  if(!enabled)return false;
  // Retain every historical row, reply, operation, attachment and grant exactly.
  db.accountInquirySchemaVersion=2;return true;
 }
 if(!enabled)return false;
 if(db.accountInquiries?.length||db.accountInquiryFiles?.length||db.accountInquiryOperations?.length)throw Error('Unversioned account inquiry records require reconciliation');
 db.accountInquirySchemaVersion=2;db.accountInquiryReadOnly=false;db.accountInquiries=[];db.accountInquiryFiles=[];db.accountInquiryOperations=[];
 for(const role of db.roleConfigs||[])for(const key of ACCOUNT_INQUIRY_PERMISSIONS)if(role.permissions[key]===undefined)role.permissions[key]=role.role==='ADMIN';
 return true;
}
