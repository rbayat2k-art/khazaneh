import{destinationRecipient}from'../utils/financial-party';
import {chainStateError} from '../utils/request-approval-chain';
import * as XLSX from 'xlsx';
import type {TreasuryDatabaseState,RolePermissionSet} from '../types/treasury';
import {buildUnifiedTreasuryItems} from '../utils/excelExport';
import {buildCompletedTreasuryItems} from '../utils/completed-payments';
import {buildTreasuryOperationalWorkbook} from '../utils/treasury-operational-export';
import {bankInquiryWorkbook} from '../utils/bank-inquiry-export';
import {inquiryEligible} from '../utils/bank-inquiry';
import {treasuryWorkbookBytes}from'../utils/treasury-workbook-format';
const fail=(status:number,message:string):never=>{throw Object.assign(Error(message),{status});};
/** Receives only the current viewer's sanitized projection, never caller-authored rows. */
export function prepareTreasuryExport(state:TreasuryDatabaseState,p:RolePermissionSet,body:any,realTest=false){
 if(!p.canExportReports)fail(403,'مجوز خروجی و چاپ غیرفعال است.');
 const purpose=body?.purpose,allowed=purpose==='OPERATIONAL'?['purpose','pool','uids']:purpose==='IBAN'?['purpose','targets']:purpose==='PRINT_RECEIPT'?['purpose','receiptId']:[];
 if(!body||!allowed.length||Object.keys(body).some(k=>!allowed.includes(k)))fail(400,'انتخاب خروجی معتبر نیست.');
 if(purpose==='PRINT_RECEIPT'){
  if(!p.canViewAttachments&&!p.canViewReceiptArchive)fail(403,'مجوز مشاهدهٔ فیش غیرفعال است.');
  if(typeof body.receiptId!=='string')fail(400,'شناسهٔ فیش معتبر نیست.');
  const receipt=state.receiptArchives.find(r=>r.id===body.receiptId);if(!receipt)fail(409,'فیش در دسترسی جاری نیست؛ فهرست را تازه‌سازی کنید.');
  return {receipt};
 }
 let workbook:XLSX.WorkBook,rowCount:number,prefix:string;
 if(purpose==='OPERATIONAL'){
  const permission={QUEUE:'canAccessTreasuryQueue',IN_PAYMENT:'canAccessTreasuryInPayment',COMPLETED:'canAccessTreasuryCompleted'} as const;
  if(!Object.hasOwn(permission,body.pool))fail(400,'بخش خروجی معتبر نیست.');
  if(!p.canAccessTreasuryWorkspace||!p[permission[body.pool as keyof typeof permission]])fail(403,'مجوز بخش خزانه فعال نیست.');
  if(!Array.isArray(body.uids)||!body.uids.length||body.uids.length>200||body.uids.some((id:any)=>typeof id!=='string'||id.length>512)||new Set(body.uids).size!==body.uids.length)fail(400,'بین۱تا۲۰۰سند یکتا انتخاب کنید.');
  const entries=body.pool==='COMPLETED'?buildCompletedTreasuryItems(state):buildUnifiedTreasuryItems({...state,manualPayments:[],includeManuals:false,targetStatuses:[body.pool==='QUEUE'?'Pending_Treasury':'In_Payment']});
  const byId=new Map(entries.map(r=>[r.uid,r])),selected=body.uids.map((id:string)=>byId.get(id));if(selected.some((r:any)=>!r))fail(409,'انتخاب، مرحله یا دسترسی تغییر کرده است؛ فهرست را تازه‌سازی کنید.');
  for(const entry of selected as any[])for(const row of entry.type==='BATCH'?entry.batchItems||[]:[entry.rawPayment||entry.rawAdvance||entry.rawManual||entry]){const error=chainStateError(row);if(error)fail(409,error);}
  const count=selected.reduce((n:number,r:any)=>n+(r.type==='BATCH'?r.batchItems?.length||0:1),0);if(count>50000)fail(413,'تعداد ردیف خروجی بیش از حد مجاز است.');
  try{({workbook,rowCount}=buildTreasuryOperationalWorkbook(selected));}catch{fail(409,'تاریخچه یا مبلغ انتخاب‌شده معتبر نیست؛ خروجی صادر نشد.');}
  prefix='treasury-'+String(body.pool).toLowerCase();
 }else{
  if(!(p.canInquireBankDetails||p.canConfirmBankOwner||p.canManageBankInquiry))fail(403,'مجوز بخش استعلام فعال نیست.');
  if(!Array.isArray(body.targets)||!body.targets.length||body.targets.length>50)fail(400,'بین۱تا۵۰ردیف انتخاب کنید.');
  const seen=new Set<string>(),entries=body.targets.map((t:any)=>{
   if(!t||Object.keys(t).some(k=>!['itemType','requestId','rowId','expectedVersion'].includes(k))||!['PAYMENT','ADVANCE','BATCH_ITEM'].includes(t.itemType)||typeof t.requestId!=='string'||(t.itemType==='BATCH_ITEM'?typeof t.rowId!=='string':t.rowId!==undefined))fail(400,'هدف خروجی معتبر نیست.');
   const key=JSON.stringify([t.itemType,t.requestId,t.rowId]);if(seen.has(key))fail(400,'ردیف تکراری است.');seen.add(key);
   const parent=t.itemType==='BATCH_ITEM'?state.batchPayments.find(r=>r.id===t.requestId):(t.itemType==='PAYMENT'?state.paymentRequests:state.advanceRequests).find(r=>r.id===t.requestId),row=t.itemType==='BATCH_ITEM'?(parent as any)?.items.find((r:any)=>r.id===t.rowId):parent;
   if(!parent||!row||chainStateError(row)||!inquiryEligible(row,parent)||!Number.isSafeInteger(t.expectedVersion)||t.expectedVersion!==(row.version||1))fail(409,'نسخه، مرحله یا دسترسی ردیف تغییر کرده است.');
   return {row:{...row,status:row.status||parent!.status},trackingCode:parent!.trackingCode,payee:destinationRecipient(t.itemType,parent,row)};
  });
  try{workbook=bankInquiryWorkbook(entries,realTest?'CARDINFO_TEST':undefined);}catch{fail(409,'شبای انتخاب‌شده کامل و تأییدشده نیست؛ خروجی صادر نشد.');}rowCount=entries.length;prefix='shahrah-iban';
 }
 return {base64:(purpose==='OPERATIONAL'?Buffer.from(treasuryWorkbookBytes(workbook!)):XLSX.write(workbook!,{bookType:'xlsx',type:'buffer'})).toString('base64'),fileName:prefix!+'-'+new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')+'.xlsx',rowCount:rowCount!};
}
