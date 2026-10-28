import type {AdminSessionProvenance} from '../types/treasury';
export const adminSessionActor=(name:string|undefined,session?:AdminSessionProvenance)=>session?`${name||'کاربر'} (توسط مدیر: ${session.adminName})`:name||'';
export const ADMIN_ENTRY_TOKEN='treasury_admin_entry_token';
export const ADMIN_ENTRY_CONTEXT='treasury_admin_entry_context';
export const activeAuthStorage=()=>sessionStorage.getItem(ADMIN_ENTRY_TOKEN)?sessionStorage:localStorage;
export const activeAuthToken=()=>sessionStorage.getItem(ADMIN_ENTRY_TOKEN)||localStorage.getItem('treasury_auth_session_token');
export function clearAdminEntry(){sessionStorage.removeItem(ADMIN_ENTRY_TOKEN);sessionStorage.removeItem(ADMIN_ENTRY_CONTEXT);sessionStorage.removeItem('treasury_auth_user_session');}
export async function endAdminEntry(){
 const info=JSON.parse(sessionStorage.getItem(ADMIN_ENTRY_CONTEXT)||'null');
 if(info){const response=await fetch('/api/auth/impersonation/end',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+localStorage.getItem('treasury_auth_session_token')},body:JSON.stringify({impersonationId:info.id})});
  if(!response.ok&&![401,403,404].includes(response.status)){const data=await response.json();throw Error(data.error||'بازگشت انجام نشد؛ دوباره تلاش کنید.');}}
 clearAdminEntry();window.location.reload();
}
