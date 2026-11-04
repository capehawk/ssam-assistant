// 평가 › 활동지 1·2단계: 탭, [새 활동지] → 한꺼번에 넣기(학생용 + (예시) 교사용 한 파일) → 카드 → 교과·단원·차시·제목 채움,
// 2단계 들어가면 AI가 기준 만들기 한 번(교사용 글 포함, 이름 없음) → 표·출처, 고치기·[기준 확정], 예시 답안 없는 활동지(그림 문항),
// 전화번호 줄은 빼고 알림, [예시로 채우기]
import { open, run, assert } from './helpers.mjs';

const t = await open();
const { page, url, errors } = t;
await page.addInitScript(() => {
  if (!localStorage.getItem('ssam:engine')) localStorage.setItem('ssam:engine', JSON.stringify({ engine: 'claude', keys: { claude: 'sk-test' }, remember: true }));
});
const calls = [];
await page.route('https://api.anthropic.com/**', async route => {
  const body = JSON.parse(route.request().postData());
  const c = body.messages[0].content;
  const prompt = typeof c === 'string' ? c : c.filter(x => x.type === 'text').map(x => x.text).join('\n');
  calls.push({ head: prompt.split('\n')[0], prompt });
  let out = '{}';
  if (prompt.startsWith('[활동지 기준]')) {
    out = prompt.includes('[교사용')
      ? JSON.stringify({ items: [{ no: 1, type: 'write', ask: '이웃을 도운 경험', answer: '무거운 짐을 들어 드렸어요.', ok: '도운 일을 구체적으로 씀', part: '한 낱말만 씀', src: 'teacher' }, { no: 2, type: 'write', ask: '돕는 방법 제안', answer: '', ok: '방법과 까닭', part: '방법만', src: 'ai' }] })
      : JSON.stringify({ items: [{ no: 1, type: 'draw', ask: '물의 여행 그리기', answer: '바다·구름·비', ok: '셋이 모두 있고 화살표로 이음', part: '일부만', src: 'ai' }] });
  }
  await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: [{ type: 'content_block_delta', delta: { type: 'text_delta', text: out } }, { type: 'message_delta', delta: { stop_reason: 'end_turn' } }].map(e => 'data: ' + JSON.stringify(e) + '\n\n').join('') }).catch(() => {});
});
const P = 'section[data-menu="evaluate"]';
const SOC = ['1. 이웃과 함께 > [5차시] 서로 돕는 마을 (교과서 30~31쪽)', '이웃을 돕는 방법 알아보기', '사회 3-2', '반     번   이름:', '(1) 이웃을 도운 경험 | ➡ | ', '문의 010-1234-5678',
  '1. 이웃과 함께 > [5차시] 서로 돕는 마을 (교과서 30~31쪽)', '이웃을 돕는 방법 알아보기', '사회 3-2', '반     번   이름:', '(예시)', '(1) 이웃을 도운 경험 | ➡ | 무거운 짐을 들어 드렸어요.'].join('\n');
const SCI = ['[과학] 3-2-1-02 물은 어디로 갈까? (12~13쪽)', '물의 여행 그리기', '◉ 물이 여행하는 길을 그려 봅시다.', '번호 | 그림', '1 | '].join('\n');
const acts = () => page.evaluate(() => (JSON.parse(localStorage.getItem('ssam:activity:list') || '[]')).map(s => JSON.parse(localStorage.getItem('ssam:activity:a:' + s.id))));
const put = (name, text) => page.setInputFiles('#bundleFile-act', { name, mimeType: 'text/plain', buffer: Buffer.from(text) });
const until = async (fn, ms = 8000) => { const end = Date.now() + ms; while (!(await fn())) { if (Date.now() > end) throw new Error('시간 초과'); await new Promise(r => setTimeout(r, 50)); } };
await page.goto(url);
await page.waitForTimeout(400);

