// 0.18.1 창 다듬기: 한꺼번에 넣기 확인 카드(활동지·단원평가·평가지 채점)는 쪽이 많아도 가로로 넘치지 않고,
// [이대로 넣기]·[취소]는 스크롤 없이 바로 누를 수 있음(넓은 창·좁은 창)
import { open, run, assert } from './helpers.mjs';

const t = await open();
const { page, url, errors } = t;
await page.goto(url);
await page.waitForTimeout(400);

// 학생 스캔 30쪽 + 교사용 1쪽 + 교사용 글이 있는 활동지 묶음으로 확인 카드를 띄움
const card = () => page.evaluate(async () => {
  const B = await import('./core/bundle.js');
  const c = document.createElement('canvas'); c.width = 300; c.height = 420;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 300, 420); g.fillStyle = '#000'; g.fillRect(20, 40, 200, 20);
  const src = c.toDataURL('image/png');
  const pages = Array.from({ length: 31 }, () => ({ url: src, thumb: src }));
  const b = { doc: { student: '1. 고마운 사람\n누구?', docTeacher: '1. 고마운 사람\n누구? 할머니', teacher: '', how: 'marker', names: ['편지 쓰기.txt'] }, pages, roles: ['teacher', ...Array(30).fill('student')], skipped: [] };
  window.__r = 'wait'; B.openBundleCard(b, { what: '활동지' }).then(r => { window.__r = r; });
});
const check = async label => {
  await page.waitForSelector('#sheetRoot #bundleOk');
  const m = await page.evaluate(() => {
    const sh = document.querySelector('#sheetRoot .sheet'), ok = document.querySelector('#bundleOk').getBoundingClientRect(), no = document.querySelector('#sheetRoot [data-close]').getBoundingClientRect();
    return { sw: sh.scrollWidth, cw: sh.clientWidth, ok: [ok.left, ok.top, ok.right, ok.bottom], no: [no.left, no.right], vw: innerWidth, vh: innerHeight, pageW: document.documentElement.scrollWidth };
  });
  assert(m.sw <= m.cw + 1, `${label}: 창이 가로로 넘침 ${JSON.stringify(m)}`);
  assert(m.ok[0] >= 0 && m.ok[2] <= m.vw && m.ok[1] >= 0 && m.ok[3] <= m.vh, `${label}: [이대로 넣기]가 화면 밖 ${JSON.stringify(m)}`);
  assert(m.no[0] >= 0 && m.no[1] <= m.vw, `${label}: [취소]가 화면 밖 ${JSON.stringify(m)}`);
  assert(m.pageW <= m.vw, `${label}: 페이지가 가로로 넘침 ${JSON.stringify(m)}`);
  await page.click('#sheetRoot #bundleOk', { trial: true, timeout: 1000 }); // 스크롤 없이 누를 수 있음
};

await run('dialogs-0418', [
  ['한꺼번에 넣기 카드(31쪽): 넓은 창에서 가로로 넘치지 않고 [이대로 넣기]가 바로 보임', async () => {
    await page.setViewportSize({ width: 1280, height: 860 });
    await card(); await check('1280');
    await page.click('#sheetRoot #bundleOk');
    await page.waitForFunction(() => window.__r !== 'wait');
    const r = await page.evaluate(() => window.__r && window.__r.roles.length);
    assert(r === 31, String(r));
  }],
  ['한꺼번에 넣기 카드(31쪽): 낮은 창(1024×600)·좁은 창(390×844)에서도 버튼이 화면 안', async () => {
    for (const [w, h] of [[1024, 600], [390, 844]]) {
      await page.setViewportSize({ width: w, height: h });
      await card(); await check(`${w}×${h}`);
      await page.click('#sheetRoot [data-close]');
      await page.waitForFunction(() => window.__r !== 'wait');
    }
    await page.setViewportSize({ width: 1280, height: 860 });
  }],
  ['쪽을 눌러 표시를 바꿔도(다시 그려도) 가로로 넘치지 않음', async () => {
    await card();
    await page.click('#sheetRoot [data-bundle-page="5"]');
    await check('다시 그림');
    assert((await page.textContent('#sheetRoot [data-bundle-page="5"]')).includes('정답·교사용'), '표시가 안 바뀜');
    await page.click('#sheetRoot [data-close]');
  }],
  ['페이지 오류 없음', async () => { assert(errors.length === 0, errors.join(' | ')); }]
]);
await t.close();
