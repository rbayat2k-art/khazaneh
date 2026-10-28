import{isPersonnelAdvance,destinationRecipient,personnelName,paymentPurpose}from'./financial-party';
import type {TreasuryDatabaseState,User} from '../types/treasury';
import type {AccountInformation,AccountSubject,FinancialInquiryTarget,InquiryFinancialIntent} from '../types/account-inquiry';

export type InquiryDraftRow={key:string;subject:AccountSubject;question:string};
export const normalizeInquiryName=(value:string)=>value.normalize('NFKC').replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/[\u064b-\u065f\u0670ـ]/g,'').replace(/[‌\s]+/g,' ').trim().toLocaleLowerCase('fa');
export function inquiryPeople(state:TreasuryDatabaseState,user:User,companyId:string){
 const company=(state.companies||[]).find(c=>c.id===companyId)?.name,scope=user.effectiveAccessScope||'SELF_ONLY';
 return state.users.filter(person=>{
  if(person.isActive===false||person.company!==company)return false;
  if(person.id===user.id)return true;
  if(user.role==='ADMIN'||scope==='COMPANY_WIDE')return true;
  if(scope==='DEPARTMENT')return person.department===user.department;
  if(scope!=='ASSIGNED_AND_SUBORDINATES'&&!(scope==='SELF_ONLY'&&user.effectivePermissions?.canRequestOthersAccountInquiry))return false;
  let current:User|undefined=person;const seen=new Set<string>();
  while(current&&!seen.has(current.id)){if(current.id===user.id)return true;seen.add(current.id);current=state.users.find(u=>u.id===current!.supervisorId);}
  return false;
 });
}
export function matchingInquiryPeople(people:User[],query:string){
 const words=normalizeInquiryName(query).split(' ').filter(Boolean);
 return people.filter(person=>words.every(word=>normalizeInquiryName(person.name+' '+(person.personnelCode||'')+' '+person.department).includes(word)));
}
export function newInquiryRow(intent:InquiryFinancialIntent,user?:User):InquiryDraftRow{
 return{key:crypto.randomUUID(),subject:user?{kind:'EMPLOYEE',userId:user.id,name:user.name,code:user.personnelCode,department:user.department}:{kind:intent==='ADVANCE'?'EMPLOYEE':'SUPPLIER',name:'',code:''},question:''};
}
export function inquiryTitle(information:AccountInformation[],names:string[]){
 const topic=information.includes('BALANCE')&&information.includes('STATEMENT')?'مانده و صورت‌حساب':information.includes('STATEMENT')?'صورت‌حساب':information.includes('BALANCE')?'مانده حساب':'توضیح حسابداری';
 return('استعلام '+topic+' — '+(names.length===1?names[0]:names.length+' نفر / طرف‌حساب')).slice(0,300);
}
export function inquiryDraftPayload({user,companyId,intent,information,asOf,fromDate,toDate,rows,linkedTargets}:{user:User;companyId:string;intent:InquiryFinancialIntent;information:AccountInformation[];asOf:string;fromDate:string;toDate:string;rows:InquiryDraftRow[];linkedTargets?:FinancialInquiryTarget[]}){
 if(!companyId)throw Error('شرکت را انتخاب کنید.');
 if(!information.length)throw Error('حداقل یکی از اطلاعات موردنیاز را انتخاب کنید.');
 if(!rows.length||rows.length>50)throw Error('بین یک تا ۵۰ ردیف وارد کنید.');
 const linked=!!linkedTargets?.length,own=rows.filter(row=>row.subject.userId===user.id);
 if(linked&&rows.length!==linkedTargets!.length)throw Error('انتخاب ردیف‌های مالی تغییر کرده است؛ فرم استعلام را دوباره باز کنید.');
 if(!linked&&own.length&&rows.length>1)throw Error('استعلام حساب خودتان را جداگانه و در یک ردیف ثبت کنید.');
 if(!linked&&rows.some(row=>!row.subject.name.trim()))throw Error('نام فرد یا طرف‌حساب را در همهٔ ردیف‌ها وارد کنید.');
 const origin=linked?'FINANCIAL_REVIEW':own.length?'SELF':'OTHERS';
 if(origin==='SELF'&&!user.effectivePermissions?.canRequestOwnAccountInquiry)throw Error('مجوز استعلام حساب خودتان را ندارید.');
 if(origin==='OTHERS'&&!user.effectivePermissions?.canRequestOthersAccountInquiry)throw Error('مجوز استعلام دیگران را ندارید.');
 return{origin,companyId,title:inquiryTitle(information,rows.map(row=>row.subject.name)),information,asOf,fromDate,toDate,rows:rows.map((row,index)=>({question:row.question,...(linked?{financialTarget:linkedTargets![index]}:{financialIntent:intent,...(origin==='OTHERS'?{subject:row.subject}:{})})}))};
}
export function linkedInquiryIdentity(state:TreasuryDatabaseState,target:FinancialInquiryTarget){
 const parent=target.itemType==='ADVANCE'?state.advanceRequests.find(r=>r.id===target.requestId):target.itemType==='PAYMENT'?state.paymentRequests.find(r=>r.id===target.requestId):state.batchPayments.find(r=>r.id===target.requestId),row:any=target.itemType==='BATCH_ITEM'?(parent as any)?.items?.find((r:any)=>r.id===target.rowId):parent;
 if(!parent||!row)return{name:'ردیف مالی انتخاب‌شده',advance:false,purpose:''};const advance=isPersonnelAdvance(target.itemType,parent,row);return{name:advance?personnelName(target.itemType,parent,row):destinationRecipient(target.itemType,parent,row)||'نام طرف‌حساب ثبت نشده',advance,purpose:advance?'':paymentPurpose(row,parent)};
}
export function linkedInquiryName(state:TreasuryDatabaseState,target:FinancialInquiryTarget){return linkedInquiryIdentity(state,target).name;}
