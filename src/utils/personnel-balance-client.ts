import {activeAuthToken} from './admin-session';
import {AccountInquiryClientError} from './account-inquiry-client';
export const PERSONNEL_BALANCE_CHANGED='personnel-balance-changed';
export async function personnelBalanceRequest(path='',body?:unknown,signal?:AbortSignal){
 const token=activeAuthToken();if(!token)throw new AccountInquiryClientError('برای ادامه وارد سامانه شوید.',401);
 const response=await window.fetch('/api/personnel-balances'+path,{method:body===undefined?'GET':'POST',headers:{authorization:'Bearer '+token,...body===undefined?{}:{'content-type':'application/json'}},...body===undefined?{}:{body:JSON.stringify(body)},signal,cache:'no-store'});
 if(activeAuthToken()!==token)throw new AccountInquiryClientError('نشست تغییر کرده است.',401);
 const result=await response.json();if(activeAuthToken()!==token)throw new AccountInquiryClientError('نشست تغییر کرده است.',401);
 if(!response.ok)throw new AccountInquiryClientError(result.error||'عملیات ثبت نشد.',response.status,result.code);
 if(body!==undefined)window.dispatchEvent(new Event(PERSONNEL_BALANCE_CHANGED));return result;
}
