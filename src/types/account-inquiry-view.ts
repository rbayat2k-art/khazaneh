import type{AccountInquiry,AccountInquiryRow,AccountInquiryReply,AccountInquiryFile,FinancialInquiryTarget}from'./account-inquiry';
export type InquiryFileView=Omit<AccountInquiryFile,'sha256'>;
export type InquiryRowView=Omit<AccountInquiryRow,'replies'>&{replies:Array<AccountInquiryReply&{files?:InquiryFileView[]}>;hiddenReplyCount:number;activeQuestion?:string;latestReplyVisible?:boolean;stagedFiles?:InquiryFileView[];conversionContext?:{replyId:string;financialTarget:FinancialInquiryTarget;trackingCode:string;convertedAt:string;today:string}};
export type InquiryView=Omit<AccountInquiry,'rows'>&{rows:InquiryRowView[]};
export type AccountInquiryView={enabled:boolean;readOnly:boolean;inquiries:InquiryView[];permissions:Record<string,boolean>};
