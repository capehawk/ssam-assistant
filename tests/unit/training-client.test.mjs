import test from 'node:test';
import assert from 'node:assert/strict';
import { createTrainingClient, validServerUrl } from '../../web/menus/training/client.js';
import { extractCertificate, pdfEvidence } from '../../web/menus/training/certificate.js';

const url = 'https://script.google.com/macros/s/DEMO_DEPLOYMENT/exec';
test('training transport only accepts exact deployment URLs', () => {
  assert.ok(validServerUrl(url));
  for (const bad of [url+'?token=x',url+'#x',url.replace('https:','http:'),url.replace('script.google.com','script.google.com.evil.test'),url.replace('/exec','/dev'),'https://u@script.google.com/macros/s/x/exec']) assert.equal(validServerUrl(bad),false);
});
test('uncertain mutations retain exact request; double clicks share promise; refresh failure retains confirmed records', async () => {
  const calls=[]; let fail=true; let finish;
  const client=createTrainingClient({id:()=> 'request-123',send:async (server,req)=>{
    calls.push(structuredClone(req));
    if(req.action==='mySubmissions') { if(fail) throw Error('offline'); return {ok:true,data:[{submissionId:'one'}]}; }
    await new Promise(r=>finish=r); if(fail) throw Error('lost response');
    return {ok:true,data:{submissionId:'one',status:'submitted'}};
  }});
  client.connect(url,'secret');
  const p=client.mutate('submit',{items:['original']});
  const p2=client.mutate('submit',{items:['changed']}); assert.equal(p,p2);
  finish(); await assert.rejects(p); assert.equal(client.state.pending.requestId,'request-123');
  fail=false; const retry=client.retry(); finish(); await retry;
  assert.deepEqual(calls[0],calls[1]); assert.equal(client.state.pending,null);
  await client.refresh(); fail=true; await assert.rejects(client.refresh());
  assert.equal(client.state.records[0].submissionId,'one'); assert.equal(client.state.fresh,false);
  client.connect(url,'different-secret'); assert.deepEqual(client.state.records,[]);
});
test('service errors do not indicate successful submission; retry remains possible for storage uncertainty', async()=>{
 const c=createTrainingClient({id:()=> 'request-123',send:async()=>({ok:false,error:{code:'STORAGE_ERROR',message:'retry'}})});
 c.connect(url,'secret'); await assert.rejects(c.mutate('submit',{})); assert.ok(c.state.pending); assert.deepEqual(c.state.records,[]);
});
test('PDF adapter validates bytes and extraction is optional/manual without AI', async()=>{
 const file={name:'demo.pdf',type:'application/pdf',size:14,arrayBuffer:async()=>new TextEncoder().encode('%PDF-1.4\ndemo').buffer};
 assert.equal((await pdfEvidence(file)).mimeType,'application/pdf');
 await assert.rejects(pdfEvidence({...file,size:5*1024*1024+1}));
 await assert.rejects(pdfEvidence({...file,arrayBuffer:async()=>new TextEncoder().encode('not a pdf').buffer}));
 const result=await extractCertificate(file,{readText:async()=> 'Synthetic training certificate'});
 assert.equal(result.text,'Synthetic training certificate'); assert.equal(result.item,null);
});
test('late reads cannot overwrite a completed mutation or a newer read', async()=>{
 const reads=[];
 const c=createTrainingClient({send:async(url,req)=>req.action==='mySubmissions'?await new Promise(r=>reads.push(r)):{ok:true,data:{submissionId:'new'}}});
 c.connect(url,'secret'); const old=c.refresh(); await c.mutate('submit',{});
 reads.shift()({ok:true,data:[]}); await old; assert.equal(c.state.records[0].submissionId,'new'); assert.equal(c.state.fresh,false);
 const first=c.refresh(),second=c.refresh(); reads[1]({ok:true,data:[{submissionId:'latest'}]}); await second;
 reads[0]({ok:true,data:[]}); await first; assert.equal(c.state.records[0].submissionId,'latest');
});
