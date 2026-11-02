// 평가지 채점 ↔ 단원평가·활동지: 평가요소를 고르면 이어 둔 것 목록(기본 체크 안 함) → 체크한 것만 평어 요청에 「참고:」(번호만),
// 한꺼번에 넣기(정답 글 + 학생 사진) → 채점 기준 문서·학생
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { open, run, assert, FIXTURES } from './helpers.mjs';

const t = await open();
const { page, url, errors } = t;
const PLAN = { kind: 'plan', title: '2학기 평가계획', grade: 3, source: '', createdAt: 1, subjects: [{ name: '과학', units: [
  { id: 'u1', subject: '과학', period: '', std: '[4과01-02] 물의 상태 변화를 설명한다.', unit: '1. 물의 여행', area: '물질', elem: '물의 상태 변화', focus: '', crit: { top: '', high: '잘 설명함', mid: '설명함', low: '도움을 받아 설명함' } },
  { id: 'u2', subject: '과학', period: '', std: '[4과02-01] 동물의 생김새를 비교한다.', unit: '2. 동물의 생활', area: '생명', elem: '동물의 생김새', focus: '', crit: { top: '', high: '잘 비교함', mid: '비교함', low: '도움을 받아 비교함' } }] }] };
const LINK = { unitId: 'u1', subject: '과학', label: '물질 · 물의 상태 변화' };
const ACT = { id: 'acR', meta: { subject: '과학', title: '물의 여행', date: '2026-09-10', term: 2 }, sheet: { student: '', teacher: '' }, items: [{ no: 1, type: 'write', ask: 'x', answer: '', ok: '', part: '', src: 'ai' }], confirmed: true, done: true, link: LINK, createdAt: 1,
  students: [1, 2, 3].map(no => ({ no, skip: false, status: 'done', marks: { 1: { mark: 'o' } }, good: `${no}번 활동 잘한 점`, next: '더 해 보기', level: 'good' })) };
const UT = { id: 'utR', meta: { subject: '과학', unitNo: 1, unitName: '물의 상태', date: '2026-09-20' }, key: { domains: [], items: [{ no: 1, answer: '③', points: 100, content: '증발' }] }, paper: { text: '' }, done: true, link: LINK, createdAt: 1,
  students: [1, 2, 3].map(no => ({ no, skip: false, status: 'done', items: { 1: { pts: 100 } }, good: `${no}번 단원평가 잘한 점`, cheer: '' })) };
// 이어 둔 활동지가 더 있어 모두 7개 → 5개만 보이고 [더보기]
const MORE = [1, 2, 3, 4, 5].map(i => ({ ...ACT, id: 'acX' + i, meta: { ...ACT.meta, title: '옛 활동 ' + i, date: `2026-08-0${i}` } }));
await page.addInitScript(([p, a, u, more]) => {
  if (!localStorage.getItem('ssam:engine')) localStorage.setItem('ssam:engine', JSON.stringify({ engine: 'claude', keys: { claude: 'sk-test' }, remember: true }));
  if (!localStorage.getItem('ssam:plans')) {
    localStorage.setItem('ssam:plan:P1', JSON.stringify(p)); localStorage.setItem('ssam:plans', JSON.stringify(['P1'])); localStorage.setItem('ssam:prefs', JSON.stringify({ current: 'P1' }));
    for (const x of [a, ...more]) localStorage.setItem('ssam:activity:a:' + x.id, JSON.stringify(x));
    localStorage.setItem('ssam:activity:list', JSON.stringify([a, ...more].map(x => ({ id: x.id, title: x.meta.title, subject: '과학', date: x.meta.date, term: 2, n: 3, done: true, at: 1 }))));
    localStorage.setItem('ssam:unit:t:utR', JSON.stringify(u)); localStorage.setItem('ssam:unit:list', JSON.stringify([{ id: 'utR', title: '과학 1단원', subject: '과학', date: '2026-09-20', n: 3, done: true, at: 1 }]));
  }
}, [PLAN, ACT, UT, MORE]);
const calls = [];
await page.route('https://api.anthropic.com/**', async route => {
  const body = JSON.parse(route.request().postData());
  const c = body.messages[0].content;
  const prompt = typeof c === 'string' ? c : c.find(x => x.type === 'text').text;
  calls.push(prompt);
  let out = '[]';
  if (prompt.includes('수행평가를 채점하는')) out = JSON.stringify({ score: 80, summary: '바르게 설명함', evidence: ['근거'], strengths: '꼼꼼함', improve: '검산', unreadable: false });
  else if (prompt.startsWith('같은 수행평가를 본 학생')) out = JSON.stringify([...prompt.matchAll(/^- (\d+)번 \| (\d+)점/gm)].map(m => ({ no: +m[1], score: +m[2] })));
  else if (prompt.includes('[학생]')) out = JSON.stringify([...prompt.matchAll(/^- (\d+)번 \(/gm)].map(m => ({ no: +m[1], text: `${m[1]}번 학생이 물의 상태 변화를 바르게 설명함.` })));
  await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: [{ type: 'content_block_delta', delta: { type: 'text_delta', text: out } }, { type: 'message_delta', delta: { stop_reason: 'end_turn' } }].map(e => 'data: ' + JSON.stringify(e) + '\n\n').join('') }).catch(() => {});
});
const until = async (fn, ms = 20000) => { const end = Date.now() + ms; while (!(await fn())) { if (Date.now() > end) throw new Error('시간 초과'); await new Promise(r => setTimeout(r, 80)); } };
const cur = () => page.evaluate(() => { const ids = JSON.parse(localStorage.getItem('ssam:grs') || '[]'); return ids.length ? JSON.parse(localStorage.getItem('ssam:gr:' + ids[0])) : null; });
const writes = () => calls.filter(p => p.includes('[학생]') && p.includes('교과학습발달상황'));
await page.goto(url);
await page.waitForTimeout(300);
await page.evaluate(() => localStorage.setItem('ssam:grset', JSON.stringify({ maskOn: false, mask: [], ratio: { top: 0, high: 100, mid: 0, low: 0 } })));
await page.reload(); await page.waitForTimeout(700);

