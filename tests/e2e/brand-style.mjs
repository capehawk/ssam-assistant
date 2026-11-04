// 로고: 말풍선 모양 표시(테마 색 그러데이션·반짝임)와 「쌤비서」·「학교 업무 AI 비서」, 테마 5개 모두 머리 높이 그대로·좁은 창에서는 표시만,
// 글쓰기 원칙: 글을 쓰는 업무(쪽지 등) AI 요청에는 원칙이 붙고, 답의 이중 피동은 고쳐짐
import { open, run, assert, mockClaude } from './helpers.mjs';

const t = await open();
const { page, url, errors } = t;
await page.addInitScript(() => {
  if (!localStorage.getItem('ssam:engine')) localStorage.setItem('ssam:engine', JSON.stringify({ engine: 'claude', keys: { claude: 'sk-test' }, remember: true }));
});
const prompts = [];
await mockClaude(page, ({ prompt }) => { prompts.push(prompt); return prompt.startsWith('[공문 처리]') ? JSON.stringify({ title: '안내', summary: '참여가 늘어날 것으로 보여진다.', tasks: [], kinds: [] }) : '{}'; });
await page.goto(url);
await page.waitForTimeout(400);

await run('brand-style', [
  ['로고: 말풍선 표시(svg)·반짝임·이름·부제, 테마마다 머리 높이 76', async () => {
    for (const th of ['dark-nav', 'mono', 'soft', 'paper', 'rail']) {
      await page.evaluate(x => { document.documentElement.dataset.theme = x; }, th);
      const r = await page.evaluate(() => ({ svg: !!document.querySelector('.app-logo .logo-mark svg .lm-spark'), h: document.querySelector('nav.app-side .app-logo').getBoundingClientRect().height,
        name: document.querySelector('.app-logo .logo-name').textContent, sub: (document.querySelector('.app-logo .logo-sub') || {}).textContent }));
      assert(r.svg && r.h === 76 && r.name === '쌤비서' && r.sub === '학교 업무 AI 비서', th + JSON.stringify(r));
    }
    await page.evaluate(() => { document.documentElement.dataset.theme = 'dark-nav'; });
    assert(await page.isVisible('.app-logo .logo-sub'), '부제가 안 보임');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(150);
    assert(await page.isVisible('.app-logo .logo-mark') && !(await page.isVisible('.app-logo .logo-sub')), '좁은 창');
    await page.setViewportSize({ width: 1280, height: 860 });
  }],
  ['글쓰기 원칙: 공문 처리 AI 요청에 원칙이 붙고, 답의 「보여진다」는 「보인다」로', async () => {
    await page.click('nav.app-side [data-menu-go="etc"]'); await page.click('#menuTabs [data-tab="gongmun"]');
    await page.fill('section[data-menu="etc"] .gm-box #gmPaste', '안내 공문\n수신 각 학교');
    await page.click('section[data-menu="etc"] .gm-box [data-gm="paste"]');
    await page.waitForFunction(() => document.querySelector('.gm-doc .gm-sum'), null, { timeout: 8000 });
    const p = prompts.find(x => x.startsWith('[공문 처리]'));
    assert(p.includes('[글쓰기 원칙]') && p.includes('되어진다'), p.slice(-300));
    assert((await page.textContent('.gm-doc .gm-sum')).includes('늘어날 것으로 보인다'), await page.textContent('.gm-doc .gm-sum'));
  }],
  ['페이지 오류 없음', async () => { assert(errors.length === 0, errors.join(' | ')); }]
]);
await t.close();
