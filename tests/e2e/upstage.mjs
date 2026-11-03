// 업스테이지 AI: 고르기, 채팅 주소·키, 이미지는 글자 읽기(OCR) 뒤 글만 보냄, 실패 안내, 권장 안내(E-5), 연결 확인(S-2)
import { join } from 'node:path';
import { open, run, assert, FIXTURES } from './helpers.mjs';

const t = await open();
const { page, url, errors } = t;
const S = 'section[data-menu="settings"]';
const CHAT = 'https://api.upstage.ai/v1/chat/completions';
const OCR = 'https://api.upstage.ai/v1/document-digitization';

const log = [];          // 부른 순서: 'ocr' | 'chat'
let lastChat = null;     // { auth, body }
let ocrStatus = 200, chatStatus = 200;
await page.route('https://api.upstage.ai/**', async route => {
  const req = route.request();
  if (req.url() === OCR) {
    log.push('ocr');
    if (ocrStatus !== 200) return route.fulfill({ status: ocrStatus, contentType: 'application/json', body: '{"error":{"message":"ocr says no"}}' });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: '분리수거 당번을 정해 매일 확인했다', pages: [{ text: '분리수거 당번을 정해 매일 확인했다' }] }) });
  }
  if (req.url() !== CHAT) return route.fulfill({ status: 404, body: 'not found' });
  log.push('chat');
  const body = JSON.parse(req.postData());
  lastChat = { auth: req.headers()['authorization'], body };
  if (chatStatus !== 200) return route.fulfill({ status: chatStatus, contentType: 'application/json', body: '{"error":{"message":"Invalid API key","type":"invalid_request_error"}}' });
  const prompt = typeof body.messages[0].content === 'string' ? body.messages[0].content : '';
  let out;
  if (prompt.includes('[이미지에서 읽은 글]')) out = JSON.stringify({ note: '분리수거 당번을 정함', text: '분리수거 당번을 정해 매일 스스로 확인하며 교실 환경을 가꿈.', blank: false });
  else if (prompt.includes('연결 확인')) out = '확인';
  else {
    const n = +(prompt.match(/학생 (\d+)명에게/) || [])[1] || 40;
    out = Array.from({ length: n }, (_, j) => `경험과 관련지어 작품을 감상하며 ${j + 1}번째 생각을 근거를 들어 자신 있게 발표함.`).join('\n');
  }
  const ev = [{ choices: [{ delta: { content: out } }] }, { choices: [{ delta: {}, finish_reason: 'stop' }] }];
  await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: ev.map(e => 'data: ' + JSON.stringify(e) + '\n\n').join('') + 'data: [DONE]\n\n' });
});
// 다른 AI로 새면 안 됨
await page.route(/api\.(anthropic|openai)\.com|generativelanguage\.googleapis\.com/, r => { log.push('other'); r.fulfill({ status: 500, body: '' }); });

await page.goto(url);
await page.waitForTimeout(500);
/* 창체 학습지를 다시 넣음(새 그림) */
const reupload = async () => {
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('[data-ccsheet][data-cck="auto"]')]);
  await fc.setFiles([join(FIXTURES, 'sheet-1.png')]);
  await page.waitForTimeout(300);
};

