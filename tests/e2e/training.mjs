// Browser UI -> native bridge mock -> real application/core -> in-memory storage.
// This is NOT a live GAS or Rust transport test.
import {open,run,assert} from './helpers.mjs';
import {createHash,randomUUID} from 'node:crypto';
import {createApplication,createTokenAuthenticator} from '../../services/training-submission/application.js';
import {createTrainingService} from '../../services/training-submission/core.js';
import {createMemoryRepository,createMemoryEvidenceStore} from '../../services/training-submission/memory.js';
import {DEMO_CATALOG} from '../../services/training-submission/fixtures.js';
import {fileURLToPath} from 'node:url';

const hash=s=>createHash('sha256').update(s).digest('hex');
const repository=createMemoryRepository(), evidenceStore=createMemoryEvidenceStore();
const clock=()=> '2026-11-02T00:00:00.000Z';
const actors=[{actorId:'teacher-a',role:'teacher'},{actorId:'teacher-b',role:'teacher'},{actorId:'reviewer',role:'reviewer'}];
const authenticate=createTokenAuthenticator({hash,clock,actors:()=>actors,credentials:()=>actors.map(a=>({actorId:a.actorId,tokenHash:hash('synthetic-'+a.actorId),expiresAt:'2027-01-01T00:00:00Z'}))});
const service=createTrainingService({repository,evidenceStore,clock,hash,idGenerator:randomUUID,decodeBase64:s=>Buffer.from(s,'base64'),catalog:DEMO_CATALOG});
const app=createApplication({authenticate,service,withLock:fn=>fn()});
let loseResponse=false, offline=false;
const t=await open();
try {
 const {page,url}=t;
 await page.exposeFunction('trainingBridge',({body})=>{
   if(offline) throw Error('Synthetic offline');
   const request=JSON.parse(body),result=app(request);
   if(loseResponse && request.action==='submit') {loseResponse=false;throw Error('Synthetic response loss after commit');}
   return JSON.stringify(result);
 });
 await page.addInitScript(()=>{window.__TAURI__={core:{invoke:(name,args)=>name==='training_request'?window.trainingBridge(args):Promise.resolve(null)}};});
 await page.goto(url); await page.click('[data-menu-go="training"]');
 const pdf=fileURLToPath(new URL('../../services/training-submission/demo-certificate.pdf',import.meta.url));
 async function connect(actor) {
   await page.locator('#tr-connection').evaluate(el=>el.open=true);
   await page.fill('#tr-url','https://script.google.com/macros/s/SYNTHETIC/exec');
   await page.fill('#tr-token','synthetic-'+actor); await page.click('#tr-connect');
   await page.waitForFunction(()=>document.querySelector('#tr-message').textContent.includes('연결했습니다'));
   assert(!await page.locator('#tr-connection').evaluate(el=>el.open),'인증 확인 후 접힘');
   assert(await page.locator('#tr-connection-status').isVisible(),'접힌 카드에 연결됨 표시');
 }
 async function fill() {
   await page.setInputFiles('#tr-pdf',pdf); await page.fill('#tr-title','Synthetic <img src=x onerror=alert(1)> Safety');
   await page.fill('#tr-provider','Demo Learning Center'); await page.fill('#tr-completedOn','2026-10-01'); await page.fill('#tr-hours','2'); await page.check('#tr-confirm');
 }
 await run('training',[
  ['manual submit, lost response retry, one record',async()=>{
    await connect('teacher-a'); await page.setInputFiles('#tr-pdf',pdf); await page.click('#tr-extract');
    await page.waitForFunction(()=>document.querySelector('#tr-text').textContent.includes('SYNTHETIC TRAINING CERTIFICATE'));
    await fill(); loseResponse=true; await page.click('#tr-send');
    await page.waitForSelector('#tr-retry:not([hidden])'); assert(repository.list().length===1,'one committed record');
    await page.click('#tr-retry'); await page.waitForFunction(()=>document.querySelector('#tr-message').textContent.includes('접수를 확인'));
    assert(repository.list().length===1 && evidenceStore.size===1,'retry must reuse record and file');
    assert(await page.locator('#tr-records img').count()===0,'untrusted title rendered as text');
    assert(await page.locator('#tr-checklist input:checked').count()===0,'접수만 된 항목은 체크하지 않음');
  }],
  ['needs changes -> revised submission -> approval -> refresh',async()=>{
    let record=repository.list()[0];
    let result=app({action:'review',token:'synthetic-reviewer',requestId:randomUUID(),payload:{submissionId:record.submissionId,expectedRevision:1,decision:'needs_changes',comment:'Update synthetic evidence'}}); assert(result.ok,'review');
    await page.click('#tr-refresh'); await page.getByRole('button',{name:'보완 작성'}).click(); await fill(); await page.click('#tr-send');
    await page.waitForFunction(()=>document.querySelector('#tr-message').textContent.includes('서버가 접수'));
    record=repository.list()[0]; assert(record.revision===3 && record.history.length===3,'revision and history');
    result=app({action:'review',token:'synthetic-reviewer',requestId:randomUUID(),payload:{submissionId:record.submissionId,expectedRevision:3,decision:'approved',comment:'Verified demo'}}); assert(result.ok,'approval');
    await page.click('#tr-refresh'); await page.waitForFunction(()=>document.querySelector('#tr-records').textContent.includes('확인완료'));
    assert(await page.locator('#tr-checklist input:checked').count()===1,'승인 후 체크');
    assert((await page.textContent('.tr-record-title')).startsWith('1. '),'연번 표시');
    assert(await page.locator('.tr-record-title').evaluate(el=>getComputedStyle(el).fontWeight)==='400','연수명 보통 굵기');
  }],
  ['failed refresh retains last confirmed status, marks stale',async()=>{
    offline=true; await page.click('#tr-refresh'); await page.waitForFunction(()=>!document.querySelector('#tr-refresh').disabled);
    assert((await page.textContent('#tr-records')).includes('확인완료'),'last known record'); assert((await page.textContent('#tr-fresh')).includes('최신 상태가 아닐'),'stale label'); offline=false;
  }],
  ['account change clears draft and isolates submissions',async()=>{
    await page.fill('#tr-title','Private previous draft'); await page.locator('#tr-connection').evaluate(el=>el.open=true); await page.click('#tr-disconnect'); await connect('teacher-b');
    assert(await page.inputValue('#tr-title')==='','draft cleared'); assert(!(await page.textContent('#tr-records')).includes('Safety'),'other owner records hidden');
    const id=repository.list()[0].submissionId;
    assert(!app({action:'evidence',token:'synthetic-teacher-b',payload:{submissionId:id}}).ok,'other owner PDF denied');
    assert(!app({action:'reviewQueue',token:'synthetic-teacher-b'}).ok,'teacher review denied');
    assert(await page.evaluate(()=>!JSON.stringify(localStorage).includes('synthetic-teacher')),'token not persisted');
  }],
  ['all years are fetched again after local school-year switch',async()=>{
    await connect('teacher-a'); await page.evaluate(()=>localStorage.setItem('ssam:years',JSON.stringify({current:2027}))); await page.reload(); await connect('teacher-a');
    assert(await page.locator('#tr-checklist input:checked').count()===0,'다른 학년도에 승인 전파 안 됨');
    await page.selectOption('#tr-year','2026');
    assert(await page.locator('#tr-checklist input:checked').count()===1,'이수 학년도 선택 시 체크');
    await page.selectOption('#tr-year','all');
    assert((await page.textContent('#tr-records')).includes('확인완료'),'server history survives year change');
  }],
  ['invalid credentials never show connected and small screens fit',async()=>{
    await page.locator('#tr-connection').evaluate(el=>el.open=true);
    await page.fill('#tr-token','invalid'); await page.click('#tr-connect');
    await page.waitForFunction(()=>!document.querySelector('#tr-connect').disabled);
    assert(await page.locator('#tr-connection').evaluate(el=>el.open),'실패 시 카드 펼침');
    assert(!await page.locator('#tr-connection').evaluate(el=>el.classList.contains('is-connected')),'잘못된 인증은 연결됨 아님');
    assert(await page.locator('#tr-send').isDisabled(),'인증 실패 상태 제출 차단');
    await connect('teacher-a'); await page.selectOption('#tr-year','2026');
    if(process.env.TRAINING_SCREENSHOT) {
      await page.screenshot({path:process.env.TRAINING_SCREENSHOT,fullPage:true});
      await page.locator('.tr-results').screenshot({path:process.env.TRAINING_SCREENSHOT.replace('.png','-results.png')});
    }
    await page.setViewportSize({width:390,height:844});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'작은 화면 가로 넘침 없음');
    if(process.env.TRAINING_SCREENSHOT) await page.locator('.tr-results').screenshot({path:process.env.TRAINING_SCREENSHOT.replace('.png','-mobile.png')});
  }],
 ]);
} finally { await t.close(); }
