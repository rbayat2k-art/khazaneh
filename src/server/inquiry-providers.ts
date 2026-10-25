import {CardinfoClient} from './cardinfo';
import type {InquiryClient} from './inquiry-client';
import type {InquiryProviderDescriptor} from '../utils/inquiry-provider-contract';
export type ProviderDefinition={descriptor:InquiryProviderDescriptor;validate:(settings:Record<string,string>,credentials:Record<string,string>)=>void;create:(settings:Record<string,string>,credentials:Record<string,string>,transport?: (input:string,init:RequestInit)=>Promise<Response>)=>InquiryClient};
const invalid=():never=>{throw Error('INVALID_CONNECTION');};
const plain=(v:unknown):v is Record<string,string>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
/** Server-owned registry: a new contract needs a reviewed adapter AND egress policy.
 * No arbitrary user-supplied URL, header, method, parser or executable template. */
const definitions:readonly ProviderDefinition[]=[{
 descriptor:{id:'cardinfo-v1',label:'REST — استعلام کارت و شبا (قرارداد ۱)',credentialFields:[{key:'apiKey',label:'کلید دسترسی API',required:true,maxLength:4096,secret:true}],settingFields:[],connectionInfo:{endpoint:'https://cardinfo.ir/inquiry/apiv1',authentication:'کلید API در هدر Authorization به روش Bearer',timeoutSeconds:8,responseLimitKiB:16},capabilities:{cardToIban:true,credits:true}},
 validate(settings,credentials){if(Object.keys(settings).length||Object.keys(credentials).some(k=>k!=='apiKey')||credentials.apiKey!==undefined&&!/^[\x21-\x7e]{1,4096}$/.test(credentials.apiKey))invalid();},
 create:(_settings,credentials,transport)=>new CardinfoClient(credentials.apiKey||'',transport),
}];
export const inquiryProviders=definitions.map(p=>p.descriptor);
export function providerDefinition(id:string){const p=definitions.find(p=>p.descriptor.id===id);if(!p)return invalid();return p;}
export function validateProviderInput(id:string,settings:unknown,credentials:unknown){if(!plain(settings)||!plain(credentials)||Object.values(settings).some(v=>typeof v!=='string')||Object.values(credentials).some(v=>typeof v!=='string'))return invalid();providerDefinition(id).validate(settings,credentials);}
export function providerConfigured(id:string,credentials:Record<string,string>){return providerDefinition(id).descriptor.credentialFields.filter(f=>f.required).every(f=>!!credentials[f.key]);}
