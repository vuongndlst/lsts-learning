window.SQLMedia=(()=>{
 'use strict';const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const time=s=>`${Math.floor(s/3600)?Math.floor(s/3600)+':':''}${String(Math.floor(s/60)%60).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
 function mount(root,lesson){
  if(!Cloud.user||!Cloud.ready||!Cloud.contentLoaded||!lesson.media)return;
  const {video:v,references:refs,note}=lesson.media;if(!/^[A-Za-z0-9_-]{11}$/.test(v.id))return;
  const uid=Cloud.user.id,url=`https://www.youtube.com/watch?v=${v.id}&t=${v.start}s`,params=new URLSearchParams({start:v.start,rel:0});if(v.end)params.set('end',v.end);
  root.innerHTML=`<section class="learning-media"><div class="eyebrow">Hỗ trợ tự học và học bù</div><h3>Video: ${esc(v.topic)}</h3><p>${esc(v.language)} · ${v.end?`đoạn ${time(v.start)}–${time(v.end)} (${Math.ceil((v.end-v.start)/60)} phút)`:'xem thêm theo nhu cầu'} · <b>không bắt buộc</b></p><p>${esc(v.prompt)}</p><div class="video-host"><button type="button" data-media-play>▶ Mở video trong bài</button></div><p><a href="${url}" target="_blank" rel="noopener noreferrer">Xem trên YouTube từ phần phù hợp ↗</a></p><p class="tiny">Nguồn: ${esc(v.author)} · ${esc(v.title)}. Nếu mạng trường chặn nhúng, dùng liên kết mở ngoài. Video bổ trợ, không thay cho phần đọc và thực hành; có thể bật phụ đề nếu video hỗ trợ.</p>${refs.length?`<h3>Đọc và thử thêm</h3><ul>${refs.map(r=>`<li><a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.source)} · ${esc(r.title)} ↗</a></li>`).join('')}</ul>`:''}<p class="tiny">${esc(note)}</p></section>`;
  root.querySelector('[data-media-play]').onclick=()=>{
   if(!Cloud.user||Cloud.user.id!==uid||!Cloud.ready||!Cloud.contentLoaded||!root.isConnected)return;
   const frame=document.createElement('iframe');frame.src=`https://www.youtube-nocookie.com/embed/${v.id}?${params}`;frame.title='Video bổ trợ: '+v.topic;frame.allow='encrypted-media; picture-in-picture; fullscreen';frame.referrerPolicy='strict-origin-when-cross-origin';frame.allowFullscreen=true;root.querySelector('.video-host').replaceChildren(frame);
  };
 }
 return {mount};
})();
