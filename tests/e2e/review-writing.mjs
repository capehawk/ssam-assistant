// 평어·행특·창체 문장 검토(옛 화면): 메인이 쓴 문장을 검토 AI가 10개씩 봄(평가 정보·문장만, 이름 없음) →
// 문제 있는 문장만 두 의견(노란 표시) → [고친 문장 쓰기]/[그대로 두기], 손으로 고친 행특 글은 의견 사라짐, 검토를 끄면 요청 없음
import { join } from 'node:path';
import { open, run, assert, FIXTURES } from './helpers.mjs';

const t = await open();
const { page, url, errors } = t;
await page.clock.setFixedTime(new Date('2026-10-29T09:00:00'));
await page.addInitScript(() => {
  if (!localStorage.getItem('ssam:engine')) localStorage.setItem('ssam:engine', JSON.stringify({ engine: 'claude', keys: { claude: 'sk-test' }, remember: true }));
  if (!localStorage.getItem('ssam:ai-roles')) localStorage.setItem('ssam:ai-roles', JSON.stringify({ review: null, tasks: { writing: { main: { engine: 'claude', model: 'claude-haiku-5-5' }, reviewOn: true, review: { engine: 'claude', model: 'claude-opus-5-5' } } } }));
  if (!localStorage.getItem('ssam:hk')) localStorage.setItem('ssam:hk', JSON.stringify({ settings: {}, students: [{ id: 'a', no: 1, label: '', memo: '우유 당번을 성실히 함', done: 0, results: [] }] }));
});
const calls = [];
let seq = 0;
const long = j => `학급 일에 책임감을 가지고 참여하며 ${j}번째로 친구를 돕는 모습이 돋보임. `.repeat(7).trim();
await page.route('https://api.anthropic.com/**', async route => {
  const body = JSON.parse(route.request().postData());
  const c = body.messages[0].content;
  const prompt = typeof c === 'string' ? c : c.find(x => x.type === 'text').text;
  const images = typeof c === 'string' ? 0 : c.filter(x => x.type === 'image').length;
  calls.push({ model: body.model, head: prompt.split('\n')[0], prompt });
  let out;
  if (prompt.startsWith('[문장 검토]')) {
    const n = [...prompt.split('[문장]')[1].split('[살펴볼 것]')[0].matchAll(/^(\d+)\. /gm)].length;
    if (prompt.includes('행동특성')) out = JSON.stringify({ items: [{ i: 1, problem: '주어가 들어감', fix: 'HK1 고친 글.' }, { i: 2, problem: '너무 김', fix: 'HK2 고친 글.' }] });
    else if (prompt.includes('창의적 체험활동')) out = JSON.stringify({ items: [{ i: 2, problem: '과장', fix: 'CC2 고친 문장임.' }] });
    else out = JSON.stringify({ items: n >= 3 ? [{ i: 3, problem: '끝맺음이 다름', fix: `PY 고친 문장 ${n}.` }] : [] });
  } else if (images) { seq++; out = JSON.stringify({ note: `학습지 ${seq}`, text: `교실을 깨끗하게 하려고 ${seq}가지 방법을 스스로 정해 꾸준히 실천함.`, blank: false }); }
  else if (prompt.startsWith('아래 행동특성 및 종합의견을')) out = long(9);
  else if (prompt.includes('행동특성 및 종합의견을')) out = [long(1), long(2)].join('\n');
  else { seq++; const syl = n => String.fromCharCode(0xAC00 + (n % 399) * 28); out = Array.from({ length: 60 }, (_, j) => `${syl(seq * 61 + j)}${syl(j * 7 + seq)} 장면을 생활과 연결하여 감상을 근거와 함께 씀.`).join('\n'); }
  await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: [{ type: 'content_block_delta', delta: { type: 'text_delta', text: out } }, { type: 'message_delta', delta: { stop_reason: 'end_turn' } }].map(e => 'data: ' + JSON.stringify(e) + '\n\n').join('') }).catch(() => {});
});
const reviews = () => calls.filter(c => c.head === '[문장 검토]');
const until = async (fn, ms = 15000) => { const end = Date.now() + ms; while (!(await fn())) { if (Date.now() > end) throw new Error('시간 초과 · 부른 수 ' + calls.length + ' · ' + calls.slice(-3).map(c => c.head.slice(0, 30)).join(' / ')); await new Promise(r => setTimeout(r, 80)); } };
await page.goto(url);
await page.waitForTimeout(500);

