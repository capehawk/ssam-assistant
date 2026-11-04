// 단원평가 답안: 모아찍기(한 면에 2쪽)·양면 스캔(뒷면 거꾸로) → 왼쪽·오른쪽으로 자르고 뒷면은 돌려 문제지 차례대로 AI에 보냄,
// 설정을 바꾸면 올린 스캔을 다시 나눔. 2쪽 모아찍기 PDF 문제지는 왼쪽 단을 먼저 읽음
import { open, run, assert } from './helpers.mjs';
import { SAMPLE_ITEMS } from '../../web/menus/evaluate/unit/unit-sample.js';

const t = await open();
const { page, url, errors } = t;
await page.addInitScript(() => {
  if (!localStorage.getItem('ssam:engine')) localStorage.setItem('ssam:engine', JSON.stringify({ engine: 'claude', keys: { claude: 'sk-test' }, remember: true }));
});
const sent = [];
await page.route('https://api.anthropic.com/**', async route => {
  const c = JSON.parse(route.request().postData()).messages[0].content;
  const prompt = c.filter(x => x.type === 'text').map(x => x.text).join('\n');
  sent.push({ prompt, images: c.filter(x => x.type === 'image').map(x => x.source.data) });
  const out = JSON.stringify({ items: SAMPLE_ITEMS.map((it, i) => ({ no: i + 1, read: '', points: 0, sure: true, why: '' })) });
  const ev = [{ type: 'content_block_delta', delta: { type: 'text_delta', text: out } }, { type: 'message_delta', delta: { stop_reason: 'end_turn' } }];
  await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: ev.map(e => 'data: ' + JSON.stringify(e) + '\n\n').join('') });
});
const V = 'section[data-menu="evaluate"] .unit-box';
await page.goto(url);
await page.waitForTimeout(400);
const id = await page.evaluate(async () => {
  const m = await import('./menus/evaluate/unit/unit-model.js'), s = await import('./menus/evaluate/unit/unit-sample.js');
  localStorage.setItem('ssam:class', JSON.stringify({ count: 2, except: [] }));
  const x = m.newTest({ meta: { ...s.SAMPLE_META, date: '2026-10-29' }, key: { domains: ['지식', '이해'], items: s.SAMPLE_ITEMS }, paper: { text: '' } });
  m.saveTest(x); return x.id;
});
await page.reload(); await page.waitForTimeout(500);
await page.click('nav.app-side [data-menu-go="evaluate"]'); await page.click('#menuTabs [data-tab="unit"]');

/* 가로 장(1200×800) 하나에 두 쪽: 쪽마다 한 색, 위쪽 끝에 검은 띠. back이면 장 전체를 거꾸로(양면 스캔의 뒷면) */
const sheet = (left, right, back) => page.evaluate(([left, right, back]) => {
  const c = document.createElement('canvas'); c.width = 1200; c.height = 800;
  const g = c.getContext('2d');
  if (back) { g.translate(1200, 800); g.rotate(Math.PI); }
  [[left, 0], [right, 600]].forEach(([col, x]) => { g.fillStyle = col; g.fillRect(x, 0, 600, 800); g.fillStyle = '#000'; g.fillRect(x, 0, 600, 80); });
  return c.toDataURL('image/png').split(',')[1];
}, [left, right, back]);
const png = async (name, l, r, back) => ({ name, mimeType: 'image/png', buffer: Buffer.from(await sheet(l, r, back), 'base64') });
// 학생 두 명: 한 명이 한 장(앞면 1·2쪽, 뒷면 3·4쪽)
const files = [await png('1a.png', '#f00', '#00f', false), await png('1b.png', '#0f0', '#ff0', true),
  await png('2a.png', '#f00', '#00f', false), await png('2b.png', '#0f0', '#ff0', true)];

/* AI로 보낸 그림 → [가운데 색, 위가 검은지, 아래가 검은지] */
const look = b64s => page.evaluate(async b64s => {
  const out = [];
  for (const b of b64s) {
    const img = new Image(); img.src = 'data:image/jpeg;base64,' + b; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const px = (x, y) => [...g.getImageData(Math.round(x * c.width), Math.round(y * c.height), 1, 1).data].slice(0, 3);
    const name = ([r, gg, bb]) => (r > 200 ? 'R' : '') + (gg > 200 ? 'G' : '') + (bb > 200 ? 'B' : '');
    const dark = p => p.every(v => v < 60);
    out.push([name(px(0.5, 0.5)), dark(px(0.5, 0.03)), dark(px(0.5, 0.97))]);
  }
  return out;
}, b64s);
let twoUpPdf = null;
const until = async (fn, ms = 8000) => { const end = Date.now() + ms; while (!(await fn())) { if (Date.now() > end) throw new Error('시간 초과'); await new Promise(r => setTimeout(r, 50)); } };

