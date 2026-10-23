// Valid positive request fixtures for the owner's required single-payment fields.
// Explicit values (including blank/undefined/invalid values) are NEVER repaired.
exports.requestFixture=(route,body)=>{
 if(!body)return body;
 if(route==='/payment-requests')return {accountOrCard:'0000000000000000',costCenter:'TEST',description:'TEST payment fixture',payeeName:'TEST recipient',...body};
 if(route==='/batch-payments'&&body.batchType!=='ADVANCE'&&Array.isArray(body.items))return {...body,items:body.items.map(row=>({accountOrCard:'0000000000000000',...row}))};
 return body;
};
