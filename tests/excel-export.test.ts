import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import * as XLSX from 'xlsx';
import {exportTreasuryItemsToExcel} from '../src/utils/excelExport';
XLSX.set_fs(fs); // Node ESM test adapter; the application uses the browser download implementation.
test('real XLSX export preserves Persian, text identifiers, dates, non-formulas and exact large rial totals',()=>{
 const root=process.env.TREASURY_TEST_DIR;if(!root||!path.resolve(root).replaceAll('\\','/').startsWith('C:/Users/reza/Desktop/پروژه‌ها/انتشار موقت khazaneh/work/'))throw Error('isolated output required');fs.mkdirSync(root,{recursive:true});const previous=process.cwd();process.chdir(root);
 try{
 const row:any={uid:'SYN',id:'SYN',type:'PAYMENT',trackingCode:'0001',typeLabel:'پرداخت تکی',title:'=1+1',payeeName:'آزمایش فارسی',requesterName:'TEST',requesterPersonnelCode:'000007',department:'TEST',costCenter:'003001',description:'@SUM(A1)',initialAmount:Number.MAX_SAFE_INTEGER,amount:Number.MAX_SAFE_INTEGER,destinationBank:'بانک ملت',accountOrCard:'0000000000000001',iban:'IR'+'0'.repeat(23)+'1',invoiceNumber:'000012',dueDate:'1405/07/29',createdAt:'2026-10-21',status:'Pending_Treasury'};
 const result=exportTreasuryItemsToExcel([row,{...row,id:'SYN2',amount:2,initialAmount:2}],{fileNamePrefix:'SYN-exact-xlsx'}),book=XLSX.read(fs.readFileSync(result.fileName),{type:'buffer',cellFormula:true}),sheet=book.Sheets[book.SheetNames[0]],rows=XLSX.utils.sheet_to_json<any>(sheet);
 assert.equal(rows[0]['شماره کارت / شماره حساب مقصد'],'0000000000000001');assert.equal(rows[0]['شماره شبا (IBAN)'],row.iban);assert.equal(rows[0]['نام ذینفع / گیرنده وجه'],'آزمایش فارسی');assert.equal(rows[0]['موعد پرداخت / سررسید'],'1405/07/29');assert.equal(rows[0]['تاریخ ثبت درخواست'],'2026-10-21');assert.equal(rows[0]['عنوان / موضوع فرم'],'=1+1');assert.equal(rows[0]['شرح و بابت (توضیحات فرم)'],'@SUM(A1)');assert.ok(Object.values(sheet).every((cell:any)=>!cell?.f));
 assert.equal(rows[0]['مبلغ قابل پرداخت مصوب (ریال)'],String(Number.MAX_SAFE_INTEGER));assert.equal(rows.at(-1)['مبلغ قابل پرداخت مصوب (ریال)'],'9007199254740993');assert.equal(rows.at(-1)['مبلغ اولیه درخواستی (ریال)'],'9007199254740993');assert.equal(String(result.totalAmount),'9007199254740993');
 }finally{process.chdir(previous);}
});
