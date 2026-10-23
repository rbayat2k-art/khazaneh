/** Provider-neutral application contract. Raw provider payloads never cross it. */
export type BankLookupResult=
 |{kind:'FOUND';iban:string;bankName:string;deposit:string;ownerNames:string;depositStatus:'02'|'03'}
 |{kind:'REVIEW';code:'ACCOUNT_STATUS';depositStatus:'04'|'05'|'06'|'07'}
 |{kind:'NOT_CONFIGURED'|'INVALID_INPUT'|'INVALID_RESPONSE'|'UNAUTHORIZED'|'RATE_LIMITED'|'UNKNOWN';code?:never};
export type CreditResult={kind:'CREDITS';packages:Array<{name:string;credit:string;orderedAt:string;expiresAt:string}>}|Exclude<BankLookupResult,{kind:'FOUND'|'REVIEW'}>;
export type InquiryClient={configured:()=>boolean;lookup:(card:string)=>Promise<BankLookupResult>;credits:()=>Promise<CreditResult>};
