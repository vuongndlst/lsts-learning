// No dependency bundle: server-only Auth Admin REST. Privilege is verified on every request.
const cors={'Access-Control-Allow-Origin':'https://vuongndlst.github.io','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};
const url=Deno.env.get('SUPABASE_URL')!;
const secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
async function rest(path:string,method='GET',body?:unknown,token=secret){
 const r=await fetch(url+path,{method,headers:{apikey:secret,Authorization:'Bearer '+token,'Content-Type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body)});
 const t=await r.text();const v=t?JSON.parse(t):null;if(!r.ok)throw new Error('operation_failed');return v;
}
Deno.serve(async(req)=>{
 const origin=req.headers.get('Origin')||'';
 const allowed=['https://vuongndlst.github.io','http://localhost:8765'];
 const headers={...cors,'Access-Control-Allow-Origin':allowed.includes(origin)?origin:cors['Access-Control-Allow-Origin'],'Content-Type':'application/json'};
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(req.method==='OPTIONS')return new Response(null,{headers});
 if(req.method!=='POST')return reply({error:'method_not_allowed'},405);
 try{
 const b=await req.json();if(!/^[0-9a-f-]{36}$/.test(b.runId||''))return reply({error:'invalid_run'},400);
 if(b.action==='register_student'){
  const sid=String(b.studentCode||'').trim(),name=String(b.name||'').trim(),cls=String(b.classLabel||'').trim(),family=String(b.family||'').trim();
  if(!/^\d{7}$/.test(sid)||!name||name.length>100||!cls||cls.length>30||family.length>60||typeof b.password!=='string'||b.password.length<10||b.password.length>128)return reply({error:'invalid_student_information'},400);
  const run=await rest('/rest/v1/learning_course_runs?run_id=eq.'+b.runId+(b.portalRegistration===true?'':'&registration_open=eq.true'));
  if(!run.length)return reply({error:'registration_closed'},400);
  const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||req.headers.get('cf-connecting-ip')||'unknown';
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ip));const hash=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
  if(!await rest('/rest/v1/rpc/learning_registration_slot','POST',{p_hash:hash}))return reply({error:'registration_rate_limit'},429);
  const user=await rest('/auth/v1/admin/users','POST',{email:sid+'@lsts.edu.vn',password:b.password,email_confirm:true,user_metadata:{display_name:name,class_label:cls,family}});
  try{
  if(b.portalRegistration===true)await rest('/rest/v1/learning_portal_security','POST',{user_id:user.id,portal_only:true,must_change_password:false});
  await rest('/rest/v1/learning_profiles?user_id=eq.'+user.id,'PATCH',{display_name:name,class_label:cls,family});
  }catch(e){await rest('/auth/v1/admin/users/'+user.id,'DELETE');throw e;}
  return reply({ok:true});
 }
 const token=(req.headers.get('Authorization')||'').replace(/^Bearer /,'');
 if(!token)return reply({error:'authentication_required'},401);
 let actor;try{actor=await rest('/auth/v1/user','GET',undefined,token)}catch{return reply({error:'authentication_required'},401)}
 const role=await rest('/rest/v1/rpc/learning_staff_access','POST',{p_run:b.runId},token);
 if(role!=='admin'&&role!=='teacher')return reply({error:'staff_required'},403);
 if(b.action==='add_teacher'){
  if(role!=='admin')return reply({error:'admin_required'},403);
  const email=String(b.email||'').trim().toLowerCase();const name=String(b.name||'').trim();
  if(!/^[a-z0-9._+-]+@lsts\.edu\.vn$/.test(email)||/^\d{7}@/.test(email)||!name||name.length>100)return reply({error:'invalid_teacher'},400);
  // Lookup server-side; never send the Auth directory to the client.
  let found=null;
  for(let page=1;page<=100;page++){
   const result=await rest('/auth/v1/admin/users?per_page=100&page='+page);
   found=result.users.find((u:any)=>u.email?.toLowerCase()===email);if(found||result.users.length<100)break;
  }
  if(!found){
   if(typeof b.password!=='string'||b.password.length<10||b.password.length>128)return reply({error:'password_min_10'},400);
   found=await rest('/auth/v1/admin/users','POST',{email,password:b.password,email_confirm:true,app_metadata:{school_provisioned:true},user_metadata:{display_name:name}});
   await rest('/rest/v1/learning_profiles?user_id=eq.'+found.id,'PATCH',{display_name:name});
  }
  const existing=await rest('/rest/v1/learning_staff?user_id=eq.'+found.id+'&run_id=eq.'+b.runId);
  if(!existing.length)await rest('/rest/v1/learning_staff','POST',{user_id:found.id,run_id:b.runId});
  return reply({ok:true,email});
 }
 if(b.action==='reset_password'){
  if(typeof b.password!=='string'||b.password.length<10||b.password.length>128)return reply({error:'password_min_10'},400);
  if(!/^[0-9a-f-]{36}$/.test(b.userId||''))return reply({error:'invalid_user'},400);
  const dashboard=await rest('/rest/v1/rpc/learning_dashboard','POST',{p_run:b.runId},token);
  const student=dashboard.students.some((s:any)=>s.user_id===b.userId);
  const teacher=role==='admin'&&dashboard.teachers.some((s:any)=>s.user_id===b.userId);
  if(!student&&!teacher)return reply({error:'user_not_in_course'},403);
  const root=await rest('/rest/v1/learning_admins?user_id=eq.'+b.userId);
  if(root.length)return reply({error:'admin_self_service_required'},403);
  await rest('/auth/v1/admin/users/'+b.userId,'PUT',{password:b.password});
  await rest('/rest/v1/rpc/learning_revoke_sessions','POST',{p_user:b.userId});
  return reply({ok:true});
 }
 return reply({error:'unknown_action'},400);
 }catch{return reply({error:'operation_failed'},400)}
});