await run('unit-twoup', [
  ['설정 없이 올리면 4장 그대로: 학생 한 명 4쪽이면 1명', async () => {
    await page.click(`${V} [data-un-open="${id}"]`);
    await page.fill(`${V} #unPagesPer`, '4'); await page.dispatchEvent(`${V} #unPagesPer`, 'change');
    await page.uncheck(`${V} #unMaskOn`);
    await page.setInputFiles(`${V} #unAnsFile`, files);
    await page.waitForFunction(() => document.querySelectorAll('.unit-box [data-st]').length === 1);
  }],
  ['모아찍기·뒷면 거꾸로를 켜면 올린 스캔을 다시 나눔: 8쪽 → 학생 2명', async () => {
    await page.check(`${V} #unTwoUp`);
    await page.waitForFunction(() => document.querySelectorAll('.unit-box [data-st]').length === 2);
    await page.check(`${V} #unFlipBack`);
    await page.waitForFunction(() => /8쪽/.test(document.querySelector('.unit-box #unAnsMsg').textContent));
    const set = await page.evaluate(() => JSON.parse(localStorage.getItem('ssam:unit:set')));
    assert(set.twoUp === true && set.flipBack === true, JSON.stringify(set));
  }],
  ['채점: 학생마다 빨강·파랑·초록·노랑 차례, 모두 바로 선 쪽(검은 띠가 위)', async () => {
    await page.click(`${V} [data-un="toGrade"]`);
    await page.click(`${V} [data-un="grade"]`);
    await until(() => sent.filter(s => s.prompt.startsWith('[단원평가 채점]')).length === 2);
    for (const s of sent.filter(s => s.prompt.startsWith('[단원평가 채점]'))) {
      const seen = await look(s.images);
      assert(JSON.stringify(seen) === JSON.stringify([['R', true, false], ['B', true, false], ['G', true, false], ['RG', true, false]]), JSON.stringify(seen));
    }
  }],
  ['2쪽 모아찍기 PDF 문제지(왼쪽·오른쪽 단이 한 줄씩 섞인 글 층): 왼쪽 단 1~5번, 오른쪽 단 6~10번 차례로 읽음', async () => {
    // 왼쪽·오른쪽 단의 줄을 같은 높이에 나란히 둔 가로 쪽 → PDF (글 층은 위에서 아래로 줄마다 왼쪽·오른쪽이 번갈아 나옴)
    const q = n => `<p>${n}. 다음 중 ${['사과', '배', '감', '귤', '밤', '콩', '쌀', '팥', '무', '파'][n - 1]}에 알맞은 것은 무엇입니까?</p><p>① 가 ② 나 ③ 다 ④ 라</p>`;
    const html = `<html><body style="margin:0;font:16px sans-serif"><div style="display:grid;grid-template-columns:1fr 1fr;gap:60px;padding:30px">
      ${[1, 2, 3, 4, 5].map(n => `<div>${q(n)}</div><div>${q(n + 5)}</div>`).join('')}</div></body></html>`;
    const p2 = await t.ctx.newPage();
    await p2.setContent(html);
    const pdf = await p2.pdf({ width: '297mm', height: '210mm', printBackground: true });
    await p2.close();
    const [cols, plain] = await page.evaluate(async b64 => {
      const u8 = () => Uint8Array.from(atob(b64), ch => ch.charCodeAt(0));
      return [await window.SSAM.files.pdfText(u8(), { columns: true }), await window.SSAM.files.pdfText(u8())];
    }, pdf.toString('base64'));
    const nos = t => [...t.matchAll(/(\d+)\. 다음/g)].map(m => Number(m[1])).join(',');
    assert(nos(cols) === '1,2,3,4,5,6,7,8,9,10', nos(cols));
    // 다른 메뉴(계획서·견적서 표 등)는 단을 나누지 않고 글 층 그대로
    assert(nos(plain) === '1,6,2,7,3,8,4,9,5,10', nos(plain));
    twoUpPdf = pdf;
  }],
  ['단원평가 [평가지 넣기]에 2쪽 모아찍기 PDF: 10문항을 차례대로', async () => {
    const id2 = await page.evaluate(async () => {
      const m = await import('./menus/evaluate/unit/unit-model.js'), s = await import('./menus/evaluate/unit/unit-sample.js');
      const x = m.newTest({ meta: { ...s.SAMPLE_META, round: 2, date: '2026-10-20' }, key: { domains: ['지식', '이해'], items: s.SAMPLE_ITEMS }, paper: { text: '' } });
      m.saveTest(x); return x.id;
    });
    await page.reload(); await page.waitForTimeout(400);
    await page.click('nav.app-side [data-menu-go="evaluate"]'); await page.click('#menuTabs [data-tab="unit"]');
    await page.click(`${V} [data-un-open="${id2}"]`);
    await page.click(`${V} .steps [data-step="1"]`);
    await page.setInputFiles(`${V} #unPaperFile`, { name: '모아찍기 문제지.pdf', mimeType: 'application/pdf', buffer: twoUpPdf });
    await page.waitForFunction(() => /10문항/.test((document.querySelector('.unit-box #unPaperMsg') || {}).textContent || ''));
    const saved = await page.evaluate(id => JSON.parse(localStorage.getItem('ssam:unit:t:' + id)).paper.text, id2);
    const qs = [...saved.matchAll(/(\d+)\. 다음/g)].map(m => m[1]).join(',');
    assert(qs === '1,2,3,4,5,6,7,8,9,10', qs);
  }],
  ['떠 있는 버튼에 2쪽 모아찍기 PDF 문제지를 넣어도 단원평가 문제지로 알아봄', async () => {
    await page.setInputFiles('#inboxFile', { name: '모아찍기.pdf', mimeType: 'application/pdf', buffer: twoUpPdf });
    await page.waitForSelector('#sheetRoot .sheet #ibKind');
    const kind = await page.inputValue('#sheetRoot .sheet #ibKind');
    assert(kind === 'unit-paper', kind + ' · ' + await page.textContent('#sheetRoot .sheet'));
    await page.click('#sheetRoot .sheet [data-close]');
  }],
  ['설정을 바꾸면 이 평가의 이름 칸은 지움(쪽 모양이 바뀌어 다시 정해야 함), 다시 나누는 동안 채점 시작은 기다리라고 함(AI 안 부름)', async () => {
    const id3 = await page.evaluate(async () => {
      const m = await import('./menus/evaluate/unit/unit-model.js'), s = await import('./menus/evaluate/unit/unit-sample.js');
      const x = m.newTest({ meta: { ...s.SAMPLE_META, round: 3, date: '2026-10-21' }, key: { domains: ['지식', '이해'], items: s.SAMPLE_ITEMS }, paper: { text: '' } });
      x.mask = [{ x: 0.05, y: 0.02, w: 0.2, h: 0.05 }]; x.maskAll = false;
      m.saveTest(x); return x.id;
    });
    await page.reload(); await page.waitForTimeout(400);
    await page.click('nav.app-side [data-menu-go="evaluate"]'); await page.click('#menuTabs [data-tab="unit"]');
    await page.click(`${V} [data-un-open="${id3}"]`);
    await page.setInputFiles(`${V} #unAnsFile`, files);
    await page.waitForFunction(() => document.querySelectorAll('.unit-box [data-st]').length === 2);
    // 그림 읽기를 느리게 해서 다시 나누는 동안 채점을 누름
    await page.evaluate(() => { const real = window.createImageBitmap; window.createImageBitmap = async (...a) => { await new Promise(r => setTimeout(r, 300)); return real.apply(window, a); }; window.__realCIB = real; });
    const n0 = sent.length;
    await page.uncheck(`${V} #unFlipBack`);
    const t3 = await page.evaluate(id => JSON.parse(localStorage.getItem('ssam:unit:t:' + id)), id3);
    assert(!(t3.mask && t3.mask.length), '이름 칸이 남음: ' + JSON.stringify(t3.mask));
    await page.click(`${V} [data-un="toGrade"]`);
    await page.click(`${V} [data-un="grade"]`);
    await page.waitForFunction(() => /나누는 중/.test(document.body.textContent));
    await page.waitForTimeout(300);
    assert(sent.length === n0, 'AI를 부름');
    await page.evaluate(() => { window.createImageBitmap = window.__realCIB; });
    await page.check(`${V} #unFlipBack`).catch(() => {});
  }],
  ['페이지 오류 없음', async () => { assert(errors.length === 0, errors.join(' | ')); }]
]);
await t.close();
