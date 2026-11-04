// 화면 줄이기(0.17): 새 품의는 종류(물품 구입 …)와 [템플릿으로 저장]·[새로 쓰기]가 한 줄,
// 쪽지 작성·가정통신문·공문 처리는 AI 줄이 머리의 [새 …] 버튼 옆(따로 한 줄을 쓰지 않음), 좁은 창에서도 가로로 넘치지 않음
import { open, run, assert } from './helpers.mjs';

const t = await open();
const { page, url, errors } = t;
await page.addInitScript(() => {
  if (!localStorage.getItem('ssam:engine')) localStorage.setItem('ssam:engine', JSON.stringify({ engine: 'claude', keys: { claude: 'sk-test' }, remember: true }));
});
await page.setViewportSize({ width: 1280, height: 860 });
await page.goto(url);
await page.waitForTimeout(400);
const box = sel => page.locator(sel).first().boundingBox();
const sameRow = (a, b) => a && b && Math.abs((a.y + a.height / 2) - (b.y + b.height / 2)) < Math.max(a.height, b.height);

await run('layout-0417', [
  ['새 품의: 종류 줄 오른쪽에 [템플릿으로 저장]·[새로 쓰기]', async () => {
    await page.click('nav.app-side [data-menu-go="purchase"]'); await page.click('#menuTabs [data-tab="new"]');
    await page.waitForSelector('.pc-types');
    const seg = await box('.pc-types'), tpl = await box('[data-pc="saveTpl"]'), fresh = await box('[data-pc="fresh"]');
    assert(sameRow(seg, tpl) && sameRow(seg, fresh) && tpl.x > seg.x + seg.width - 1, JSON.stringify({ seg, tpl, fresh }));
  }],
  ...[['message', 'msg-box', 'data-msg="new"'], ['letter', 'lf-box', 'data-lf="new"'], ['gongmun', 'gm-box', null]].map(([tab, cls, btn]) => [`기타 › ${tab}: AI 줄이 머리 안(제목과 같은 줄 높이)`, async () => {
    await page.click('nav.app-side [data-menu-go="etc"]'); await page.click(`#menuTabs [data-tab="${tab}"]`);
    const P = `section[data-menu="etc"] .${cls}`;
    await page.waitForSelector(`${P} .m-head [data-ai-row]`, { timeout: 5000 });
    const h = await box(`${P} .m-head h2`), ai = await box(`${P} .m-head [data-ai-row]`);
    assert(ai && h && ai.y < h.y + h.height + 30, JSON.stringify({ h, ai }));
    if (btn) { const b = await box(`${P} [${btn}]`); assert(sameRow(ai, b), JSON.stringify({ ai, b })); }
  }]),
  ['390px 폭에서 가로로 넘치지 않음(새 품의·쪽지)', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const [m, tb] of [['purchase', 'new'], ['etc', 'message']]) {
      await page.click(`nav.app-side [data-menu-go="${m}"]`).catch(() => {}); await page.click(`#menuTabs [data-tab="${tb}"]`).catch(() => {});
      await page.waitForTimeout(200);
      const w = await page.evaluate(() => [document.querySelector('#app').scrollWidth, document.querySelector('#app').clientWidth]);
      assert(w[0] <= w[1], `${m} 넘침: ${w}`);
    }
    await page.setViewportSize({ width: 1280, height: 860 });
  }],
  ['페이지 오류 없음', async () => { assert(errors.length === 0, errors.join(' | ')); }]
]);
await t.close();
