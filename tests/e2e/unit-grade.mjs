// 단원평가 2·3단계: 답안 올리기(번호·명단 예외·이름 가리기), 문항별 채점, 확인 표(노란 칸·칸 고치기·문항 모아 보기),
// 다시 채점해도 고친 칸 그대로, 멈추기, 채점 도중 다른 평가로 가도 결과는 시작한 평가에, 채점 마치기, 업스테이지 안내
import { open, run, assert, mockClaude } from './helpers.mjs';
import { SAMPLE_ITEMS } from '../../web/menus/evaluate/unit/unit-sample.js';
import { autoJudge } from '../../web/menus/evaluate/unit/unit-grade.js';

const t = await open();
const { page, url, errors } = t;
await page.clock.setFixedTime(new Date('2026-10-29T09:00:00'));
let slow = 0, round = 1;
const prompts = [];
await page.addInitScript(() => {
  if (!localStorage.getItem('ssam:engine')) localStorage.setItem('ssam:engine', JSON.stringify({ engine: 'claude', keys: { claude: 'sk-test' }, remember: true }));
});
// 학생마다 다른 답: 1번은 2번 문항을 틀렸는데 AI가 맞다고 함(differ), 서술형 9·10번은 부분 점수
const READS = {
  1: ['(2)', '②', '㉯', '민수', '②, ④', '(1)-②, (2)-①', '마을 도서관', '⑤', '도서관에서 잔치가 열린다.', '가고 싶다.'],
  3: ['(1)', '③', '㉮', '민수', '②', '(1)-②, (2)-①', '도서관', '⑤', '', '재미있겠다.'],
  4: ['(2)', '③', '㉯', '민지', '②, ④', '(1)-②, (2)-②', '마을 도서관', '③', '토요일에 잔치가 있다.', '책을 읽고 싶다. 재미있기 때문이다.']
};
await mockClaude(page, async ({ prompt, images }) => {
  prompts.push({ prompt, images });
  if (slow) await new Promise(r => setTimeout(r, slow));
  const no = Number((/\[학생\] (\d+)번/.exec(prompt) || [])[1]);
  const reads = READS[no].slice();
  if (round === 2 && no === 3) reads[0] = '(2)';
  // AI처럼 채점: 맞으면 만점, 서술형은 부분 점수, 「도서관」은 같은 뜻으로 봄. 1번 학생 2번 문항만 틀렸는데 맞다고 함
  return JSON.stringify({ items: reads.map((read, i) => {
    const it = SAMPLE_ITEMS[i];
    let p = autoJudge(it, read);
    if (p == null) p = it.type === 'essay' ? (read ? (i === 8 ? 9 : 12) : 0) : (read === '도서관' ? 10 : 0);
    if (no === 1 && i === 1) p = 10;
    return { no: i + 1, read, points: p, sure: true, why: it.type === 'essay' ? '기준과 비교' : '' };
  }) });
});
const V = 'section[data-menu="evaluate"] .unit-box';
const go = async () => { await page.click('nav.app-side [data-menu-go="evaluate"]'); await page.click('#menuTabs [data-tab="unit"]'); };
const T = id => page.evaluate(id => JSON.parse(localStorage.getItem('ssam:unit:t:' + id)), id);
const grades = () => prompts.filter(p => p.prompt.startsWith('[단원평가 채점]'));
const until = async (fn, ms = 6000) => { const end = Date.now() + ms; while (!(await fn())) { if (Date.now() > end) throw new Error('시간 초과'); await new Promise(r => setTimeout(r, 50)); } };
await page.goto(url);
await page.waitForTimeout(400);
const [A, B] = await page.evaluate(async () => {
  const m = await import('./menus/evaluate/unit/unit-model.js'), s = await import('./menus/evaluate/unit/unit-sample.js');
  const mk = (round, date) => { const x = m.newTest({ meta: { ...s.SAMPLE_META, round, date }, key: { domains: ['지식', '이해'], items: s.SAMPLE_ITEMS }, paper: { text: '' } }); m.saveTest(x); return x.id; };
  localStorage.setItem('ssam:class', JSON.stringify({ count: 4, except: [2] }));
  return [mk(1, '2026-10-29'), mk(2, '2026-10-28')];
});
await page.reload(); await page.waitForTimeout(500);
await go();
const shot = async (w, h) => ({ name: `답안${w}.png`, mimeType: 'image/png', buffer: await page.screenshot({ clip: { x: 0, y: 0, width: w, height: h } }) });
const files = [await shot(300, 420), await shot(310, 430), await shot(320, 440)];

