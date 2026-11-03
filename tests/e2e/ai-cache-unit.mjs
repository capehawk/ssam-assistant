// 단원평가 채점 AI 요청: 공통 글(cache_control) → 학생 그림 → 학생 글, 공통은 학생마다 같음, 동시 요청 4 이하,
// 한 학생이 한도(429)에 걸려도 쉬었다가 끝까지, 끝나면 「AI 사용량」 줄·새로고침 뒤 「지난 채점」, 한 학생만 다시 채점하면 그 채점 것으로
import { open, run, assert, mockClaude } from './helpers.mjs';
import { SAMPLE_ITEMS } from '../../web/menus/evaluate/unit/unit-sample.js';

const t = await open();
const { page, url, errors } = t;
await page.clock.install({ time: new Date('2026-11-03T09:00:00') });
await page.addInitScript(() => {
  if (!localStorage.getItem('ssam:engine')) localStorage.setItem('ssam:engine', JSON.stringify({ engine: 'claude', keys: { claude: 'sk-test' }, remember: true }));
});
const reqs = [];
let now = 0, max = 0, rate3 = 1, first = true, always429 = false;
await mockClaude(page, async ({ prompt, content }) => {
  if (!prompt.startsWith('[단원평가 채점]')) return '{}';
  reqs.push(content);
  now++; max = Math.max(max, now);
  await new Promise(r => setTimeout(r, 120));
  now--;
  if (always429 || (rate3 && prompt.includes('[학생] 3번'))) { if (!always429) rate3--; return { status: 429 }; }
  const usage = first ? { input_tokens: 300, cache_creation_input_tokens: 2000, output_tokens: 400 } : { input_tokens: 300, cache_read_input_tokens: 2000, output_tokens: 400 };
  first = false;
  return { text: JSON.stringify({ items: SAMPLE_ITEMS.map(it => ({ no: it.no, read: '', points: 0, sure: true, why: '' })) }), usage };
});
const V = 'section[data-menu="evaluate"] .unit-box';
const go = async () => { await page.click('nav.app-side [data-menu-go="evaluate"]'); await page.click('#menuTabs [data-tab="unit"]'); };
const T = id => page.evaluate(id => JSON.parse(localStorage.getItem('ssam:unit:t:' + id)), id);
await page.goto(url);
await page.waitForTimeout(400);
const A = await page.evaluate(async () => {
  const m = await import('./menus/evaluate/unit/unit-model.js'), s = await import('./menus/evaluate/unit/unit-sample.js');
  const x = m.newTest({ meta: { ...s.SAMPLE_META, round: 1, date: '2026-11-03' }, key: { domains: ['지식', '이해'], items: s.SAMPLE_ITEMS }, paper: { text: '평가지 글' } });
  m.saveTest(x);
  localStorage.setItem('ssam:class', JSON.stringify({ count: 5, except: [] }));
  localStorage.setItem('ssam:unit:set', JSON.stringify({ pagesPer: 1, mask: [], maskAll: false, maskOn: false }));
  return x.id;
});
await page.reload(); await page.waitForTimeout(500);
await go();
const shot = async w => ({ name: `답안${w}.png`, mimeType: 'image/png', buffer: await page.screenshot({ clip: { x: 0, y: 0, width: w, height: 300 } }) });
const files = [await shot(300), await shot(301), await shot(302), await shot(303), await shot(304)];
const allDone = () => page.waitForFunction(id => JSON.parse(localStorage.getItem('ssam:unit:t:' + id)).students.every(s => s.status === 'done'), A, { timeout: 15000 });

