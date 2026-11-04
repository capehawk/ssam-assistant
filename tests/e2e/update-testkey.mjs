// Windows 앱(가짜 __TAURI__): 새 버전 알림 창을 실수로 닫아도 ⋮ 옆 [새 버전 …] 버튼으로 다시 열기,
// 시험용 업스테이지(빌드에 넣은 키·2027. 3. 31.까지): 내 키가 없으면 쓰고 사용자에게 알림, 웹 쪽에는 표시(마커)만 오고 저장되지 않음, 내 키를 넣으면 그 키
import { open, run, assert } from './helpers.mjs';

const t = await open();
const { page, url, errors } = t;
await page.addInitScript(() => {
  window.__calls = [];
  const sse = text => `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\ndata: [DONE]\n\n`;
  window.__TAURI__ = { core: { invoke: async (cmd, args) => {
    window.__calls.push([cmd, cmd === 'ai_proxy' ? { url: args.url, headers: args.headers } : args]);
    if (cmd === 'check_update') return { available: true, current: '0.16.0', latest: '9.9.9', notes: '- 새 기능', date: '2026-11-04', size: 1000 };
    if (cmd === 'test_key_info') return { available: true, until: '2027-03-31' };
    if (cmd === 'ai_proxy' && window.__proxyFail) throw window.__proxyFail;
    if (cmd === 'ai_proxy') return { status: 200, contentType: 'text/event-stream', body: sse(JSON.stringify({ title: '시험 공문', due: '', tasks: [], kinds: [] })) };
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
    assert((await page.textContent('#sheetRoot .sheet')).includes('9.9.9'), '다시 열리지 않음');
    await page.click('#sheetRoot .sheet #updLater');
  }],
  ['내 키가 없으면 시험용 업스테이지를 쓰고 한 번 알림, 설정 › AI에도 「시험용」·기한 표시', async () => {
    await page.waitForFunction(() => localStorage.getItem('ssam:testkey:told') === '1', null, { timeout: 8000 });
    await page.click('nav.app-side [data-menu-go="settings"]'); await page.click('#menuTabs [data-tab="ai"]');
    await page.waitForTimeout(300);
    const txt = await page.textContent('section[data-menu="settings"]');
    assert(txt.includes('시험용') && txt.includes('2027. 3. 31.'), txt.slice(0, 400));
  }],
  ['AI 부르기는 앱(ai_proxy)으로, 웹 쪽 키는 마커뿐이고 저장되지 않음', async () => {
    await page.click('nav.app-side [data-menu-go="etc"]'); await page.click('#menuTabs [data-tab="gongmun"]');
    await page.fill('section[data-menu="etc"] .gm-box #gmPaste', '시험 공문\n수신 각 학교');
    await page.click('section[data-menu="etc"] .gm-box [data-gm="paste"]');
    await page.waitForFunction(() => window.__calls.some(c => c[0] === 'ai_proxy'), null, { timeout: 8000 });
    const c = await page.evaluate(() => window.__calls.find(x => x[0] === 'ai_proxy')[1]);
    const auth = (c.headers.find(h => h[0] === 'authorization') || [])[1];
    assert(c.url.startsWith('https://api.upstage.ai/') && auth === 'Bearer ssam-test-upstage', JSON.stringify(c));
    const ls = await page.evaluate(() => JSON.stringify(localStorage));
    assert(!ls.includes('ssam-test-upstage'), '마커가 저장됨');
  }],
  ['내 키(Claude)를 넣으면 시험용 키를 쓰지 않음', async () => {
    await page.evaluate(() => { localStorage.setItem('ssam:engine', JSON.stringify({ engine: 'claude', keys: { claude: 'sk-test' }, remember: true })); });
    await page.reload(); await page.waitForTimeout(800);
    const ready = await page.evaluate(() => window.SSAM && window.SSAM.ai && window.SSAM.ai.engineName && window.SSAM.ai.engineName());
    assert(!String(ready || '').includes('시험용'), String(ready));
  }],
  ['I2 시험용 하루 횟수를 다 쓰면 그 까닭(400번)을 알림(인터넷 연결 탓이라고 하지 않음)', async () => {
    await page.evaluate(() => { localStorage.removeItem('ssam:engine'); });
    await page.reload(); await page.waitForTimeout(800);
    await page.evaluate(() => { window.__proxyFail = '오늘 시험용 업스테이지 사용 횟수(400번)를 다 썼어요. 내일 다시 쓰거나 설정 › AI에 내 AI 키를 넣어 주세요.'; });
    await page.click('nav.app-side [data-menu-go="etc"]'); await page.click('#menuTabs [data-tab="gongmun"]');
    await page.fill('section[data-menu="etc"] .gm-box #gmPaste', '한도 시험 공문');
    await page.click('section[data-menu="etc"] .gm-box [data-gm="paste"]');
    await page.waitForFunction(() => (document.querySelector('#toast') || {}).textContent?.includes('400번'), null, { timeout: 8000 });
    await page.evaluate(() => { window.__proxyFail = null; });
  }],
  ['I3 Claude를 골라 두고 키를 기억하지 않았으면, 시험용 업스테이지로 바꾸지 않음', async () => {
    await page.evaluate(() => { localStorage.setItem('ssam:engine', JSON.stringify({ engine: 'claude', keys: { claude: '', gemini: '', openai: '', upstage: '' }, remember: false })); });
    await page.reload(); await page.waitForTimeout(1200);
    const r = await page.evaluate(() => [window.SSAM.ai.current().engine, window.SSAM.ai.engineName()]);
    assert(r[0] === 'claude' && !String(r[1]).includes('시험용'), JSON.stringify(r));
  }],
  ['M5 시험용 키를 알게 되면 왼쪽 아래 AI 이름도 바로 바뀜', async () => {
    await page.evaluate(() => { localStorage.removeItem('ssam:engine'); });
    await page.reload();
    await page.waitForFunction(() => (document.querySelector('#sideAiName') || {}).textContent?.includes('시험용'), null, { timeout: 8000 });
  }],
  ['페이지 오류 없음', async () => { assert(errors.length === 0, errors.join(' | ')); }]
]);
await t.close();
