import type {TreasuryDatabaseState} from '../types/treasury';
type Target={type:'ADVANCE'|'PAYMENT'|'BATCH_ITEM';id:string;batchId?:string};
type Parsed={items:Target[];partial?:number;error?:never}|{error:string;status?:409;code?:string;items?:never;partial?:never};
export function validPaymentAllocation(total:number,paid:number,now:number):boolean{return Number.isSafeInteger(total)&&total>0&&Number.isSafeInteger(paid)&&paid>=0&&paid<=total&&Number.isSafeInteger(now)&&now>0&&now<=total-paid;}
/** Resolve exactly the UI contract once; authorization and execution use the same child targets. */
export function treasuryInput(body:any,db:TreasuryDatabaseState,payment:boolean):Parsed{
  if(!Array.isArray(body.items)||!body.items.length)return {error:'هیچ ردیفی برای اقدام انتخاب نشده است.'};
  const seen=new Set<string>(),parents=new Set<string>(),children=new Set<string>();
  for(const item of body.items){
    if(!item||typeof item!=='object'||Array.isArray(item)||Object.keys(item).some(k=>!['type','id','batchId'].includes(k))||!['ADVANCE','PAYMENT','BATCH','BATCH_ITEM'].includes(item.type)||typeof item.id!=='string'||!item.id.trim()||(item.type==='BATCH_ITEM'?(typeof item.batchId!=='string'||!item.batchId.trim()):item.batchId!==undefined))return {error:'هدف پرداخت باید با نوع و شناسه صریح و بدون نام‌های جایگزین تعیین شود.'};
    const key=item.type+':'+(item.batchId||'')+':'+item.id;if(seen.has(key))return {error:'یک ردیف بیش از یک بار انتخاب شده است.'};seen.add(key);
    if(item.type==='BATCH')parents.add(item.id);if(item.type==='BATCH_ITEM')children.add(item.batchId);
  }
  if([...parents].some(id=>children.has(id)))return {error:'گروه و ردیف‌های همان گروه را هم‌زمان انتخاب نکنید.'};
  let partial:number|undefined;
  if(payment){
    for(const key of ['paymentAmount','partialAmount'])if(body[key]!==undefined){const raw=body[key];if(!((typeof raw==='number')||(typeof raw==='string'&&/^\d+$/.test(raw)))||!Number.isSafeInteger(Number(raw))||Number(raw)<=0)return {error:'مبلغ پرداخت جزئی باید عدد صحیح مثبت و معتبر به ریال باشد.'};if(partial!==undefined&&partial!==Number(raw))return {error:'مبلغ‌های پرداخت ارسال‌شده با هم سازگار نیستند.'};partial=Number(raw);}
    if(partial!==undefined&&(body.items.length!==1||parents.size))return {error:'پرداخت جزئی فقط برای یک ردیف مستقل مجاز است، نه کل گروه.'};
  }
  const items:Target[]=[];
  for(const item of body.items){if(item.type==='BATCH'){
    const batch=db.batchPayments.find(b=>b.id===item.id);if(!batch)return {error:'گروه انتخاب‌شده یافت نشد.'};
    const unpaid=batch.items.filter(r=>r.status!=='Paid');if(!unpaid.length)return {error:'گروه انتخاب‌شده مانده پرداخت‌نشده ندارد.'};
    for(const row of unpaid)items.push({type:'BATCH_ITEM',id:row.id,batchId:batch.id});
  }else items.push({type:item.type,id:item.id,...(item.type==='BATCH_ITEM'?{batchId:item.batchId}:{})});}
  if(payment&&body.expectedPaidAmounts!==undefined){
    const expected=body.expectedPaidAmounts;
    const key=(t:Target)=>t.type+':'+(t.batchId?t.batchId+':':'')+t.id;
    if(!expected||typeof expected!=='object'||Array.isArray(expected)||Object.keys(expected).length!==items.length||items.some(t=>!Object.hasOwn(expected,key(t))||!Number.isSafeInteger(expected[key(t)])||expected[key(t)]<0)||typeof body.idempotencyKey!=='string'||!body.idempotencyKey.trim()||body.idempotencyKey.length>200)return {error:'شناسه عملیات و مانده مشاهده‌شده برای همه اهداف پرداخت باید معتبر باشد.'};
    for(const target of items){const row=target.type==='BATCH_ITEM'?db.batchPayments.find(b=>b.id===target.batchId)?.items.find(r=>r.id===target.id):target.type==='PAYMENT'?db.paymentRequests.find(r=>r.id===target.id):db.advanceRequests.find(r=>r.id===target.id);
      if(!row)return {error:'هدف پرداخت یافت نشد.'};
      const paid=row.paidAmountSoFar??row.paidAmount??(row.status==='Paid'?(row.approvedAmount??row.amount):0);
      if(expected[key(target)]!==paid)return {error:'مانده این درخواست تغییر کرده است؛ کارتابل را تازه‌سازی و ثبت قبلی را بررسی کنید.',status:409,code:'STALE_PAYMENT_BALANCE'};
    }
  }
  return {items,partial};
}
