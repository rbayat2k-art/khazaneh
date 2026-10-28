/** Explicit transaction ownership must never fall back to a source-account holder. */
export function manualCompanyIdentity(row:any):{companyId?:string;company:string}|undefined {
  if(!row||!['companyId','company'].some(key=>Object.prototype.hasOwnProperty.call(row,key)))return;
  return {companyId:typeof row.companyId==='string'?row.companyId:undefined,company:typeof row.company==='string'?row.company:''};
}
