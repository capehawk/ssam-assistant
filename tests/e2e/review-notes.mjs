// 피드백·알림 검토: 단원평가 잘한 점·격려 쓰기 뒤, 주간학습안내 알림 쓰기 뒤 검토 AI가 한 번 봄(번호·점수만, 이름 없음)
// → 고칠 칸만 두 의견, [검토 안 쓰기]로 바뀜, [그대로 두기]로 사라짐, 손으로 고치면 사라짐
import { open, run, assert } from './helpers.mjs';

const t = await open();
const { page, url, errors } = t;
await page.clock.setFixedTime(new Date('2026-10-29T09:00:00'));
await page.addInitScript(() => {
  if (!localStorage.getItem('ssam:engine')) localStorage.setItem('ssam:engine', JSON.stringify({ engine: 'claude', keys: { claude: 'sk-test' }, remember: true }));
  if (!localStorage.getItem('ssam:ai-roles')) localStorage.setItem('ssam:ai-roles', JSON.stringify({ review: { engine: 'claude', model: 'claude-opus-5-5' }, tasks: { notes: { main: { engine: 'claude', model: 'claude-haiku-5-5' }, reviewOn: true, review: null } } }));
});
const calls = [];
await page.route('https://api.anthropic.com/**', async route => {
  const body = JSON.parse(route.request().postData());
  const c = body.messages[0].content;
  const prompt = typeof c === 'string' ? c : c.filter(x => x.type === 'text').map(x => x.text).join('\n');
  calls.push({ model: body.model, head: prompt.split('\n')[0], prompt });
  let out = '{}';
  if (prompt.startsWith('[단원평가 피드백]')) {
    const nos = [...prompt.matchAll(/^- (\d+)번 \|/gm)].map(m => Number(m[1]));
    out = JSON.stringify({ students: nos.map(no => ({ no, good: `G${no}`, cheer: `C${no}` })) });
  } else if (prompt.startsWith('[주간학습안내]')) out = JSON.stringify({ days: [0, 1, 2, 3, 4].map(i => ({ prep: i === 0 ? '색연필' : '', safety: i === 0 ? '복도에서 뛰지 않기' : '', homework: '', notice: '' })) });
  else if (prompt.startsWith('[글 검토]')) {
    if (prompt.includes('주간학습안내')) out = JSON.stringify({ items: [{ key: '0', field: 'prep', problem: '수업과 맞지 않음', fix: '색연필, 풀' }] });
    else out = JSON.stringify({ items: [{ key: 5, field: 'cheer', problem: '너무 짧음', fix: 'C5 고침: 다시 읽어 봐요.' }, { key: 2, field: 'good', problem: '근거 없음', fix: 'G2 고침' }, { key: 9, field: 'good', problem: 'x', fix: 'y' }] });
  }
  await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: [{ type: 'content_block_delta', delta: { type: 'text_delta', text: out } }, { type: 'message_delta', delta: { stop_reason: 'end_turn' } }].map(e => 'data: ' + JSON.stringify(e) + '\n\n').join('') }).catch(() => {});
});
const V = 'section[data-menu="evaluate"] .unit-box', C = 'section[data-menu="class"]';
const reviews = () => calls.filter(c => c.head === '[글 검토]');
const T = id => page.evaluate(id => JSON.parse(localStorage.getItem('ssam:unit:t:' + id)), id);
const until = async (fn, ms = 8000) => { const end = Date.now() + ms; while (!(await fn())) { if (Date.now() > end) throw new Error('시간 초과'); await new Promise(r => setTimeout(r, 50)); } };
const tab = async (m, id) => { await page.click(`nav.app-side [data-menu-go="${m}"]`); await page.click(`#menuTabs [data-tab="${id}"]`); };
await page.goto(url);
await page.waitForTimeout(400);
await tab('evaluate', 'unit');
await page.click(`${V} [data-un="sample"]`);
await page.evaluate(() => { const k = 'ssam:unit:t:sample-1', x = JSON.parse(localStorage.getItem(k)); x.students.forEach(s => { if (s.no === 2 || s.no === 5) { s.good = ''; s.cheer = ''; } }); localStorage.setItem(k, JSON.stringify(x)); });
await page.reload(); await page.waitForTimeout(500);
await tab('evaluate', 'unit');
await page.click(`${V} [data-un-open="sample-1"]`);

