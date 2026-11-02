// 단원평가 채점 검토: 메인(Haiku)이 확신 없는 칸·서술형 부분 점수만 검토 AI(Opus)가 같은 그림으로 다시 봄.
// 같으면 확인할 칸이 줄고, 다르면 두 의견 → [검토 안 쓰기]/[그대로 두기], 손으로 고치면 의견 사라짐,
// 다시 채점하면 새 검토만, 검토 AI가 401이면 메인 결과 그대로 · 「검토하지 못했어요」 · 남은 학생은 검토 안 함
import { open, run, assert } from './helpers.mjs';
import { SAMPLE_ITEMS } from '../../web/menus/evaluate/unit/unit-sample.js';

const t = await open();
const { page, url, errors } = t;
await page.clock.setFixedTime(new Date('2026-10-29T09:00:00'));
await page.addInitScript(() => {
  if (!localStorage.getItem('ssam:engine')) localStorage.setItem('ssam:engine', JSON.stringify({ engine: 'claude', keys: { claude: 'sk-test' }, remember: true }));
  if (!localStorage.getItem('ssam:ai-roles')) localStorage.setItem('ssam:ai-roles', JSON.stringify({ review: null, tasks: { grade: { main: { engine: 'claude', model: 'claude-haiku-5-5' }, reviewOn: true, review: { engine: 'claude', model: 'claude-opus-5-5' } } } }));
});
const ANS = ['(2)', '③', '㉯', '민수', '②, ④', '(1)-②, (2)-①', '마을 도서관', '⑤', '마을 도서관에서 잔치가 열린다.', '가고 싶다. 친구와 책을 고를 수 있다.'];
const calls = [];
let round = 1, reviewFail = false, slow3 = 0;
const send = (route, out) => route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: [{ type: 'content_block_delta', delta: { type: 'text_delta', text: out } }, { type: 'message_delta', delta: { stop_reason: 'end_turn' } }].map(e => 'data: ' + JSON.stringify(e) + '\n\n').join('') }).catch(() => {});
await page.route('https://api.anthropic.com/**', async route => {
  const body = JSON.parse(route.request().postData());
  const c = body.messages[0].content;
  const prompt = typeof c === 'string' ? c : c.find(x => x.type === 'text').text;
  const images = typeof c === 'string' ? 0 : c.filter(x => x.type === 'image').length;
  const no = Number((/\[학생\] (\d+)번/.exec(prompt) || [])[1]);
  calls.push({ model: body.model, head: prompt.split('\n')[0], no, images, prompt });
  if (prompt.startsWith('[채점 검토]')) {
    if (reviewFail) return route.fulfill({ status: 401, body: JSON.stringify({ error: { type: 'authentication_error', message: 'bad key' } }) }).catch(() => {});
    const nos = [...prompt.split('[확인할 문항의 정답표]')[1].split('[할 일]')[0].matchAll(/^(\d+) \| /gm)].map(m => Number(m[1]));
    // 1번: 2번 문항은 같게(③ 10점), 9번 서술형은 12점(다름). 3번: 5번 문항을 ②로 읽음(다름)
    return send(route, JSON.stringify({ items: nos.map(n => (no === 1 && n === 9 ? { no: n, read: ANS[8], points: 12, why: '까닭이 잘 드러남' }
      : no === 3 && n === 5 ? { no: n, read: '②', points: 0, why: round === 2 ? 'R2 하나만 고름' : '하나만 고름' }
        : { no: n, read: ANS[n - 1], points: SAMPLE_ITEMS[n - 1].points, why: '' })) }));
  }
  if (no === 3 && slow3) await new Promise(r => setTimeout(r, slow3));
  // 메인 채점: 모두 맞음. 1번은 2번 문항 확신 없음·9번 서술형 9점, 3번은 5번 문항 확신 없음, 2번은 모두 확신
  return send(route, JSON.stringify({ items: SAMPLE_ITEMS.map((it, i) => ({ no: it.no, read: ANS[i], points: no === 1 && it.no === 9 ? 9 : it.points, sure: !((no === 1 && it.no === 2) || (no === 3 && it.no === 5)), why: '' })) }));
});
const V = 'section[data-menu="evaluate"] .unit-box';
const T = id => page.evaluate(id => JSON.parse(localStorage.getItem('ssam:unit:t:' + id)), id);
const reviews = () => calls.filter(c => c.head === '[채점 검토]');
const mains = () => calls.filter(c => c.head === '[단원평가 채점]');
const pendingN = async () => Number((/(\d+)개/.exec(await page.textContent(`${V} #unPending`)) || [])[1]);
await page.goto(url);
await page.waitForTimeout(400);
const A = await page.evaluate(async () => {
  const m = await import('./menus/evaluate/unit/unit-model.js'), s = await import('./menus/evaluate/unit/unit-sample.js');
  const x = m.newTest({ meta: { ...s.SAMPLE_META, round: 1, date: '2026-10-29' }, key: { domains: ['지식', '이해'], items: s.SAMPLE_ITEMS }, paper: { text: '' } }); m.saveTest(x);
  localStorage.setItem('ssam:class', JSON.stringify({ count: 3, except: [] }));
  return x.id;
});
await page.reload(); await page.waitForTimeout(500);
await page.click('nav.app-side [data-menu-go="evaluate"]'); await page.click('#menuTabs [data-tab="unit"]');
const shot = async (w, h) => ({ name: `답안${w}.png`, mimeType: 'image/png', buffer: await page.screenshot({ clip: { x: 0, y: 0, width: w, height: h } }) });
const files = [await shot(300, 420), await shot(310, 430), await shot(320, 440)];
const until = async (fn, ms = 8000) => { const end = Date.now() + ms; while (!(await fn())) { if (Date.now() > end) throw new Error('시간 초과'); await new Promise(r => setTimeout(r, 50)); } };
const idle = () => until(async () => (await T(A)).students.every(s => s.status === 'done') && !(await page.locator(`${V} [data-un="stop"]`).count()));

