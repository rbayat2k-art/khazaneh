import {readBankWorkbook,type BankWorkbookResult} from './bank-account-workbook';
const scope=globalThis as unknown as {onmessage:(event:MessageEvent<ArrayBuffer>)=>void;postMessage:(result:BankWorkbookResult)=>void};
scope.onmessage=event=>scope.postMessage(readBankWorkbook(event.data));
