import * as XLSX from 'xlsx';
import {BANK_IMPORT_COLUMNS,BANK_IMPORT_LIMIT,bankText,type BankImportField,type BankImportInput} from './bank-account-import';
export type BankWorkbookResult={rows:BankImportInput[];errors:string[]};
export const BANK_WORKBOOK_MAX_BYTES=1024*1024;
/** Inspect ZIP metadata before decompression; the UI also runs parsing in a disposable, timed worker. */
export function validateBankWorkbookZip(buffer:ArrayBuffer):void{
  const bytes=new Uint8Array(buffer),v=new DataView(buffer),fail=()=>{throw Error('فایل xlsx معتبر نیست یا حجم بازشدهٔ آن بیش از حد مجاز است.');};
  if(bytes.length<22||bytes.length>BANK_WORKBOOK_MAX_BYTES)fail();
  let end=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(v.getUint32(i,true)===0x06054b50&&i+22+v.getUint16(i+20,true)===bytes.length){end=i;break;}
  if(end<0)fail();
  const count=v.getUint16(end+10,true),size=v.getUint32(end+12,true),start=v.getUint32(end+16,true);
  if(v.getUint16(end+4,true)||v.getUint16(end+6,true)||v.getUint16(end+8,true)!==count||!count||count>256||start+size!==end)fail();
  let offset=start,total=0;const decoder=new TextDecoder();
  for(let i=0;i<count;i++){
    if(offset+46>end||v.getUint32(offset,true)!==0x02014b50)fail();
    const flags=v.getUint16(offset+8,true),method=v.getUint16(offset+10,true),compressed=v.getUint32(offset+20,true),expanded=v.getUint32(offset+24,true),nameLength=v.getUint16(offset+28,true),extraLength=v.getUint16(offset+30,true),commentLength=v.getUint16(offset+32,true),local=v.getUint32(offset+42,true);
    const next=offset+46+nameLength+extraLength+commentLength;total+=expanded;
    // Descriptor-based sizes cannot be safely trusted by the installed decoder before inflate.
    if(next>end||flags&9||![0,8].includes(method)||(method===8&&expanded===0)||total>8*1024*1024||local+30>start||compressed===0xffffffff||expanded===0xffffffff||v.getUint32(local,true)!==0x04034b50)fail();
    const name=decoder.decode(bytes.subarray(offset+46,offset+46+nameLength)),localNameLength=v.getUint16(local+26,true),localExtraLength=v.getUint16(local+28,true);
    if(/vbaProject|\.bin$|\.\.|\0/i.test(name)||local+30+localNameLength+localExtraLength+compressed>start||v.getUint16(local+8,true)!==method||v.getUint16(local+6,true)!==flags||v.getUint32(local+18,true)!==compressed||v.getUint32(local+22,true)!==expanded||decoder.decode(bytes.subarray(local+30,local+30+localNameLength))!==name)fail();
    offset=next;
  }
  if(offset!==end)fail();
}
export function readBankWorkbook(buffer:ArrayBuffer):BankWorkbookResult{
  try{
    validateBankWorkbookZip(buffer);
    const workbook=XLSX.read(buffer,{type:'array',cellFormula:true,cellDates:false,sheetRows:BANK_IMPORT_LIMIT+2}),sheet=workbook.Sheets['حساب‌ها'];
    if(!sheet)return {rows:[],errors:['شیت «حساب‌ها» در فایل نیست؛ از قالب سامانه استفاده کنید.']};
    const range=XLSX.utils.decode_range(sheet['!fullref']||sheet['!ref']||'A1');
    if(range.e.r>BANK_IMPORT_LIMIT||range.e.c>30)return {rows:[],errors:['قالب حداکثر۲۰۰ ردیف حساب دارد؛ داده/قالب اضافه در فایل شناسایی شد.']};
    const header=(value:string)=>bankText(value.replace(/\*/g,''));
    const mapping:Array<{column:number;key:BankImportField}>=[],errors:string[]=[];
    for(let c=0;c<=range.e.c;c++){
      const cell=sheet[XLSX.utils.encode_cell({r:0,c})],text=typeof cell?.v==='string'?header(cell.v):'';
      if(cell?.f||cell?.t==='e'){errors.push('فرمول یا خطا در عنوان ستون مجاز نیست.');continue;}
      const field=BANK_IMPORT_COLUMNS.find(([,label])=>header(label)===text)?.[0];
      if(!field){errors.push(`عنوان ستون ${XLSX.utils.encode_col(c)} ناشناخته یا خالی است.`);continue;}
      if(mapping.some(item=>item.key===field)){errors.push(`ستون «${text}» تکرار شده است.`);continue;}mapping.push({column:c,key:field});
    }
    for(const [key,label] of BANK_IMPORT_COLUMNS.slice(0,4))if(!mapping.some(item=>item.key===key))errors.push(`ستون «${label}» وجود ندارد.`);
    if(errors.length)return {rows:[],errors};
    const rows:BankImportInput[]=[];
    for(let r=1;r<=range.e.r;r++){
      if(!mapping.some(({column})=>{const cell=sheet[XLSX.utils.encode_cell({r,c:column})];return cell?.f||cell?.t==='e'||(cell?.v!==undefined&&cell.v!==null&&String(cell.v).trim());}))continue;
      const values:BankImportInput['values']={};
      for(const {column,key} of mapping){
        const cell=sheet[XLSX.utils.encode_cell({r,c:column})],label=BANK_IMPORT_COLUMNS.find(([field])=>field===key)![1];
        if(cell?.f||cell?.t==='e'){errors.push(`ردیف ${r+1}، ${label}: فرمول یا خطای اکسل مجاز نیست.`);continue;}
        if(cell?.v!==undefined&&cell.v!==null&&typeof cell.v!=='string'){errors.push(`ردیف ${r+1}، ${label}: مقدار باید متنی (Text) باشد؛ شمارهٔ عددی ممکن است صفر یا دقت خود را از دست داده باشد.`);continue;}
        values[key]=cell?.v||'';
      }
      rows.push({rowNumber:r+1,values});
    }
    if(!rows.length)errors.push('فایل حسابی برای ورود ندارد؛ شیت «حساب‌ها» را پر کنید.');
    return {rows:errors.length?[]:rows,errors};
  }catch{return {rows:[],errors:['فایل xlsx قابل خواندن نیست، ناقص است یا از محدودیت حجم مجاز عبور می‌کند.']};}
}
