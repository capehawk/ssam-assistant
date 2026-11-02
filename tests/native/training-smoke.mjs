// 실제 Windows 실행 파일의 WebView2를 검사합니다. 서버·인증값은 사용하지 않습니다.
import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import net from 'node:net';
import assert from 'node:assert/strict';

if (process.platform !== 'win32') throw Error('Windows 실행 파일 검사입니다.');
const exe = resolve(process.argv[2] || 'src-tauri/target/release/ssam-training.exe');
await access(exe);
const profile = await mkdtemp(join(tmpdir(), 'ssam-training-smoke-'));
const port = await new Promise((yes,no)=>{
  const server=net.createServer();server.on('error',no);
  server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(()=>yes(port));});
});
const child=spawn(exe,[],{windowsHide:true,stdio:'ignore',env:{...process.env,
  WEBVIEW2_USER_DATA_FOLDER:profile,
  WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:`--remote-debugging-port=${port} --remote-debugging-address=127.0.0.1`,
}});
let launchError;child.on('error',e=>{launchError=e;});
let browser;
try {
  const endpoint=`http://127.0.0.1:${port}`;
  const deadline=Date.now()+60000;
  while(Date.now()<deadline) {
    if(launchError)throw launchError;
    if(child.exitCode!==null)throw Error('진단 앱이 연결 전에 종료됐습니다.');
    try{const r=await fetch(endpoint+'/json/version');if(r.ok)break;}catch{}
    await new Promise(r=>setTimeout(r,500));
  }
  browser=await chromium.connectOverCDP(endpoint);
  let page;
  for(let i=0;i<40;i++) {
    page=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().includes('tauri.localhost')&&!p.url().includes('bubble'));
    if(page)break;await new Promise(r=>setTimeout(r,250));
  }
  assert.ok(page,'메인 WebView가 있어야 합니다.');
  page.setDefaultTimeout(10000);
  await page.waitForSelector('[data-menu-go="training"]');
  const mime=await page.evaluate(async()=>{
    const r=await fetch('menus/training/certificate.js');return {status:r.status,type:r.headers.get('content-type')};
  });
  assert.equal(mime.status,200);
  assert.match(mime.type,/javascript/,'PDF 검사 JS가 PDF MIME으로 제공되면 안 됩니다.');
  await page.locator('[data-menu-go="training"]').click();
  await page.locator('#tr-form').waitFor({state:'visible'});
  assert.ok(await page.locator('#tr-connect').isVisible(),'연결 화면 표시');
  const update=await page.evaluate(()=>window.__TAURI__.core.invoke('check_update'));
  assert.equal(update.available,false,'테스트판에서 공식 업데이트를 제안하면 안 됩니다.');
  assert.equal(update.page,'','공식 업데이트 경로를 노출하지 않습니다.');
  const installError=await page.evaluate(async()=>{try{await window.__TAURI__.core.invoke('install_update');return null;}catch(e){return String(e);}});
  assert.match(installError,/테스트판/,'직접 업데이트 요청도 차단');
  const transportError=await page.evaluate(async()=>{try{await window.__TAURI__.core.invoke('training_request',{url:'https://example.invalid/',body:'{}'});return null;}catch(e){return String(e);}});
  assert.match(transportError,/주소|요청/,'네이티브 전송 명령 등록과 주소 제한');
  console.log('네이티브 연수 화면·JavaScript MIME·공식 업데이트 차단·전송 주소 제한 통과');
} finally {
  if(browser)await browser.close();
  if(child.pid && child.exitCode===null)spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
}