await run('unit-grade', [
  ['답안 올리기: 학생 한 명 1쪽, 명단 예외 번호 2를 건너뛰어 1·3·4번', async () => {
    await page.click(`${V} [data-un-open="${A}"]`);
    assert((await page.textContent(`${V} .steps [aria-current="step"]`)).includes('답안'), '2단계가 아님');
    await page.fill(`${V} #unPagesPer`, '1'); await page.dispatchEvent(`${V} #unPagesPer`, 'change');
    await page.setInputFiles(`${V} #unAnsFile`, files);
    await page.waitForFunction(() => document.querySelectorAll('.unit-box [data-st]').length === 3);
    const nos = await page.$$eval(`${V} input[data-stno]`, els => els.map(e => e.value));
    assert(nos.join(',') === '1,3,4', nos.join(','));
    assert((await T(A)).students.map(s => s.no).join(',') === '1,3,4', '저장');
  }],
  ['검토 고침: 이름 칸을 정하지 않고 채점하면 먼저 물어봄(AI 안 부름)', async () => {
    await page.click(`${V} [data-un="toGrade"]`);
    await page.click(`${V} [data-un="grade"]`);
    await page.waitForSelector('#sheetRoot #unNoMaskOk');
    assert((await page.textContent('#sheetRoot')).includes('학생 이름이 그대로 AI'), '안내 글');
    await page.click('#sheetRoot [data-close]');
    await page.waitForTimeout(200);
    assert(grades().length === 0, 'AI를 부름');
    await page.click(`${V} .steps [data-step="2"]`);
  }],
  ['이름 칸 상자를 그리면 이 평가에 저장(다음 평가용으로 unit:set에도)', async () => {
    await page.click(`${V} [data-un="mask"]`);
    const b = await page.locator('#sheetRoot #mkStage').boundingBox();
    await page.mouse.move(b.x + b.width * 0.6, b.y + 10); await page.mouse.down();
    await page.mouse.move(b.x + b.width * 0.95, b.y + 40, { steps: 4 }); await page.mouse.up();
    await page.click('#sheetRoot #mkOk');
    const set = await page.evaluate(() => JSON.parse(localStorage.getItem('ssam:unit:set')));
    assert(set.mask.length === 1 && set.pagesPer === 1, JSON.stringify(set));
    assert((await T(A)).mask.length === 1, '평가에 없음');
  }],
  ['채점 시작 → 학생마다 AI 한 번, 이미지 1장', async () => {
    await page.click(`${V} [data-un="toGrade"]`);
    assert(!(await page.textContent(V)).includes('업스테이지'), '업스테이지 안내가 보임');
    await page.click(`${V} [data-un="grade"]`);
    await page.waitForFunction(id => JSON.parse(localStorage.getItem('ssam:unit:t:' + id)).students.every(s => s.status === 'done'), A);
    assert(grades().length === 3 && grades().every(p => p.images === 1), JSON.stringify(grades().map(p => p.images)));
    assert(['1', '3', '4'].every(n => grades().some(p => p.prompt.includes(`[학생] ${n}번`))), '번호');
  }],
  ['확인 표: 앱이 정한 점수, 노란 칸(앱과 AI가 다름·서술형), 총점', async () => {
    await page.waitForSelector(`${V} [data-cell="1-2"]`);
    assert(await page.locator(`${V} [data-cell="1-2"].chk`).count() === 1, '1번 2번 문항이 노란 칸이 아님');
    assert(await page.locator(`${V} [data-cell="1-9"].chk`).count() === 1, '서술형');
    assert(await page.locator(`${V} [data-cell="1-1"].chk`).count() === 0, '맞은 칸이 노란 칸');
    const a = await T(A);
    assert(a.students[0].items[2].pts === 0 && a.students[0].items[2].flag === 'differ', JSON.stringify(a.students[0].items[2]));
    assert(a.students[1].items[7].flag === 'similar' && a.students[1].items[7].pts === 10, '단답 similar');
    assert((await page.textContent(`${V} [data-strow="1"]`)).includes('/100'), '총점');
    assert(/확인할 칸 \d+개/.test(await page.textContent(`${V} #unPending`)), '확인할 칸');
  }],
  ['칸 시트에서 점수 고치기 → 선생님이 고침, 노란색 풀림', async () => {
    const before = Number((/(\d+)개/.exec(await page.textContent(`${V} #unPending`)) || [])[1]);
    await page.click(`${V} [data-cell="1-2"]`);
    await page.waitForSelector('#sheetRoot #unCellOk');
    assert((await page.inputValue('#sheetRoot #unCellRead')) === '②', '읽은 답');
    await page.click('#sheetRoot [data-pts="10"]');
    await page.click('#sheetRoot #unCellOk');
    await page.waitForTimeout(100);
    const c = (await T(A)).students[0].items[2];
    assert(c.pts === 10 && c.manual && c.ok, JSON.stringify(c));
    assert(await page.locator(`${V} [data-cell="1-2"].chk`).count() === 0, '노란 칸 남음');
    const after = Number((/(\d+)개/.exec(await page.textContent(`${V} #unPending`)) || [])[1]);
    assert(after === before - 1, `${before} → ${after}`);
  }],
  ['문항 모아 보기: AI 점수로 모두 확인', async () => {
    await page.click(`${V} [data-item="9"]`);
    await page.waitForSelector('#sheetRoot [data-un="itemOk"]');
    assert((await page.textContent('#sheetRoot [data-un="itemOk"]')).includes('지금 점수로 모두 확인'), '단추 이름');
    assert((await page.textContent('#sheetRoot')).includes('도서관에서 잔치가 열린다.'), '반 전체 답');
    await page.click('#sheetRoot [data-un="itemOk"]');
    await page.waitForTimeout(100);
    assert(await page.locator(`${V} [data-cell$="-9"].chk`).count() === 0, '9번 노란 칸 남음');
    assert((await T(A)).students.every(s => s.items[9].ok), '저장');
  }],
  ['다시 채점해도 선생님이 고친 칸은 그대로', async () => {
    const n = grades().length;
    await page.click(`${V} [data-un="retry"][data-no="1"]`);
    await until(() => grades().length === n + 1);
    await page.waitForTimeout(300);
    assert(grades().length === n + 1, '다시 부르지 않음');
    const c = (await T(A)).students[0].items[2];
    assert(c.pts === 10 && c.manual, JSON.stringify(c));
  }],
  ['멈추기: 시작하지 않은 학생은 부르지 않음, 오류 없음', async () => {
    slow = 900;
    const n = grades().length;
    await page.click(`${V} [data-un="grade"]`);
    await page.click('#sheetRoot #unRegradeOk');
    await page.waitForSelector(`${V} [data-un="stop"]`);
    await page.click(`${V} [data-un="stop"]`);
    await page.waitForTimeout(1300); slow = 0;
    // 첫 학생은 혼자 보냄(공통 부분 캐시를 한 번만 쓰게) → 멈추면 그 한 명만 불림
    assert(grades().length - n === 1, `불린 수 ${grades().length - n}`);
    assert((await T(A)).students.every(s => s.status === 'done'), JSON.stringify((await T(A)).students.map(s => s.status)));
    assert(await page.locator(`${V} [data-un="grade"]`).count() === 1, '채점 시작 단추가 없음');
  }],
  ['채점 도중 다른 평가를 열어도 결과는 시작한 평가에', async () => {
    slow = 700; round = 2;
    await page.click(`${V} [data-un="grade"]`);
    await page.click('#sheetRoot #unRegradeOk');
    await page.click(`${V} [data-un="back"]`);
    await page.click(`${V} [data-un-open="${B}"]`);
    await page.waitForTimeout(1800); slow = 0;
    assert((await T(B)).students.length === 0, 'B에 학생이 생김');
    assert((await T(A)).students[1].items[1].read === '(2)', 'A에 새 결과가 없음');
    assert((await page.textContent(`${V} .un-title`)).includes('(2회)'), '보는 평가가 바뀜');
  }],
  ['검토 고침: A를 채점하는 동안 B에 답안을 올리면 막고, A는 모두 이미지와 함께', async () => {
    const n = grades().length;
    await page.click(`${V} [data-un="back"]`);
    await page.click(`${V} [data-un-open="${A}"]`);
    slow = 900;
    await page.click(`${V} [data-un="grade"]`);
    await page.click('#sheetRoot #unRegradeOk');
    await page.click(`${V} [data-un="back"]`);
    await page.click(`${V} [data-un-open="${B}"]`);
    await page.setInputFiles(`${V} #unAnsFile`, files);
    await page.waitForTimeout(300);
    assert((await page.textContent(`${V} #unAnsMsg`)).includes('다른 평가를 채점하는 중'), '안내 없음');
    assert((await T(B)).students.length === 0, 'B에 학생이 생김');
    await until(() => grades().length === n + 3, 8000);
    await page.waitForTimeout(300); slow = 0;
    assert(grades().slice(n).every(p => p.images === 1), JSON.stringify(grades().slice(n).map(p => p.images)));
  }],
  ['채점 마치기 → 확인 창 → 마침, 목록에 반 평균', async () => {
    await page.click(`${V} [data-un="back"]`);
    await page.click(`${V} [data-un-open="${A}"]`);
    if (!(await page.locator(`${V} [data-un="finish"]`).count())) await page.click(`${V} .steps [data-step="3"]`);
    await page.click(`${V} [data-un="finish"]`);
    assert((await page.textContent('#sheetRoot')).includes('확인하지 않은 칸'), '확인 창 글');
    await page.click('#sheetRoot #unFinishOk');
    await page.waitForTimeout(100);
    assert((await T(A)).done === true, 'done');
    await page.click(`${V} [data-un="back"]`);
    const card = await page.textContent(`${V} [data-un-open="${A}"]`);
    assert(card.includes('마침') && card.includes('반 평균') && card.includes('학생 3명'), card);
  }],
  ['검토 고침: 정답표를 고치면 채점한 칸을 다시 맞춤', async () => {
    await page.click(`${V} [data-un-open="${A}"]`);
    await page.click(`${V} .steps [data-step="1"]`);
    await page.fill(`${V} [data-k="2-points"]`, '5'); await page.dispatchEvent(`${V} [data-k="2-points"]`, 'change');
    assert((await T(A)).students[0].items[2].pts === 5, '고친 칸이 배점보다 큼');
    await page.fill(`${V} [data-k="7-answer"]`, '도서관'); await page.dispatchEvent(`${V} [data-k="7-answer"]`, 'change');
    const a = await T(A), s3 = a.students[1].items[7], s1 = a.students[0].items[7];
    assert(s3.pts === 10 && s3.flag === '' && s1.pts === 0 && s1.flag === 'similar', JSON.stringify([s3, s1]));
    await page.click(`${V} [data-un="back"]`);
  }],
  ['다듬기: 채점하는 동안 같은 평가의 1단계에서 쓰던 글이 지워지지 않음', async () => {
    await page.click(`${V} [data-un-open="${A}"]`);
    await page.click(`${V} .steps [data-step="3"]`);
    slow = 1500;
    await page.click(`${V} [data-un="grade"]`);
    await page.click('#sheetRoot #unRegradeOk');
    await page.click(`${V} .steps [data-step="1"]`);
    await page.click(`${V} #unUnitName`); await page.keyboard.press('End'); await page.keyboard.type(' 고침');
    await page.waitForTimeout(3600); slow = 0;
    assert(await page.evaluate(() => document.activeElement && document.activeElement.id) === 'unUnitName', '쓰던 칸에서 커서가 빠짐');
    assert((await page.inputValue(`${V} #unUnitName`)).endsWith(' 고침'), '쓰던 글이 지워짐: ' + await page.inputValue(`${V} #unUnitName`));
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);
    assert((await T(A)).meta.unitName.endsWith(' 고침'), '저장 안 됨');
  }],
  ['다듬기: 저장 공간이 꽉 차면 채점을 멈춤(AI를 더 부르지 않음)', async () => {
    await page.click(`${V} .steps [data-step="3"]`);
    await page.evaluate(() => { const o = Storage.prototype.setItem; window.__set = o; Storage.prototype.setItem = function (k, v) { if (String(k).startsWith('ssam:unit:t:')) throw new Error('QuotaExceededError'); return o.call(this, k, v); }; });
    slow = 300;
    const n = grades().length;
    await page.click(`${V} [data-un="grade"]`);
    await page.click('#sheetRoot #unRegradeOk');
    // 첫 학생 혼자 → 저장이 안 되면 바로 멈춤(나머지는 부르지 않음)
    await until(() => grades().length >= n + 1);
    await page.waitForTimeout(1500); slow = 0;
    await page.evaluate(() => { Storage.prototype.setItem = window.__set; });
    assert(grades().length === n + 1, `불린 수 ${grades().length - n}`);
  }],
  ['다듬기: 채점한 뒤 쪽 수를 바꾸면 알려 줌', async () => {
    await page.click(`${V} .steps [data-step="2"]`);
    await page.fill(`${V} #unPagesPer`, '2'); await page.dispatchEvent(`${V} #unPagesPer`, 'change');
    await page.waitForTimeout(100);
    assert((await page.textContent('#toast')).includes('이미 채점한 학생이 있어'), await page.textContent('#toast'));
    await page.fill(`${V} #unPagesPer`, '1'); await page.dispatchEvent(`${V} #unPagesPer`, 'change');
    await page.click(`${V} [data-un="back"]`);
  }],
  ['검토 고침: 결석 번호를 적으면 뒤 번호가 밀리고 채점 결과는 그 답안에 그대로', async () => {
    await page.click(`${V} [data-un-open="${A}"]`);
    await page.click(`${V} .steps [data-step="2"]`);
    const before = (await T(A)).students.map(s => s.items[1].read);
    await page.fill(`${V} #unAbsent`, '3'); await page.dispatchEvent(`${V} #unAbsent`, 'change');
    await page.waitForTimeout(100);
    let a = await T(A);
    assert(a.students.map(s => s.no).join(',') === '1,4,5' && JSON.stringify(a.absent) === '[3]', a.students.map(s => s.no).join(','));
    assert(JSON.stringify(a.students.map(s => s.items[1].read)) === JSON.stringify(before), '결과가 다른 답안으로 감');
    assert((await page.$$eval(`${V} input[data-stno]`, els => els.map(e => e.value))).join(',') === '1,4,5', '화면 번호');
    await page.fill(`${V} #unAbsent`, ''); await page.dispatchEvent(`${V} #unAbsent`, 'change');
    a = await T(A);
    assert(a.students.map(s => s.no).join(',') === '1,3,4', '되돌리기');
    await page.click(`${V} [data-un="back"]`);
  }],
  ['검토 고침: 이름 칸은 평가마다 따로, 새 평가는 지난 평가의 가림을 보여 주고 확인받은 뒤에 보냄', async () => {
    const n = grades().length;
    await page.click(`${V} [data-un-open="${B}"]`);
    await page.setInputFiles(`${V} #unAnsFile`, files);
    await page.waitForFunction(() => document.querySelectorAll('.unit-box [data-st]').length === 3);
    assert((await page.textContent(V)).includes('가릴 곳을 아직 정하지 않았어요'), 'A의 가림이 B에 그대로');
    await page.click(`${V} [data-un="toGrade"]`);
    await page.click(`${V} [data-un="grade"]`);
    await page.waitForSelector('#sheetRoot #unMaskGo');
    assert((await page.textContent('#sheetRoot')).includes('지난 평가에서 정한 곳'), await page.textContent('#sheetRoot'));
    await page.click('#sheetRoot #unMaskGo');
    await page.waitForSelector('#sheetRoot #mkStage');
    assert(await page.locator('#sheetRoot #mkBoxes .mk').count() === 1, '지난 가림을 보여 주지 않음');
    await page.click('#sheetRoot #mkOk');
    await page.waitForTimeout(100);
    assert(grades().length === n, 'AI를 부름');
    const b = await T(B);
    assert(Array.isArray(b.mask) && b.mask.length === 1, JSON.stringify(b.mask));
    await page.click(`${V} [data-un="back"]`);
  }],
  ['검토 고침: 문항을 빼고 다시 더해도 그 번호에 지난 채점 칸이 남지 않음', async () => {
    await page.click(`${V} [data-un-open="${A}"]`);
    await page.click(`${V} .steps [data-step="1"]`);
    assert((await T(A)).students.some(s => s.items[10]), '처음부터 10번 칸이 없음');
    await page.click(`${V} [data-un="delItem"][data-no="10"]`);
    assert((await T(A)).students.every(s => !s.items[10]), '뺀 문항의 칸이 남음');
    await page.click(`${V} [data-un="addItem"]`);
    const a = await T(A);
    assert(a.key.items.at(-1).no === 10 && a.students.every(s => !s.items[10]), JSON.stringify(a.students.map(s => s.items[10])));
    await page.click(`${V} [data-un="back"]`);
  }],
  ['검토 고침: AI 키가 틀리면(401) 남은 학생은 부르지 않고 멈춘 까닭을 알림', async () => {
    let calls = 0;
    const deny = async route => { calls++; await new Promise(r => setTimeout(r, 200)); await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }) }); };
    await page.route('https://api.anthropic.com/**', deny);
    await page.click(`${V} [data-un-open="${A}"]`);
    await page.click(`${V} .steps [data-step="2"]`);
    await page.setInputFiles(`${V} #unAnsFile`, files);
    await page.waitForFunction(s => (document.querySelector(s + ' #unAnsMsg') || {}).textContent?.includes('3쪽'), V); // 이 평가에 스캔이 붙을 때까지
    await page.click(`${V} [data-un="toGrade"]`);
    await page.click(`${V} [data-un="grade"]`);
    // 앞 시험에 따라 모두 채점한 상태면 「모두 다시 채점할까요?」가 뜸
    await until(async () => calls > 0 || await page.locator('#sheetRoot #unRegradeOk').count() > 0, 3000);
    if (!calls) await page.click('#sheetRoot #unRegradeOk');
    await page.waitForTimeout(1500);
    await page.unroute('https://api.anthropic.com/**', deny);
    for (let k = errors.length - 1; k >= 0; k--) if (errors[k].includes('401')) errors.splice(k, 1); // 일부러 낸 401
    assert(calls === 1, `부른 수 ${calls}`); // 첫 학생 혼자 보내다 키 오류 → 나머지는 부르지 않음
    assert((await page.textContent('#toast')).includes('채점을 멈췄어요'), await page.textContent('#toast'));
    await page.click(`${V} [data-un="back"]`);
  }],
  ['업스테이지면 손글씨 안내', async () => {
    await page.evaluate(() => localStorage.setItem('ssam:engine', JSON.stringify({ engine: 'upstage', keys: { upstage: 'up-test' }, remember: true })));
    await page.reload(); await page.waitForTimeout(500);
    await page.click(`${V} [data-un-open="${A}"]`);
    await page.click(`${V} .steps [data-step="3"]`);
    assert((await page.textContent(V)).includes('업스테이지는 이미지를 글자로 바꿔 보내요'), '안내 없음');
    assert((await page.textContent(V)).includes('스캔을 다시 올려'), '다시 열면 스캔이 없다는 안내');
  }],
  ['페이지 오류 없음', async () => { assert(errors.length === 0, errors.join(' | ')); }]
]);
await t.close();
