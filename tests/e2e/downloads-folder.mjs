// 평가 결과 내려받기 옆 [다운로드 폴더] (Windows 앱): 단원평가 성적 일람표·결과지, 활동지 반 표·피드백 쪽지 줄에 있고
// 누르면 다운로드 폴더를 탐색기로 엶(open_downloads). 웹판은 폴더를 열 수 없어 버튼이 없음. 탭 아이콘은 헤더 로고 그림
import { open, run, assert } from './helpers.mjs';

const t = await open();
const { page, url, errors } = t;
const E = 'section[data-menu="evaluate"]', U = `${E} .unit-box`;
const tab = async id => { await page.click('nav.app-side [data-menu-go="evaluate"]'); await page.click(`#menuTabs [data-tab="${id}"]`); };
const app = (fail = false) => page.evaluate(fail => {
  window.__calls = [];
  window.__TAURI__ = { core: { invoke: async (cmd, args) => { window.__calls.push(cmd); if (fail && cmd === 'open_downloads') throw '폴더를 열지 못했어요: 없음'; return null; } } };
}, fail);
const unitResults = async () => {
  await tab('unit');
  if (await page.locator(`${U} [data-un="back"]`).count()) await page.click(`${U} [data-un="back"]`);
  await page.click(`${U} [data-unv="results"]`);
  await page.waitForSelector(`${U} [data-un="tableHwpx"]`);
};
await page.goto(url);
await page.waitForTimeout(400);
await tab('unit');
await page.click(`${U} [data-un="sample"]`);

await run('downloads-folder', [
  ['웹판: 성적 일람표 줄에 [다운로드 폴더] 없음(브라우저는 폴더를 열 수 없음)', async () => {
    await unitResults();
    assert(await page.locator(`${E} [data-open-downloads]`).count() === 0, '웹판에 버튼이 있음');
  }],
  ['Windows 앱: 성적 일람표 [한글로 내려받기▾] 옆 [다운로드 폴더] → 다운로드 폴더 열기', async () => {
    await app();
    await page.click('nav.app-side [data-menu-go="class"]');
    await unitResults();
    const b = `${U} .row:has([data-un="tableHwpx"]) [data-open-downloads]`;
    await page.waitForSelector(b);
    const txt = (await page.textContent(b)).trim();
    assert(txt === '다운로드 폴더' && (await page.locator(`${b} svg`).count()) === 1, txt);
    // 내려받기 단추 바로 뒤
    const order = await page.$$eval(`${U} .row:has([data-un="tableHwpx"]) > *`, els => els.map(e => e.matches('[data-open-downloads]') ? 'folder' : e.querySelector('[data-un="tableHwpx"]') ? 'export' : ''));
    assert(order.indexOf('folder') === order.indexOf('export') + 1, JSON.stringify(order));
    await page.click(b);
    await page.waitForFunction(() => window.__calls.includes('open_downloads'));
  }],
  ['Windows 앱: 단원평가 결과지(4단계) 줄에도', async () => {
    await page.click(`${U} [data-un="back"]`).catch(() => {});
    await page.click(`${U} [data-unv="list"]`).catch(() => {});
    await page.click(`${U} [data-un-open="sample-1"]`);
    const b = `${U} .row:has([data-un="fbHwpx"]) [data-open-downloads]`;
    await page.waitForSelector(b);
    await page.evaluate(() => { window.__calls = []; });
    await page.click(b);
    await page.waitForFunction(() => window.__calls.includes('open_downloads'));
  }],
  ['Windows 앱: 활동지 반 표·피드백 쪽지 줄에도, 열지 못하면 알림', async () => {
    await app(true);
    await tab('activity');
    await page.click(`${E} [data-ac="sample"]`);
    const id = await page.evaluate(() => JSON.parse(localStorage.getItem('ssam:activity:list'))[0].id);
    await page.click(`${E} [data-ac-open="${id}"]`);
    const b = `${E} .row:has([data-ac="exportSlips"]) [data-open-downloads]`;
    await page.waitForSelector(b);
    assert(await page.locator(`${E} .act-box [data-open-downloads]`).count() === 1, '활동지 결과에 하나(반 표·피드백 쪽지 줄 끝)');
    await page.click(b);
    await page.waitForFunction(() => /다운로드 폴더를 열지 못했어요/.test(document.body.textContent));
  }],
  ['탭 아이콘: 헤더 로고와 같은 말풍선 그림이 그려짐', async () => {
    const r = await page.evaluate(async () => {
      const href = document.querySelector('link[rel="icon"]').href, im = new Image(); im.src = href; await im.decode();
      const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d'); g.drawImage(im, 0, 0, 64, 64);
      const px = (x, y) => [...g.getImageData(x, y, 1, 1).data];
      return { w: im.naturalWidth, left: px(8, 32), corner: px(58, 58) };
    });
    assert(r.w > 0 && r.left[3] > 240 && r.left[2] > r.left[0] && r.corner[3] === 0, JSON.stringify(r));
  }],
  ['페이지 오류 없음', async () => { assert(errors.length === 0, errors.join(' | ')); }]
]);
await t.close();
