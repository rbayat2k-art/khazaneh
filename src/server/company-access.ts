import type {TreasuryDatabaseState,User} from '../types/treasury';
import {getUserRoles} from '../utils/user-roles';
import {immutableScalarArray} from './financial-selection';

/** Current role membership is authoritative; an empty/missing list grants none. */
export function companyPolicy(viewer:User,db:TreasuryDatabaseState){
  const admin=viewer.role==='ADMIN',allowed=new Set<string>();
  for(const role of getUserRoles(viewer))if(role!=='ADMIN')for(const name of db.roleConfigs?.find(r=>r.role===role)?.allowedCompanies||[])if(typeof name==='string'&&name.trim())allowed.add(name.trim());
  for(const c of db.companies||[])if(allowed.has(c.id)||allowed.has(c.name)){allowed.add(c.id);allowed.add(c.name);}
  const has=(value:unknown)=>admin||typeof value==='string'&&!!value.trim()&&allowed.has(value.trim());
  const users=new Map<string,User>();for(const user of db.users)if(!users.has(user.id))users.set(user.id,user);
  const banks=new Map((db.companyBankAccounts||[]).map(b=>[b.id,b]));
  const entity=(row:any,ownerId?:string):boolean=>{
    if(admin)return true;if(!row)return false;
    // Stable ID wins over an immutable historical display name after a rename.
    if(row.companyId)return Boolean(db.companies?.some(c=>c.id===row.companyId)&&has(row.companyId));
    let declared=false;
    for(const key of ['company','companyName']){const value=row[key];if(value!==undefined&&value!==null&&value!==''){declared=true;if(!has(value))return false;}}
    return declared||has(ownerId?users.get(ownerId)?.company:undefined);
  };
  const financial=(row:any)=>entity(row,row?.requesterId);
  const bank=(id:unknown)=>admin||typeof id==='string'&&entity(banks.get(id));
  const manual=(row:any)=>admin||Boolean(row&&(row.sourceBankAccountId?bank(row.sourceBankAccountId):entity(row.sourceAccountSnapshot||{},row.createdById)));
  const role=(key:unknown)=>{const config=db.roleConfigs?.find(r=>r.role===key);return admin||key!=='ADMIN'&&!!config&&Array.isArray(config.allowedCompanies)&&config.allowedCompanies.every(has);};
  // Shared/global settings cannot be partitioned by an arbitrary record ID.
  const all=admin||Boolean(db.companies?.length&&db.companies.every(c=>has(c.id)||has(c.name)));
  // This is the actual current policy, not a second role/permission evaluator.
  // Keep owner-map first-ID-wins semantics and exact catalog IDs (no coercion).
  const financialContext=():string|undefined=>{
    if(!immutableScalarArray(db.users,['id','company'],['id'])||db.companies&&!immutableScalarArray(db.companies,['id','name'],['id','name']))return;
    return JSON.stringify([[...allowed].sort(),(db.companies||[]).map(c=>c.id).sort(),[...users].map(([id,u])=>[id,u.company])]);
  };
  return {has,entity,financial,bank,manual,role,all,financialContext};
}
