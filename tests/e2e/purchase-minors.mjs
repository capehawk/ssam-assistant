// 미뤄 둔 작은 것(품의 화면): 산출 내역 표에 구입처 열, 개인정보가 든 칸만 빨갛게, 협의회 상한 오류는 그 카드에,
// 예전 초안은 열자마자 「바뀌었어요」가 뜨지 않음, 지금 쓰는 품의를 최근 작성에서 열어도 고치던 것 그대로,
// [한 품의로] 고른 구입처는 다시 묻지 않음(새 구입처면 물음), 구입처별로 나눠도 초안은 남고 사유가 다시 맞춰짐
import { open, run, assert } from './helpers.mjs';

const t = await open();
const { page, url, errors } = t;
// 품의 칸을 다루는 시험: [자세히 고치기]를 펼친 채로 (처음 화면은 purchase-oneshot.mjs)
await page.addInitScript(() => { if (!localStorage.getItem('ssam:purchase:view')) localStorage.setItem('ssam:purchase:view', JSON.stringify('full')); });
await page.addInitScript(() => {
  if (!localStorage.getItem('ssam:engine')) localStorage.setItem('ssam:engine', JSON.stringify({ engine: 'claude', keys: { claude: 'sk-test' }, remember: true }));
});
let cart = [{ name: '물티슈', spec: '100매', unit: '팩', qty: 2, price: 3000, vendor: '쿠팡' }, { name: '지퍼백', spec: '', unit: '개', qty: 10, price: 500, vendor: '학교장터' }];
await page.route('https://api.anthropic.com/**', async route => {
  const body = JSON.parse(route.request().postData());
  const c = body.messages[0].content;
  const prompt = typeof c === 'string' ? c : c.filter(x => x.type === 'text').map(x => x.text).join('\n');
  let out = JSON.stringify({ title: '교실 물품 구입', intro: '교실 물품을 다음과 같이 구입하고자 합니다.' });
  if (prompt.startsWith('[품의 넣기]')) out = JSON.stringify({ items: cart, shipping: [], fields: {} });
  await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: [{ type: 'content_block_delta', delta: { type: 'text_delta', text: out } }, { type: 'message_delta', delta: { stop_reason: 'end_turn' } }].map(e => 'data: ' + JSON.stringify(e) + '\n\n').join('') }).catch(() => {});
});
const P = 'section[data-menu="purchase"]';
const until = async (fn, ms = 8000) => { const end = Date.now() + ms; while (!(await fn())) { if (Date.now() > end) throw new Error('시간 초과'); await new Promise(r => setTimeout(r, 50)); } };
const cur = () => page.evaluate(() => JSON.parse(localStorage.getItem('ssam:purchase:current')));
const set = (k, v) => page.evaluate(([k, v]) => localStorage.setItem('ssam:' + k, JSON.stringify(v)), [k, v]);
const base = { type: 'goods', project: '교실 물품', purpose: '수업 준비', date: '2026-11-10', target: '3학년 1반' };
const go = async () => { await page.reload(); await page.waitForTimeout(400); await page.click('nav.app-side [data-menu-go="purchase"]'); await page.click('#menuTabs [data-tab="new"]'); await page.waitForSelector(`${P} #pcIntake`); };
const draft = async () => { await page.click(`${P} [data-pc="draft"]`); await page.waitForFunction(s => document.querySelector(`${s} #pcReason`), P, { timeout: 8000 }); };
const pasteImage = () => page.evaluate(async () => {
  const c = document.createElement('canvas'); c.width = 40; c.height = 30;
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  const dt = new DataTransfer(); dt.items.add(new File([blob], 'image.png', { type: 'image/png' }));
  document.querySelector('#pcIntake').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
});
const tailOk = () => page.evaluate(async () => { const r = await import('./menus/purchase/rules.js'); const c = JSON.parse(localStorage.getItem('ssam:purchase:current')); return c.draft.reason.endsWith(r.reasonTail(c.form)); });
await page.goto(url);
await page.waitForTimeout(300);