await run('review-writing', [
  ['교과 평어: 한 수준 50문장 → 검토 5번(10개씩, Opus, 성취기준 포함) → 문장마다 의견(노란 표시)', async () => {
    await page.click('nav.app-side [data-menu-go="evaluate"]'); await page.click('#menuTabs [data-tab="pyeongeo"]');
    await page.click('#srcPaste');
    await page.fill('#pasteBox', await page.getAttribute('#pasteBox', 'placeholder'));
    await page.click('#pasteGo');
    await page.keyboard.press('Escape');
    await page.waitForSelector('#units .unit');
    await page.click('#units .unit');
    await page.click('#pane [data-act="genUnit"]');
    await until(async () => reviews().filter(r => r.prompt.includes('교과 평어')).length >= 20);
    const py = reviews().filter(r => r.prompt.includes('교과 평어'));
    assert(py.every(r => r.model === 'claude-opus-5-5' && r.prompt.includes('[4국05-02]')), '모델·성취기준');
    assert(py.every(r => !/^11\. /m.test(r.prompt)), '11개 이상');
    assert(calls.filter(c => c.head !== '[문장 검토]').every(c => c.model === 'claude-haiku-5-5'), '메인 모델');
    await until(async () => await page.locator('#listBox .rv-op').count() === 5);
    assert((await page.textContent('#listBox .rv-bar')).includes('검토 의견 5개'), '막대');
    assert(await page.locator('#listBox li.sent.rv-mark').count() === 5, '노란 표시');
  }],
  ['[고친 문장 쓰기] → 그 문장이 고친 문장으로, 저장', async () => {
    const first = page.locator('#listBox [data-rv-use]').first();
    await first.click();
    await until(async () => await page.locator('#listBox .rv-op').count() === 4);
    assert((await page.textContent('#listBox')).includes('PY 고친 문장 10.'), '고친 문장');
    await page.waitForTimeout(500);
    const saved = await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('ssam:sets:')).map(k => localStorage.getItem(k)).join(''));
    assert(saved.includes('PY 고친 문장 10.') && saved.includes('"rv"'), '저장');
  }],
  ['행특: 후보 2개 → 검토 1번 → 두 의견 → [그대로 두기]·손으로 고치면 사라짐', async () => {
    await page.click('#menuTabs [data-tab="hk"]');
    await page.waitForTimeout(300);
    if (!(await page.locator('#hkList [data-hkstu]').count())) { await page.fill('#hkCount', '1'); await page.click('#hkList [data-hk="roster"]'); }
    await page.click('#hkList [data-hkstu]');
    await page.waitForSelector('#hkMemo');
    if (!(await page.inputValue('#hkMemo'))) { await page.fill('#hkMemo', '우유 당번을 성실히 함'); await page.waitForTimeout(500); }
    const n = reviews().length;
    await page.click('#hkEditor [data-hk="gen"]');
    await until(async () => reviews().length === n + 1 && await page.locator('#hkEditor .rv-op').count() === 2);
    const p = reviews().at(-1).prompt;
    assert(p.includes('행동특성') && !p.includes('우유 당번'), '메모가 들어감: ' + p.slice(0, 300));
    await page.locator('#hkEditor [data-rv-keep]').first().click();
    await until(async () => await page.locator('#hkEditor .rv-op').count() === 1);
    const i = await page.getAttribute('#hkEditor .rv-op [data-rv-use]', 'data-rv-use');
    const ri = i.split(':').pop();
    await page.click(`#hkEditor [data-hkr="edit"][data-i="${ri}"]`);
    await page.fill(`#hkEditor [data-edit="${ri}"]`, '선생님이 고친 행특 글.');
    await page.click(`#hkEditor [data-hkr="edit"][data-i="${ri}"]`);
    await until(async () => !(await page.locator('#hkEditor .rv-op').count()));
    await page.waitForTimeout(600);
    const hk = await page.evaluate(() => JSON.parse(localStorage.getItem('ssam:hk')));
    const r = hk.students.find(x => x.results && x.results.length).results[+ri];
    assert(r.t === '선생님이 고친 행특 글.' && !(r.rv && !r.rv.done), JSON.stringify(r));
  }],
  ['창체: 학습지로 3명 → 검토 1번 → 2번 학생 의견 → [고친 문장 쓰기]', async () => {
    await page.evaluate(() => window.SSAM.setMode('cc'));
    await page.fill('#ccSetup [data-cls="count"]', '3'); await page.press('#ccSetup [data-cls="count"]', 'Tab');
    await page.fill('[data-ccf="name"][data-cck="auto"]', '교실 환경 지킴이');
    await page.fill('[data-ccf="desc"][data-cck="auto"]', '교실을 깨끗하게 하는 방법을 정해 실천함');
    await page.click('#ccGrade');
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('[data-ccsheet][data-cck="auto"]')]);
    await fc.setFiles([1, 2, 3].map(i => join(FIXTURES, `sheet-${i}.png`)));
    await page.waitForSelector('[data-ccsheetinfo]');
    const n = reviews().length;
    await page.click('[data-cc="genAll"]');
    await until(async () => reviews().length > n && await page.locator('#ccResults .rv-op').count() >= 1);
    assert(reviews().at(-1).prompt.includes('교실 환경 지킴이'), '활동 정보');
    await page.click('#ccResults [data-rv-use]');
    await until(async () => (await page.textContent('#ccResults')).includes('CC2 고친 문장임.'));
    assert(!(await page.locator('#ccResults .rv-op').count()), '의견 남음');
  }],
  ['문장 검토를 끄면 행특을 다시 만들어도 검토 요청 없음', async () => {
    await page.evaluate(() => { const r = JSON.parse(localStorage.getItem('ssam:ai-roles')); r.tasks.writing.reviewOn = false; localStorage.setItem('ssam:ai-roles', JSON.stringify(r)); });
    await page.click('#menuTabs [data-tab="hk"]');
    await page.click('#hkList [data-hkstu]');
    await page.waitForSelector('#hkEditor [data-hk="gen"]');
    const n = reviews().length, m = calls.length;
    await page.click('#hkEditor [data-hk="gen"]');
    await until(async () => calls.length > m && !(await page.locator('#hkEditor .spin').count()));
    await page.waitForTimeout(500);
    assert(reviews().length === n, '검토 요청');
  }],
  ['페이지 오류 없음', async () => { assert(errors.length === 0, errors.join(' | ')); }]
]);
await t.close();
