// 새 버전 버튼(Windows 앱, 가짜 __TAURI__)과 시험용 업스테이지(Vercel 중계 https://ssam-relay.vercel.app, 키는 Vercel에만):
// 알림 창을 닫아도 ⋮ 옆 [새 버전 …]으로 다시 열기, 내 키가 없으면 중계로(앱·웹판 모두) 부르고 한 번 알림, 앱에는 키가 없고
// 중계로 Authorization을 보내지 않음, 하루 횟수를 다 쓰면 그 까닭, 다른 AI를 고른 선생님은 바꾸지 않음
import { open, run, assert } from './helpers.mjs';

const t = await open();
const { page, ctx, url, errors } = t;
const RELAY = 'https://ssam-relay.vercel.app';
const relayReqs = [];
let relayMode = '';
const sse = text => `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\ndata: [DONE]\n\n`;
const relay = async route => {
  const r = route.request(), path = new URL(r.url()).pathname;
  relayReqs.push({ path, method: r.method(), headers: r.headers() });
  const cors = { 'access-control-allow-origin': r.headers().origin || '*', 'access-control-allow-headers': 'content-type' };
  if (r.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
  if (path === '/api/info') return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ available: true, until: '2027-03-31', daily: 400 }) });
  if (relayMode === 'limit') return route.fulfill({ status: 429, headers: cors, contentType: 'application/json', body: JSON.stringify({ ssam: true, error: 'daily_limit', message: '오늘 시험용 업스테이지 사용 횟수(400번)를 다 썼어요. 내일 다시 쓰거나 설정 › AI에 내 AI 키를 넣어 주세요.' }) });
  return route.fulfill({ status: 200, headers: cors, contentType: 'text/event-stream', body: sse(JSON.stringify({ title: '시험 공문', due: '', tasks: [], kinds: [] })) });
};
await page.route(`${RELAY}/**`, relay);
await page.addInitScript(() => {
  window.__calls = [];
  window.__TAURI__ = { core: { invoke: async (cmd, args) => {
    window.__calls.push([cmd, args]);
    if (cmd === 'check_update') return { available: true, current: '0.17.0', latest: '9.9.9', notes: '- 새 기능', date: '2026-11-04', size: 1000 };
    return null;
  } }, event: { listen: async () => () => {} } };
});
await page.goto(url);

