window.CppRun=(()=>{'use strict';
 const workerURL=new URL('cpp-worker.js',document.currentScript.src),waiting=new Map();let worker=null,id=0;
 function stop(message='Đã đóng phòng thực hành.'){
  worker?.terminate();worker=null;for(const w of waiting.values()){clearTimeout(w.timer);w.resolve({ok:false,output:'',error:message})}waiting.clear();
 }
 function start(){if(worker)return;worker=new Worker(workerURL);worker.onmessage=e=>{const w=waiting.get(e.data.id);if(!w)return;clearTimeout(w.timer);waiting.delete(e.data.id);w.resolve(e.data.result)};worker.onerror=()=>stop('Chưa tải được trình chạy C++. Kiểm tra mạng và thử lại.')}
 async function run(code,input=''){
  if(!CppCloud.allowed())return {ok:false,output:'',error:'Cần đăng nhập để chạy mã.'};
  if(waiting.size)return {ok:false,output:'',error:'Đang chạy mã khác. Đợi kết quả rồi thử lại.'};
  start();const job=++id;
  return new Promise(resolve=>{waiting.set(job,{resolve,timer:setTimeout(()=>stop('Chương trình quá thời gian chạy. Kiểm tra điều kiện và bước tăng/giảm; bạn có thể sửa và chạy lại.'),3500)});worker.postMessage({id:job,code,input})});
 }
 return {run,stop};
})();
