import type { MasterDataKind, TreasuryDatabaseState } from '../types/treasury';
export const MASTER_CODE_PREFIX:Record<MasterDataKind,string>={companies:'001',departments:'002','cost-centers':'003'};
type CodeState=Pick<TreasuryDatabaseState,'companies'|'departments'|'costCenters'|'masterDataCodeSequences'>;
export function nextMasterDataCode(db:CodeState,kind:MasterDataKind):string {
  if(db.masterDataCodeSequences!==undefined&&(!db.masterDataCodeSequences||typeof db.masterDataCodeSequences!=='object'||Array.isArray(db.masterDataCodeSequences)))throw Error('شمارندهٔ کد اطلاعات پایه معتبر نیست.');
  const prefix=MASTER_CODE_PREFIX[kind],stored=db.masterDataCodeSequences?.[kind];
  if(stored!==undefined&&(!Number.isSafeInteger(stored)||stored<0))throw Error('شمارندهٔ کد اطلاعات پایه معتبر نیست؛ ثبت انجام نشد.');
  let high=stored||0;
  for(const row of (kind==='companies'?db.companies:kind==='departments'?db.departments:db.costCenters)||[]){
    const code=String(row.code).trim().replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
    if(code.startsWith(prefix)&&/^\d{3,}$/.test(code.slice(3))){const n=Number(code.slice(3));if(!Number.isSafeInteger(n))throw Error('بازهٔ کد اطلاعات پایه معتبر نیست.');high=Math.max(high,n);}
  }
  if(!Number.isSafeInteger(high+1))throw Error('بازهٔ کد اطلاعات پایه تکمیل شده است.');
  return prefix+String(high+1).padStart(3,'0');
}
