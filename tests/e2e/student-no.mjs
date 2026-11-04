// 적힌 번호로 학생 맞추기: 걷은 순서가 뒤섞인 답안 → 번호 칸 정하기 → AI가 번호 칸만 모은 그림 한 장을 읽음 → 확인 표(노란 줄을 고쳐야 채점)
// → 번호 차례로 늘어놓고 학생마다 맞는 쪽으로 채점 (단원평가·평가지 채점)
import { open, run, assert } from './helpers.mjs';
import { SAMPLE_ITEMS } from '../../web/menus/evaluate/unit/unit-sample.js';

const t = await open();
const { page, url, errors } = t;
await page.addInitScript(() => {
  if (!localStorage.getItem('ssam:engine')) localStorage.setItem('ssam:engine', JSON.stringify({ engine: 'claude', keys: { claude: 'sk-test' }, remember: true }));
});
const sent = [];
let reads = [3, 1, 2], noDelay = 0;
await page.route('https://api.anthropic.com/**', async route => {
  const c = JSON.parse(route.request().postData()).messages[0].content;
  const prompt = typeof c === 'string' ? c : c.filter(x => x.type === 'text').map(x => x.text).join('\n');
  sent.push({ prompt, images: typeof c === 'string' ? [] : c.filter(x => x.type === 'image').map(x => x.source.data) });
  let out = '{}';
  if (prompt.startsWith('[번호 읽기]') && noDelay) await new Promise(r => setTimeout(r, noDelay));
  if (prompt.startsWith('[번호 읽기]')) out = JSON.stringify({ nos: reads.map((no, i) => ({ i: i + 1, no, sure: true })) });
  else if (prompt.startsWith('[단원평가 채점]')) out = JSON.stringify({ items: SAMPLE_ITEMS.map((it, i) => ({ no: i + 1, read: '', points: 0, sure: true, why: '' })) });
  else if (prompt.includes('수행평가를 채점하는')) out = JSON.stringify({ score: 80, summary: '바르게 풀었음', evidence: ['풀이가 맞음'], strengths: '꼼꼼함', improve: '검산', unreadable: false });
  else { const nos = [...prompt.matchAll(/"no": (\d+)/g)].map(m => +m[1]); out = JSON.stringify((nos.length ? nos : [1]).map(no => ({ no, score: 80, text: '수를 바르게 계산함.' }))); }
  const ev = [{ type: 'content_block_delta', delta: { type: 'text_delta', text: out } }, { type: 'message_delta', delta: { stop_reason: 'end_turn' } }];
  await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: ev.map(e => 'data: ' + JSON.stringify(e) + '\n\n').join('') }).catch(() => {}); // 그만두기로 끊은 요청
});
const V = 'section[data-menu="evaluate"] .unit-box';
const T = id => page.evaluate(id => JSON.parse(localStorage.getItem('ssam:unit:t:' + id)), id);
const until = async (fn, ms = 8000) => { const end = Date.now() + ms; while (!(await fn())) { if (Date.now() > end) throw new Error('시간 초과'); await new Promise(r => setTimeout(r, 50)); } };
const widths = b64s => page.evaluate(async b64s => { const out = []; for (const b of b64s) { const im = new Image(); im.src = 'data:image/jpeg;base64,' + b; await im.decode(); out.push(im.width); } return out; }, b64s);
const grades = () => sent.filter(s => s.prompt.startsWith('[단원평가 채점]'));
await page.goto(url);
await page.waitForTimeout(400);
const [A, B] = await page.evaluate(async () => {
  const m = await import('./menus/evaluate/unit/unit-model.js'), s = await import('./menus/evaluate/unit/unit-sample.js');
  localStorage.setItem('ssam:class', JSON.stringify({ count: 3, except: [] }));
  m.saveSet({ ...m.getSet(), pagesPer: 1, maskOn: false });
  const mk = round => { const x = m.newTest({ meta: { ...s.SAMPLE_META, round, date: '2026-10-2' + round }, key: { domains: ['지식', '이해'], items: s.SAMPLE_ITEMS }, paper: { text: '' } }); m.saveTest(x); return x.id; };
  return [mk(1), mk(2)];
});
await page.reload(); await page.waitForTimeout(500);
await page.click('nav.app-side [data-menu-go="evaluate"]'); await page.click('#menuTabs [data-tab="unit"]');
// 스캔 차례: 폭 300(3번 학생) · 310(1번) · 320(2번)
const shot = async w => ({ name: `답안${w}.png`, mimeType: 'image/png', buffer: await page.screenshot({ clip: { x: 0, y: 0, width: w, height: 420 } }) });
const files = [await shot(300), await shot(310), await shot(320)];
const drawBox = async () => {
  await page.waitForSelector('#sheetRoot #mkStage');
  assert((await page.textContent('#sheetRoot')).includes('번호 칸'), '번호 칸 편집기가 아님');
  const b = await page.locator('#sheetRoot #mkStage').boundingBox();
  await page.mouse.move(b.x + b.width * 0.7, b.y + 8); await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.9, b.y + 40, { steps: 4 }); await page.mouse.up();
  await page.click('#sheetRoot #mkOk');
};

