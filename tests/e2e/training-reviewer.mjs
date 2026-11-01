// Real service + application behind a mock google.script.run; no Google deployment claim.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { open, run, assert } from './helpers.mjs';
import { createTrainingService } from '../../services/training-submission/core.js';
import { createApplication } from '../../services/training-submission/application.js';
import { createMemoryRepository, createMemoryEvidenceStore } from '../../services/training-submission/memory.js';
import { DEMO_CATALOG } from '../../services/training-submission/fixtures.js';

let next=0,loseResponse=true;
const repo=createMemoryRepository();
const service=createTrainingService({repository:repo,evidenceStore:createMemoryEvidenceStore(),clock:()=>new Date().toISOString(),idGenerator:()=>`demo-${++next}`,hash:s=>createHash('sha256').update(s).digest('hex'),decodeBase64:s=>Buffer.from(s,'base64'),catalog:DEMO_CATALOG});
const teacher={actorId:'teacher-a',role:'teacher'};
const payload={items:[{catalogId:'safety',title:'<img src=x onerror="window.injected=true"> 합성 연수',provider:'시연기관',completedOn:'2026-11-01',hours:1}],evidence:{name:'synthetic.pdf',mimeType:'application/pdf',base64:Buffer.from('%PDF-1.4\nsynthetic').toString('base64')}};
const initial=service.execute('submit',payload,teacher,'submit-demo-1');
const app=createApplication({authenticate:token=>{if(token==='reviewer-demo')return {actorId:'reviewer-a',role:'reviewer'};if(token==='teacher-demo')return teacher;throw Object.assign(new Error('auth'),{code:'UNAUTHENTICATED'});},service,withLock:fn=>fn()});
const t=await open();const {page,url}=t;
try{
  const html=await readFile(new URL('../../services/training-submission/gas/Reviewer.html',import.meta.url),'utf8');
  await page.route('**/reviewer-test',route=>route.fulfill({contentType:'text/html',body:html}));
  await page.exposeFunction('mockTrainingRequest',request=>{
    const result=app(request);
    if(request.action==='review'&&result.ok&&loseResponse){loseResponse=false;throw new Error('simulated lost response');}
    return result;
  });
  await page.addInitScript(()=>{
    window.google={script:{get run(){let success,failure;const runner={withSuccessHandler(fn){success=fn;return runner;},withFailureHandler(fn){failure=fn;return runner;},trainingRequest(request){window.mockTrainingRequest(request).then(success,failure);}};return runner;}}};
  });
  await page.goto(url+'reviewer-test');
  await run('training-reviewer',[
    ['교사 인증은 담당자 목록에 접근할 수 없음',async()=>{
      await page.fill('#token','teacher-demo');await page.click('#login button[type="submit"]');
      await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('권한'));
      assert(await page.locator('article').count()===0,'teacher saw review queue');
    }],
    ['담당자 목록은 악성 HTML을 텍스트로만 표시',async()=>{
      await page.fill('#token','reviewer-demo');await page.click('#login button[type="submit"]');await page.waitForSelector('article');
      assert(await page.locator('article h2').textContent()===payload.items[0].title,'title changed');
      assert(await page.locator('article img').count()===0,'HTML executed');
    }],
    ['증빙 내려받기는 인증 경로를 사용',async()=>{
      const download=page.waitForEvent('download');await page.getByRole('button',{name:'증빙 PDF 내려받기'}).click();
      assert((await download).suggestedFilename()==='synthetic.pdf','wrong evidence name');
      await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);
    }],
    ['검토 응답 유실 후 같은 요청 재시도로 단일 보완 이력',async()=>{
      await page.locator('textarea').fill('합성 이수일을 수정해 주세요.');await page.getByRole('button',{name:'보완요청',exact:true}).click();
      await page.waitForSelector('#retry:not([hidden])');await page.click('#retry');
      await page.waitForFunction(()=>document.querySelector('article .status')?.textContent.includes('보완요청'));
      assert(repo.get(initial.submissionId).revision===2,'review duplicated');
      assert(repo.get(initial.submissionId).history.length===2,'duplicate history');
    }],
    ['교사 재제출 후 담당자 확인완료 및 본인 결과 반영',async()=>{
      service.execute('revise',{...payload,submissionId:initial.submissionId,expectedRevision:2},teacher,'revise-demo-1');
      await page.click('#refresh');await page.getByRole('button',{name:'확인완료',exact:true}).waitFor();
      await page.getByRole('button',{name:'확인완료',exact:true}).click();
      await page.waitForFunction(()=>document.querySelector('article .status')?.textContent.includes('확인완료'));
      const mine=service.execute('mySubmissions',{},teacher);assert(mine[0].status==='approved'&&mine[0].revision===4,'teacher result incorrect');
    }],
    ['로그아웃은 인증과 자료를 지움',async()=>{
      await page.click('#logout');assert(await page.locator('article').count()===0,'queue retained');
      await page.click('#refresh');await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('인증값'));
      assert(await page.evaluate(()=>localStorage.length)===0,'secret stored in localStorage');
    }]
  ]);
}finally{await t.close();}
