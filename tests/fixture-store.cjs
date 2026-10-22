// Read persisted synthetic state, never a stale JSON migration source in SQLite tests.
const fs=require('node:fs'),path=require('node:path');
exports.readFixture=(file)=>{
 const root=process.env.TREASURY_TEST_DIR;
 if(!root||!path.resolve(root).replaceAll('\\','/').startsWith('C:/Users/reza/Desktop/پروژه‌ها/انتشار موقت khazaneh/work/')||path.resolve(file)!==path.resolve(root,'treasury-db.json'))throw Error('explicit synthetic fixture required');
 if(process.env.TREASURY_TEST_STORAGE!=='sqlite')return fs.readFileSync(file,'utf8');
 const {SqliteRecords}=require('../src/server/sqlite-records.ts'),s=new SqliteRecords(path.join(root,'treasury.sqlite'),false,true);
 try{return JSON.stringify(s.read());}finally{s.close();}
};
