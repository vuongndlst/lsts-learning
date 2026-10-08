/* Append-only practice outbox, isolated by Auth UUID / course / run. */
(()=>{
 const api=Cloud,cfg=SQL_CONFIG,fail=r=>{if(r.error)throw r.error;return r.data};
 let owner=null,queue=[],flushing=false,generation=0;
 const key=()=>`lsts:${owner}:${cfg.courseId}:${cfg.runId}:practice`;
 const emit=()=>window.dispatchEvent(new Event('practice-change'));
 const store=()=>{try{if(owner)localStorage.setItem(key(),JSON.stringify(queue))}catch{document.querySelector('#sync').textContent='Bộ nhớ máy đầy · chờ mạng để lưu lịch sử';}};
 function activate(){const id=api.ready&&api.enrollment?api.user?.id:null;if(id===owner)return;generation++;owner=id;queue=[];if(owner)try{const cached=JSON.parse(localStorage.getItem(key())||'[]');if(Array.isArray(cached))queue=cached.slice(-20)}catch{};emit();if(owner)api.flushPractice()}
 api.practicePending=()=>queue.length;
 api.logPractice=(lessonKey,kind,code,summary={},snapshot=null)=>{
  if(!api.user||!api.ready||!api.enrollment)return false;activate();
  const lessonId=api.lessonId(lessonKey);if(!lessonId)return false;
  let text=String(code||'');const original=text;while(new TextEncoder().encode(text).length>32000)text=text.slice(0,Math.floor(text.length*.85));
  if(snapshot&&new TextEncoder().encode(snapshot).length>150000)return false;
  if(queue.length>=20)return false;
  queue.push({event_id:crypto.randomUUID(),enrollment_id:api.enrollment.enrollment_id,lesson_id:lessonId,kind,code:text,summary:{...summary,codeTruncated:text!==original},snapshot_sql:snapshot,created_at:new Date().toISOString()});
  store();emit();api.flushPractice();return true;
 };
 api.flushPractice=async()=>{
  if(flushing||!owner||!api.ready||!navigator.onLine)return;
  const ticket=generation;flushing=true;
  try{while(queue.length&&ticket===generation){const p=queue[0];fail(await api.client.rpc('learning_save_practice',{p_event:p.event_id,p_enrollment:p.enrollment_id,p_lesson:p.lesson_id,p_kind:p.kind,p_code:p.code,p_summary:p.summary,p_snapshot:p.snapshot_sql}));if(ticket!==generation)break;queue=queue.filter(x=>x.event_id!==p.event_id);store();emit()}}
  catch{emit()}
  finally{flushing=false}
 };
 api.practiceHistory=async lessonKey=>{
  const lessonId=api.lessonId(lessonKey),pending=queue.filter(p=>p.lesson_id===lessonId).map(p=>({...p,pending:true,has_backup:Boolean(p.snapshot_sql)}));
  let rows=[];try{rows=fail(await api.client.from('learning_practice').select('event_id,kind,code,summary,created_at,snapshot_sql').eq('enrollment_id',api.enrollment.enrollment_id).eq('lesson_id',lessonId).order('created_at',{ascending:false}).limit(30))}catch{if(!pending.length)throw Error('Chưa tải được lịch sử. Kết nối lại rồi bấm Làm mới.');}
  const ids=new Set(rows.map(r=>r.event_id));return [...pending.filter(p=>!ids.has(p.event_id)),...rows].sort((a,b)=>b.created_at.localeCompare(a.created_at));
 };
 api.studentDetail=(userId,lessonKey)=>api.client.rpc('learning_student_detail',{p_run:cfg.runId,p_user:userId,p_lesson:api.lessonId(lessonKey)}).then(fail);
 api.projectList=()=>api.client.rpc('learning_project_list',{p_run:cfg.runId}).then(fail);
 api.projectGet=id=>api.client.from('learning_projects').select('*').eq('project_id',id).single().then(fail);
 api.projectSubmissions=id=>api.client.from('learning_project_submissions').select('*').eq('project_id',id).order('version',{ascending:false}).then(fail);
 api.projectCreate=(title,theme,group)=>api.client.rpc('learning_project_create',{p_run:cfg.runId,p_title:title,p_theme:theme,p_group:group}).then(fail);
 api.projectJoin=code=>api.client.rpc('learning_project_join',{p_run:cfg.runId,p_code:code}).then(fail);
 api.projectSave=(project,payload,title,group)=>api.client.rpc('learning_project_save',{p_project:project.project_id,p_revision:project.revision,p_payload:payload,p_title:title,p_group:group}).then(fail);
 api.projectSubmit=project=>api.client.rpc('learning_project_submit',{p_project:project.project_id,p_revision:project.revision}).then(fail);
 api.projectReview=(project,version,scores,decision,feedback,verified)=>api.client.rpc('learning_project_review',{p_event:crypto.randomUUID(),p_project:project.project_id,p_version:version,p_scores:scores,p_decision:decision,p_feedback:feedback,p_verified:verified}).then(fail);
 const originalSignOut=api.signOut;api.signOut=async()=>{await api.flushPractice();return originalSignOut()};
 window.addEventListener('cloud-change',activate);window.addEventListener('online',()=>api.flushPractice());setInterval(()=>api.flushPractice(),20000);
})();