await run('gr-refs', [
  ['평가요소를 고르면 「참고할 단원평가·활동지」에 이어 둔 단원평가·활동지(늦은 것 먼저, 5개 + [더보기]), 기본 체크 안 함', async () => {
    await page.click('nav.app-side [data-menu-go="evaluate"]'); await page.click('#menuTabs [data-tab="gr"]');
    await page.waitForSelector('#grUnit');
    await page.selectOption('#grUnit', 'u1');
    await page.waitForSelector('#grRefs [data-gr-ref="activity:acR"]');
    const keys = await page.$$eval('#grRefs [data-gr-ref]', els => els.map(e => e.dataset.grRef));
    assert(keys.length === 5 && keys[0] === 'unit:utR' && keys[1] === 'activity:acR', keys.join(','));
    assert(await page.$$eval('#grRefs [data-gr-ref]', els => els.every(e => !e.checked)), '기본 체크');
    assert((await page.textContent('#grRefs [data-gr-ref-more]')).includes('2개'), '더보기');
    await page.click('#grRefs [data-gr-ref-more]');
    await page.waitForFunction(() => document.querySelectorAll('#grRefs [data-gr-ref]').length === 7);
    assert((await page.textContent('#grRefs')).includes('물의 여행') && (await page.textContent('#grRefs')).includes('단원평가'), await page.textContent('#grRefs'));
  }],
  ['체크 안 하고 채점·평어 → 평어 요청에 「참고:」 없음', async () => {
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#grDrop')]);
    await fc.setFiles([1, 2, 3].map(i => ({ name: `sheet-${i}.png`, mimeType: 'image/png', buffer: readFileSync(join(FIXTURES, `sheet-${i}.png`)) })));
    await page.waitForFunction(() => document.querySelector('#grSetup').textContent.includes('학생 3명'));
    await page.click('[data-gr="start"]');
    await until(async () => { const g = await cur(); return g && g.students.filter(s => s.text).length === 3; });
    assert(writes().length >= 1 && writes().every(p => !p.includes('참고:')), writes().map(p => p.slice(-200)).join(' | '));
  }],
  ['체크하고 한 학생 평어를 다시 쓰면 「참고: 활동지 「물의 여행」 잘함 · 잘한 점 …」(번호만)', async () => {
    await page.check('#grRefs [data-gr-ref="activity:acR"]');
    const n0 = writes().length;
    const id = (await cur()).students[1].id, no = (await cur()).students[1].no;
    await page.click(`#grResults [data-grre="${id}"]`);
    await until(async () => writes().length > n0);
    const p = writes().at(-1);
    assert(p.includes('참고: 활동지 「물의 여행」 잘함') && p.includes(`${no}번 활동 잘한 점`) && p.includes(`- ${no}번 (`), p.slice(-400));
    await until(async () => (((await cur()) || {}).refs || []).includes('activity:acR'), 3000);
  }],
  ['다른 평가요소로 바꾸면 전에 체크한 활동지는 그 평가요소 평어에 쓰지 않음(목록에도 없음)', async () => {
    await page.selectOption('#grUnit', 'u2');
    await page.waitForFunction(() => !document.querySelector('#grRefs [data-gr-ref="activity:acR"]'));
    const n0 = writes().length, id = (await cur()).students[0].id;
    await page.click(`#grResults [data-grre="${id}"]`);
    await until(async () => writes().length > n0);
    const p = writes().at(-1);
    assert(!p.includes('참고:') && !p.includes('[참고: 단원평가·활동지]'), p.slice(-400));
  }],
  ['한꺼번에 넣기: 정답 파일 + 학생 사진 3장 → 카드(정답·교사용 문서 · 학생 3쪽) → 채점 기준 문서 「한꺼번에 넣은 정답·기준」 하나·학생 3명', async () => {
    await page.click('[data-gr="new"]');
    await page.waitForSelector('#bundleFile-gr', { state: 'attached' });
    await page.setInputFiles('#bundleFile-gr', [{ name: '정답.txt', mimeType: 'text/plain', buffer: Buffer.from('[정답]\n1. 456\n2. 까닭 두 가지') }, ...[1, 2, 3].map(i => ({ name: `평가지${i}.png`, mimeType: 'image/png', buffer: readFileSync(join(FIXTURES, `sheet-${i}.png`)) }))]);
    await page.waitForSelector('#sheetRoot #bundleCard');
    const sum = await page.textContent('#sheetRoot #bundleSum');
    assert(sum.includes('정답·교사용') && sum.includes('학생 3쪽'), sum);
    await page.click('#sheetRoot #bundleOk');
    await page.waitForFunction(() => document.querySelector('#grCritBox').textContent.includes('한꺼번에 넣은 정답·기준') && document.querySelector('#grSetup').textContent.includes('학생 3명'));
    assert((await page.textContent('#grCritBox')).split('한꺼번에 넣은 정답·기준').length === 2, await page.textContent('#grCritBox'));
  }],
  ['페이지 오류 없음', async () => { assert(errors.length === 0, errors.join(' | ')); }]
]);
await t.close();
