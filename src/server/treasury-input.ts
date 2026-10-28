import type {TreasuryDatabaseState} from '../types/treasury';
type Target={type:'ADVANCE'|'PAYMENT'|'BATCH_ITEM';id:string;batchId?:string;expectedVersion?:number};
type Parsed={items:Target[];partial?:number;error?:never}|{error:string;status?:409;code?:string;items?:never;partial?:never};
export function validPaymentAllocation(total:number,paid:number,now:number):boolean{return Number.isSafeInteger(total)&&total>0&&Number.isSafeInteger(paid)&&paid>=0&&paid<=total&&Number.isSafeInteger(now)&&now>0&&now<=total-paid;}
/** Resolve exactly the UI contract once; authorization and execution use the same child targets. */
export function treasuryInput(body:any,db:TreasuryDatabaseState,payment:boolean):Parsed{
  if(!Array.isArray(body.items)||!body.items.length)return {error:'هیچ ردیفی برای اقدام انتخاب نشده است.'};
  const seen=new Set<string>(),parents=new Set<string>(),children=new Set<string>();
  for(const item of body.items){
    if(!item||typeof item!=='object'||Array.isArray(item)||Object.keys(item).some(k=>!['type','id','batchId','expectedVersion'].includes(k))||!['ADVANCE','PAYMENT','BATCH','BATCH_ITEM'].includes(item.type)||typeof item.id!=='string'||!item.id.trim()||(item.type==='BATCH_ITEM'?(typeof item.batchId!=='string'||!item.batchId.trim()):item.batchId!==undefined)||item.expectedVersion!==undefined&&(item.type!=='PAYMENT'||!Number.isSafeInteger(item.expectedVersion)||item.expectedVersion<1))return {error:'هدف پرداخت باید با نوع و شناسه صریح و بدون نام‌های جایگزین تعیین شود.'};
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
  }else items.push({type:item.type,id:item.id,...(item.type==='BATCH_ITEM'?{batchId:item.batchId}:{}),...(item.expectedVersion!==undefined?{expectedVersion:item.expectedVersion}:{})});}
  for(const target of items)if(target.type==='PAYMENT'){
    const row=db.paymentRequests.find(r=>r.id===target.id);
    if(target.expectedVersion!==undefined&&!row?.personnelBalanceRef)return {error:'نسخهٔ این هدف در قرارداد پرداخت عادی پذیرفته نیست.'};
    if(!row?.personnelBalanceRef)continue;
    const balance=db.personnelBalanceRequests?.find(q=>q.id===row.personnelBalanceRef!.requestId&&q.financial?.requestId===row.id),amended=!!balance?.accountingRevisions?.length;
    if(!balance||amended&&target.expectedVersion===undefined||target.expectedVersion!==undefined&&target.expectedVersion!==(row.version||1)||payment&&amended&&body.expectedPaidAmounts===undefined)return{error:'اطلاعات حسابداری این درخواست اصلاح شده یا تغییر کرده است؛ فرم و خروجی قبلی را کنار بگذارید و کارتابل را تازه‌سازی کنید.',status:409,code:'STALE_BALANCE_PAYMENT'};
  }
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