await run('ai-cache-unit', [
  ['채점: 공통 글(cache_control) → 학생 그림 → 학생 글, 공통 글은 학생마다 같음, 한도에 걸려도 쉬었다가 끝까지, 동시 4 이하', async () => {
    await page.click(`${V} [data-un-open="${A}"]`);
    await page.setInputFiles(`${V} #unAnsFile`, files);
    await page.waitForFunction(() => document.querySelectorAll('.unit-box [data-st]').length === 5);
    await page.click(`${V} [data-un="toGrade"]`);
    await page.click(`${V} [data-un="grade"]`);
    await page.waitForFunction(s => document.querySelector(s).textContent.includes('AI 한도에 걸려 잠깐 쉬어요'), V, { timeout: 8000 });
    await page.clock.runFor(25000);
    await allDone();
    assert(!(await page.textContent('#toast')).includes('멈췄어요'), await page.textContent('#toast'));
    assert(reqs.length === 6, '요청 수 ' + reqs.length);
    const kinds = reqs.map(c => c.map(x => x.type).join(','));
    assert(kinds.every(k => k === 'text,image,text'), kinds.join(' / '));
    assert(reqs.every(c => c[0].cache_control && c[0].cache_control.type === 'ephemeral' && !c[2].cache_control), 'cache_control');
    assert(new Set(reqs.map(c => c[0].text)).size === 1, '공통 글이 학생마다 다름');
    assert(max >= 3 && max <= 4, '동시 ' + max);
  }],
  ['끝나면 「AI 사용량」 줄(캐시 %), 평가에 숫자만 저장, 새로고침 뒤 「지난 채점 AI 사용량」', async () => {
    await page.waitForSelector(`${V} #unAiUse`);
    const line = await page.textContent(`${V} #unAiUse`);
    assert(line.includes('AI 사용량: 보낸 양 약 1.') && line.includes('캐시로 싸게') && line.includes('받은 답 2,000 토큰'), line);
    const u = (await T(A)).aiUse;
    assert(u && u.sent === 11500 && u.cached === 8000 && u.out === 2000 && u.at > 0, JSON.stringify(u));
    await page.reload(); await page.waitForTimeout(500);
    await go();
    await page.click(`${V} [data-un-open="${A}"]`);
    await page.waitForSelector(`${V} #unAiUse`);
    assert((await page.textContent(`${V} #unAiUse`)).startsWith('지난 채점 AI 사용량'), await page.textContent(`${V} #unAiUse`));
  }],
  ['한 학생만 다시 채점하면 사용량 줄이 그 채점 것으로 바뀜', async () => {
    await page.click(`${V} .steps [data-step="2"]`);
    await page.setInputFiles(`${V} #unAnsFile`, files);
    await page.waitForFunction(() => document.querySelectorAll('.unit-box [data-st]').length === 5);
    await page.click(`${V} [data-un="toGrade"]`);
    await page.waitForFunction(s => !document.querySelector(s).textContent.includes('스캔 이미지는 저장하지 않아요'), V); // 다시 올린 스캔을 다 읽음
    await page.click(`${V} [data-un="retry"][data-no="2"]`);
    await page.waitForFunction(id => { const t = JSON.parse(localStorage.getItem('ssam:unit:t:' + id)); return t.aiUse && t.aiUse.sent === 2300; }, A, { timeout: 8000 });
    assert((await page.textContent(`${V} #unAiUse`)).includes('보낸 양 2,300 토큰'), await page.textContent(`${V} #unAiUse`));
  }],
  ['최종 검토 I1: 1명씩인데도 한도가 계속이면 멈추고 [채점 시작]이 다시 보임(「채점하는 중」에 멈추지 않음)', async () => {
    always429 = true;
    await page.click(`${V} .steps [data-step="2"]`);
    await page.setInputFiles(`${V} #unAnsFile`, files);
    await page.waitForFunction(() => document.querySelectorAll('.unit-box [data-st]').length === 5);
    await page.click(`${V} [data-un="toGrade"]`);
    await page.waitForFunction(s => !document.querySelector(s).textContent.includes('스캔 이미지는 저장하지 않아요'), V);
    await page.evaluate(id => { const t = JSON.parse(localStorage.getItem('ssam:unit:t:' + id)); t.students.forEach(s => { s.status = ''; }); localStorage.setItem('ssam:unit:t:' + id, JSON.stringify(t)); }, A);
    await page.click(`${V} .steps [data-step="2"]`); await page.click(`${V} [data-un="toGrade"]`);
    await page.click(`${V} [data-un="grade"]`);
    for (let k = 0; k < 6 && !(await page.textContent('#toast')).includes('멈췄어요'); k++) { await page.waitForTimeout(300); await page.clock.runFor(25000); }
    await page.waitForTimeout(300);
    assert((await page.textContent('#toast')).includes('멈췄어요'), await page.textContent('#toast'));
    assert(await page.isVisible(`${V} [data-un="grade"]`) && !(await page.textContent(V)).includes('채점하는 중'), (await page.textContent(V)).slice(0, 200));
    always429 = false;
  }],
  // 일부러 보낸 429는 브라우저가 콘솔에 적으므로 그 줄만 뺌
  ['페이지 오류 없음', async () => { const e = errors.filter(x => !/status of 429/.test(x)); assert(e.length === 0, e.join(' | ')); }]
]);
await t.close();
