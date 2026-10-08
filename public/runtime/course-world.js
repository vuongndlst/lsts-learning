/* Shared island navigator. The original lesson engines still grade and save work. */
window.CourseWorld=async(p,C,originBase)=>{
 const asset=src=>{const u=new URL(src,originBase);u.searchParams.set('v',window.PORTAL_RUNTIME_VERSION);return u.href};
 const kind=p.payload.kind,script=src=>new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=asset(src);s.onload=resolve;s.onerror=reject;document.head.append(s)});
 let steps;
 if(kind==='sql')steps=[...p.payload.lesson.stages.map(x=>({title:x.title})),{title:'Phòng thực hành SQL'}];
 else {await script(kind+'/engine/kit.js');const source=document.createElement('script');source.textContent=p.payload.source;document.head.append(source);source.remove();steps=LESSON.steps.filter(x=>x.kind!=='gate'&&x.kind!=='boss');}
 const world={sql:{kieu:'network',mau:'#65DCC4',bieu_tuong:'SQL',ky_hieu:['SELECT','PK','FK','JOIN']},python:{kieu:'code',mau:'#8BC7FF',bieu_tuong:'Py',ky_hieu:['print()','if','for','list']},cpp:{kieu:'factory',mau:'#B69CFF',bieu_tuong:'C++',ky_hieu:['cout','cin','int','for']}}[kind];
 window.PORTAL_WORLD_STEPS=steps;
 window.BAI={ma:p.lesson.lesson_key,tien_to_luu:'lsts-world-',bai:p.lesson.position,khoa:p.course_id,nhan:world.bieu_tuong,tieu_de:p.lesson.title,cau_hoi:'Chọn bất kỳ trạm nào để học. Trên lớp, dừng và trao đổi theo hướng dẫn của giáo viên.',chang:steps.map(s=>({ten:s.title||s.name||s.label||s.id,phut:5,muc_tieu:[],khoi_dong:''})),cuoi:{so_cau:kind==='sql'?6:(LESSON.steps.find(s=>s.kind==='boss')?.challenges?.length||3),dat:kind==='sql'?5:3}};
 const key=BAI.tien_to_luu+BAI.ma,originalGet=Storage.prototype.getItem;
 const progress=()=>{const state=C.peek();const completed=Boolean(state.completed||state.completedAt);const done=steps.map((s,i)=>kind==='sql'?(i<4?state.passed?.includes(i):i===4?state.taskDone:state.completed):(s.challenges||[]).filter(c=>!c.advanced&&!c.bonus).every(c=>state.passed?.[c.id]));let qua=0;for(const d of done){if(!d)break;qua++}return {...state,passedStages:done.flatMap((yes,i)=>yes?[i]:[]),qua,dat:completed,ten:C.profile.display_name,lop:C.profile.class_label}};
 Storage.prototype.getItem=function(k){return this===localStorage&&k===key?JSON.stringify(progress()):originalGet.call(this,k)};
 window.QUEST={...world,ten:'Đảo '+world.bieu_tuong+' · '+p.lesson.title,mau_phu:'#FFD07A',dung_sau_chang:false,trang_doc:new URL('lesson.html',originBase).href};
 const css=document.createElement('link');css.rel='stylesheet';css.href=asset('ml/assets/quest3d.css');document.head.append(css);
 const map=document.createElement('script');map.type='importmap';map.textContent=JSON.stringify({imports:{three:'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js'}});document.head.append(map);
 document.body.innerHTML='<div id="quest"></div>';
 const m=document.createElement('script');m.type='module';m.src=asset('ml/assets/quest3d.js');document.head.append(m);
 addEventListener('storage',e=>{if(e.key!==key)dispatchEvent(new StorageEvent('storage',{key}))});
 const child=()=>document.querySelector('.q-khung iframe')?.contentWindow;
 addEventListener('message',e=>{if(e.origin!==location.origin)return;if(e.source===child()&&e.data?.type==='portal-status'){C.setNestedPending(e.data.pending);parent.postMessage(e.data,location.origin)}if(e.source===parent&&['portal-flush','portal-download'].includes(e.data?.type)&&child())child().postMessage(e.data,location.origin)});
 setTimeout(()=>{if(!document.querySelector('#quest canvas')){const u=new URL(location.href);u.searchParams.set('mode','read');location.replace(u.href)}},15000);
 parent.postMessage({type:'portal-lesson',kind},location.origin);
};
