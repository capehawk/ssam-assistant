// 평가 › 활동지 3·4단계: 학생 스캔 + 앞쪽 교사용 쪽 → 카드 → 학생 4명, [채점 시작] → 학생마다 AI 한 번(그림 1장),
// 고르기 맞음 ○·틀림 ×(노란 칸)·빈칸 안 함, 칸 고치기(△)·수준 바꾸기, 기준 고치면 「다시 채점」, 학생 수 다른 스캔은 확인,
// 검토 켜면 노란 칸만 검토, 키 오류면 멈춤
import { open, run, assert } from './helpers.mjs';

const t = await open();
const { page, url, errors } = t;
await page.addInitScript(() => {
  if (!localStorage.getItem('ssam:engine')) localStorage.setItem('ssam:engine', JSON.stringify({ engine: 'claude', keys: { claude: 'sk-test' }, remember: true }));
  if (!localStorage.getItem('ssam:activity:set')) localStorage.setItem('ssam:activity:set', JSON.stringify({ pagesPer: 1, maskOn: false, mask: [], maskAll: false }));
});
const calls = [];
let k = 0, fail = false, teacherPage = true, wrongAt = 1;
await page.route('https://api.anthropic.com/**', async route => {
  const body = JSON.parse(route.request().postData());
  const c = body.messages[0].content;
  const prompt = typeof c === 'string' ? c : c.find(x => x.type === 'text').text;
  const head = prompt.split('\n')[0];
  calls.push({ head, prompt, model: body.model, images: typeof c === 'string' ? 0 : c.filter(x => x.type === 'image').length });
  if (fail && head === '[활동지 채점]') { await route.fulfill({ status: 401, body: JSON.stringify({ error: { type: 'authentication_error', message: 'bad key' } }) }).catch(() => {}); return; }
  let out = '{}';
  if (head === '[쪽 나누기]') out = JSON.stringify({ pages: teacherPage ? [{ i: 0, role: 'teacher' }] : [] });
  else if (head === '[활동지 채점]') {
    const n = k++;
    out = JSON.stringify({ items: [{ no: 1, read: n === wrongAt ? '②' : '3', mark: 'o', why: '', sure: true }, { no: 2, read: n === 2 ? '' : '증발', mark: n === 2 ? 'n' : 'o', why: '', sure: true }, { no: 3, read: '바다에서 구름으로', mark: 't', why: '비가 없음', sure: true }, { no: 4, read: '바다·구름·비 그림', mark: 'o', why: '', sure: true }], good: '그림을 꼼꼼히 그렸어요.', next: '비가 내리는 까닭도 써 보세요.', level: 'ok', levelWhy: '대체로 해냄' });
  } else if (head === '[활동지 검토]') out = JSON.stringify({ items: [{ no: 1, mark: 'x', why: '②를 골랐음' }] });
  await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: [{ type: 'content_block_delta', delta: { type: 'text_delta', text: out } }, { type: 'message_delta', delta: { stop_reason: 'end_turn' } }].map(e => 'data: ' + JSON.stringify(e) + '\n\n').join('') }).catch(() => {});
});
const P = 'section[data-menu="evaluate"]';
const ACT = { id: 'acT1', meta: { subject: '과학', unit: '1', lesson: '2', pages: '12~13쪽', title: '물의 여행', date: '2026-09-10', term: 2 }, sheet: { student: '1. 고르기\n2. 빈칸\n3. 설명\n4. 그리기', teacher: '' },
  items: [{ no: 1, type: 'choice', ask: '고르기', answer: '③', ok: '', part: '', src: 'answer' }, { no: 2, type: 'short', ask: '빈칸', answer: '증발', ok: '', part: '', src: 'answer' }, { no: 3, type: 'write', ask: '설명', answer: '증발·구름·비', ok: '셋 다', part: '일부', src: 'ai' }, { no: 4, type: 'draw', ask: '그리기', answer: '', ok: '바다·구름·비', part: '일부', src: 'ai' }],
  confirmed: true, students: [], done: false, link: null, createdAt: 1 };
