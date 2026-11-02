// 계획 13 뒤 미뤄 둔 작은 것(화면): 창체 모드가 남아 있어도 한꺼번에 넣기 칸에 끌어 놓기, 1단계에 글을 더 넣으면 기준을 물어봄,
// 교사용 글이 있으면 AI 없이 기준 표, 카드의 빈 활동지 안내, 「이름: 김철수」 줄 가리기, 쪽 수 바꾸기 취소면 되돌림, 멈춘 뒤 곧바로 다시 채점
import { open, run, assert } from './helpers.mjs';

const t = await open();
const { page, url, errors } = t;
await page.addInitScript(() => {
  if (!localStorage.getItem('ssam:mode')) localStorage.setItem('ssam:mode', 'cc');
  if (!localStorage.getItem('ssam:activity:set')) localStorage.setItem('ssam:activity:set', JSON.stringify({ pagesPer: 1, maskOn: false, mask: [], maskAll: false }));
});
const P = 'section[data-menu="evaluate"]';
const acts = () => page.evaluate(() => (JSON.parse(localStorage.getItem('ssam:activity:list') || '[]')).map(s => JSON.parse(localStorage.getItem('ssam:activity:a:' + s.id))));
const cur = () => page.evaluate(() => { const l = JSON.parse(localStorage.getItem('ssam:activity:list') || '[]'); return l.map(s => JSON.parse(localStorage.getItem('ssam:activity:a:' + s.id))); });
const until = async (fn, ms = 10000) => { const end = Date.now() + ms; while (!(await fn())) { if (Date.now() > end) throw new Error('시간 초과'); await new Promise(r => setTimeout(r, 60)); } };
const txt = (name, text) => ({ name, mimeType: 'text/plain', buffer: Buffer.from(text) });
const STU = ['물의 여행 > [2차시] 물의 여행 그리기 (교과서 12~13쪽)', '과학 3-2', '3학년 2반 5번 이름: 김하늘', '1. 물이 하늘로 올라가는 까닭을 고르세요.  (      )', '① 바람이 불어서   ② 햇볕을 받아 증발해서', '2. 물이 수증기가 되는 것을 무엇이라고 하나요?  (              )'];
const TEA = ['물의 여행 > [2차시] 물의 여행 그리기 (교과서 12~13쪽)', '과학 3-2', '3학년 반 번 이름: 교사용', '1. 물이 하늘로 올라가는 까닭을 고르세요.  ( ② )', '① 바람이 불어서   ② 햇볕을 받아 증발해서', '2. 물이 수증기가 되는 것을 무엇이라고 하나요?  ( 증발 )'];
const pngs = n => page.evaluate(async n => { const out = []; for (let i = 0; i < n; i++) { const c = document.createElement('canvas'); c.width = 300; c.height = 420; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 300, 420); g.fillStyle = '#123'; g.fillRect(30 + i * 9, 90, 140, 30); out.push(c.toDataURL('image/png').split(',')[1]); } return out; }, n);
// 가짜 AI: 채점은 늦게(동시에 몇 개가 가는지 셈)
let inflight = 0, maxIn = 0, gradeCalls = 0;
await page.route('https://api.anthropic.com/**', async route => {
  const body = JSON.parse(route.request().postData());
  const c = body.messages[0].content, prompt = typeof c === 'string' ? c : c.find(x => x.type === 'text').text;
  let out = '{}';
  if (prompt.startsWith('[활동지 채점]')) {
    gradeCalls++; inflight++; maxIn = Math.max(maxIn, inflight);
    await new Promise(r => setTimeout(r, 300)); inflight--;
    out = JSON.stringify({ items: [{ no: 1, read: '②', mark: 'o', why: '', sure: true }], good: '잘함', next: '더', level: 'ok', levelWhy: '' });
  }
  await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: [{ type: 'content_block_delta', delta: { type: 'text_delta', text: out } }, { type: 'message_delta', delta: { stop_reason: 'end_turn' } }].map(e => 'data: ' + JSON.stringify(e) + '\n\n').join('') }).catch(() => {});
});
await page.goto(url);
await page.waitForTimeout(400);

