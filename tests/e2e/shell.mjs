// 창 틀: 세로 메뉴 + 헤더(┌), 메뉴 전환, 마지막 위치 기억, 좁은 화면
import { open, run, assert, mockClaude } from './helpers.mjs';

const t = await open();
const { page, url, errors } = t;
const title = () => page.textContent('header.app-top h1');
const tabs = () => page.locator('header.app-top nav.app-tabs button').allInnerTexts();
const current = sel => page.locator(`${sel} [aria-current="page"]`).innerText();

let slow = true;
await page.addInitScript(() => {
  if (!localStorage.getItem('ssam:engine')) localStorage.setItem('ssam:engine', JSON.stringify({ engine: 'claude', keys: { claude: 'sk-test' }, remember: true }));
});
await mockClaude(page, async ({ prompt }) => {
  if (slow) await new Promise(r => setTimeout(r, 2500));
  return Array.from({ length: 60 }, (_, j) => `경험과 관련지어 작품을 감상하며 ${j + 1}번째 생각을 근거를 들어 자신 있게 발표함.`).join('\n');
});
await page.goto(url);
await page.waitForTimeout(600);

await run('shell', [
  ['처음 열면 평가 › 교과 평어', async () => {
    assert(await current('nav.app-side') === '평가', '세로 메뉴 현재: ' + await current('nav.app-side'));
    assert(await title() === '평가', '제목: ' + await title());
    const ts = await tabs();
    assert(ts.join('|') === '교과 평어|창의적 체험활동|행동특성|평가지 채점|단원평가|활동지', '가로 메뉴: ' + ts.join('|'));
    assert(await current('header.app-top nav.app-tabs') === '교과 평어', '가로 메뉴 현재');
  }],
  ['로고 칸과 헤더 높이가 76px', async () => {
    const h = await page.evaluate(() => [document.querySelector('nav.app-side .app-logo').getBoundingClientRect().height, document.querySelector('header.app-top').getBoundingClientRect().height]);
    assert(h[0] === 76 && h[1] === 76, '높이: ' + h.join(', '));
  }],
  ['품의로 가면 제목·가로 메뉴·섹션이 바뀌고, 새로고침해도 품의', async () => {
    await page.click('nav.app-side [data-menu-go="purchase"]');
    assert(await title() === '품의', '제목: ' + await title());
    assert((await tabs()).join('|') === '새 품의|저장한 템플릿|최근 작성', '가로 메뉴');
    assert(await page.isVisible('section[data-menu="purchase"]') && !(await page.isVisible('section[data-menu="evaluate"]')), '섹션 표시');
    await page.reload(); await page.waitForTimeout(400);
    assert(await title() === '품의', '새로고침 뒤 제목: ' + await title());
  }],
  ['평가 › 평가지 채점을 누르면 채점 화면', async () => {
    await page.click('nav.app-side [data-menu-go="evaluate"]');
    await page.click('header.app-top nav.app-tabs [data-tab="gr"]');
    assert(await page.evaluate(() => window.SSAM.getMode()) === 'gr', 'mode가 gr이 아님');
    assert(await page.isVisible('#grView'), '#grView 안 보임');
    assert(await current('header.app-top nav.app-tabs') === '평가지 채점', '가로 메뉴 현재');
  }],
  ['망가진 위치 값이면 평가로 열림', async () => {
    for (const bad of ['{"menu":"없음","tab":"x"}', '망가진 값']) {
      await page.evaluate(v => localStorage.setItem('ssam:nav', v), bad);
      await page.reload(); await page.waitForTimeout(400);
      assert(await title() === '평가', `${bad} → ${await title()}`);
    }
  }],
  ['평어를 만드는 동안 메뉴를 옮겨도 계속 만들고 진행 표시가 보임', async () => {
    await page.click('header.app-top nav.app-tabs [data-tab="pyeongeo"]');
    await page.click('#srcPaste');
    await page.fill('#pasteBox', await page.getAttribute('#pasteBox', 'placeholder'));
    await page.click('#pasteGo');
    await page.click('#genBtn');            // 「평어 만들기」 → 과목 고르기
    await page.click('#pickGo');
    await page.waitForSelector('#genSpin:not([hidden])', { timeout: 5000 });
    await page.click('nav.app-side [data-menu-go="purchase"]');
    assert(await page.isVisible('#genPill'), '품의에서 진행 표시가 안 보임');
    slow = false;
    await page.click('nav.app-side [data-menu-go="evaluate"]');
    await page.waitForFunction(() => document.querySelector('#genPill').hidden, null, { timeout: 30000 });
    const n = await page.locator('#pane .sent').count();
    assert(n > 0, '만든 평어가 없음');
  }],
  ['평어 문장 옆 글자 수 칸이 세로 메뉴 색을 물려받지 않음', async () => {
    const bg = await page.evaluate(() => getComputedStyle(document.querySelector('#pane .sent .side')).backgroundColor);
    assert(bg !== 'rgb(21, 23, 28)', '글자 수 칸 배경이 세로 메뉴 색: ' + bg);
  }],
  ['390px 폭에서 가로 스크롤 없고 메뉴 글자가 한 줄', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(200);
    const w = await page.evaluate(() => document.documentElement.scrollWidth);
    assert(w <= 390, 'scrollWidth ' + w);
    const hs = await page.evaluate(() => [...document.querySelectorAll('.side-btn span')].map(s => s.getBoundingClientRect().height));
    assert(hs.every(h => h > 0 && h < 26), '메뉴 글자 높이(줄바꿈?): ' + hs.join(','));
    await page.setViewportSize({ width: 1280, height: 860 });
  }],
  ['380px 폭: 세로 메뉴 버튼·가로 메뉴가 모두 화면 안, 본문도 가로로 넘치지 않음', async () => {
    await page.setViewportSize({ width: 380, height: 800 });
    await page.click('nav.app-side [data-menu-go="settings"]'); await page.click('#menuTabs [data-tab="school"]');
    await page.click('section[data-menu="settings"] [data-set="addBreak"]');
    await page.waitForTimeout(200);
    const r = await page.evaluate(() => ({
      side: [...document.querySelectorAll('.app-side .side-btn')].map(b => { const x = b.getBoundingClientRect(); return [b.textContent.trim(), Math.round(x.left), Math.round(x.right)]; }),
      tabs: [...document.querySelectorAll('#menuTabs button')].map(b => { const x = b.getBoundingClientRect(); return [b.textContent.trim(), Math.round(x.right)]; }),
      app: [document.querySelector('#app').scrollWidth, document.querySelector('#app').clientWidth],
      sideBox: [document.querySelector('.app-side').scrollWidth, document.querySelector('.app-side').clientWidth]
    }));
    assert(r.side.every(([, l, rt]) => l >= 0 && rt <= 380), '세로 메뉴 버튼이 화면 밖: ' + JSON.stringify(r.side));
    assert(r.tabs.every(([, rt]) => rt <= 380), '가로 메뉴가 화면 밖: ' + JSON.stringify(r.tabs));
    assert(r.sideBox[0] <= r.sideBox[1], '세로 메뉴가 넘침: ' + r.sideBox);
    assert(r.app[0] <= r.app[1], '본문이 넘침: ' + r.app);
    await page.setViewportSize({ width: 1280, height: 860 });
  }],
  ['설정에서 끄고 다시 켜면 설정만 보이고 「곧 만들어요」 자리가 없음', async () => {
    await page.click('nav.app-side [data-menu-go="settings"]'); await page.click('#menuTabs [data-tab="ai"]');
    await page.reload(); await page.waitForTimeout(500);
    assert(await title() === '설정', '제목: ' + await title());
    assert(await page.locator('section[data-menu="settings"] .ph').count() === 0, '설정에 「곧 만들어요」가 남음');
    assert((await page.textContent('section[data-menu="settings"]')).includes('지금 쓰는 AI'), '설정 › AI 내용 없음');
  }],
  ['품의에서 ⋮ → 새 평가계획 넣기를 누르면 평가로 감', async () => {
    await page.click('nav.app-side [data-menu-go="purchase"]');
    await page.click('#menuBtn'); await page.click('#menu [data-act="new"]');
    assert(await title() === '평가', '제목: ' + await title());
    assert(await page.isVisible('section[data-menu="evaluate"]'), '평가 화면이 안 보임');
    await page.keyboard.press('Escape');
  }],
  ['단원평가·창체·평가지 채점 탭에서 ⋮ → 새 평가계획 넣기를 누르면 교과 평어의 넣기 화면이 보임', async () => {
    for (const tab of ['unit', 'cc', 'gr']) {
      await page.click('nav.app-side [data-menu-go="evaluate"]'); await page.click(`#menuTabs [data-tab="${tab}"]`);
      await page.click('#menuBtn'); await page.click('#menu [data-act="new"]');
      await page.waitForTimeout(150);
      assert(await page.getAttribute('#menuTabs [data-tab="pyeongeo"]', 'aria-current') === 'page', tab + ': 탭이 그대로');
      assert(await page.isVisible('#importView'), tab + ': 넣기 화면이 안 보임');
    }
  }],
  ['페이지 오류 없음', async () => { assert(errors.length === 0, errors.join(' | ')); }]
]);
await t.close();