await run('student-no', [
  ['단원평가: 「적힌 번호로 학생 맞추기」를 켜고 번호 칸을 정함(평가에 저장)', async () => {
    await page.click(`${V} [data-un-open="${A}"]`);
    await page.check(`${V} #unByNo`);
    await page.setInputFiles(`${V} #unAnsFile`, files);
    await page.waitForFunction(() => document.querySelectorAll('.unit-box [data-st]').length === 3);
    await page.click(`${V} [data-un="noBox"]`);
    await drawBox();
    const box = (await T(A)).noBox;
    assert(box && box.w > 0.1 && box.x > 0.5, JSON.stringify(box));
    assert((await page.evaluate(() => JSON.parse(localStorage.getItem('ssam:unit:set')))).byNo === true, '설정 저장');
  }],
  ['채점을 누르면 번호 칸만 모은 그림 한 장으로 번호를 읽고 확인 표(3·1·2), 이대로 채점 → 번호 차례로 학생마다 맞는 쪽', async () => {
    await page.click(`${V} [data-un="toGrade"]`);
    await page.click(`${V} [data-un="grade"]`);
    await page.waitForSelector('#sheetRoot #noOk');
    const r = sent.filter(s => s.prompt.startsWith('[번호 읽기]'));
    assert(r.length === 1 && r[0].images.length === 1, JSON.stringify(r.map(x => x.images.length)));
    // 쪽 전체가 아니라 번호 칸만 3줄로 모은 그림(줄마다 80px + 여백 → 296px)
    const dim = await page.evaluate(async b => { const im = new Image(); im.src = 'data:image/jpeg;base64,' + b; await im.decode(); return [im.width, im.height]; }, r[0].images[0]);
    assert(dim[1] === 296 && dim[0] <= 90 + 520 + 20, JSON.stringify(dim));
    const vals = await page.$$eval('#sheetRoot [data-noi]', els => els.map(e => e.value));
    assert(vals.join(',') === '3,1,2', vals.join(','));
    assert(!(await page.isDisabled('#sheetRoot #noOk')), '확인 버튼이 막힘');
    assert(grades().length === 0, '확인 전에 채점함');
    await page.click('#sheetRoot #noOk');
    await until(() => grades().length === 3);
    const by = {};
    for (const g of grades()) by[(/\[학생\] (\d+)번/.exec(g.prompt) || [])[1]] = (await widths(g.images))[0];
    assert(JSON.stringify(by) === JSON.stringify({ 1: 310, 2: 320, 3: 300 }), JSON.stringify(by));
    await until(async () => (await T(A)).students.every(s => s.status === 'done'));
    assert((await T(A)).students.map(s => s.no).join(',') === '1,2,3', (await T(A)).students.map(s => s.no).join(','));
  }],
  ['번호로 맞춘 평가에 같은 스캔을 다시 올려 다시 읽어도 채점 결과는 그 번호 학생에 그대로(스캔 차례로 섞이지 않음)', async () => {
    await page.evaluate(id => { const k = 'ssam:unit:t:' + id, x = JSON.parse(localStorage.getItem(k)); x.students.forEach(s => { s.good = 'g' + s.no; }); localStorage.setItem(k, JSON.stringify(x)); }, A);
    await page.click(`${V} .steps [data-step="2"]`);
    await page.setInputFiles(`${V} #unAnsFile`, files);
    await page.waitForFunction(() => /3쪽/.test((document.querySelector('.unit-box #unAnsMsg') || {}).textContent || ''));
    assert((await page.textContent(V)).includes('번호를 다시 읽기 전'), '다시 읽기 전 안내가 없음');
    await page.click(`${V} [data-un="toGrade"]`);
    await page.click(`${V} [data-un="grade"]`);
    await page.waitForSelector('#sheetRoot #noOk');
    await page.click('#sheetRoot #noOk');
    await page.waitForSelector('#sheetRoot #unRegradeOk');
    const st = (await T(A)).students.map(s => `${s.no}:${s.good}:${s.status}`).join(',');
    assert(st === '1:g1:done,2:g2:done,3:g3:done', st);
    await page.click('#sheetRoot [data-close]');
    await page.click(`${V} .steps [data-step="2"]`);
    assert(!(await page.textContent(V)).includes('번호를 다시 읽기 전'), '읽은 뒤에도 안내가 남음');
  }],
  ['번호 칸을 정하지 않고 채점하면 번호 칸 정하기부터, 겹치거나 못 읽은 번호는 노란 줄이고 고쳐야 채점', async () => {
    reads = [1, 1, null];
    const n0 = grades().length;
    await page.click('nav.app-side [data-menu-go="evaluate"]'); await page.click('#menuTabs [data-tab="unit"]');
    await page.click(`${V} [data-un="back"]`).catch(() => {});
    await page.click(`${V} [data-un-open="${B}"]`);
    await page.setInputFiles(`${V} #unAnsFile`, files);
    await page.waitForFunction(() => document.querySelectorAll('.unit-box [data-st]').length === 3);
    await page.click(`${V} [data-un="toGrade"]`);
    await page.click(`${V} [data-un="grade"]`);
    await drawBox();
    await page.waitForSelector('#sheetRoot #noOk');
    assert(await page.locator('#sheetRoot li.warn').count() === 3, String(await page.locator('#sheetRoot li.warn').count()));
    assert(await page.isDisabled('#sheetRoot #noOk'), '노란 줄이 있는데 채점 가능');
    const ins = page.locator('#sheetRoot [data-noi]');
    // 못 읽은 번호 칸을 누르면 그 학생의 번호 칸(크게)과 시험지 첫 쪽(번호 칸 표시)이 그 줄 아래에 펼쳐짐
    await ins.nth(2).click();
    await page.waitForSelector('#sheetRoot [data-noview="2"]:not([hidden]) .no-view-page img');
    const v = await page.evaluate(async () => {
      const box = document.querySelector('#sheetRoot [data-noview="2"]'), im = box.querySelector('.no-view-page img'); await im.decode();
      const r = box.getBoundingClientRect(), sh = document.querySelector('#sheetRoot .sheet');
      return { w: im.naturalWidth, crop: !!box.querySelector('.no-view-crop img[src^="data:image"]'), left: parseFloat(box.querySelector('.no-view-box').style.left),
        others: [...document.querySelectorAll('#sheetRoot [data-noview]')].filter(x => !x.hidden).length, h: r.height, wide: sh.scrollWidth <= sh.clientWidth + 1 };
    });
    assert(v.w === 320 && v.crop && v.left > 65 && v.left < 75 && v.others === 1 && v.h > 100 && v.wide, JSON.stringify(v));
    assert(await page.evaluate(() => document.activeElement && document.activeElement.dataset.noi === '2'), '번호 칸에 바로 쓸 수 없음');
    await page.click('#sheetRoot [data-nozoom="2"]');
    assert(await page.locator('#sheetRoot [data-noview="2"]').isHidden(), '다시 누르면 접힘');
    await page.click('#sheetRoot [data-nozoom="0"]');
    await page.waitForSelector('#sheetRoot [data-noview="0"]:not([hidden]) .no-view-page img');
    await ins.nth(1).fill('2'); await ins.nth(2).fill('3');
    assert(!(await page.isDisabled('#sheetRoot #noOk')), '고쳤는데 막힘');
    assert(grades().length === n0, '확인 전에 채점함');
    await page.click('#sheetRoot #noOk');
    await until(() => grades().length === n0 + 3);
  }],
  ['번호를 읽는 동안에는 「읽는 중」 창이 떠 있고(스캔을 바꿀 수 없음), 그만두면 읽은 번호는 쓰지 않음', async () => {
    reads = [3, 1, 2]; noDelay = 1500;
    await page.click(`${V} .steps [data-step="2"]`);
    await page.setInputFiles(`${V} #unAnsFile`, files);
    await page.waitForTimeout(500);
    await page.click(`${V} [data-un="toGrade"]`);
    await page.click(`${V} [data-un="grade"]`);
    await page.waitForFunction(() => /번호를 읽는 중/.test(document.querySelector('#sheetRoot').textContent));
    await page.click('#sheetRoot [data-close]');
    // 그만두면 읽기도 멈춰서 곧바로 다시 누를 수 있음
    noDelay = 0;
    await page.click(`${V} [data-un="grade"]`);
    await page.waitForSelector('#sheetRoot #noOk', { timeout: 4000 });
    await page.click('#sheetRoot [data-close]');
    await page.waitForTimeout(1800);
    assert(await page.locator('#sheetRoot #noOk').count() === 0, '그만둔 읽기의 확인 표가 늦게 뜸');
  }],
  ['「채점 안 함」 학생은 번호 확인 표에서 빼고(번호를 묻지 않음) 맨 뒤에 그대로', async () => {
    await page.click(`${V} .steps [data-step="2"]`);
    await page.click(`${V} [data-un="skip"][data-i="0"]`);
    await page.click(`${V} [data-un="toGrade"]`);
    await page.click(`${V} [data-un="grade"]`);
    await page.waitForSelector('#sheetRoot #noOk');
    assert(await page.locator('#sheetRoot [data-noi]').count() === 2, String(await page.locator('#sheetRoot [data-noi]').count()));
    await page.click('#sheetRoot [data-close]');
  }],
  ['이름 칸을 가리기로 했는데 정하지 않았으면 번호를 읽기 전에 먼저 묻고(AI 부르기 전), 「가리지 않고 채점」은 한 번만', async () => {
    await page.click(`${V} .steps [data-step="2"]`);
    await page.check(`${V} #unMaskOn`);
    const n0 = sent.filter(s => s.prompt.startsWith('[번호 읽기]')).length;
    await page.click(`${V} [data-un="toGrade"]`);
    await page.click(`${V} [data-un="grade"]`);
    await page.waitForSelector('#sheetRoot #unNoMaskOk');
    await page.waitForTimeout(300);
    assert(sent.filter(s => s.prompt.startsWith('[번호 읽기]')).length === n0, '이름 칸을 묻기 전에 번호를 읽음');
    await page.click('#sheetRoot #unNoMaskOk');
    await page.waitForSelector('#sheetRoot #noOk');
    await page.click('#sheetRoot #noOk');
    await page.waitForSelector('#sheetRoot #unRegradeOk');
    await page.click('#sheetRoot [data-close]');
    // 새 스캔을 올리면 다시 물음
    await page.click(`${V} .steps [data-step="2"]`);
    await page.setInputFiles(`${V} #unAnsFile`, files);
    await page.waitForTimeout(500);
    await page.click(`${V} [data-un="toGrade"]`);
    await page.click(`${V} [data-un="grade"]`);
    await page.waitForSelector('#sheetRoot #unNoMaskOk');
    await page.click('#sheetRoot [data-close]');
    await page.click(`${V} .steps [data-step="2"]`);
    await page.uncheck(`${V} #unMaskOn`);
  }],
  ['평가지 채점도 같은 방법: 번호 칸을 정하고 채점하면 확인 표(2·3·1) → 번호 차례로, 학생마다 맞는 평가지', async () => {
    reads = [2, 3, 1];
    await page.evaluate(() => localStorage.setItem('ssam:grset', JSON.stringify({ maskOn: false, mask: [] })));
    await page.reload(); await page.waitForTimeout(500);
    await page.click('nav.app-side [data-menu-go="evaluate"]'); await page.click('#menuTabs [data-tab="gr"]');
    await page.waitForSelector('#grDrop');
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#grDrop')]);
    await fc.setFiles(files);
    await page.waitForFunction(() => document.querySelector('#grSetup').textContent.includes('학생 3명'));
    await page.check('#grByNo');
    await page.click('[data-gr="noBox"]');
    await drawBox();
    assert((await page.evaluate(() => JSON.parse(localStorage.getItem('ssam:grset')))).noBox, '번호 칸 저장');
    await page.fill('#grTitle', '세 자리 수 덧셈'); await page.dispatchEvent('#grTitle', 'input');
    const n0 = sent.filter(s => s.prompt.startsWith('[번호 읽기]')).length;
    await page.click('[data-gr="start"]');
    await page.waitForSelector('#sheetRoot #noOk');
    assert(sent.filter(s => s.prompt.startsWith('[번호 읽기]')).length === n0 + 1, '번호 읽기 요청');
    const vals = await page.$$eval('#sheetRoot [data-noi]', els => els.map(e => e.value));
    assert(vals.join(',') === '2,3,1', vals.join(','));
    await page.click('#sheetRoot [data-nozoom="1"]');
    await page.waitForSelector('#sheetRoot [data-noview="1"]:not([hidden]) .no-view-page img');
    const pw = await page.evaluate(async () => { const im = document.querySelector('#sheetRoot [data-noview="1"] .no-view-page img'); await im.decode(); return im.naturalWidth; });
    assert(pw === 310, '평가지 채점: 2번째 스캔이 아님 ' + pw);
    assert(!sent.some(s => s.prompt.includes('수행평가를 채점하는')), '확인 전에 채점함');
    await page.click('#sheetRoot #noOk');
    await until(() => sent.filter(s => s.prompt.includes('수행평가를 채점하는')).length >= 3, 15000);
    // 결과 줄: 번호 → 썸네일 높이(가로 200으로 줄임: 폭 300 → 280, 310 → 271, 320 → 263)
    await page.waitForFunction(() => document.querySelectorAll('[data-grview1] img').length === 3);
    const rows = await page.$$eval('[data-grview1]', els => els.map(e => [e.getAttribute('aria-label').match(/^(\d+)번/)[1], e.querySelector('img').naturalHeight]));
    assert(JSON.stringify(rows) === JSON.stringify([['1', 263], ['2', 280], ['3', 271]]), JSON.stringify(rows));
  }],
  ['평가지 채점: 번호로 맞춘 뒤 예외 번호를 바꿔도 읽은 번호는 그대로(차례로 다시 매기지 않음)', async () => {
    await page.waitForSelector('#grExcept:not([disabled])', { timeout: 15000 });
    await page.fill('#grExcept', '2'); await page.dispatchEvent('#grExcept', 'change');
    await page.waitForTimeout(300);
    const rows = await page.$$eval('[data-grview1]', els => els.map(e => e.getAttribute('aria-label').match(/^(\d+)번/)[1]));
    assert(rows.join(',') === '1,2,3', rows.join(','));
  }],
  ['떠 있는 버튼으로 넣은 답안: 번호를 읽는 동안 「읽는 중」 창, 확인 표를 닫은 뒤에 다음 파일 카드(덮이지 않음)', async () => {
    reads = [3, 1, 2]; noDelay = 1200;
    await page.setInputFiles('#inboxFile', [...files, { name: '명단.csv', mimeType: 'text/csv', buffer: Buffer.from('번호,성명\n1,가\n2,나\n3,다') }]);
    await page.waitForSelector('#sheetRoot #ibRun:not([disabled])');
    assert((await page.textContent('#sheetRoot')).includes('학생 답안 스캔'), await page.textContent('#sheetRoot'));
    await page.click('#sheetRoot #ibRun');
    await page.waitForFunction(() => /번호를 읽는 중/.test(document.querySelector('#sheetRoot').textContent));
    await page.waitForSelector('#sheetRoot #noOk', { timeout: 8000 });
    await page.waitForTimeout(300);
    assert(await page.locator('#sheetRoot #noOk').count() === 1, '확인 표가 덮임');
    await page.click('#sheetRoot [data-close]');
    await page.waitForSelector('#sheetRoot #ibRun');
    assert((await page.textContent('#sheetRoot')).includes('학급 명단'), '다음 카드: ' + await page.textContent('#sheetRoot'));
    await page.click('#sheetRoot [data-close]');
    noDelay = 0;
  }],
  ['페이지 오류 없음', async () => { assert(errors.length === 0, errors.join(' | ')); }]
]);
await t.close();