const act = () => page.evaluate(() => JSON.parse(localStorage.getItem('ssam:activity:a:acT1')));
const until = async (fn, ms = 10000) => { const end = Date.now() + ms; while (!(await fn())) { if (Date.now() > end) throw new Error('시간 초과'); await new Promise(r => setTimeout(r, 50)); } };
const pngs = n => page.evaluate(async n => {
  const out = [];
  for (let i = 0; i < n; i++) { const c = document.createElement('canvas'); c.width = 300; c.height = 420; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 300, 420); g.fillStyle = '#123'; g.fillRect(30 + i * 7, 90, 140, 30); out.push(c.toDataURL('image/png').split(',')[1]); }
  return out;
}, n);
const put = async n => page.setInputFiles('#bundleFile-act3', (await pngs(n)).map((b, i) => ({ name: `스캔${i + 1}.png`, mimeType: 'image/png', buffer: Buffer.from(b, 'base64') })));
await page.goto(url);
await page.waitForTimeout(300);
await page.evaluate(a => { localStorage.setItem('ssam:activity:a:acT1', JSON.stringify(a)); localStorage.setItem('ssam:activity:list', JSON.stringify([{ id: 'acT1', title: '물의 여행', subject: '과학', date: '2026-09-10', term: 2, n: 0, done: false, at: 1 }])); }, ACT);
await page.reload(); await page.waitForTimeout(400);