await run('deferred-13', [
  ['M4 교과 평어가 창체 모드로 남아 있어도 활동지 한꺼번에 넣기 칸에 끌어 놓을 수 있음', async () => {
    await page.click('nav.app-side [data-menu-go="evaluate"]'); await page.click('#menuTabs [data-tab="activity"]');
    await page.click(`${P} [data-ac="new"]`);
    await page.waitForSelector(`${P} [data-bundle-drop="act"]`);
    // 만든 끌기 사건에서는 dropEffect를 바꿔도 남지 않아, 무엇을 넣었는지 적어 둠(「none」이면 브라우저가 놓기를 막음)
    const effect = await page.evaluate(s => {
      const set = [], desc = Object.getOwnPropertyDescriptor(DataTransfer.prototype, 'dropEffect');
      Object.defineProperty(DataTransfer.prototype, 'dropEffect', { configurable: true, get: () => 'copy', set: v => set.push(v) });
      const box = document.querySelector(`${s} [data-bundle-drop="act"]`), dt = new DataTransfer();
      dt.items.add(new File(['x'], 'a.txt', { type: 'text/plain' }));
      const ev = new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true });
      box.dispatchEvent(ev);
      Object.defineProperty(DataTransfer.prototype, 'dropEffect', desc);
      return { prevented: ev.defaultPrevented, set };
    }, P);
    assert(effect.prevented && !effect.set.includes('none'), JSON.stringify(effect));
  }],
  ['M8·M6 학생용(이름 적힘) + 교사용 → 이름은 지우고 넣음, AI 키가 없어도 2단계 표를 교사용에서 채움(고르기 ②·빈칸 증발)', async () => {
    await page.setInputFiles('#bundleFile-act', [txt('물의 여행(학생용).txt', STU.join('\n')), txt('물의 여행(교사용).txt', TEA.join('\n'))]);
    await page.waitForSelector('#sheetRoot #bundleCard');
    await page.click('#sheetRoot #bundleOk');
    await until(async () => (await acts()).some(a => a.sheet.teacher.includes('증발')));
    const a = (await acts()).find(x => x.sheet.teacher.includes('증발'));
    assert(!a.sheet.student.includes('김하늘') && a.sheet.student.includes('이름:'), a.sheet.student);
    await page.click(`${P} [data-ac="next"]`);
    await page.waitForFunction(s => document.querySelectorAll(`${s} #actItems tbody tr`).length === 2, P);
    assert(await page.inputValue(`${P} [data-it="1"][data-f="answer"]`) === '②' && await page.inputValue(`${P} [data-it="2"][data-f="answer"]`) === '증발', '예시 답안');
    assert(await page.inputValue(`${P} [data-it="1"][data-f="type"]`) === 'choice', '종류');
    assert((await page.textContent(`${P}`)).includes('AI 키가 없어'), '안내');
  }],
  ['M5 기준이 있는데 1단계에 글을 더 넣으면 물어봄: [기준 그대로] → 기준 남음, [기준 다시 만들기] → 비움', async () => {
    await page.fill(`${P} [data-it="1"][data-f="ok"]`, '②를 고름');
    await page.waitForTimeout(150);
    await page.click(`${P} [data-step="1"]`);
    await page.setInputFiles('#bundleFile-act', [txt('물의 여행 2.txt', STU.join('\n').replace('물이 수증기가', '물방울이 수증기가'))]);
    await page.waitForSelector('#sheetRoot #actKeepCrit');
    await page.click('#sheetRoot #actKeepCrit');
    await until(async () => (await acts()).some(a => a.sheet.student.includes('물방울')));
    let a = (await acts()).find(x => x.sheet.student.includes('물방울'));
    assert(a.items.length === 2 && a.items[0].ok === '②를 고름', JSON.stringify(a.items));
    await page.setInputFiles('#bundleFile-act', [txt('물의 여행 3.txt', STU.join('\n').replace('물이 하늘로', '물이 높이'))]);
    await page.waitForSelector('#sheetRoot #actRedoCrit');
    await page.click('#sheetRoot #actRedoCrit');
    await until(async () => (await acts()).some(a => a.sheet.student.includes('물이 높이') && !a.items.length));
  }],
  ['M7 카드에 빈 활동지 쪽이 있으면 「이름이 적힌 쪽은 학생으로」 안내', async () => {
    await page.evaluate(async () => {
      const B = await import('./core/bundle.js'); window.__r = 'wait';
      B.openBundleCard({ doc: { student: '', teacher: '', docTeacher: '', names: [] }, pages: [{ url: '', thumb: '' }, { url: '', thumb: '' }], roles: ['blank', 'student'], skipped: [] }, { what: '활동지' }).then(r => { window.__r = r; });
    });
    await page.waitForSelector('#sheetRoot #bundleCard');
    assert((await page.textContent('#sheetRoot #bundleBlankNote')).includes('이름'), '안내');
    await page.click('#sheetRoot [data-close]');
  }],
  ['M9·M10 (키 넣고) 학생 4명 채점 중 멈추고 곧바로 다시 → 한 번에 둘씩만, 다 끝나야 「멈추기」가 사라짐 · 쪽 수 바꾸기를 취소하면 그대로', async () => {
    await page.evaluate(() => localStorage.setItem('ssam:engine', JSON.stringify({ engine: 'claude', keys: { claude: 'sk-test' }, remember: true })));
    await page.reload(); await page.waitForTimeout(500);
    const id = await page.evaluate(() => {
      const id = 'acD', a = { id, meta: { subject: '과학', title: '멈춤 시험', date: '2026-09-10', term: 2 }, sheet: { student: '1. 고르세요.', teacher: '' }, items: [{ no: 1, type: 'write', ask: '고르세요', answer: '', ok: '', part: '', src: 'ai' }], confirmed: true, students: [], done: false, link: null, createdAt: 2 };
      localStorage.setItem('ssam:activity:a:' + id, JSON.stringify(a));
      const l = JSON.parse(localStorage.getItem('ssam:activity:list') || '[]'); l.push({ id, title: a.meta.title, subject: '과학', date: a.meta.date, term: 2, n: 0, done: false, at: 2 });
      localStorage.setItem('ssam:activity:list', JSON.stringify(l)); return id;
    });
    await page.reload(); await page.waitForTimeout(500);
    await page.click('nav.app-side [data-menu-go="evaluate"]'); await page.click('#menuTabs [data-tab="activity"]');
    await page.click(`${P} [data-ac-open="${id}"]`);
    await page.waitForSelector(`${P} [data-bundle-pick="act3"]`);
    await page.setInputFiles('#bundleFile-act3', (await pngs(4)).map((b, i) => ({ name: `s${i + 1}.png`, mimeType: 'image/png', buffer: Buffer.from(b, 'base64') })));
    await until(async () => (await acts()).find(a => a.id === id).students.length === 4);
    await page.click(`${P} [data-ac="toGrade"]`);
    // 그림 준비를 늦춰 멈춘 앞 채점이 뒤에 돌아오게 함
    await page.evaluate(() => { const f = window.SSAM.files, o = f.pageImage; f.pageImage = async (p, m) => { await new Promise(r => setTimeout(r, 700)); return o(p, m); }; });
    await page.click(`${P} [data-ac="grade"]`);
    await page.waitForSelector(`${P} [data-ac="stop"]`);
    await page.click(`${P} [data-ac="stop"]`);
    await page.click(`${P} [data-ac="grade"]`);
    await page.waitForFunction(s => !document.querySelector(`${s} [data-ac="stop"]`), P, { timeout: 15000 });
    const done = (await acts()).find(a => a.id === id).students.filter(s => s.status === 'done').length;
    assert(done === 4 && maxIn <= 2, JSON.stringify({ done, maxIn, gradeCalls }));
    // M9: 채점한 학생이 있을 때 쪽 수를 바꾸면 확인 → 취소하면 쪽 수도 그대로
    await page.click(`${P} [data-step="3"]`);
    await page.fill(`${P} #acPer`, '2'); await page.press(`${P} #acPer`, 'Tab');
    await page.waitForSelector('#sheetRoot #acRedoOk');
    await page.click('#sheetRoot [data-close]');
    await until(async () => JSON.parse(await page.evaluate(() => localStorage.getItem('ssam:activity:set'))).pagesPer === 1);
    await page.waitForFunction(s => (document.querySelector(`${s} #acPer`) || {}).value === '1', P);
  }],
  ['페이지 오류 없음', async () => { assert(errors.length === 0, errors.join(' | ')); }]
]);
await t.close();