await run('upstage', [
  ['설정에서 업스테이지와 키를 넣으면 세로 메뉴 AI가 업스테이지', async () => {
    await page.click('nav.app-side [data-menu-go="settings"]'); await page.click('#menuTabs [data-tab="ai"]');
    await page.click(`${S} [data-set="openAi"]`);
    await page.click('#engSeg [data-e="upstage"]');
    await page.fill('#apiKey', 'up-test-key');
    await page.click('#sheetRoot [data-close]');
    const nm = await page.textContent('#sideAiName');
    assert(nm.includes('업스테이지'), '세로 메뉴 AI: ' + nm);
  }],
  ['교과 평어는 업스테이지 채팅 주소로 키를 실어 보내고 문장이 나옴', async () => {
    await page.click('nav.app-side [data-menu-go="evaluate"]'); await page.click('#menuTabs [data-tab="pyeongeo"]');
    await page.click('#srcPaste');
    await page.fill('#pasteBox', await page.getAttribute('#pasteBox', 'placeholder'));
    await page.click('#pasteGo');
    await page.click('#genBtn'); await page.click('#pickGo');
    await page.waitForFunction(() => document.querySelectorAll('#pane .sent').length > 0, null, { timeout: 20000 });
    assert(lastChat && lastChat.auth === 'Bearer up-test-key', 'Authorization: ' + (lastChat && lastChat.auth));
    assert(/^solar/.test(lastChat.body.model), '모델: ' + lastChat.body.model);
    assert(!log.includes('other'), '다른 AI로 요청이 감');
  }],
  ['창체·평가지 채점 화면에 손글씨 권장 안내 한 줄', async () => {
    await page.click('#menuTabs [data-tab="gr"]');
    assert((await page.textContent('#grView')).includes('손글씨 이미지는 Claude·Gemini·GPT를 권장해요'), '평가지 채점 안내 없음');
    await page.click('#menuTabs [data-tab="cc"]');
    assert((await page.textContent('#ccView')).includes('손글씨 이미지는 Claude·Gemini·GPT를 권장해요'), '창체 안내 없음');
  }],
  ['창체 학습지: 글자 읽기가 먼저, 읽은 글이 채팅 본문에 들어감', async () => {
    await page.fill('#ccSetup [data-cls="count"]', '1'); await page.press('#ccSetup [data-cls="count"]', 'Tab');
    await page.fill('[data-ccf="name"][data-cck="auto"]', '교실 환경 지킴이');
    await page.fill('[data-ccf="desc"][data-cck="auto"]', '교실을 깨끗하게 하는 방법을 정해 실천함');
    await page.click('#ccGrade');
    log.length = 0;
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('[data-ccsheet][data-cck="auto"]')]);
    await fc.setFiles([join(FIXTURES, 'sheet-1.png')]);
    await page.waitForSelector('[data-ccsheetinfo]');
    await page.click('[data-cc="genAll"]');
    await page.waitForFunction(() => document.querySelectorAll('#ccResults .gr-sum').length === 1, null, { timeout: 15000 });
    assert(log[0] === 'ocr' && log.includes('chat'), '순서: ' + log.join(','));
    const c = lastChat.body.messages[0].content;
    assert(typeof c === 'string' && c.includes('[이미지에서 읽은 글]') && c.includes('분리수거 당번을 정해 매일 확인했다'), '채팅 본문에 읽은 글 없음');
  }],
  ['같은 학습지 그림으로 [다시 만들기]하면 글자를 다시 읽지 않음(앱이 기억)', async () => {
    log.length = 0;
    await page.click('[data-ccre="1"]');
    await page.waitForFunction(() => !document.querySelector('#ccView .spin'), null, { timeout: 10000 });
    await page.waitForTimeout(300);
    assert(log.includes('chat') && !log.includes('ocr'), '순서: ' + log.join(','));
  }],
  ['글자 읽기가 이미지를 받지 않으면(400) 안내', async () => {
    ocrStatus = 400;
    await reupload(); // 새로 넣은 그림은 다시 읽음
    await page.click('[data-ccre="1"]');
    await page.waitForFunction(() => document.querySelector('#ccView').textContent.includes('업스테이지가 이미지를 읽지 못했어요'), null, { timeout: 10000 });
    assert((await page.textContent('#ccView')).includes('이미지 기능은 Claude·Gemini·GPT를 권장해요'), '권장 문구 없음');
    ocrStatus = 200;
  }],
  ['글자 읽기가 요청 한도(429)면 멈추지 않고 쉬었다가 이어서', async () => {
    ocrStatus = 429;
    await reupload();
    await page.click('[data-ccre="1"]');
    await page.waitForFunction(() => document.querySelector('#ccView').textContent.includes('요청 한도'), null, { timeout: 10000 });
    assert(!(await page.textContent('#ccView')).includes('이미지를 읽지 못했어요'), '429를 읽기 실패로 봄');
    ocrStatus = 200;
  }],
  ['설정 › AI [연결 확인]: 성공·키 틀림', async () => {
    await page.click('nav.app-side [data-menu-go="settings"]'); await page.click('#menuTabs [data-tab="ai"]');
    await page.click(`${S} [data-set="testAi"]`);
    await page.waitForFunction(s => document.querySelector(s).textContent.includes('연결됐어요 · 업스테이지 Solar'), S, { timeout: 8000 });
    chatStatus = 401;
    await page.click(`${S} [data-set="testAi"]`);
    await page.waitForFunction(s => document.querySelector(s).textContent.includes('키가 맞지 않아요'), S, { timeout: 8000 });
    chatStatus = 200;
  }],
  ['페이지 오류 없음', async () => {
    // 일부러 돌려준 400·401·429·500 응답 기록은 뺌
    const real = errors.filter(m => !/Failed to load resource: the server responded with a status of (400|401|429|500)/.test(m));
    assert(real.length === 0, real.join(' | '));
  }]
]);
await t.close();
