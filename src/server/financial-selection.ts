// Only raw COMPANY_WIDE financial selections; never sessions, grants or files.
type Row={id:string};
const dependencies=['id','requesterId','companyId','company','companyName','requesterDeletedAt'];
export function immutableScalars(value:any,fields:string[],required:string[]=[]):boolean {
 if(!value||typeof value!=='object'||!Object.isFrozen(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return false;
 for(const field of fields){const descriptor=Object.getOwnPropertyDescriptor(value,field);if(!descriptor){if(required.includes(field)||field in value)return false;continue;}
  if(!('value'in descriptor)||required.includes(field)&&typeof descriptor.value!=='string'||descriptor.value!==undefined&&descriptor.value!==null&&typeof descriptor.value!=='string')return false;
 }
 return true;
}
export function immutableScalarArray(rows:any[],fields:string[],required:string[]=[]):boolean {
 if(!Array.isArray(rows)||!Object.isFrozen(rows)||Object.getPrototypeOf(rows)!==Array.prototype)return false;
 for(let index=0;index<rows.length;index++){const descriptor=Object.getOwnPropertyDescriptor(rows,index);if(!descriptor||!('value'in descriptor)||!immutableScalars(descriptor.value,fields,required))return false;}
 return true;
}

type Entry={source:any[];key:string;selected:any[];cost:number};
export class FinancialSelectionCache {
 private readonly validRows=new WeakSet<object>();
 private readonly validArrays=new WeakSet<object>();
 private readonly entries=new WeakMap<any[],Map<string,Entry>>();
 private readonly lru=new Map<Entry,true>();
 private rowReferences=0;
 private readonly validBatchArrays=new WeakSet<object>();
 private related:Array<{sources:any[][];lookup:{has:(id:string)=>boolean};cost:number}>=[];
 private relatedRows=0;
 private readonly relatedLookups=new WeakSet<object>();
 private readonly validReceiptArrays=new WeakSet<any[]>();
 private readonly validReceiptRows=new WeakSet<object>();
 private readonly visibleReceipts=new WeakMap<any[],WeakSet<object>>();
 private readonly maxRows:number;
 private readonly maxEntries:number;
 constructor(maxRows=120000,maxEntries=256){this.maxRows=maxRows;this.maxEntries=maxEntries;}
 private eligible(rows:any[]):boolean {
  // A changed prototype must never make a retained decision skip inherited data.
  if(dependencies.some(key=>key in Object.prototype)||!Array.isArray(rows)||!Object.isFrozen(rows)||Object.getPrototypeOf(rows)!==Array.prototype)return false;
  if(this.validArrays.has(rows))return true;
  for(let index=0;index<rows.length;index++){const descriptor=Object.getOwnPropertyDescriptor(rows,index);if(!descriptor||!('value'in descriptor))return false;const row=descriptor.value;if(this.validRows.has(row))continue;if(!immutableScalars(row,dependencies,['id']))return false;this.validRows.add(row);}
  this.validArrays.add(rows);return true;
 }
 private drop(entry:Entry){this.lru.delete(entry);this.rowReferences-=entry.cost;this.entries.get(entry.source)?.delete(entry.key);}
 select<T extends Row>(rows:T[],key:string|undefined,visible:(row:T)=>boolean):T[]{
  const retain=key!==undefined&&this.eligible(rows),own=retain?this.entries.get(rows):undefined,found=own?.get(key!);
  if(found){this.lru.delete(found);this.lru.set(found,true);return found.selected;}
  const selected=rows.filter(visible),result=selected.length===rows.length&&Object.isFrozen(rows)?rows:retain?Object.freeze(selected) as T[]:selected;
  if(retain)this.validArrays.add(result);
  const cost=rows.length+result.length;
  if(!retain||cost>this.maxRows||this.maxEntries<=0)return result;
  while(this.lru.size&&(this.rowReferences+cost>this.maxRows||this.lru.size>=this.maxEntries||Number(own?.size)>=64)){
   const old=Number(own?.size)>=64?own!.values().next().value!:this.lru.keys().next().value!;this.drop(old);
  }
  const current=this.entries.get(rows)||new Map<string,Entry>(),entry={source:rows,key:key!,selected:result,cost};current.set(key!,entry);this.entries.set(rows,current);this.lru.set(entry,true);this.rowReferences+=cost;return result;
 }
 /** Derived membership only, AFTER current visibility selection. Independently
  * bounded to maxRows TOTAL references / at most 64 entries, never a grant. */
 relatedIds(advances:any[],payments:any[],batches:any[]):{has:(id:string)=>boolean}{
  const sources=[advances,payments,batches];let immutable=!('items'in Object.prototype)&&sources.every(rows=>this.eligible(rows));
  if(immutable&&!this.validBatchArrays.has(batches)){
   for(const row of batches){const items=Object.getOwnPropertyDescriptor(row,'items');if(!items){if('items'in row){immutable=false;break;}continue;}if(!('value'in items)||items.value!==undefined&&items.value!==null&&!this.eligible(items.value)){immutable=false;break;}}
   if(immutable)this.validBatchArrays.add(batches);
  }
  const found=immutable?this.related.findIndex(entry=>sources.every((rows,index)=>rows===entry.sources[index])):-1;
  if(found>=0){const [entry]=this.related.splice(found,1);this.related.push(entry);return entry.lookup;}
  const ids=new Set<string>();let count=0;for(const rows of sources)for(const row of rows){ids.add(row.id);count++;}for(const row of batches)for(const item of row.items||[]){ids.add(item.id);count++;}
  const lookup=Object.freeze({has:(id:string)=>ids.has(id)});this.relatedLookups.add(lookup);
  if(immutable&&count<=this.maxRows&&this.maxEntries>0){while(this.related.length&&(this.relatedRows+count>this.maxRows||this.related.length>=Math.min(64,this.maxEntries))){this.relatedRows-=this.related.shift()!.cost;}this.related.push({sources,lookup,cost:count});this.relatedRows+=count;}return lookup;
 }
 /** Positive proof only: EVERY receipt is covered solely by the exact current
  * financial membership. Never cache full/admin/manual grants or permissions. */
 allRelatedVisible(rows:any[],lookup:{has:(id:string)=>boolean}):boolean {
  if(!this.relatedLookups.has(lookup)||!Array.isArray(rows)||!Object.isFrozen(rows)||Object.getPrototypeOf(rows)!==Array.prototype)return false;
  if(!this.validReceiptArrays.has(rows)){
   for(let i=0;i<rows.length;i++){const cell=Object.getOwnPropertyDescriptor(rows,i);if(!cell||!('value'in cell))return false;if(this.validReceiptRows.has(cell.value))continue;if(!immutableScalars(cell.value,['id'],['id']))return false;const related=Object.getOwnPropertyDescriptor(cell.value,'relatedPaymentIds');if(!related||!('value'in related)||!Array.isArray(related.value)||!Object.isFrozen(related.value)||Object.getPrototypeOf(related.value)!==Array.prototype||!related.value.length)return false;
    for(let n=0;n<related.value.length;n++){const id=Object.getOwnPropertyDescriptor(related.value,n);if(!id||!('value'in id)||typeof id.value!=='string')return false;}
    // Shape only, never permission: immutable own scalar/array data remains the
    // same across collection versions. The current branded lookup is checked below.
    this.validReceiptRows.add(cell.value);
   }this.validReceiptArrays.add(rows);
  }
  const proven=this.visibleReceipts.get(rows);if(proven?.has(lookup))return true;
  if(!rows.every(row=>row.relatedPaymentIds.every((id:string)=>lookup.has(id))))return false;
  const proofs=proven||new WeakSet<object>();proofs.add(lookup);this.visibleReceipts.set(rows,proofs);return true;
 }
}
