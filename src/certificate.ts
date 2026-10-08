export function certificate(name:string,title:string,id:string,issued:string,full=false){
 const canvas=document.createElement('canvas');canvas.width=1600;canvas.height=1100;const g=canvas.getContext('2d')!;g.fillStyle='#f8fafc';g.fillRect(0,0,1600,1100);g.strokeStyle='#087d78';g.lineWidth=8;g.strokeRect(40,40,1520,1020);g.textAlign='center';g.fillStyle='#16324f';
 const text=(value:string,y:number,size:number,bold=false)=>{g.font=`${bold?'700':'400'} ${size}px system-ui`;g.fillText(value,800,y,1410)};
 text('LSTS LEARNING',160,42,true);text('THCS & THPT ĐINH THIỆN LÝ',220,26);text(full?'CHỨNG CHỈ HOÀN THÀNH KHÓA HỌC':'CHỨNG CHỈ HOÀN THÀNH BÀI HỌC',360,45,true);g.fillStyle='#087d78';text(name,495,64,true);g.fillStyle='#16324f';text('đã hoàn thành lộ trình tự học',590,30);text(title,690,44,true);text('Cấp ngày '+new Date(issued).toLocaleDateString('vi-VN'),825,26);text('Mã chứng chỉ: '+id,905,22);text('Ghi nhận quá trình tự học trên LSTS Learning',990,22);
 const a=document.createElement('a');a.href=canvas.toDataURL('image/png');a.download=(full?'chung-chi-khoa-':'chung-chi-bai-')+id+'.png';a.click();
}
