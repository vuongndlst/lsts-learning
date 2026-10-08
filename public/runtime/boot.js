(async()=>{'use strict';
 const originBase=new URL('.',location.href),C=PortalCloud;
 const script=src=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=new URL(src,originBase);s.onload=resolve;s.onerror=()=>reject(Error('asset_failed'));document.head.append(s)});
 const css=href=>{const l=document.createElement('link');l.rel='stylesheet';l.href=new URL(href,originBase);document.head.append(l)};
 const base=href=>{const b=document.createElement('base');b.href=new URL(href,originBase);document.head.prepend(b)};
 const account=()=>({name:C.profile.display_name,className:C.profile.class_label,studentCode:C.profile.student_code,userId:C.user.id});
 try{
 const p=await C.init(),kind=p.payload.kind;document.title=p.lesson.title+' · LSTS Learning';
 document.addEventListener('click',e=>{const b=e.target.closest('[data-action="home"]');if(b){e.preventDefault();e.stopImmediatePropagation();parent.postMessage({type:'portal-back'},location.origin)}},true);
 if(kind==='sql'){
 base('sql/');css('sql/assets/style.css');window.Cloud=C;window.SQL_CONFIG={...PORTAL_CONFIG,courseId:p.course_id,runId:p.run_id};window.SQL_COURSE={lessons:[p.payload.lesson],seed:p.payload.seed};
 document.body.innerHTML='<header hidden><nav><button id="home">Bài học</button><button id="staff" hidden>Giáo viên</button><button id="account">Hồ sơ</button></nav></header><div class="statusbar" hidden><span id="sync"></span></div><main id="app"></main><dialog id="modal"><div id="modal-body"></div><button id="close-modal" class="close" aria-label="Đóng">×</button></dialog><div id="toast" role="status"></div>';
 if(C.guest){const k='lsts-guest-practice:'+p.course_id+':'+p.lesson.lesson_key+':v'+p.lesson.content_version;const get=()=>{try{return JSON.parse(localStorage.getItem(k)||'[]')}catch{return []}};C.practicePending=()=>0;C.flushPractice=async()=>true;C.logPractice=(key,kind,code,summary,snapshot)=>{try{localStorage.setItem(k,JSON.stringify([{event_id:crypto.randomUUID(),kind,code,summary,snapshot_sql:snapshot,has_backup:!!snapshot,created_at:new Date().toISOString()},...get()].slice(0,20)));return true}catch{return false}};C.practiceHistory=async()=>get();C.projectList=async()=>[];for(const method of ['projectCreate','projectJoin','projectGet','projectSave','projectSubmit','projectReview','projectSubmissions','studentDetail'])C[method]=async()=>{throw Error('Đăng nhập và tham gia lớp để sử dụng chức năng này.')}}
 const init=C.init;C.init=async()=>{window.dispatchEvent(new Event('cloud-change'));return p};location.hash=p.lesson.lesson_key;
 for(const f of ['visuals.js','sql-tools.js',...(C.guest?[]:['learning-cloud.js']),'designer.js','projects.js','dashboard.js','media.js','app.js'])await script('sql/assets/'+f);
 C.init=init;
 }else if(kind==='python'||kind==='cpp'){
 base(kind+'/lesson/');const upper=kind==='python'?'PY':'CPP';window[upper+'_LESSON_KEY']=p.lesson.lesson_key;window[upper==='PY'?'PY10_CLOUD_CONFIG':'CPP8_CLOUD_CONFIG']={...PORTAL_CONFIG,runId:p.run_id};window[kind==='python'?'PyCloud':'CppCloud']=C;window[upper+'Account']={student:account,controls:()=>{},profile:()=>parent.postMessage({type:'portal-account'},location.origin)};
 if(kind==='python')css('python/engine/style.css');else{for(const f of ['base.css','game.css','school.css'])css('cpp/engine/'+f);await script('cpp/engine/scratchblocks.min.js');await script('cpp/engine/scratchblocks-vi.js')}
 await script(kind+'/engine/kit.js');const payload=document.createElement('script');payload.textContent=p.payload.source;document.head.append(payload);payload.remove();window.LESSON.media=p.payload.media;document.body.innerHTML='';await script(kind+'/engine/media.js');if(kind==='cpp')await script('cpp/engine/cpp-runner.js');await script(kind+'/engine/engine.js');
 }else if(kind==='ml'){
 base('ml/'+p.lesson.lesson_key+'/');css('ml/assets/style.css');css('ml/assets/chu_de.css');window.BAI=p.payload.data;
 const key=(BAI.tien_to_luu||'ml1_')+BAI.ma,storedGet=Storage.prototype.getItem,storedSet=Storage.prototype.setItem;
 const s={...C.state(p.lesson.lesson_key),ten:C.profile.display_name,lop:C.profile.class_label};C.states[p.lesson.lesson_id]=s;
 Storage.prototype.getItem=function(k){return this===localStorage&&k===key?JSON.stringify({...C.peek(),ten:C.profile.display_name,lop:C.profile.class_label}):this===localStorage&&k===(BAI.tien_to_luu||'ml1_')+'quest'?storedGet.call(this,(C.guest?'lsts-guest-settings:':'lsts-portal-settings:')+C.user.id+':'+p.enrollment_id):storedGet.call(this,k)};
 Storage.prototype.setItem=function(k,v){if(this===localStorage&&k===key){const state=JSON.parse(v);state.completed=Boolean(state.dat);C.save(p.lesson.lesson_key,state);return}if(this===localStorage&&k===(BAI.tien_to_luu||'ml1_')+'quest'){storedSet.call(this,(C.guest?'lsts-guest-settings:':'lsts-portal-settings:')+C.user.id+':'+p.enrollment_id,v);return}storedSet.call(this,k,v)};
 await script('ml/assets/the-gioi.js');
 parent.postMessage({type:'portal-lesson',kind:'ml'},location.origin);
 if(new URLSearchParams(location.search).get('mode')==='quest'){
 css('ml/assets/quest3d.css');const map=document.createElement('script');map.type='importmap';map.textContent=JSON.stringify({imports:{three:'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js'}});document.head.append(map);
 window.QUEST={...(window.THE_GIOI?.[BAI.ma]||{}),dung_sau_chang:!p.self_study,trang_doc:new URL('lesson.html',originBase).href};document.body.innerHTML='<div id="quest"></div>';
 const fallback=setTimeout(()=>{if(!document.querySelector('#quest canvas')){const u=new URL('lesson.html',originBase);u.search=location.search;u.searchParams.set('mode','read');location.replace(u.href)}},15000);
 const module=document.createElement('script');module.type='module';module.src=new URL('ml/assets/quest3d.js',originBase);document.head.append(module);
 addEventListener('storage',e=>{if(e.key?.includes(p.enrollment_id)||e.key?.includes(p.lesson.lesson_id))dispatchEvent(new StorageEvent('storage',{key}))});
 const nested=()=>document.querySelector('.q-khung iframe')?.contentWindow;
 addEventListener('message',e=>{if(e.origin!==location.origin)return;if(e.source===nested()&&e.data?.type==='portal-status'){C.setNestedPending(e.data.pending);parent.postMessage(e.data,location.origin)}if(e.source===parent&&['portal-flush','portal-download'].includes(e.data?.type)&&nested())nested().postMessage(e.data,location.origin)});
 document.addEventListener('click',e=>{const a=e.target.closest('a');if(a?.href?.startsWith(QUEST.trang_doc)){e.preventDefault();const u=new URL(QUEST.trang_doc),q=new URLSearchParams(location.search);u.searchParams.set('class',q.get('class'));u.searchParams.set('lesson',q.get('lesson'));if(C.guest)u.searchParams.set('guest','1');location.href=u.href}});
 }else{
 document.body.innerHTML='<div id="app"></div>';await script('ml/assets/tuong_tac.js');await script('ml/assets/app.js');
 }
 }else if(kind==='activity'){
 document.body.innerHTML='<main style="max-width:900px;margin:auto;padding:24px;font-family:system-ui"><h1></h1><article></article><label>Nhật ký thực hành / link minh chứng<textarea maxlength="6000" style="display:block;width:100%;min-height:180px"></textarea></label><button>Lưu nhật ký</button></main>';document.querySelector('h1').textContent=p.payload.title;document.querySelector('article').innerHTML=p.payload.html;
 const t=document.querySelector('textarea');t.value=C.state(p.lesson.lesson_key).evidence||'';document.querySelector('button').onclick=()=>C.save(p.lesson.lesson_key,{...C.state(p.lesson.lesson_key),evidence:t.value,started:true});
 }
 document.querySelectorAll('#studyMode,[data-action="study-mode"]').forEach(b=>b.hidden=true);
 if(p.read_only){const banner=document.createElement('p');banner.textContent='Lớp đã lưu trữ · Em có thể xem lại bài học và tải bản sao.';banner.style='background:#edf2f4;padding:16px';document.body.prepend(banner);const observer=new MutationObserver(()=>document.querySelectorAll('input,textarea,select,form button').forEach(x=>{x.disabled=true}));observer.observe(document.body,{childList:true,subtree:true});document.querySelectorAll('input,textarea,select,form button').forEach(x=>x.disabled=true)}
 if(p.payload.notebook){const box=document.createElement('aside');box.style='padding:14px 24px;background:#eaf5ef;color:#14524b;display:flex;gap:15px;align-items:center;flex-wrap:wrap';const text=document.createElement('span');text.textContent='Notebook học sinh · tải xuống rồi mở trong Google Colab';const b=document.createElement('button');b.textContent='Tải notebook';b.onclick=()=>{const n=p.payload.notebook,u=URL.createObjectURL(new Blob([JSON.stringify(n.data,null,2)],{type:'application/x-ipynb+json'})),a=document.createElement('a');a.href=u;a.download=n.name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)};box.append(text,b);document.body.prepend(box)}
 await C.flush();
 }catch(e){const msg=/authentication_required|password_change_required/.test(e.message)?'Đăng nhập và hoàn tất đổi mật khẩu ở LSTS Learning trước khi mở bài.':/lesson_not_open|class_access_denied/.test(e.message)?'Bài học chưa được mở cho bạn. Trở về lớp để xem lịch.':'Chưa mở được bài học. Kiểm tra mạng rồi tải lại.';document.body.innerHTML='<main style="padding:24px;font-family:system-ui"><p role="alert"></p></main>';document.querySelector('p').textContent=msg;parent.postMessage({type:'portal-status',status:msg,pending:false},location.origin)}
})();
