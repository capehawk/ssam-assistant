// 떠 있는 버튼 › 활동지: 활동지 글 → 카드 「수업 활동지」 → [실행] → 평가 › 활동지 새 활동지 1단계(학생용·교사용 나눠 넣음),
// 같은 활동지의 학생용·교사용 두 파일은 활동지 하나(교사용 파일은 교사용으로), 다른 활동지 둘은 따로,
// samples/활동지-예시.hwpx도 수업 활동지로, 학생 스캔 → 받는 곳에서 「활동지 채점 · …」을 고르면 그 활동지 3단계·학생 수
import { join } from 'node:path';
import { open, run, assert, mockClaude, ROOT } from './helpers.mjs';

const t = await open();
const { page, url, errors } = t;
await page.addInitScript(() => {
  if (!localStorage.getItem('ssam:engine')) localStorage.setItem('ssam:engine', JSON.stringify({ engine: 'claude', keys: { claude: 'sk-test' }, remember: true }));
  if (!localStorage.getItem('ssam:activity:set')) localStorage.setItem('ssam:activity:set', JSON.stringify({ pagesPer: 1, maskOn: false, mask: [], maskAll: false }));
});
await mockClaude(page, async () => '{}');
const sheet = '#sheetRoot .sheet', P = 'section[data-menu="evaluate"]';
const pick = files => page.setInputFiles('#inboxFile', files);
const runCard = async () => { await page.waitForSelector(`${sheet} #ibRun:not([disabled])`); await page.click(`${sheet} #ibRun`); };
const txt = (name, text) => ({ name, mimeType: 'text/plain', buffer: Buffer.from(text) });
const acts = () => page.evaluate(() => (JSON.parse(localStorage.getItem('ssam:activity:list') || '[]')).map(s => JSON.parse(localStorage.getItem('ssam:activity:a:' + s.id))));
const until = async (fn, ms = 10000) => { const end = Date.now() + ms; while (!(await fn())) { if (Date.now() > end) throw new Error('시간 초과'); await new Promise(r => setTimeout(r, 60)); } };
const SOC = ['1. 이웃과 함께 > [5차시] 서로 돕는 마을 (교과서 30~31쪽)', '이웃을 돕는 방법 알아보기', '사회 3-2', '반     번   이름:', '※ 이웃을 도운 경험을 적어 봅시다.', '(1) 이웃을 도운 경험 | ➡ | '];
const MATH = ['4. 분수', '[5차시] 진분수와 가분수를 알아볼까요', '교과서 94~95쪽', '수학', '학년       반       번   이름:', '1. □ 안에 알맞은 수를 써넣으세요.', '1/5 | '];
const SCI = ['[과학] 3-2-1-02 물은 어디로 갈까? (12~13쪽)', '물의 여행 그리기', '◉ 물이 여행하는 길을 그려 봅시다.', '번호 | 그림', '1 | '];
await page.goto(url);
await page.waitForTimeout(400);

