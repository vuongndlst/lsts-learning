importScripts('../vendor/sql-wasm.js');
let SQL,db;
const ready=initSqlJs({locateFile:f=>'../vendor/'+f}).then(x=>SQL=x);
function result(sql){return db.exec(sql).map(r=>({columns:r.columns,values:r.values.slice(0,500),total:r.values.length}));}
self.onmessage=async e=>{
 const {id,action,sql,seed}=e.data;
 try{
  await ready;
  if(action==='empty'){db?.close();db=new SQL.Database();db.run('PRAGMA foreign_keys=ON;');self.postMessage({id,ok:true,results:[]});return;}
  if(action==='schema'){
   if(!db)throw Error('Chưa khởi tạo dữ liệu.');
   const names=db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;")[0]?.values||[];
   const quote=x=>'"'+String(x).replaceAll('"','""')+'"';
   const schema=names.map(([name])=>({name,fields:db.exec('PRAGMA table_info('+quote(name)+');')[0]?.values||[],foreignKeys:db.exec('PRAGMA foreign_key_list('+quote(name)+');')[0]?.values||[],uniqueKeys:(db.exec('PRAGMA index_list('+quote(name)+');')[0]?.values||[]).filter(row=>row[2]===1).map(row=>(db.exec('PRAGMA index_info('+quote(row[1])+');')[0]?.values||[]).map(field=>field[2]))}));
   self.postMessage({id,ok:true,schema});return;
  }
  if(action==='reset'){db?.close();db=new SQL.Database();db.run(seed);self.postMessage({id,ok:true,results:result("SELECT 'nguoi_muon' AS bang,COUNT(*) AS soDong FROM nguoi_muon UNION ALL SELECT 'thiet_bi',COUNT(*) FROM thiet_bi UNION ALL SELECT 'luot_muon',COUNT(*) FROM luot_muon;")});return;}
  if(!db)throw Error('Chưa khởi tạo dữ liệu.');
  if(action==='restore'){
   const candidate=new SQL.Database();
   try{candidate.run('PRAGMA foreign_keys=ON;');candidate.run(sql);try{candidate.run('BEGIN; ROLLBACK;');}catch{throw Error('File còn giao dịch chưa kết thúc. Kiểm tra COMMIT hoặc ROLLBACK trước khi phục hồi.');}if(candidate.exec('PRAGMA foreign_key_check;').length)throw Error('File có tham chiếu không hợp lệ.');candidate.run('PRAGMA foreign_keys=ON;');if(candidate.exec('PRAGMA foreign_keys;')[0]?.values[0][0]!==1)throw Error('Chưa bật được kiểm tra khóa ngoài.');}catch(err){candidate.close();throw err;}
   db.close();db=candidate;self.postMessage({id,ok:true,results:result("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;")});return;
  }
  if(action==='export'){
   const tables=db.exec("SELECT name,sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;")[0]?.values||[];
   let out='-- SQLite backup: structure + data. Restore into a separate sandbox.\nPRAGMA foreign_keys=OFF;\nBEGIN;\n';
   const literal=v=>v===null?'NULL':v instanceof Uint8Array?"X'"+Array.from(v,b=>b.toString(16).padStart(2,'0')).join('')+"'":typeof v==='number'?String(v):"'"+String(v).replaceAll("'","''")+"'";
   for(const [name,ddl] of tables){out+=ddl+';\n';const rows=db.exec('SELECT * FROM "'+name.replaceAll('"','""')+'"')[0]?.values||[];for(const row of rows)out+='INSERT INTO "'+name.replaceAll('"','""')+'" VALUES('+row.map(literal).join(',')+');\n';}
   out+='COMMIT;\nPRAGMA foreign_keys=ON;\n';self.postMessage({id,ok:true,sql:out});return;
  }
  // Students cannot turn off FK enforcement through the learning console.
  if(/\bpragma\b/i.test(sql.replace(/--[^\n]*|\/\*[\s\S]*?\*\//g,''))&&!/^\s*PRAGMA\s+(table_info|foreign_key_list|foreign_key_check)\s*\([^;]*\)\s*;?\s*$/i.test(sql))throw Error('Sandbox chỉ cho PRAGMA xem cấu trúc/khóa. Không tắt kiểm tra FK.');
  const started=performance.now();const results=result(sql);self.postMessage({id,ok:true,results,changed:db.getRowsModified(),ms:Math.round(performance.now()-started)});
 }catch(err){self.postMessage({id,ok:false,error:err.message})}
};
