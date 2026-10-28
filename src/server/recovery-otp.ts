import crypto from 'node:crypto';
import type {User} from '../types/treasury';

export const RECOVERY_OTP_TTL_MS=3*60_000;
export const RECOVERY_OTP_MAX_ATTEMPTS=5;
type Principal=Pick<User,'id'|'personnelCode'|'phone'|'passwordHash'|'passwordSalt'|'isActive'>;
type Challenge={id:string;binding:string;salt:string;hash:Buffer;expiresAt:number;attempts:number;deliveryStatus:'SENT'|'UNKNOWN'};
const digits=(v:unknown)=>String(v||'').replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).trim();
const binding=(u:Principal)=>crypto.createHash('sha256').update(JSON.stringify([u.id,digits(u.personnelCode).toLowerCase(),digits(u.phone),u.passwordHash||'',u.passwordSalt||''])).digest('hex');

/** Process-local recovery secrets; never persisted, logged or returned as metadata. */
export class RecoveryOtpChallenges {
 private entries=new Map<string,Challenge>();
 private now:()=>number;
 constructor(now:()=>number=()=>Date.now()){this.now=now;}
 private current(u:Principal){const c=this.entries.get(u.id);if(c&&(u.isActive===false||c.binding!==binding(u)||c.expiresAt<=this.now())){this.entries.delete(u.id);return;}return c;}
 metadata(u:Principal){const c=this.current(u);if(!c)return;return{otpAvailable:c.attempts<RECOVERY_OTP_MAX_ATTEMPTS,challengeLocked:c.attempts>=RECOVERY_OTP_MAX_ATTEMPTS,expiresAt:c.expiresAt,resendAvailableAt:c.expiresAt,serverNow:this.now(),deliveryStatus:c.deliveryStatus};}
 issue(u:Principal){if(u.isActive===false)throw Error('Inactive recovery principal');if(this.current(u))throw Error('Existing recovery challenge must be reused');const code=String(crypto.randomInt(100000,1_000_000)),salt=crypto.randomBytes(16).toString('hex'),id=crypto.randomUUID();this.entries.set(u.id,{id,binding:binding(u),salt,hash:crypto.scryptSync(code,salt,64),expiresAt:this.now()+RECOVERY_OTP_TTL_MS,attempts:0,deliveryStatus:'UNKNOWN'});return{id,code};}
 delivery(u:Principal,id:string,sent:boolean){const c=this.current(u);if(c?.id===id)c.deliveryStatus=sent?'SENT':'UNKNOWN';}
 verify(u:Principal,code:string):{kind:'MISSING'}|{kind:'LOCKED'}|{kind:'WRONG'}|{kind:'VALID';challengeId:string}{const c=this.current(u);if(!c)return{kind:'MISSING'};if(c.attempts>=RECOVERY_OTP_MAX_ATTEMPTS)return{kind:'LOCKED'};if(!/^\d{6}$/.test(code)||!crypto.timingSafeEqual(crypto.scryptSync(code,c.salt,64),c.hash)){c.attempts++;return{kind:c.attempts>=RECOVERY_OTP_MAX_ATTEMPTS?'LOCKED':'WRONG'};}return{kind:'VALID',challengeId:c.id};}
 consume(u:Principal,id:string){if(this.entries.get(u.id)?.id===id)this.entries.delete(u.id);}
}