await run('activity-grading', [
  ['3단계: 스캔 5장(앞쪽 교사용) → 카드 「정답·교사용 1쪽」 → [이대로 넣기] → 학생 4명', async () => {
    await page.click('nav.app-side [data-menu-go="evaluate"]'); await page.click('#menuTabs [data-tab="activity"]');
    await page.click(`${P} [data-ac-open="acT1"]`);
    await page.waitForSelector(`${P} [data-bundle-pick="act3"]`);
    await put(5);
    await page.waitForSelector('#sheetRoot #bundleCard');
    assert((await page.textContent('#sheetRoot #bundleSum')).includes('정답·교사용 1쪽'), await page.textContent('#sheetRoot #bundleSum'));
    await page.click('#sheetRoot #bundleOk');
    await until(async () => (await act()).students.length === 4);
    assert((await page.textContent(`${P} #acStus`)).includes('학생 4명'), await page.textContent(`${P} #acStus`));
  }],
  ['결석 번호를 적으면 그 번호를 건너뛰어 다시 매김(쪽 차례는 그대로), 지우면 돌아옴', async () => {
    await page.fill(`${P} #acAbsent`, '2');
    await page.press(`${P} #acAbsent`, 'Tab');
    await until(async () => JSON.stringify((await act()).students.map(s => s.no)) === '[1,3,4,5]');
    assert((await page.textContent(`${P} .ac-stus`)).includes('5번') && !(await page.textContent(`${P} .ac-stus`)).includes('2번'), await page.textContent(`${P} .ac-stus`));
    await page.fill(`${P} #acAbsent`, '');
    await page.press(`${P} #acAbsent`, 'Tab');
    await until(async () => JSON.stringify((await act()).students.map(s => s.no)) === '[1,2,3,4]');
  }],
  ['[채점 시작] → 학생마다 [활동지 채점] 한 번(그림 1장, 이름 없음) → 고르기 맞음 ○·틀림 ×(노란 칸)·빈칸 안 함', async () => {
    await page.click(`${P} [data-ac="toGrade"]`);
    await page.click(`${P} [data-ac="grade"]`);
    await until(async () => (await act()).students.filter(s => s.status === 'done').length === 4);
    const g = calls.filter(c => c.head === '[활동지 채점]');
    assert(g.length === 4 && g.every(c => c.images === 1) && !g[0].prompt.includes('이름:'), JSON.stringify(g.map(c => c.images)));
    const a = await act();
    const wrong = a.students.filter(s => s.marks[1].mark === 'x');
    assert(wrong.length === 1 && wrong[0].marks[1].chk, JSON.stringify(a.students.map(s => s.marks[1])));
    assert(a.students.filter(s => s.marks[2].mark === 'n').length === 1 && a.students.every(s => s.level === 'ok' && s.good), '빈칸·수준');
    await page.waitForSelector(`${P} #acGrid .ac-cell.chk`);
    assert(await page.locator(`${P} #acGrid .ac-cell.chk`).count() === 1, '노란 칸 수');
  }],
  ['노란 칸 눌러 △로 → 노란색 사라짐·선생님 표시, 수준 바꾸기 저장', async () => {
    await page.click(`${P} #acGrid .ac-cell.chk`);
    await page.waitForSelector('#sheetRoot #acCellSheet');
    await page.click('#sheetRoot [data-set-mark="t"]');
    await page.click('#sheetRoot #acCellOk');
    await until(async () => (await act()).students.some(s => s.marks[1].mark === 't' && s.marks[1].manual && !s.marks[1].chk));
    assert(await page.locator(`${P} #acGrid .ac-cell.chk`).count() === 0, '노란 칸 남음');
    const no = (await act()).students[0].no;
    await page.selectOption(`${P} [data-level="${no}"]`, 'good');
    await until(async () => (await act()).students[0].level === 'good' && (await act()).students[0].levelManual);
  }],
  ['기준을 고치면 채점한 학생에 「다시 채점」(결과는 그대로)', async () => {
    await page.click(`${P} [data-step="2"]`);
    await page.fill(`${P} [data-it="3"][data-f="ok"]`, '증발·구름·비를 차례대로');
    await page.waitForTimeout(150);
    await page.click(`${P} [data-ac="confirm"]`);
    await page.click(`${P} [data-ac="toGrade"]`);
    await page.waitForSelector(`${P} #acGrid .ac-stale`);
    const a = await act();
    assert(a.students.every(s => s.stale && s.status === 'done' && s.marks[4].mark === 'o'), JSON.stringify(a.students.map(s => [s.stale, s.status])));
  }],
  ['학생 수가 다른 스캔을 다시 올리면 확인(취소하면 그대로)', async () => {
    await page.click(`${P} [data-step="3"]`);
    calls.length = 0;
    await put(2);
    await page.waitForSelector('#sheetRoot #acRedoOk');
    assert((await page.textContent('#sheetRoot')).includes('채점한 결과가 지워져요'), '안내');
    await page.click('#sheetRoot [data-close]');
    await page.waitForTimeout(200);
    assert((await act()).students.length === 4, '학생 수가 바뀜');
  }],
  ['검토 켬: 다시 채점하면 노란 칸이 있는 학생만 [활동지 검토]', async () => {
    teacherPage = false; wrongAt = 3; // 3번째 학생은 고친 칸이 없음
    await page.evaluate(() => localStorage.setItem('ssam:ai-roles', JSON.stringify({ review: null, tasks: { grade: { main: null, reviewOn: true, review: { engine: 'claude', model: 'claude-opus-5-5' } } } })));
    await page.reload(); await page.waitForTimeout(400);
    await page.click('nav.app-side [data-menu-go="evaluate"]'); await page.click('#menuTabs [data-tab="activity"]');
    await page.click(`${P} [data-ac-open="acT1"]`);
    await page.click(`${P} [data-step="3"]`);
    await put(4);
    await page.click(`${P} [data-ac="toGrade"]`);
    calls.length = 0; k = 0;
    await page.click(`${P} [data-ac="grade"]`);
    await until(async () => (await act()).students.every(s => !s.stale) && calls.filter(c => c.head === '[활동지 검토]').length >= 1);
    await page.waitForTimeout(400);
    const rv = calls.filter(c => c.head === '[활동지 검토]');
    assert(rv.length === 1 && rv[0].model === 'claude-opus-5-5' && rv[0].prompt.includes('[1]') && !rv[0].prompt.includes('[4]'), rv.map(c => c.prompt.slice(0, 80)).join(' | '));
  }],
  ['키 오류(401)면 채점을 멈추고 알림', async () => {
    fail = true;
    await page.click(`${P} [data-step="2"]`);
    await page.fill(`${P} [data-it="4"][data-f="ok"]`, '바다·구름·비와 화살표');
    await page.click(`${P} [data-ac="confirm"]`);
    await page.click(`${P} [data-ac="toGrade"]`);
    await page.click(`${P} [data-ac="grade"]`);
    await page.waitForFunction(() => (document.querySelector('#toast') || {}).textContent.includes('채점을 멈췄어요'));
    fail = false;
  }],
  ['모아찍기 켬: 가로로 긴 장 1장 → 왼쪽·오른쪽 2쪽 → 학생 2명(학생 수가 다르면 확인)', async () => {
    await page.click(`${P} [data-step="3"]`);
    await page.check(`${P} #acTwoUp`);
    const wide = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 840; c.height = 300; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 840, 300); g.fillStyle = '#123'; g.fillRect(40, 60, 200, 30); g.fillRect(480, 60, 200, 30); return c.toDataURL('image/png').split(',')[1]; });
    await page.setInputFiles('#bundleFile-act3', [{ name: '모아찍기.png', mimeType: 'image/png', buffer: Buffer.from(wide, 'base64') }]);
    await page.waitForSelector('#sheetRoot #acRedoOk');
    await page.click('#sheetRoot #acRedoOk');
    await until(async () => (await act()).students.length === 2);
    assert((await page.textContent(`${P} #acStus`)).includes('쪽 2장'), await page.textContent(`${P} #acStus`));
    await page.uncheck(`${P} #acTwoUp`);
  }],
  ['페이지 오류 없음', async () => { const bad = errors.filter(e => !/status of 401/.test(e)); assert(bad.length === 0, bad.join(' | ')); }]
]);
await t.close();
