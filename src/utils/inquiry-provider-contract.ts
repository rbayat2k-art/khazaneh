/** Public descriptors contain form data only, never URLs, auth templates or code. */
export type ProviderField={key:string;label:string;required:boolean;maxLength:number;secret:boolean};
export type InquiryProviderDescriptor={id:string;label:string;credentialFields:ProviderField[];settingFields:ProviderField[];connectionInfo?:{endpoint:string;authentication:string;timeoutSeconds:number;responseLimitKiB:number};capabilities:{cardToIban:boolean;credits:boolean}};
export type InquiryConnectionMetadata={id:string;name:string;providerId:string;settings:Record<string,string>;hasCredentials:boolean;configuredFields:string[]};
export type InquiryConnectionsMetadata={available:boolean;revision:number;activeConnectionId:string;profiles:InquiryConnectionMetadata[];providers:InquiryProviderDescriptor[]};
