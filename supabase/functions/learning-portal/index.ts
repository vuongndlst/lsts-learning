// Privileged Auth operations only. Class/course permissions come from protected DB rows.
const url=Deno.env.get('SUPABASE_URL')!,secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
class Failure extends Error { constructor(public code:string,public status=400){super(code)} }
async function rest(path:string,method='GET',body?:unknown,token=secret){
 const response=await fetch(url+path,{method,headers:{apikey:secret,Authorization:'Bearer '+token,'Content-Type':'application/json',Prefer:'return=representation'+(path.includes('on_conflict=')?',resolution=merge-duplicates':'')},body:body===undefined?undefined:JSON.stringify(body)});
 const v=await response.json().catch(()=>null);
 if(!response.ok){const code=v?.code||v?.error_code;throw new Failure(code==='email_exists'||code==='email_address_not_authorized'?'account_exists':response.status===401?'authentication_required':'operation_failed',response.status===401?401:400)}return v;
}
function password(){const chars='abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#';const values=crypto.getRandomValues(new Uint32Array(18));return 'Aa7!'+Array.from(values.slice(4),v=>chars[v%chars.length]).join('')}
async function findUser(email:string){for(let page=1;page<=100;page++){const v=await rest('/auth/v1/admin/users?per_page=100&page='+page);const u=v.users.find((x:any)=>x.email?.toLowerCase()===email);if(u)return u;if(v.users.length<100)return null}throw new Failure('directory_limit')}
Deno.serve(async(req)=>{
 const origin=req.headers.get('Origin')||'',allowed=['https://vuongndlst.github.io','http://localhost:8765','http://127.0.0.1:8765'];
 const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':allowed.includes(origin)?origin:'https://vuongndlst.github.io','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin'};
 const reply=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers});
 if(req.method==='OPTIONS')return new Response(null,{headers});if(req.method!=='POST')return reply({error:'method_not_allowed'},405);
 if(Number(req.headers.get('Content-Length')||0)>20000)return reply({error:'request_too_large'},413);
 try{
 const b=await req.json();
 const token=(req.headers.get('Authorization')||'').replace(/^Bearer /,'');if(!token)throw new Failure('authentication_required',401);
 const actor=await rest('/auth/v1/user','GET',undefined,token);
 const boot=await rest('/rest/v1/rpc/learning_portal_call','POST',{p_action:'bootstrap',p_data:{}},token);
 if(b.action==='change_password'){
 if(typeof b.password!=='string'||b.password.length<10||b.password.length>128||typeof b.currentPassword!=='string'||b.password===b.currentPassword)throw new Failure('invalid_password');
 let proof;try{proof=await rest('/auth/v1/token?grant_type=password','POST',{email:actor.email,password:b.currentPassword})}catch{throw new Failure('current_password_incorrect')}
 if(proof.user.id!==actor.id)throw new Failure('authentication_required',401);
 await rest('/auth/v1/user','PUT',{password:b.password},proof.access_token);
 await rest('/rest/v1/learning_portal_security?user_id=eq.'+actor.id,'PATCH',{must_change_password:false,changed_at:new Date().toISOString()});
 // Invalidate old sessions; browser signs in again with the new password after success.
 await rest('/rest/v1/rpc/learning_revoke_sessions','POST',{p_user:actor.id});
 return reply({ok:true});
 }
 if(boot.must_change_password)throw new Failure('password_change_required',403);
 if(b.action==='add_teacher'){
 if(boot.role!=='admin')throw new Failure('admin_required',403);
 const email=String(b.email||'').trim().toLowerCase(),name=String(b.name||'').trim(),courses=Array.isArray(b.courses)?[...new Set(b.courses)]:[];
 if(!/^[a-z0-9._+-]+@lsts\.edu\.vn$/.test(email)||/^\d{7}@/.test(email)||!name||name.length>100||!courses.length||courses.some(x=>typeof x!=='string'))throw new Failure('invalid_teacher');
 const catalog=await rest('/rest/v1/rpc/learning_portal_call','POST',{p_action:'courses',p_data:{}},token);if(courses.some(x=>!catalog.some((c:any)=>c.course_id===x)))throw new Failure('invalid_course_version');
 let u=await findUser(email),temp:string|undefined;
 if(!u){temp=password();u=await rest('/auth/v1/admin/users','POST',{email,password:temp,email_confirm:true,app_metadata:{school_provisioned:true},user_metadata:{display_name:name}});}
 try{
 if(temp)await rest('/rest/v1/learning_portal_security','POST',{user_id:u.id,must_change_password:true,portal_only:true});
 for(const course of courses)await rest('/rest/v1/learning_teacher_course_grants?on_conflict=user_id,course_id','POST',{user_id:u.id,course_id:course});
 }catch(e){if(temp)await rest('/auth/v1/admin/users/'+u.id,'DELETE');throw e}
 return reply({ok:true,email,temporaryPassword:temp,existing:temp===undefined});
 }
 if(b.action==='reset_password'){
 if(boot.role!=='admin'&&boot.role!=='teacher')throw new Failure('staff_required',403);
 const userId=String(b.userId||'');if(!/^[0-9a-f-]{36}$/.test(userId))throw new Failure('invalid_user');
 if((await rest('/rest/v1/learning_admins?user_id=eq.'+userId)).length)throw new Failure('admin_self_service_required',403);
 if(boot.role!=='admin'){
 const detail=await rest('/rest/v1/rpc/learning_portal_call','POST',{p_action:'class_detail',p_data:{class_id:b.classId}},token);
 if(!detail.staff||!detail.members?.some((m:any)=>m.user_id===userId&&m.member_status==='active'))throw new Failure('user_not_in_class',403);
 }
 const temp=password();await rest('/auth/v1/admin/users/'+userId,'PUT',{password:temp});
 const existing=await rest('/rest/v1/learning_portal_security?user_id=eq.'+userId);
 if(existing.length)await rest('/rest/v1/learning_portal_security?user_id=eq.'+userId,'PATCH',{must_change_password:true});
 else await rest('/rest/v1/learning_portal_security','POST',{user_id:userId,must_change_password:true,portal_only:false});
 await rest('/rest/v1/rpc/learning_revoke_sessions','POST',{p_user:userId});return reply({ok:true,temporaryPassword:temp});
 }
 throw new Failure('unknown_action');
 }catch(e){return reply({error:e instanceof Failure?e.code:'operation_failed'},e instanceof Failure?e.status:400)}
});
