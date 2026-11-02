const {Client}=require('pg');const fs=require('fs');
(async()=>{const c=new Client({host:'/tmp',port:55432,user:'postgres',database:process.argv[3]||'postgres'});await c.connect();
const sql=fs.readFileSync(process.argv[2],'utf8');
try{const r=await c.query(sql);const rs=Array.isArray(r)?r:[r];for(const x of rs){if(x.rows&&x.rows.length)console.log(JSON.stringify(x.rows))}}catch(e){console.log('ERR',e.message, e.position||'');process.exitCode=1}
await c.end()})();
