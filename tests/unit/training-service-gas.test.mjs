import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createApplication, createTokenAuthenticator } from '../../services/training-submission/application.js';
import { createSheetRepository, createDriveEvidenceStore } from '../../services/training-submission/gas-adapters.js';

test('authentication rejects expired/revoked/unknown tokens and never trusts requested role', () => {
  const entries = [{ actorId:'a', tokenHash:'hash-secret', expiresAt:'2027-01-01T00:00:00Z' }];
  const auth = createTokenAuthenticator({ hash:x=>'hash-'+x, credentials:()=>entries, actors:()=>[{actorId:'a',role:'teacher'}], clock:()=> '2026-11-02T00:00:00Z' });
  assert.deepEqual(auth('secret'), {actorId:'a',role:'teacher'});
  for(const value of ['wrong','',null]) assert.throws(()=>auth(value), {code:'UNAUTHENTICATED'});
  entries[0].revoked=true;
  assert.throws(()=>auth('secret'), {code:'UNAUTHENTICATED'});
  entries[0].revoked=false; entries[0].expiresAt='2026-01-01T00:00:00Z';
  assert.throws(()=>auth('secret'), {code:'UNAUTHENTICATED'});
});

test('entry point authenticates inside lock, maps errors, never exposes raw failures', () => {
  const events=[];
  const app=createApplication({authenticate:()=>{events.push('auth');return {actorId:'a',role:'teacher'};},service:{execute:(...args)=>{events.push('execute');return args[2];}},withLock:fn=>{events.push('lock');try{return fn();}finally{events.push('unlock');}}});
  assert.equal(app({action:'mySubmissions',token:'secret',payload:{},requestId:'read-1234',role:'reviewer'}).data.role,'teacher');
  assert.deepEqual(events,['lock','auth','execute','unlock']);
  const broken=createApplication({authenticate:()=>{throw new Error('secret internal ID');},service:{},withLock:fn=>fn()});
  const result=broken({action:'catalog',token:'secret'});
  assert.equal(result.error.code,'INTERNAL'); assert.ok(!JSON.stringify(result).includes('secret'));
});

function sheetFake() {
  const rows=[['submissionId','json chunks']];
  return {rows,getLastRow:()=>rows.length,getLastColumn:()=>Math.max(...rows.map(r=>r.length)),getRange:(row,col,height=1,width=1)=>({getValues:()=>Array.from({length:height},(_,i)=>Array.from({length:width},(_,j)=>rows[row+i-1]?.[col+j-1]??'')),setValues:values=>{values.forEach((r,i)=>{rows[row+i-1]??=[];r.forEach((v,j)=>{rows[row+i-1][col+j-1]=v;});});}})};
}
test('Sheets adapter chunks JSON below 50k and reads receipts after a shorter overwrite', () => {
  const sheet=sheetFake(); const repo=createSheetRepository(sheet,()=>{});
  const record={submissionId:'s1',actorId:'a',items:[{title:'x'.repeat(65000)}],requests:[{actorId:'a',requestId:'r1',hash:'h',result:{revision:1}}]};
  repo.save(record);
  assert.ok(sheet.rows[1].slice(1).every(cell=>cell.length<=40000));
  assert.ok(sheet.rows[1].slice(1).every(cell=>cell.startsWith('j:')));
  assert.deepEqual(repo.get('s1'),record);
  assert.deepEqual(repo.findRequest('a','r1'),record.requests[0]);
  record.items=[]; repo.save(record);
  assert.deepEqual(repo.list(),[record]);
});

test('Drive adapter reuses an orphan after a sheet failure and never makes a public URL', () => {
  const files=[];let creates=0;
  const folder={getFilesByName:name=>{let found=files.filter(f=>f.name===name);return {hasNext:()=>found.length>0,next:()=>found.shift()};},createFile:blob=>{creates++;const f={name:blob.name,getId:()=> 'f1',setDescription:()=>{},getBlob:()=>blob};files.push(f);return f;}};
  const env={Utilities:{base64Decode:x=>[37,80,68,70,45],base64Encode:x=>'JVBERi0=',newBlob:(bytes,mime,name)=>({name,getBytes:()=>bytes,getContentType:()=>mime})},DriveApp:{getFileById:()=>files[0]}};
  const store=createDriveEvidenceStore(env,folder);
  const evidence={name:'a.pdf',mimeType:'application/pdf',base64:'JVBERi0=',size:5};
  assert.equal(store.put('opaque-key',evidence).id,'f1');
  assert.equal(store.put('opaque-key',evidence).id,'f1');
  assert.equal(creates,1);
  assert.equal(store.read('f1').base64,'JVBERi0=');
});

test('committed Sheet write followed by flush failure keeps recoverable receipt', () => {
  const sheet=sheetFake(); let fail=true;
  const repo=createSheetRepository(sheet,()=>{if(fail)throw new Error('uncertain flush');});
  const record={submissionId:'s1',requests:[{actorId:'a',requestId:'request-1',hash:'h',result:{submissionId:'s1',revision:1}}]};
  assert.throws(()=>repo.save(record)); fail=false;
  assert.equal(repo.findRequest('a','request-1').result.revision,1);
  repo.save(record);assert.equal(repo.list().length,1);
});

test('chunk prefix protects formula-shaped boundaries; grid grows for bounded records', () => {
  const sheet=sheetFake(); let columns=26,rows=1;
  sheet.getMaxColumns=()=>columns;sheet.insertColumnsAfter=(after,n)=>{assert.equal(after,columns);columns+=n;};
  sheet.getMaxRows=()=>rows;sheet.insertRowsAfter=(after,n)=>{assert.equal(after,rows);rows+=n;};
  const repo=createSheetRepository(sheet,()=>{});
  const prefix=JSON.stringify({submissionId:'s1',value:''}).indexOf('""')+1;
  const value='x'.repeat(39998-prefix)+'=IMPORTXML("https://invalid.example","x")'+'x'.repeat(920000);
  const record={submissionId:'s1',value};record.value+='x'.repeat(999980-JSON.stringify(record).length);repo.save(record);
  assert.ok(sheet.rows[1][2].startsWith('j:='),'boundary was not formula-shaped');
  assert.ok(columns>26);assert.equal(rows,2);assert.deepEqual(repo.get('s1'),record);
});

test('deployable bundle exposes only authenticated public entry points', () => {
  const root=new URL('../../services/training-submission/dist/',import.meta.url);
  const context={};vm.createContext(context);
  vm.runInContext(readFileSync(new URL('Training.gs',root),'utf8'),context);
  vm.runInContext(readFileSync(new URL('entry.gs',root),'utf8'),context);
  const publicFunctions=Object.keys(context).filter(name=>typeof context[name]==='function'&&!name.endsWith('_')).sort();
  assert.deepEqual(publicFunctions,['doGet','doPost','trainingRequest']);
  assert.equal(typeof context.TrainingModule_.createTrainingService,'function');
  assert.equal(context.createTrainingService,undefined);
});