await run('review-notes', [
  ['잘한 점·격려 쓰기(Haiku) 뒤 검토 1번(Opus): 쓴 학생의 번호·점수·글만', async () => {
    await page.click(`${V} [data-un="fbAI"]`);
    await until(async () => reviews().length === 1 && await page.locator(`${V} .rv-op`).count() === 2);
    assert(calls.filter(c => c.head === '[단원평가 피드백]').every(c => c.model === 'claude-haiku-5-5'), '메인 모델');
    const p = reviews()[0];
    assert(p.model === 'claude-opus-5-5', p.model);
    assert(p.prompt.includes('2 | good') && p.prompt.includes('5 | cheer') && p.prompt.includes('C5') && !p.prompt.includes('1 | good'), p.prompt.slice(0, 500));
    assert(!p.prompt.includes('도서관에서 잔치를 한다.'), '학생 답 글');
    assert((await page.textContent(`${V} .rv-bar`)).includes('검토 의견 2개'), '막대');
    assert(await page.locator(`${V} textarea[data-fb="5-cheer"].rv-mark`).count() === 1, '노란 칸');
  }],
  ['[검토 안 쓰기] → 격려가 고친 글로, 저장', async () => {
    await page.click(`${V} [data-rv-use="5-cheer"]`);
    await until(async () => (await page.inputValue(`${V} textarea[data-fb="5-cheer"]`)) === 'C5 고침: 다시 읽어 봐요.');
    const s = (await T('sample-1')).students.find(x => x.no === 5);
    assert(s.cheer === 'C5 고침: 다시 읽어 봐요.' && s.rv.find(r => r.field === 'cheer').done === 'review', JSON.stringify(s.rv));
  }],
  ['손으로 고치면 그 칸 의견 사라짐', async () => {
    await page.fill(`${V} textarea[data-fb="2-good"]`, '선생님이 고친 잘한 점');
    await page.dispatchEvent(`${V} textarea[data-fb="2-good"]`, 'change');
    await until(async () => !(await page.locator(`${V} .rv-op`).count()));
    const s = (await T('sample-1')).students.find(x => x.no === 2);
    assert(s.good === '선생님이 고친 잘한 점' && !(s.rv || []).some(r => !r.done), JSON.stringify(s.rv));
  }],
  ['주간학습안내 알림 쓰기 뒤 검토 1번 → 월요일 준비물 의견 → [그대로 두기]로 사라짐', async () => {
    await tab('class', 'progress');
    await page.click(`${C} [data-c="sample"]`);
    await tab('class', 'weekly');
    const n = reviews().length;
    await page.click(`${C} [data-w="ai"]`);
    await until(async () => reviews().length === n + 1 && await page.locator(`${C} .rv-op`).count() === 1);
    const p = reviews().at(-1).prompt;
    assert(p.includes('주간학습안내') && p.includes('0 | prep') && p.includes('색연필'), p.slice(0, 400));
    assert(await page.locator(`${C} textarea[data-wn="0-prep"].rv-mark`).count() === 1, '노란 칸');
    await page.click(`${C} [data-rv-keep="0-prep"]`);
    await until(async () => !(await page.locator(`${C} .rv-op`).count()));
    assert((await page.inputValue(`${C} textarea[data-wn="0-prep"]`)) === '색연필', '메인 안');
    assert(!(await page.locator(`${C} textarea[data-wn="0-prep"].rv-mark`).count()), '노란 칸 남음');
  }],
  ['페이지 오류 없음', async () => { assert(errors.length === 0, errors.join(' | ')); }]
]);
await t.close();
