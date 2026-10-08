/* JSCPP runs in a worker; bounded output prevents runaway programs retaining memory. */
// The pinned bundle selects its run API using window.document. These empty
// compatibility markers expose that API; they do not provide a browser DOM.
self.window=self;
self.document={};
importScripts('JSCPP.es5.min.js');
self.onmessage=e=>{
 const {id,code,input}=e.data;let output='';
 const append=s=>{if(output.length+s.length>32768)throw Error('Output limit exceeded');output+=s};
 try{const exitCode=JSCPP.run(code,input,{stdio:{write:append,echo:t=>append(t+'\n')},maxTimeout:2000});self.postMessage({id,result:{ok:true,output,exitCode}})}
 catch(err){self.postMessage({id,result:{ok:false,output,error:String(err?.message||err)}})}
};