await run('purchase-minors', [
  ['산출 내역 표: 구입처가 있으면 구입처 열', async () => {
    await set('purchase:current', { id: 'pcA', form: { ...base, items: [{ name: '비커', unit: '개', qty: '8', price: '4500', vendor: '과학사' }] }, draft: null });
    await go(); await draft();
    const head = await page.textContent(`${P} #pcCalc thead`), body = await page.textContent(`${P} #pcCalc tbody`);
    assert(head.includes('구입처') && body.includes('과학사'), head + ' / ' + body);
  }],
  ['개인정보가 든 칸만 빨갛게(구입처 칸에 주민번호)', async () => {
    await set('purchase:current', { id: 'pcB', form: { ...base, items: [{ name: '비커', qty: '8', price: '4500' }, { name: '스포이트', qty: '2', price: '500', vendor: '800101-1234567' }] }, draft: null });
    await go();
    await page.click(`${P} [data-pc="draft"]`);
    await page.waitForSelector(`${P} [data-item="1"][data-f="vendor"].bad`);
    assert(!(await page.$(`${P} [data-item="0"][data-f="name"].bad`)), '첫 줄 품명이 빨감');
  }],
  ['설정 › 품의 기준: 협의회 상한 오류는 협의회 카드에', async () => {
    await page.click('nav.app-side [data-menu-go="settings"]'); await page.click('#menuTabs [data-tab="purchase"]');
    await page.fill('#meetCap', '0');
    await page.click('[data-set="saveMeetCap"]');
    await page.waitForSelector('.set-msg');
    assert(await page.evaluate(() => !!document.querySelector('.set-msg').closest('.set-card').querySelector('#meetCap')), '다른 카드에 뜸');
  }],
  ['예전 초안(첫 문장 따로 없음·붙임 없는 사유)은 열자마자 「바뀌었어요」가 뜨지 않고, 품목을 바꾸면 뜸', async () => {
    await set('purchase:current', { id: 'pcC', form: { ...base, items: [{ name: '비커', qty: '8', price: '4500' }] }, draft: { title: '비커 구입', reason: '비커를 구입하고자 합니다.\n\n가. 목적: 수업 준비\n나. 일시: 2026-11-10' } });
    await go();
    await page.waitForSelector(`${P} #pcReason`);
    assert(!(await page.$(`${P} [data-pc="resync"]`)), '열자마자 뜸');
    await page.fill(`${P} [data-item="0"][data-f="qty"]`, '10');
    await page.waitForSelector(`${P} [data-pc="resync"]`);
  }],
  ['손으로 고친 사유는 품목이 그대로면 「바뀌었어요」가 뜨지 않음', async () => {
    await set('purchase:current', { id: 'pcD', form: { ...base, items: [{ name: '비커', qty: '8', price: '4500' }] }, draft: null });
    await go(); await draft();
    await page.fill(`${P} #pcReason`, '선생님이 다 고친 사유입니다.');
    await page.waitForTimeout(150);
    assert(!(await page.$(`${P} [data-pc="resync"]`)), '고치기만 했는데 뜸');
  }],
  ['지금 쓰는 품의를 최근 작성에서 [열기]: 고치던 것 그대로(옛 모습으로 바뀌지 않음)', async () => {
    await page.fill(`${P} #pcProject`, '고치던 사업명');
    await page.click('#menuTabs [data-tab="recent"]');
    await page.click(`${P} [data-recent-open="pcD"]`);
    await page.waitForSelector(`${P} #pcProject`);
    assert(await page.inputValue(`${P} #pcProject`) === '고치던 사업명' && (await cur()).form.project === '고치던 사업명', await page.inputValue(`${P} #pcProject`));
  }],
  ['[한 품의로] 고른 구입처는 다음 넣기에서 다시 묻지 않음 · 새 구입처가 오면 물음', async () => {
    await set('purchase:current', { id: 'pcE', form: { ...base, items: [{ name: '', spec: '', qty: '', price: '' }] }, draft: null });
    await go();
    await pasteImage();
    await page.waitForSelector('#sheetRoot #pcVendorOne');
    await page.click('#sheetRoot #pcVendorOne');
    await page.waitForFunction(() => !document.querySelector('#sheetRoot #pcVendorOne'));
    await pasteImage();
    await page.waitForSelector('#sheetRoot #pcMergeAdd');
    await page.click('#sheetRoot #pcMergeAdd');
    await until(async () => (await cur()).form.items.filter(i => i.name).length === 4);
    await page.waitForTimeout(400);
    assert(!(await page.$('#sheetRoot #pcVendorOne')), '같은 구입처인데 또 물음');
    cart = [{ name: '풀', spec: '', unit: '개', qty: 3, price: 800, vendor: '문구점' }];
    await pasteImage();
    await page.waitForSelector('#sheetRoot #pcMergeAdd');
    await page.click('#sheetRoot #pcMergeAdd');
    await page.waitForSelector('#sheetRoot #pcVendorOne');
    await page.click('#sheetRoot #pcVendorOne');
  }],
  ['구입처별로 나눠도 초안은 남고 사유(소요 예산)가 남은 품목으로 다시 맞춰짐', async () => {
    cart = [{ name: '물티슈', spec: '100매', unit: '팩', qty: 2, price: 3000, vendor: '쿠팡' }, { name: '지퍼백', spec: '', unit: '개', qty: 10, price: 500, vendor: '학교장터' }];
    await page.evaluate(() => localStorage.removeItem('ssam:purchase:recent'));
    await set('purchase:current', { id: 'pcF', form: { ...base, items: [{ name: '', spec: '', qty: '', price: '' }] }, draft: null });
    await go();
    await pasteImage();
    await page.waitForSelector('#sheetRoot #pcVendorOne');
    await page.click('#sheetRoot #pcVendorOne');
    await page.waitForFunction(() => !document.querySelector('#sheetRoot #pcVendorOne'));
    await draft();
    cart = [{ name: '가위', spec: '', unit: '개', qty: 2, price: 2000, vendor: '문구점' }];
    await pasteImage();
    await page.waitForSelector('#sheetRoot #pcMergeAdd');
    await page.click('#sheetRoot #pcMergeAdd');
    await page.waitForSelector('#sheetRoot #pcVendorSplit');
    await page.click('#sheetRoot #pcVendorSplit');
    await until(async () => (await cur()).form.items.filter(i => i.name).length === 1);
    const c = await cur();
    assert(c.draft && c.draft.title === '교실 물품 구입', JSON.stringify(c.draft));
    assert(await tailOk(), '사유가 다시 맞춰지지 않음');
    assert((await page.inputValue(`${P} #pcReason`)).includes('금6,000원'), await page.inputValue(`${P} #pcReason`));
  }],
  ['페이지 오류 없음', async () => { assert(errors.length === 0, errors.join(' | ')); }]
]);
await t.close();