await run('update-testkey', [
  ['새 버전 알림 창을 닫아도 ⋮ 옆에 [새 버전 9.9.9] 버튼이 남고, 누르면 다시 열림', async () => {
    await page.waitForSelector('#sheetRoot .sheet', { timeout: 8000 });
    assert((await page.textContent('#sheetRoot .sheet')).includes('9.9.9'), '알림 창');
    await page.click('#sheetRoot .sheet #updLater');
    await page.waitForFunction(() => !document.querySelector('#sheetRoot .sheet'));
    assert(await page.isVisible('#updTop'), '⋮ 옆 버튼이 없음');
    assert((await page.textContent('#updTop')).includes('9.9.9'), await page.textContent('#updTop'));
    await page.click('#updTop');
    await page.waitForSelector('#sheetRoot .sheet');
    await page.click('#sheetRoot .sheet #updLater');
  }],
  ['내 키가 없으면 시험용 업스테이지(한 번 알림), 설정 › AI에 「시험용」·기한, 왼쪽 아래 AI 이름도', async () => {
    await page.waitForFunction(() => localStorage.getItem('ssam:testkey:told') === '1', null, { timeout: 8000 });
    await page.waitForFunction(() => (document.querySelector('#sideAiName') || {}).textContent?.includes('시험용'), null, { timeout: 8000 });
    await page.click('nav.app-side [data-menu-go="settings"]'); await page.click('#menuTabs [data-tab="ai"]');
    await page.waitForTimeout(300);
    const txt = await page.textContent('section[data-menu="settings"]');
    assert(txt.includes('시험용') && txt.includes('2027. 3. 31.'), txt.slice(0, 400));
  }],
  ['AI 부르기는 중계(/api/chat)로, Authorization 없이 · 앱(ai_proxy)으로 가지 않음 · 저장소에 표시가 남지 않음', async () => {
    await page.click('nav.app-side [data-menu-go="etc"]'); await page.click('#menuTabs [data-tab="gongmun"]');
    await page.fill('section[data-menu="etc"] .gm-box #gmPaste', '시험 공문\n수신 각 학교');
    await page.click('section[data-menu="etc"] .gm-box [data-gm="paste"]');
    await page.waitForFunction(() => document.querySelector('.gm-doc')?.textContent.includes('시험 공문'), null, { timeout: 8000 });
    const c = relayReqs.find(x => x.path === '/api/chat' && x.method === 'POST');
    assert(c && !c.headers.authorization, JSON.stringify(c && c.headers));
    assert(!(await page.evaluate(() => window.__calls.some(x => x[0] === 'ai_proxy'))), 'ai_proxy를 부름');
    assert(!(await page.evaluate(() => JSON.stringify(localStorage))).includes('ssam-test-upstage'), '표시가 저장됨');
  }],
  ['하루 횟수를 다 쓰면 그 까닭(400번)을 알림', async () => {
    relayMode = 'limit';
    await page.fill('section[data-menu="etc"] .gm-box #gmPaste', '한도 시험 공문');
    await page.click('section[data-menu="etc"] .gm-box [data-gm="paste"]');
    await page.waitForFunction(() => (document.querySelector('#toast') || {}).textContent?.includes('400번'), null, { timeout: 8000 });
    relayMode = '';
  }],
  ['Claude를 골라 두고 키를 기억하지 않았으면 시험용으로 바꾸지 않음, 내 키를 넣으면 시험용을 쓰지 않음', async () => {
    await page.evaluate(() => { localStorage.setItem('ssam:engine', JSON.stringify({ engine: 'claude', keys: { claude: '', gemini: '', openai: '', upstage: '' }, remember: false })); });
    await page.reload(); await page.waitForTimeout(1200);
    let r = await page.evaluate(() => [window.SSAM.ai.current().engine, window.SSAM.ai.engineName()]);
    assert(r[0] === 'claude' && !String(r[1]).includes('시험용'), JSON.stringify(r));
    await page.evaluate(() => { localStorage.setItem('ssam:engine', JSON.stringify({ engine: 'claude', keys: { claude: 'sk-test' }, remember: true })); });
    await page.reload(); await page.waitForTimeout(1200);
    r = await page.evaluate(() => window.SSAM.ai.engineName());
    assert(!String(r).includes('시험용'), String(r));
  }],
  ['AI 설정 창의 업스테이지 칸: 키를 넣지 않으면 시험용을 쓴다고 알림', async () => {
    await page.evaluate(() => localStorage.removeItem('ssam:engine'));
    await page.reload(); await page.waitForFunction(() => String(window.SSAM.ai.engineName()).includes('시험용'), null, { timeout: 8000 });
    await page.evaluate(() => window.SSAM.ai.openSettings());
    await page.waitForSelector('#sheetRoot .sheet');
    assert((await page.textContent('#sheetRoot .sheet')).includes('시험용 업스테이지'), (await page.textContent('#sheetRoot .sheet')).slice(0, 300));
    await page.keyboard.press('Escape');
  }],
  ['웹판(Windows 앱 아님)에서도 내 키가 없으면 시험용 업스테이지', async () => {
    await page.evaluate(() => localStorage.removeItem('ssam:engine'));
    const p2 = await ctx.newPage();
    await p2.route(`${RELAY}/**`, relay);
    await p2.goto(url);
    await p2.waitForFunction(() => window.SSAM && window.SSAM.ai && String(window.SSAM.ai.engineName()).includes('시험용'), null, { timeout: 8000 });
    await p2.close();
  }],
  ['페이지 오류 없음', async () => { const real = errors.filter(m => !/status of 429/.test(m)); assert(real.length === 0, real.join(' | ')); }]
]);
await t.close();
