// 품의 저장한 템플릿·최근 작성·[새로 쓰기]: 저장·이름 바꾸기·불러오기(일시 비움, 쓰던 품의가 있으면 먼저 물어봄)·지우기,
// 초안을 만들면 최근 작성에 남고, [새로 쓰기] 뒤 [열기]로 입력·초안이 돌아옴, 새로고침 뒤에도 남음
import { open, run, assert } from './helpers.mjs';

const t = await open();
const { page, url, errors } = t;
// 품의 칸을 다루는 시험: [자세히 고치기]를 펼친 채로 (처음 화면은 purchase-oneshot.mjs)
await page.addInitScript(() => { if (!localStorage.getItem('ssam:purchase:view')) localStorage.setItem('ssam:purchase:view', JSON.stringify('full')); });
await page.addInitScript(() => {
  if (!localStorage.getItem('ssam:engine')) localStorage.setItem('ssam:engine', JSON.stringify({ engine: 'claude', keys: { claude: 'sk-test' }, remember: true }));
});
await page.route('https://api.anthropic.com/**', async route => {
  const out = JSON.stringify({ title: '과학 실험 재료 구입', intro: '과학 실험 재료를 다음과 같이 구입하고자 합니다.' });
  await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: [{ type: 'content_block_delta', delta: { type: 'text_delta', text: out } }, { type: 'message_delta', delta: { stop_reason: 'end_turn' } }].map(e => 'data: ' + JSON.stringify(e) + '\n\n').join('') }).catch(() => {});
});
const P = 'section[data-menu="purchase"]';
const tab = async id => { await page.click('nav.app-side [data-menu-go="purchase"]'); await page.click(`#menuTabs [data-tab="${id}"]`); };
const cur = () => page.evaluate(() => JSON.parse(localStorage.getItem('ssam:purchase:current')));
await page.goto(url);
await page.waitForTimeout(300);
await page.evaluate(() => localStorage.setItem('ssam:purchase:current', JSON.stringify({ form: { type: 'goods', project: '과학 실험 재료', purpose: '모둠 실험', date: '2026-11-10', target: '5학년', items: [{ name: '비커', spec: '500ml', unit: '개', qty: '8', price: '4500' }] }, draft: null })));
await page.reload(); await page.waitForTimeout(400);

await run('purchase-library', [
  ['[템플릿으로 저장] → 이름 → 템플릿 탭에 1줄(품목 1개·합계)', async () => {
    await tab('new');
    await page.click(`${P} [data-pc="saveTpl"]`);
    await page.waitForSelector('#sheetRoot #pcTplName');
    assert(await page.inputValue('#sheetRoot #pcTplName') === '과학 실험 재료', '기본 이름');
    await page.fill('#sheetRoot #pcTplName', '실험 재료');
    await page.click('#sheetRoot #pcTplOk');
    await tab('templates');
    await page.waitForSelector(`${P} [data-tpl-load]`);
    const row = await page.textContent(`${P} .pc-lib-list`);
    assert(row.includes('실험 재료') && row.includes('품목 1개') && row.includes('36,000원'), row);
  }],
  ['[이름 바꾸기]', async () => {
    await page.click(`${P} [data-tpl-rename]`);
    await page.waitForSelector('#sheetRoot #pcTplRename');
    await page.fill('#sheetRoot #pcTplRename', '5학년 실험 재료');
    await page.click('#sheetRoot #pcTplRenameOk');
    await page.waitForFunction(s => document.querySelector(`${s} .pc-lib-list`).textContent.includes('5학년 실험 재료'), P);
  }],
  ['[불러오기]: 쓰던 품의가 있으면 먼저 물어봄 → 칸·품목(수량 그대로), 일시는 비고 초안 없음', async () => {
    await page.click(`${P} [data-tpl-load]`);
    await page.waitForSelector('#sheetRoot #pcSwapOk');
    await page.click('#sheetRoot #pcSwapOk');
    await page.waitForSelector(`${P} #pcIntake`);
    const c = await cur();
    assert(c.form.project === '과학 실험 재료' && c.form.date === '' && c.form.items[0].qty === '8' && !c.draft, JSON.stringify(c).slice(0, 300));
    assert(await page.inputValue(`${P} #pcDate`) === '', '일시 칸');
  }],
  ['초안 만들기 → 최근 작성 1줄(제목) → [새로 쓰기] 빈 품의 → [열기]로 입력·초안이 돌아옴', async () => {
    await page.fill(`${P} #pcDate`, '2026-11-20');
    await page.click(`${P} [data-pc="draft"]`);
    await page.waitForFunction(s => document.querySelector(`${s} #pcTitle`), P);
    await page.click(`${P} [data-pc="fresh"]`);
    await page.waitForFunction(() => !JSON.parse(localStorage.getItem('ssam:purchase:current')).form.project);
    assert(await page.inputValue(`${P} #pcProject`) === '', '빈 품의가 아님');
    await tab('recent');
    await page.waitForSelector(`${P} [data-recent-open]`);
    assert((await page.textContent(`${P} .pc-lib-list`)).includes('과학 실험 재료 구입'), await page.textContent(`${P} .pc-lib-list`));
    await page.click(`${P} [data-recent-open]`);
    await page.waitForFunction(s => document.querySelector(`${s} #pcTitle`), P);
    assert(await page.inputValue(`${P} #pcTitle`) === '과학 실험 재료 구입' && await page.inputValue(`${P} #pcDate`) === '2026-11-20', '돌아오지 않음');
  }],
  ['같은 품의로 초안을 다시 만들면 최근 작성은 한 줄 그대로, 새로고침 뒤에도 남음', async () => {
    await page.click(`${P} [data-pc="draft"]`);
    await page.waitForTimeout(400);
    await page.reload(); await page.waitForTimeout(400);
    await tab('recent');
    await page.waitForSelector(`${P} [data-recent-open]`);
    assert(await page.locator(`${P} [data-recent-open]`).count() === 1, '줄 수');
  }],
  ['[지우기]: 최근 작성·템플릿(확인)', async () => {
    await page.click(`${P} [data-recent-del]`);
    await page.waitForFunction(s => !document.querySelector(`${s} [data-recent-open]`), P);
    await tab('templates');
    await page.click(`${P} [data-tpl-del]`);
    await page.waitForSelector('#sheetRoot #pcTplDelOk');
    await page.click('#sheetRoot #pcTplDelOk');
    await page.waitForFunction(s => !document.querySelector(`${s} [data-tpl-load]`), P);
    assert((await page.textContent(`${P} .pc-lib`)).includes('아직 없어요'), '빈 안내');
  }],
  ['페이지 오류 없음', async () => { assert(errors.length === 0, errors.join(' | ')); }]
]);
await t.close();
