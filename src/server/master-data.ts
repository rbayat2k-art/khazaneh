import crypto from 'node:crypto';
import type {BulkMasterDataKind,MasterDataKind,OrganizationalDepartment,CostCenterItem,TreasuryDatabaseState} from '../types/treasury';
import {nextMasterDataCode} from '../utils/master-data-codes';
export function allocateMasterDataCode(db:TreasuryDatabaseState,kind:MasterDataKind):string {
  const code=nextMasterDataCode(db,kind);
  db.masterDataCodeSequences={...db.masterDataCodeSequences,[kind]:Number(code.slice(3))};
  return code;
}
export function immutableMasterDataCode(existing:{code:string}|undefined,provided:unknown):string {
  if(!existing)throw Error('رکورد مورد نظر یافت نشد.');
  if(provided!==undefined&&provided!==existing.code)throw Error('کد یکتا خودکار است و هنگام ویرایش تغییر نمی‌کند.');
  return existing.code;
}
export function retainMasterDataHighWater(db:TreasuryDatabaseState,kind:MasterDataKind):void {
  db.masterDataCodeSequences={...db.masterDataCodeSequences,[kind]:Number(nextMasterDataCode(db,kind).slice(3))-1};
}
const text=(value:unknown,label:string,required=false)=>{if(value===undefined||value===null){if(required)throw Error(`${label} الزامی است.`);return '';}
  if(typeof value!=='string'||value.length>2000||(required&&!value.trim()))throw Error(`${label} معتبر نیست.`);return value.trim();};
/** Called inside the existing serialized write turn. Caller commits once after all rows validate. */
export function createMasterDataRow(db:TreasuryDatabaseState,kind:BulkMasterDataKind,input:unknown,today:string):OrganizationalDepartment|CostCenterItem {
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('اطلاعات ردیف معتبر نیست.');
  const row=input as Record<string,unknown>;
  const allowed=kind==='departments'?['name','companyId','description','isActive']:['name','companyId','departmentId','description','budgetCategory','isActive'];
  if(Object.keys(row).some(key=>!allowed.includes(key)))throw Error('ردیف فقط اطلاعات تعریف جدید را می‌پذیرد؛ کد و شناسه خودکارند.');
  if(row.isActive!==undefined&&typeof row.isActive!=='boolean')throw Error('وضعیت فعال معتبر نیست.');
  const name=text(row.name,'عنوان',true),companyId=text(row.companyId,'شرکت',true),description=text(row.description,'توضیحات');
  const company=db.companies?.find(c=>c.id===companyId&&c.isActive!==false);if(!company)throw Error('شرکت مرتبط معتبر یا فعال نیست.');
  const pool=kind==='departments'?db.departments:db.costCenters;
  if(pool?.some(r=>r.companyId===companyId&&r.name.trim()===name))throw Error('عنوان در همین شرکت تکراری است.');
  const common={name,companyId:company.id,companyName:company.name,description:description||undefined,isActive:row.isActive!==false,createdAt:today,updatedAt:today};
  if(kind==='departments'){
    const result:OrganizationalDepartment={...common,id:'dept-'+crypto.randomUUID(),code:allocateMasterDataCode(db,kind)};
    (db.departments||=[]).push(result);return result;
  }
  const departmentId=text(row.departmentId,'واحد مرتبط');
  const department=departmentId?db.departments?.find(d=>d.id===departmentId&&d.companyId===companyId&&d.isActive!==false):undefined;
  if(departmentId&&!department)throw Error('واحد مرتبط باید فعال و متعلق به همین شرکت باشد.');
  const budgetCategory=text(row.budgetCategory,'طبقه بودجه‌ای');
  const result:CostCenterItem={...common,id:'cc-'+crypto.randomUUID(),code:allocateMasterDataCode(db,kind),departmentId:department?.id||null,departmentName:department?.name||null,budgetCategory:budgetCategory||undefined};
  (db.costCenters||=[]).push(result);return result;
}
