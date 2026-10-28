export type TreasuryExportSelection={purpose:'OPERATIONAL';pool:'QUEUE'|'IN_PAYMENT'|'COMPLETED';uids:string[]}|{purpose:'IBAN';targets:unknown[]}|{purpose:'PRINT_RECEIPT';receiptId:string};
export function downloadAuthorizedWorkbook(result:{base64:string;fileName:string;rowCount:number}){
 if(typeof result.base64!=='string'||typeof result.fileName!=='string'||!result.fileName.endsWith('.xlsx'))throw Error('پاسخ خروجی معتبر نیست.');
 const bytes=Uint8Array.from(atob(result.base64),c=>c.charCodeAt(0)),url=URL.createObjectURL(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})),a=document.createElement('a');a.href=url;a.download=result.fileName;document.body.append(a);try{a.click();}finally{a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}return {fileName:result.fileName,rowCount:result.rowCount};
}