await run('activity', [
  ['평가 메뉴에 「활동지」 탭', async () => {
    await page.click('nav.app-side [data-menu-go="evaluate"]');
    assert((await page.textContent('#menuTabs [data-tab="activity"]')).includes('활동지'), '탭');
    await page.click('#menuTabs [data-tab="activity"]');
    await page.waitForSelector(`${P} [data-ac="new"]`);
  }],
  ['[새 활동지] → 한꺼번에 넣기(학생용 + (예시)) → 카드 → 교과·단원·차시·제목, 전화번호 줄은 빼고 알림', async () => {
    await page.click(`${P} [data-ac="new"]`);
    await page.waitForSelector(`${P} [data-bundle-pick="act"]`);
    await put('서로 돕는 마을.txt', SOC);
    await page.waitForSelector('#sheetRoot #bundleCard');
    assert((await page.textContent('#sheetRoot #bundleSum')).includes('교사용'), '요약');
    await page.click('#sheetRoot #bundleOk');
    await page.waitForFunction(s => (document.querySelector(`${s} #actTitle`) || {}).value === '서로 돕는 마을', P);
    assert(await page.inputValue(`${P} #actSubject`) === '사회' && await page.inputValue(`${P} #actLesson`) === '5' && await page.inputValue(`${P} #actUnit`) === '1. 이웃과 함께', '머리');
    assert((await page.textContent('#toast')).includes('전화번호'), await page.textContent('#toast'));
    const a = (await acts())[0];
    assert(a && a.sheet.teacher.includes('무거운 짐') && !a.sheet.student.includes('무거운 짐') && !a.sheet.student.includes('010-'), JSON.stringify(a && a.sheet).slice(0, 200));
  }],
  ['2단계: 들어가면 기준 만들기 한 번(교사용 글 포함) → 표 2문항·출처 「교사용에서」', async () => {
    await page.click(`${P} [data-ac="next"]`);
    await until(async () => calls.filter(c => c.head === '[활동지 기준]').length === 1 && await page.locator(`${P} #actItems tbody tr`).count() === 2);
    const q = calls.find(c => c.head === '[활동지 기준]');
    assert(q.prompt.includes('[교사용') && q.prompt.includes('무거운 짐') && q.prompt.includes('서로 돕는 마을'), q.prompt.slice(0, 300));
    assert((await page.textContent(`${P} #actItems`)).includes('교사용에서'), '출처');
  }],
  ['칸 고치기 → 출처 「선생님이 고침」 → [기준 확정] → 저장(확정)', async () => {
    await page.fill(`${P} [data-it="2"][data-f="answer"]`, '어려운 이웃에게 먼저 인사해요.');
    await page.waitForTimeout(150);
    assert((await page.textContent(`${P} #actItems tbody tr:nth-child(2)`)).includes('선생님이 고침'), '출처 바뀜');
    await page.click(`${P} [data-ac="confirm"]`);
    await until(async () => (await acts())[0].confirmed === true);
    const a = (await acts())[0];
    assert(a.items[1].answer === '어려운 이웃에게 먼저 인사해요.' && a.items[1].src === 'edit', JSON.stringify(a.items[1]));
  }],
  ['예시 답안 없는 활동지(과학, 그림): 기준 요청에 교사용 없음 → 그림 문항', async () => {
    await page.click(`${P} [data-ac="back"]`);
    await page.click(`${P} [data-ac="new"]`);
    await put('물의 여행.txt', SCI);
    await page.waitForFunction(s => (document.querySelector(`${s} #actTitle`) || {}).value === '물은 어디로 갈까?', P);
    assert(!(await page.$('#sheetRoot #bundleCard')), '나눌 것이 없으면 카드 없음');
    await page.click(`${P} [data-ac="next"]`);
    await until(async () => calls.filter(c => c.head === '[활동지 기준]').length === 2 && await page.locator(`${P} #actItems tbody tr`).count() === 1);
    assert(!calls.filter(c => c.head === '[활동지 기준]')[1].prompt.includes('[교사용'), '교사용 칸');
    assert(await page.inputValue(`${P} [data-it="1"][data-f="type"]`) === 'draw', '그림 문항');
  }],
  ['사진만 넣은 활동지: 기준 만들기에 보내는 그림도 이름 칸을 가림(정한 칸이 없으면 맨 위 띠)', async () => {
    await page.click(`${P} [data-ac="back"]`);
    await page.click(`${P} [data-ac="new"]`);
    const png = await page.screenshot({ clip: { x: 0, y: 0, width: 300, height: 420 } });
    await page.setInputFiles('#bundleFile-act', { name: '빈 활동지.png', mimeType: 'image/png', buffer: png });
    await page.waitForFunction(() => /넣었어요/.test((document.querySelector('#toast') || {}).textContent || ''));
    await page.evaluate(() => { const f = window.SSAM.files, orig = f.pageImage; window.__masks = []; f.pageImage = (p, m) => { window.__masks.push(m); return orig(p, m); }; });
    const n0 = calls.filter(c => c.head === '[활동지 기준]').length;
    await page.click(`${P} [data-ac="next"]`);
    await until(async () => calls.filter(c => c.head === '[활동지 기준]').length === n0 + 1);
    const masks = await page.evaluate(() => window.__masks);
    assert(masks.length >= 1 && masks.every(m => Array.isArray(m) && m.some(r => r.y === 0 && r.h >= 0.15)), JSON.stringify(masks));
  }],
  ['[예시로 채우기] → 목록에 예시 활동지', async () => {
    await page.click(`${P} [data-ac="back"]`);
    await page.click(`${P} [data-ac="sample"]`);
    await page.waitForFunction(s => document.querySelector(`${s} .act-list`) && document.querySelector(`${s} .act-list`).textContent.includes('(예시)'), P);
    const a = (await acts()).find(x => x.meta.sample);
    assert(a && a.confirmed && a.items.length >= 3 && a.students.length >= 4 && a.students.every(s => !('name' in s)), JSON.stringify(a && a.meta));
  }],
  ['페이지 오류 없음', async () => { assert(errors.length === 0, errors.join(' | ')); }]
]);
await t.close();
