// 계획 초안 검토: 초안(메인 Haiku) 뒤 검토 AI(Opus)가 초안 전체를 한 번 봄 → 칸마다 두 의견,
// [검토 안 쓰기]로 칸 글이 고친 글로, [그대로 두기]로 의견 사라짐, 칸을 손으로 고치면 그 칸 의견 사라짐, 검토를 끄면 요청 없음
import { open, run, assert } from './helpers.mjs';

const t = await open();
const { page, url, errors } = t;
await page.clock.setFixedTime(new Date('2026-10-29T09:00:00'));
await page.addInitScript(() => {
  if (!localStorage.getItem('ssam:engine')) localStorage.setItem('ssam:engine', JSON.stringify({ engine: 'claude', keys: { claude: 'sk-test' }, remember: true }));
  if (!localStorage.getItem('ssam:ai-roles')) localStorage.setItem('ssam:ai-roles', JSON.stringify({ review: null, tasks: { plan: { main: { engine: 'claude', model: 'claude-haiku-5-5' }, reviewOn: true, review: { engine: 'claude', model: 'claude-opus-5-5' } } } }));
});
const calls = [];
await page.route('https://api.anthropic.com/**', async route => {
  const body = JSON.parse(route.request().postData());
  const c = body.messages[0].content;
  const prompt = typeof c === 'string' ? c : c.find(x => x.type === 'text').text;
  calls.push({ model: body.model, head: prompt.split('\n')[0], prompt });
  let out = '{}';
  if (prompt.startsWith('[연간계획 초안]')) out = JSON.stringify({ purpose: '책 읽는 습관을 기른다.', policy: '2025년 3월부터 운영한다.', details: '가. 아침 독서', schedule: [], budget: [], evaluation: '설문으로 평가한다.' });
  else if (prompt.startsWith('[학급운영계획 지침]')) out = '[]';
  else if (prompt.startsWith('[학급운영계획 초안]')) {
    const secs = [...prompt.matchAll(/^ {2}- \[(\S+)\] ([^(\n]+)/gm)].map(m => [m[1], m[2].trim()]);
    out = JSON.stringify({ sections: Object.fromEntries(secs.map(([id, ti]) => [id, `${ti}을(를) OO반에 맞게 운영한다.`])), monthly: [] });
  } else if (prompt.startsWith('[행사 문서]')) out = JSON.stringify({ plan: '가. 개요\n운동회를 한다.', roles: [], safety: '- 구급함 준비', letter: '운동회 안내입니다.', rain: '' });
  else if (prompt.startsWith('[계획 검토]')) {
    const keys = [...prompt.split('[초안]')[1].matchAll(/^\[(\S+)\] /gm)].map(m => m[1]);
    if (keys.includes('policy')) out = JSON.stringify({ items: [{ section: 'policy', problem: '작년 날짜가 남음', fix: '2027년 3월부터 운영한다.' }, { section: 'evaluation', problem: '평가 방법이 하나뿐', fix: '설문과 대출 기록으로 평가한다.' }, { section: 'zzz', problem: 'x', fix: 'y' }] });
    else if (keys.includes('letter')) out = JSON.stringify({ items: [{ section: 'letter', problem: '날짜·준비물이 빠짐', fix: '10월 30일(금) 운동회를 해요. 준비물: 물, 모자. 문의: 교무실' }] });
    else out = JSON.stringify({ items: [{ section: keys[0], problem: 'OO가 남음', fix: '3학년 1반에 맞게 운영한다.' }] });
  }
  await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: [{ type: 'content_block_delta', delta: { type: 'text_delta', text: out } }, { type: 'message_delta', delta: { stop_reason: 'end_turn' } }].map(e => 'data: ' + JSON.stringify(e) + '\n\n').join('') }).catch(() => {});
});
const P = 'section[data-menu="plan"]';
const reviews = () => calls.filter(c => c.head === '[계획 검토]');
const until = async (fn, ms = 8000) => { const end = Date.now() + ms; while (!(await fn())) { if (Date.now() > end) throw new Error('시간 초과'); await new Promise(r => setTimeout(r, 50)); } };
await page.goto(url);
await page.waitForTimeout(400);
const ids = await page.evaluate(async () => {
  const y = await import('./menus/plan/year-model.js'), c = await import('./menus/plan/classplan-model.js'), e = await import('./menus/plan/event-model.js');
  const p = y.newPlan(); Object.assign(p, { name: '독서 교육', year: 2027, goal: '책 읽는 학교', step: 4, maxStep: 4, guide: [{ item: '아침 독서', keywords: ['아침'], sentence: '매일 아침 독서 20분을 운영한다.', section: 'details' }] });
  y.savePlan(p); y.setCurrent(p.id);
  const q = c.newPlan(); Object.assign(q, { year: 2027, grade: 3, room: 1, step: 3, maxStep: 3, outline: c.STANDARD.slice(0, 3) });
  c.savePlan(q); c.setCurrent(q.id);
  const v = e.newEvent(); Object.assign(v, { name: '가을 운동회', purpose: '체력', grades: '전 학년', date: '2027-10-30', place: '운동장', step: 3, maxStep: 3 });
  e.saveEvent(v); e.setCurrentEvent(v.id);
  return { year: p.id, cls: q.id, ev: v.id };
});
await page.reload(); await page.waitForTimeout(500);
const yearPlan = () => page.evaluate(id => JSON.parse(localStorage.getItem('ssam:plan:year')).find(p => p.id === id) || null, ids.year).catch(() => null);
const tab = async id => { await page.click('nav.app-side [data-menu-go="plan"]'); await page.click(`#menuTabs [data-tab="${id}"]`); };

