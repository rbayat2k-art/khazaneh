import path from 'node:path';
import {importJson,exportJson,backupSqlite} from './storage-transfer';
const [command,source,destination,...extra]=process.argv.slice(2);
if(extra.length||!source||!destination||!path.isAbsolute(source)||!path.isAbsolute(destination)||source===destination)throw Error('Usage: storage-cli import|export|backup ABS_SOURCE ABS_NEW_DESTINATION');
async function main(){
 const result=command==='import'?importJson(source,destination):command==='export'?exportJson(source,destination):command==='backup'?await backupSqlite(source,destination):(()=>{throw Error('Unknown transfer command');})();
 console.log(JSON.stringify({status:'PASS',command,...result}));
}
main().catch(()=>{console.error('Storage transfer failed; activation forbidden. Inspect the private source/destination without logging data.');process.exitCode=1;});
