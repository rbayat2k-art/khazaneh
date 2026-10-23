// Test-process-only deterministic scheduler gate; no product authentication mock.
if(!process.env.TREASURY_TEST_DIR?.replaceAll('\\','/').includes('/work/'))throw Error('Isolated fixture required');
const immediate=global.setImmediate;let armed=false,pending;
global.setImmediate=(callback,...args)=>{if(!armed)return immediate(callback,...args);armed=false;pending=()=>immediate(callback,...args);process.send?.('REPORT_PAUSED');return {hasRef:()=>false,ref(){return this;},unref(){return this;}};};
process.on('message',message=>{if(message==='ARM_REPORT'){armed=true;process.send?.('REPORT_ARMED');}else if(message==='RELEASE_REPORT'){const release=pending;pending=undefined;release?.();}});
