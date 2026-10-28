import type {UnifiedTreasuryItem} from './excelExport';
type Target={type:'ADVANCE'|'PAYMENT'|'BATCH_ITEM';id:string;batchId?:string;expectedVersion?:number};
/** Bind actions to the exact displayed pool children, never the whole mixed-state parent. */
export function treasuryTargets(items:UnifiedTreasuryItem[]):Target[]{
 return items.flatMap<Target>(item=>item.type==='BATCH'?(item.batchItems||[]).map(row=>({type:'BATCH_ITEM' as const,id:row.id,batchId:item.id})):item.type==='MANUAL'?[]:[{type:item.type,id:item.id,...item.type==='PAYMENT'&&item.rawPayment?.personnelBalanceRef?{expectedVersion:item.rawPayment.version||1}:{}}]);
}
export function treasuryExpectedPaid(items:UnifiedTreasuryItem[]):Record<string,number>{
 const expected:Record<string,number>={};
 for(const item of items){if(item.type==='BATCH'){for(const row of item.batchItems||[])expected[`BATCH_ITEM:${item.id}:${row.id}`]=row.paidAmountSoFar??row.paidAmount??0;}else if(item.type!=='MANUAL')expected[`${item.type}:${item.id}`]=item.paidAmountSoFar||0;}
 return expected;
}
