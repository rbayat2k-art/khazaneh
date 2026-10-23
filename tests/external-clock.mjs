// Test process only: exercise a successful command replay after a day boundary.
import path from 'node:path';
const root=path.resolve(process.env.TREASURY_DATA_DIR||'').replaceAll('\\','/');if(!root.startsWith('C:/Users/reza/Desktop/پروژه‌ها/انتشار موقت khazaneh/work/')||process.env.DISABLE_EXTERNAL_INTEGRATIONS!=='true')throw Error('Isolated fixture required');
const NativeDate=Date,offset=Number(process.env.TEST_EXTERNAL_DAY_OFFSET||0)*86400000;
if(![0,172800000].includes(offset))throw Error('Bounded synthetic clock required');
globalThis.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[NativeDate.now()+offset]));}static now(){return NativeDate.now()+offset;}};
