import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';import * as XLSX from 'xlsx';
import {BANK_IMPORT_COLUMNS,assessBankImport,bankImportShapeError,type BankImportInput} from '../src/utils/bank-account-import';
import {readBankWorkbook,validateBankWorkbookZip} from '../src/utils/bank-account-workbook';
const input=(rowNumber=2,extra:Record<string,string>={}):BankImportInput=>({rowNumber,values:{bankName:'بانک ملت',accountTitle:'TEST account',companyName:'TEST',accountNumber:'001234567890',...extra}});
function workbook(rows:unknown[][],change?:(sheet:XLSX.WorkSheet)=>void){
  // In-memory synthetic test inputs, not the downloadable authored template.
  const sheet=XLSX.utils.aoa_to_sheet([BANK_IMPORT_COLUMNS.map(([,label])=>label),...rows]);change?.(sheet);const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,sheet,'حساب‌ها');return XLSX.write(book,{type:'array',bookType:'xlsx'}) as ArrayBuffer;
}
const values=(extra:Record<string,string>={})=>BANK_IMPORT_COLUMNS.map(([key])=>input(2,extra).values[key]||'');
test('bank import normalizes Persian digits without losing zeros and keeps every authored field',()=>{
  const row=input(2,{accountNumber:'۰۰۱۲۳۴۵۶۷۸۹۰',iban:'IR'+'۰'.repeat(24),cardNumber:'۰'.repeat(16),branchCode:'۰۰۷',branchName:'TEST branch',accountType:'تنخواه',status:'غیرفعال',description:'TEST description',allowedPaymentMethods:'پایا، داخلی'});
  const report=assessBankImport([row],[]);assert.equal(report.errorCount,0);const account=report.rows[0].account!;assert.equal(account.accountNumber,'001234567890');assert.equal(account.branchCode,'007');assert.equal(account.isActive,false);assert.deepEqual(account.allowedPaymentMethods,['PAYA','INTERNAL']);assert.equal(account.description,'TEST description');
});

test('every additional source bank from the owner workbook is admitted with its own identity',()=>{
 const names=['بانک اقتصاد نوین','بانک ایران زمین','بانک رسالت','بلوبانک','پست بانک ایران','بانک توسعه تعاون','بانک دی','بانک سرمایه','بانک سینا','بانک قرض‌الحسنه مهر ایران','بانک گردشگری','مؤسسه اعتباری ملل'];
 const report=assessBankImport(names.map((bankName,i)=>input(i+2,{bankName,accountNumber:'00123456'+String(i).padStart(4,'0')})),[]);
 assert.equal(report.errorCount,0);assert.equal(report.newCount,12);assert.deepEqual(report.rows.map(r=>r.account!.bankName),names);
 const two=assessBankImport([input(2,{bankName:'بلوبانک'}),input(3,{bankName:'بانک سامان'})],[]);assert.equal(two.newCount,2);assert.equal(two.errorCount,0);
});

