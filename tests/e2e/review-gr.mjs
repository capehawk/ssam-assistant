// 평가지 채점 검토(옛 화면): 수준을 나눈 뒤 「읽기 어려움」 학생과 수준 경계 위·아래 학생만 검토 AI(Opus)가 같은 그림으로 다시 채점 →
// 10점 이상 다르면 두 의견 → [검토 점수 쓰기]로 점수가 바뀜, 5점 차이는 의견 없음
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { open, run, assert, FIXTURES } from './helpers.mjs';

const t = await open();
const { page, url, errors } = t;
await page.addInitScript(() => {
  if (!localStorage.getItem('ssam:engine')) localStorage.setItem('ssam:engine', JSON.stringify({ engine: 'claude', keys: { claude: 'sk-test' }, remember: true }));
  if (!localStorage.getItem('ssam:ai-roles')) localStorage.setItem('ssam:ai-roles', JSON.stringify({ review: null, tasks: { grade: { main: null, reviewOn: true, review: { engine: 'claude', model: 'claude-opus-5-5' } } } }));
});
// 같은 쪽 그림 → 같은 학생. 처음 본 차례대로 92·75·74·40점(40점은 읽기 어려움). 검토는 75 → 90(다름), 74 → 79, 40 → 45
const MAIN = [92, 75, 74, 40], REVIEW = { 92: 92, 75: 90, 74: 79, 40: 45 };
const seen = new Map();
const calls = [];
await page.route('https://api.anthropic.com/**', async route => {
  const body = JSON.parse(route.request().postData());
  const c = body.messages[0].content;
  const prompt = typeof c === 'string' ? c : c.find(x => x.type === 'text').text;
  const img = typeof c === 'string' ? null : c.find(x => x.type === 'image');
  let out = '[]', main = null;
  if (prompt.includes('수행평가를 채점하는') && img) {
    const key = img.source.data.length + ':' + img.source.data.slice(-300);
    if (!seen.has(key)) seen.set(key, MAIN[seen.size]);
    main = seen.get(key);
    const sc = body.model === 'claude-opus-5-5' ? REVIEW[main] : main;
    out = JSON.stringify({ score: sc, summary: `${sc}점 모습`, evidence: ['근거'], strengths: '꼼꼼함', improve: '검산', unreadable: main === 40 });
  } else if (prompt.startsWith('같은 수행평가를 본 학생')) {
    out = JSON.stringify([...prompt.matchAll(/^- (\d+)번 \| (\d+)점/gm)].map(m => ({ no: +m[1], score: +m[2] })));
  } else {
    const nos = [...prompt.matchAll(/"no": (\d+)/g)].map(m => +m[1]);
    out = JSON.stringify((nos.length ? nos : [1]).map(no => ({ no, text: `${no}번 학생이 수를 바르게 계산함.` })));
  }
  calls.push({ model: body.model, review: body.model === 'claude-opus-5-5', main, head: prompt.slice(0, 20) });
  await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: [{ type: 'content_block_delta', delta: { type: 'text_delta', text: out } }, { type: 'message_delta', delta: { stop_reason: 'end_turn' } }].map(e => 'data: ' + JSON.stringify(e) + '\n\n').join('') }).catch(() => {});
});
const until = async (fn, ms = 20000) => { const end = Date.now() + ms; while (!(await fn())) { if (Date.now() > end) throw new Error('시간 초과 · ' + calls.map(c => (c.review ? 'R' : '') + (c.main || c.head.slice(0, 4))).join(',')); await new Promise(r => setTimeout(r, 100)); } };
const cur = () => page.evaluate(() => { const ids = JSON.parse(localStorage.getItem('ssam:grs') || '[]'); return ids.length ? JSON.parse(localStorage.getItem('ssam:gr:' + ids[0])) : null; });
await page.goto(url);
await page.waitForTimeout(300);
await page.evaluate(() => localStorage.setItem('ssam:grset', JSON.stringify({ maskOn: false, mask: [], ratio: { top: 0, high: 50, mid: 50, low: 0 } })));
await page.reload(); await page.waitForTimeout(500);
const extra = { name: '답안4.png', mimeType: 'image/png', buffer: await page.screenshot({ clip: { x: 0, y: 0, width: 330, height: 450 } }) };

await run('review-gr', [
  ['채점·수준 나누기 뒤 경계 위·아래(75·74)와 읽기 어려움(40) 학생만 검토, 92점 학생은 검토 안 함', async () => {
    await page.click('nav.app-side [data-menu-go="evaluate"]'); await page.click('#menuTabs [data-tab="gr"]');
    await page.waitForSelector('#grDrop');
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#grDrop')]);
    await fc.setFiles([...[1, 2, 3].map(i => ({ name: `sheet-${i}.png`, mimeType: 'image/png', buffer: readFileSync(join(FIXTURES, `sheet-${i}.png`)) })), extra]);
    await page.waitForFunction(() => document.querySelector('#grSetup').textContent.includes('학생 4명'));
    await page.fill('#grTitle', '세 자리 수 덧셈'); await page.dispatchEvent('#grTitle', 'input');
    await page.click('[data-gr="start"]');
    await until(async () => { const g = await cur(); return g && g.students.filter(s => s.text).length === 4; });
    const rv = calls.filter(c => c.review);
    assert(rv.length === 3 && rv.map(c => c.main).sort().join(',') === '40,74,75', rv.map(c => c.main).join(','));
    const s = (await cur()).students;
    const by = sc => s.find(x => x.score === sc);
    assert(by(75).rv && by(75).rv.score === 90, JSON.stringify(by(75)));
    assert(!by(74).rv && !by(40).rv && !by(92).rv, '의견이 있음');
  }],
  ['두 의견(75점 / 90점) → [검토 점수 쓰기]로 점수가 바뀜, 「검토 의견」 사라짐', async () => {
    await page.waitForSelector('#grResults .rv-op');
    assert(await page.locator('#grResults .rv-op').count() === 1, '의견 수');
    const txt = await page.textContent('#grResults .rv-op');
    assert(txt.includes('75점') && txt.includes('90점') && txt.includes('검토 점수 쓰기'), txt);
    await page.click('#grResults [data-rv-use]');
    await until(async () => !(await page.locator('#grResults .rv-op').count()));
    await page.waitForTimeout(600);
    const st = (await cur()).students.find(x => x.rv);
    assert(st.score === 90 && st.rv.done === 'review', JSON.stringify(st));
  }],
  ['페이지 오류 없음', async () => { assert(errors.length === 0, errors.join(' | ')); }]
]);
await t.close();