await run('inbox-activity', [
  ['활동지 글(학생용 + (예시)) → 카드 「수업 활동지」 → [실행] → 활동지 탭 새 활동지 1단계 → 나눈 결과 카드 → 학생용·교사용', async () => {
    await pick(txt('서로 돕는 마을.txt', [...SOC, '(예시)', ...SOC.slice(0, -1), '(1) 이웃을 도운 경험 | ➡ | 무거운 짐을 들어 드렸어요.'].join('\n')));
    await page.waitForSelector(sheet);
    assert((await page.textContent(sheet)).includes('수업 활동지'), await page.textContent(sheet));
    await runCard();
    await page.waitForSelector('#sheetRoot #bundleCard');
    await page.click('#sheetRoot #bundleOk');
    await page.waitForFunction(s => (document.querySelector(`${s} #actTitle`) || {}).value === '서로 돕는 마을', P);
    assert(await page.isVisible('#menuTabs [data-tab="activity"][aria-current="page"]'), '활동지 탭');
    const a = (await acts())[0];
    assert(a && a.sheet.teacher.includes('무거운 짐') && !a.sheet.student.includes('무거운 짐'), JSON.stringify(a && a.sheet).slice(0, 200));
  }],
  ['같은 활동지의 학생용·교사용 두 파일 → 활동지 하나, 교사용 파일은 교사용으로', async () => {
    await pick([txt('분수(학생용).txt', MATH.join('\n')), txt('분수(교사용).txt', [...MATH.slice(0, 4), '학년       반       번   이름: 교사용', MATH[5], '1/5 | 1'].join('\n'))]);
    await runCard();
    await page.waitForSelector('#sheetRoot #bundleCard');
    await page.click('#sheetRoot #bundleOk');
    await until(async () => (await acts()).some(a => a.meta.subject === '수학'));
    const m = (await acts()).filter(a => a.meta.subject === '수학');
    assert(m.length === 1 && m[0].sheet.teacher.includes('1/5 | 1') && !m[0].sheet.student.includes('교사용') && m[0].sheet.student.includes('써넣으세요'), JSON.stringify(m.map(a => a.sheet)).slice(0, 300));
  }],
  ['서로 다른 활동지 두 파일 → 활동지 둘', async () => {
    const n0 = (await acts()).length;
    await pick([txt('물의 여행.txt', SCI.join('\n')), txt('분수 2.txt', MATH.join('\n').replace('[5차시] 진분수와 가분수를 알아볼까요', '[6차시] 대분수를 알아볼까요'))]);
    await runCard();
    await until(async () => (await acts()).length === n0 + 2);
  }],
  ['samples/활동지-예시.hwpx → 「수업 활동지」 → 학생용·교사용(예시 답) 나눠 넣음, 과학·차시·제목', async () => {
    await pick(join(ROOT, 'samples', '활동지-예시.hwpx'));
    await page.waitForSelector(sheet);
    assert((await page.textContent(sheet)).includes('수업 활동지'), await page.textContent(sheet));
    await runCard();
    await page.waitForSelector('#sheetRoot #bundleCard');
    await page.click('#sheetRoot #bundleOk');
    await until(async () => (await acts()).some(a => a.meta.title === '물의 여행 그리기'));
    const a = (await acts()).find(x => x.meta.title === '물의 여행 그리기');
    assert(a.meta.subject === '과학' && a.meta.lesson === '2' && a.sheet.teacher.includes('증발해 구름') && !a.sheet.student.includes('증발해 구름') && a.sheet.student.includes('그려 봅시다'), JSON.stringify(a.meta) + JSON.stringify(a.sheet).slice(0, 300));
  }],
  ['학생 스캔 → 받는 곳 「활동지 채점 · …」 → 그 활동지 3단계·학생 2명', async () => {
    const id = await page.evaluate(() => {
      const ids = JSON.parse(localStorage.getItem('ssam:activity:list') || '[]').map(s => s.id);
      const id = ids.find(i => JSON.parse(localStorage.getItem('ssam:activity:a:' + i)).meta.subject === '사회');
      const a = JSON.parse(localStorage.getItem('ssam:activity:a:' + id));
      a.items = [{ no: 1, type: 'write', ask: '도운 경험', answer: '', ok: '구체적으로', part: '', src: 'ai' }]; a.confirmed = true;
      localStorage.setItem('ssam:activity:a:' + id, JSON.stringify(a));
      return id;
    });
    const shot = async w => ({ name: `활동지${w}.png`, mimeType: 'image/png', buffer: await page.screenshot({ clip: { x: 0, y: 0, width: w, height: 400 } }) });
    await pick([await shot(300), await shot(310)]);
    await page.waitForSelector(sheet);
    assert((await page.textContent(sheet)).includes('학생 답안 스캔'), await page.textContent(sheet));
    const opts = await page.$$eval(`${sheet} [data-ib-field="test"] option`, os => os.map(o => [o.value, o.textContent]));
    assert(opts.some(([v, l]) => v === 'act:' + id && l.includes('활동지 채점') && l.includes('서로 돕는 마을')), JSON.stringify(opts));
    assert(!opts.some(([v]) => v.startsWith('act:') && v !== 'act:' + id), '기준을 확정하지 않은 활동지도 나옴');
    await page.selectOption(`${sheet} [data-ib-field="test"]`, 'act:' + id);
    await runCard();
    await until(async () => (await acts()).find(a => a.id === id).students.length === 2);
    await page.waitForSelector(`${P} #acStus`);
    assert((await page.textContent(`${P} #acStus`)).includes('학생 2명'), await page.textContent(`${P} #acStus`));
  }],
  ['페이지 오류 없음', async () => { assert(errors.length === 0, errors.join(' | ')); }]
]);
await t.close();