test('known short names match existing banks without rewriting records or hiding conflicts',()=>{
 const aliases=[['اقتصاد نوین','بانک اقتصاد نوین'],['ایران زمین','بانک ایران زمین'],['رسالت','بانک رسالت'],['بلو بانک','بلوبانک'],['پست بانک','پست بانک ایران'],['توسعه تعاون','بانک توسعه تعاون'],['دی','بانک دی'],['سرمایه','بانک سرمایه'],['سینا','بانک سینا'],['قرض الحسنه مهر ایران','بانک قرض‌الحسنه مهر ایران'],['گردشگری','بانک گردشگری'],['موسسه اعتباری ملل','مؤسسه اعتباری ملل'],['رفاه','بانک رفاه کارگران'],['صادرات','بانک صادرات ایران'],['ملی','بانک ملی ایران']];
 for(const [alias,canonical] of aliases){
  const normalized=assessBankImport([input(2,{bankName:alias+' '})],[]);assert.equal(normalized.errorCount,0,canonical);assert.equal(normalized.rows[0].account!.bankName,canonical);
  const existing={...normalized.rows[0].account!,id:'TEST-'+canonical,bankName:alias,createdAt:'TEST'},before=JSON.stringify(existing);
  const duplicate=assessBankImport([input(2,{bankName:canonical})],[existing]);assert.equal(duplicate.errorCount,0);assert.equal(duplicate.duplicateCount,1);assert.equal(JSON.stringify(existing),before);
  assert.equal(assessBankImport([input(2,{bankName:canonical,accountTitle:'TEST DIFFERENT'})],[existing]).errorCount,1);
 }
 for(const bankName of ['بانک ناشناخته TEST','__proto__','constructor'])assert.equal(assessBankImport([input(2,{bankName})],[]).errorCount,1);
});
test('bank import rejects two new defaults and conflicting cross-linked identifiers without mutating the catalogue',()=>{
  const duplicates=assessBankImport([input(2,{isDefault:'بله'}),input(3,{accountNumber:'001234567891',isDefault:'بله'})],[]);assert.equal(duplicates.errorCount,2);
  const original=assessBankImport([input(2,{iban:'IR'+'0'.repeat(24)}),input(3,{accountNumber:'001234567891',cardNumber:'0'.repeat(16)})],[]).rows.map((row,i)=>({...row.account!,id:'TEST'+i,createdAt:'TEST'}));const before=JSON.stringify(original);
  const report=assessBankImport([input(2,{iban:'IR'+'0'.repeat(24),cardNumber:'0'.repeat(16)})],original);assert.equal(report.errorCount,1);assert.equal(JSON.stringify(original),before);
});
test('bank import empty optional values never clear existing information or default and provided differences are errors',()=>{
  const account={...assessBankImport([input(2,{isDefault:'بله',branchName:'TEST retained branch',allowedPaymentMethods:'پایا'})],[]).rows[0].account!,id:'TEST old',createdAt:'TEST'};
  assert.equal(assessBankImport([input()], [account]).duplicateCount,1);assert.equal(assessBankImport([input(2,{isDefault:'خیر',branchName:''})],[account]).duplicateCount,1);
  assert.equal(assessBankImport([input(2,{branchName:'TEST changed'})],[account]).errorCount,1);assert.equal(account.branchName,'TEST retained branch');assert.equal(account.isDefault,true);
  assert.ok(bankImportShapeError([{...input(),rowNumber:0}]));
});
test('bank workbook parses the complete text row, ignores only blank rows and preserves Excel row numbers',()=>{
  const result=readBankWorkbook(workbook([[],values({branchCode:'0007'})]));assert.deepEqual(result.errors,[]);assert.equal(result.rows.length,1);assert.equal(result.rows[0].rowNumber,3);assert.equal(result.rows[0].values.accountNumber,'001234567890');assert.equal(result.rows[0].values.branchCode,'0007');
});
test('bank workbook rejects numeric identifiers, formulas, errors, duplicate or unknown headers and data after the limit',()=>{
  for(const change of [(s:XLSX.WorkSheet)=>{s.D2={t:'n',v:123456};},(s:XLSX.WorkSheet)=>{s.D2={t:'n',v:123456,f:'123456'};},(s:XLSX.WorkSheet)=>{s.D2={t:'e',v:15};},(s:XLSX.WorkSheet)=>{s.M1={t:'s',v:'TEST unknown'};},(s:XLSX.WorkSheet)=>{s.M1=s.A1;}]){
    const result=readBankWorkbook(workbook([values()],change));assert.ok(result.errors.length);assert.equal(result.rows.length,0);
  }
  const tooMany=readBankWorkbook(workbook(Array.from({length:201},()=>values())));assert.ok(tooMany.errors.length);assert.equal(tooMany.rows.length,0);
});
test('bank workbook ZIP guards reject oversized, corrupt and falsely expanded ZIP entries before decoding',()=>{
  assert.throws(()=>validateBankWorkbookZip(new ArrayBuffer(1024*1024+1)));assert.throws(()=>validateBankWorkbookZip(new ArrayBuffer(50)));
  const buffer=workbook([values()]),copy=buffer.slice(0),view=new DataView(copy);for(let i=0;i<view.byteLength-46;i++)if(view.getUint32(i,true)===0x02014b50){view.setUint32(i+24,9*1024*1024,true);break;}
  assert.throws(()=>validateBankWorkbookZip(copy));assert.equal(readBankWorkbook(copy).rows.length,0);
  const localSize=buffer.slice(0),localView=new DataView(localSize);localView.setUint32(22,0x7fffffff,true);
  assert.throws(()=>validateBankWorkbookZip(localSize));assert.equal(readBankWorkbook(localSize).rows.length,0);
  const descriptor=buffer.slice(0),descriptorView=new DataView(descriptor);descriptorView.setUint16(6,descriptorView.getUint16(6,true)|8,true);
  for(let i=0;i<descriptorView.byteLength-46;i++)if(descriptorView.getUint32(i,true)===0x02014b50){descriptorView.setUint16(i+8,descriptorView.getUint16(i+8,true)|8,true);break;}
  assert.throws(()=>validateBankWorkbookZip(descriptor));
  const zeroSize=XLSX.write(XLSX.read(buffer,{type:'array'}),{type:'array',bookType:'xlsx',compression:true}) as ArrayBuffer,zeroView=new DataView(zeroSize);
  for(let i=0;i<zeroView.byteLength-46;i++)if(zeroView.getUint32(i,true)===0x02014b50){const local=zeroView.getUint32(i+42,true);assert.equal(zeroView.getUint16(i+10,true),8);zeroView.setUint32(i+24,0,true);zeroView.setUint32(local+22,0,true);break;}
  assert.throws(()=>validateBankWorkbookZip(zeroSize));assert.equal(readBankWorkbook(zeroSize).rows.length,0);
});
test('the downloadable template has matching headers, text identifiers, no sample accounts and stays within parser limits',()=>{
  const bytes=fs.readFileSync('public/templates/bank-accounts-template.xlsx'),buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),book=XLSX.read(buffer,{type:'array',cellStyles:true});
  assert.deepEqual(book.SheetNames,['حساب‌ها','راهنما']);assert.deepEqual(BANK_IMPORT_COLUMNS.map(([,label])=>label),XLSX.utils.sheet_to_json(book.Sheets['حساب‌ها'],{header:1})[0]);assert.equal(book.Sheets['حساب‌ها'].D2.z,'@');assert.equal(book.Sheets['حساب‌ها'].I201.z,'@');assert.equal(readBankWorkbook(buffer).rows.length,0);assert.match(readBankWorkbook(buffer).errors[0],/حسابی برای ورود ندارد/);
});

test('the template download URL is bound to its bytes so a cached older bank catalogue is not reused',()=>{
 const hash=crypto.createHash('sha256').update(fs.readFileSync('public/templates/bank-accounts-template.xlsx')).digest('hex').slice(0,12),dialog=fs.readFileSync('src/components/BankAccountImportDialog.tsx','utf8');
 assert.ok(dialog.includes('/templates/bank-accounts-template.xlsx?v='+hash));
});