await run('review-plan', [
  ['연간계획 초안 → 검토 요청 1번(Opus, 지침 요약 포함), 초안은 Haiku', async () => {
    await tab('year');
    await page.click(`${P} [data-y="draft"]`);
    await until(async () => reviews().length === 1 && await page.locator(`${P} .rv-op`).count() === 2);
    const d = calls.find(c => c.head === '[연간계획 초안]');
    assert(d.model === 'claude-haiku-5-5', d.model);
    const r = reviews()[0];
    assert(r.model === 'claude-opus-5-5' && r.prompt.includes('매일 아침 독서 20분') && r.prompt.includes('2025년 3월부터 운영한다.'), r.prompt.slice(0, 400));
    assert((await page.textContent(`${P} .rv-bar`)).includes('검토 의견 2개'), '막대');
    assert(await page.locator(`${P} textarea[data-sec="policy"].rv-mark`).count() === 1, '노란 칸');
  }],
  ['[검토 안 쓰기] → 칸 글이 고친 글, [그대로 두기] → 의견 사라짐, 저장', async () => {
    await page.click(`${P} [data-rv-use="policy"]`);
    await until(async () => (await page.inputValue(`${P} textarea[data-sec="policy"]`)) === '2027년 3월부터 운영한다.');
    await page.click(`${P} [data-rv-keep="evaluation"]`);
    await until(async () => !(await page.locator(`${P} .rv-op`).count()));
    assert((await page.inputValue(`${P} textarea[data-sec="evaluation"]`)) === '설문으로 평가한다.', '메인 안 그대로');
    await page.waitForTimeout(700);
    const st = await page.evaluate(id => { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (!k.startsWith('ssam:')) continue; const v = localStorage.getItem(k); if (v.includes(id) && v.includes('"rv"')) return v; } return ''; }, ids.year);
    assert(st.includes('2027년 3월부터 운영한다.') && st.includes('"done":"review"') && st.includes('"done":"main"'), st.slice(0, 300));
  }],
  ['학급운영계획 초안 → 검토 1번 → 의견 → 그 칸을 손으로 고치면 의견 사라짐', async () => {
    await tab('class');
    const n = reviews().length;
    await page.click(`${P} .cp-box [data-c="draft"]`);
    await until(async () => reviews().length === n + 1 && await page.locator(`${P} .cp-box .rv-op`).count() === 1);
    const sec = await page.getAttribute(`${P} .cp-box [data-rv-use]`, 'data-rv-use');
    const ta = `${P} .cp-box textarea[data-sec="${sec}"]`;
    assert(await page.locator(`${ta}.rv-mark`).count() === 1, '노란 칸');
    await page.fill(ta, '손으로 고친 글');
    await until(async () => !(await page.locator(`${P} .cp-box .rv-op`).count()));
    assert(!(await page.locator(`${ta}.rv-mark`).count()), '노란 칸 남음');
  }],
  ['행사 문서 → 검토 1번 → 가정통신문 의견 → [검토 안 쓰기]', async () => {
    await tab('event');
    const n = reviews().length;
    await page.click(`${P} [data-e="docs"]`);
    await until(async () => reviews().length === n + 1 && await page.locator(`${P} .rv-op`).count() === 1);
    assert(reviews().at(-1).prompt.includes('운동회 안내입니다.'), '문서 글');
    await page.click(`${P} [data-rv-use="letter"]`);
    await until(async () => !(await page.locator(`${P} .rv-op`).count()));
    const ev = await page.evaluate(id => { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); const v = localStorage.getItem(k); if (k.startsWith('ssam:') && v.includes(id) && v.includes('"docs"')) return JSON.parse(v); } return null; }, ids.ev);
    const e = (Array.isArray(ev) ? ev : [ev]).find(x => x && x.id === ids.ev);
    assert(e.docs.letter.startsWith('10월 30일(금) 운동회를 해요.'), JSON.stringify(e.docs));
  }],
  ['계획 검토를 끄면 초안 뒤 검토 요청 없음', async () => {
    await page.evaluate(() => { const r = JSON.parse(localStorage.getItem('ssam:ai-roles')); r.tasks.plan.reviewOn = false; localStorage.setItem('ssam:ai-roles', JSON.stringify(r)); });
    await tab('year');
    const n = reviews().length, m = calls.length;
    await page.click(`${P} [data-y="draft"]`);
    await until(async () => calls.length > m && await page.locator(`${P} textarea[data-sec="policy"]`).count() === 1);
    await page.waitForTimeout(500);
    assert(reviews().length === n, '검토 요청');
    assert(!(await page.locator(`${P} .rv-op`).count()), '의견');
  }],
  ['페이지 오류 없음', async () => { assert(errors.length === 0, errors.join(' | ')); }]
]);
await t.close();
