import type {AdminSessionProvenance} from './treasury';

export const PERSONNEL_BALANCE_PERMISSIONS=['canViewPersonnelBalances','canRequestPersonnelBalance','canReviewPersonnelBalance','canManagePersonnelBalances'] as const;
export type PersonnelBalancePermission=typeof PERSONNEL_BALANCE_PERMISSIONS[number];
export type PersonnelBalanceTab='CREATE'|'MINE'|'ACCOUNTING';
export type PersonnelBalanceStatus='PENDING_ACCOUNTING'|'NEEDS_REVISION'|'REJECTED'|'CANCELLED'|'FORWARDED';
export const personnelBalanceLabels:Record<PersonnelBalanceStatus,string>={PENDING_ACCOUNTING:'منتظر بررسی و تأیید حسابداری',NEEDS_REVISION:'نیازمند اصلاح ثبت‌کننده',REJECTED:'ردشده توسط حسابداری',CANCELLED:'لغوشده با دلیل',FORWARDED:'تأیید حسابداری؛ ارسال به خزانه'};
export type PersonnelBalanceAudit={id:string;actorId:string;actorName:string;at:string;action:string;reason?:string;requestedAmountChange?:{before:number|null;after:number|null};requestedAmount?:number;approvedAmount?:number;adminSession?:AdminSessionProvenance};
export type PersonnelBalanceFinancialValues={amount:number;costCenter:string;payeeName:string;accountOrCard:string;iban:string;bankName:string;note:string};
export type PersonnelBalanceAccountingRevision={id:string;actorId:string;actorName:string;at:string;reason:string;requestVersionBefore:number;requestVersionAfter:number;paymentVersionBefore:number;paymentVersionAfter:number;before:PersonnelBalanceFinancialValues;after:PersonnelBalanceFinancialValues;adminSession?:AdminSessionProvenance};
export type PersonnelBalanceRequest={
 id:string;trackingCode:string;version:number;companyId:string;company:string;department:string;
 requesterId:string;requesterName:string;personnel:{name:string;userId?:string;code?:string};
 description:string;requestedAmount?:number;status:PersonnelBalanceStatus;createdAt:string;updatedAt:string;audit:PersonnelBalanceAudit[];
 financial?:{requestId:string;trackingCode:string;amount:number;initialAmount?:number;accountantId:string;accountantName:string;at:string};
 accountingRevisions?:PersonnelBalanceAccountingRevision[];
};
export type PersonnelBalanceOperation={id:string;actorId:string;fingerprint:string;requestId:string;at:string};
export type PersonnelBalanceSummary={mine:number;accounting:number;revision:number};
/** Immutable source link. Personnel identity is never a bank account-holder assertion. */
export type PersonnelBalanceRef={schemaVersion:1;requestId:string;trackingCode:string;personnelName:string;personnelUserId?:string;personnelCode?:string;requestedAmount?:number};
