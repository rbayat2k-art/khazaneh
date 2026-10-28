import type {CompanyBankAccount,RolePermissionSet,TreasuryDatabaseState,User} from '../types/treasury';
import {companyPolicy} from './company-access';

/** Organization source accounts are shared; financial records retain their own company policy. */
export function sourceBankPolicy(viewer:User,db:TreasuryDatabaseState,p:RolePermissionSet){
  const admin=viewer.role==='ADMIN',unlocked=!viewer.mustChangePassword;
  const canRead=unlocked&&Boolean(admin||p.canAccessTreasuryBankAccounts||p.canManageBankAccounts||p.canExecutePayment||p.canCreateManualPayment);
  const accounts=db.companyBankAccounts||[],company=companyPolicy(viewer,db);
  const noActiveDefault=!accounts.some(a=>a.isDefault&&a.isActive!==false&&a.status!=='INACTIVE');
  const actions=(account:CompanyBankAccount)=>{
    const manage=unlocked&&Boolean(admin||p.canManageBankAccounts)&&company.entity(account);
    const canChange=manage&&(company.all||!account.isDefault&&!noActiveDefault);
    return {edit:canChange,toggleStatus:canChange,setDefault:manage&&company.all};
  };
  return {
    canRead,
    canUse:(id:unknown)=>unlocked&&Boolean(admin||p.canExecutePayment||p.canCreateManualPayment)&&typeof id==='string'&&accounts.some(a=>a.id===id),
    project:():CompanyBankAccount[]=>canRead?accounts.map(a=>({...a,managementAccess:actions(a)})):[],
  };
}