await run('review-unit', [
  ['채점: 메인은 Haiku, 검토는 확신 없는 칸·서술형 부분 점수가 있는 학생만 Opus로, 같은 그림·그 문항만', async () => {
    await page.click(`${V} [data-un-open="${A}"]`);
    await page.fill(`${V} #unPagesPer`, '1'); await page.dispatchEvent(`${V} #unPagesPer`, 'change');
    await page.setInputFiles(`${V} #unAnsFile`, files);
    await page.waitForFunction(() => document.querySelectorAll('.unit-box [data-st]').length === 3);
    if (await page.isChecked(`${V} #unMaskOn`)) await page.click(`${V} #unMaskOn`);
    await page.click(`${V} [data-un="toGrade"]`);
    await page.click(`${V} [data-un="grade"]`);
    await idle();
    await until(async () => reviews().length >= 2 && (await T(A)).students.every(s => s.no === 2 || Object.values(s.items).some(c => c.rv)));
    assert(mains().length === 3 && mains().every(c => c.model === 'claude-haiku-5-5'), mains().map(c => c.model).join(','));
    const rv = reviews();
    assert(rv.length === 2 && rv.every(c => c.model === 'claude-opus-5-5' && c.images === 1), JSON.stringify(rv.map(c => [c.no, c.model, c.images])));
    assert(rv.map(c => c.no).sort().join(',') === '1,3', '검토한 학생: ' + rv.map(c => c.no).join(','));
    const r1 = rv.find(c => c.no === 1).prompt;
    assert(/^2 \| 고르기/m.test(r1) && /^9 \| 서술형/m.test(r1) && !/^1 \| 고르기/m.test(r1) && !/^10 \| 서술형/m.test(r1), r1.split('[할 일]')[0]);
  }],
  ['같으면 확인할 칸에서 빠지고, 다르면 두 의견(노란 칸) · 「검토 의견 2개」', async () => {
    const s = (await T(A)).students;
    assert(s[0].items[2].rv.agree === true && s[0].items[2].ok === true, JSON.stringify(s[0].items[2]));
    assert(s[0].items[9].rv.agree === false && !s[0].items[9].ok && s[0].items[9].rv.points === 12, JSON.stringify(s[0].items[9]));
    assert(s[2].items[5].rv.agree === false && s[2].items[5].rv.read === '②', JSON.stringify(s[2].items[5]));
    assert(await page.locator(`${V} [data-cell="1-9"].rvo`).count() === 1, '두 의견 표시');
    assert(await page.locator(`${V} [data-cell="1-2"].chk`).count() === 0, '같게 본 칸이 노란 칸');
    assert((await page.textContent(`${V} .rv-bar`)).includes('검토 의견 2개'), await page.textContent(V));
  }],
  ['[다음 의견] → 메인 안 9점 / 검토 안 12점 → [검토 안 쓰기]로 바뀜', async () => {
    await page.click(`${V} [data-un="nextRv"]`);
    await page.waitForSelector('#sheetRoot .rv-op');
    const txt = await page.textContent('#sheetRoot .rv-op');
    assert(txt.includes('9점') && txt.includes('12점') && txt.includes('까닭이 잘 드러남'), txt);
    await page.click('#sheetRoot [data-rv-use]');
    await page.waitForTimeout(150);
    const c = (await T(A)).students[0].items[9];
    assert(c.pts === 12 && c.ok && c.rv.done === 'review', JSON.stringify(c));
    assert(await page.locator(`${V} [data-cell="1-9"].rvo`).count() === 0, '표시 남음');
    assert((await page.textContent(`${V} .rv-bar`)).includes('검토 의견 1개'), '개수');
  }],
  ['같은 학생을 다시 채점하면 지난 검토 의견은 지우고 새 검토만', async () => {
    round = 2;
    const n = reviews().length;
    await page.click(`${V} [data-un="retry"][data-no="3"]`);
    await until(async () => reviews().length === n + 1 && ((await T(A)).students[2].items[5].rv || {}).why === 'R2 하나만 고름');
    await idle();
    const c = (await T(A)).students[2].items[5];
    assert(c.rv.why === 'R2 하나만 고름' && !c.rv.done, JSON.stringify(c));
  }],
  ['두 의견이 있는 칸을 손으로 고치면 검토 의견이 사라짐', async () => {
    await page.click(`${V} [data-cell="3-5"]`);
    await page.waitForSelector('#sheetRoot .rv-op');
    await page.click('#sheetRoot [data-pts="0"]');
    await page.click('#sheetRoot #unCellOk');
    await page.waitForTimeout(150);
    const c = (await T(A)).students[2].items[5];
    assert(!c.rv && c.manual && c.pts === 0, JSON.stringify(c));
    assert(!(await page.locator(`${V} .rv-bar`).count()), '검토 의견 막대가 남음');
  }],
  ['검토 AI가 401 → 메인 결과 그대로, 「검토하지 못했어요」, 같은 차례의 다음 학생은 검토 요청 안 함', async () => {
    reviewFail = true; slow3 = 600; round = 1;
    const n = reviews().length, m = mains().length;
    await page.click(`${V} [data-un="grade"]`);
    await page.waitForSelector('#sheetRoot #unRegradeOk');
    await page.click('#sheetRoot #unRegradeOk');
    await until(async () => mains().length === m + 3);
    await idle();
    await page.waitForTimeout(300);
    assert(reviews().length === n + 1, `검토 요청 ${reviews().length - n}번`);
    const s = (await T(A)).students;
    assert(s.every(x => x.status === 'done') && s[0].items[1].read === '(2)', '메인 결과');
    assert(s[0].rvErr === '검토하지 못했어요', JSON.stringify(s[0].rvErr));
    assert((await page.textContent(`${V} [data-strow="1"]`)).includes('검토하지 못했어요'), '표시');
    assert(s[0].items[2].flag === 'low' && !s[0].items[2].ok, '노란 칸 그대로');
  }],
  ['페이지 오류 없음', async () => { const bad = errors.filter(e => !/status of 401/.test(e)); assert(bad.length === 0, bad.join(' | ')); }]
]);
await t.close();
