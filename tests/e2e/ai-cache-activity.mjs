// 활동지 채점 AI 요청: 공통 글(cache_control) → 학생 그림 → 학생 글, 공통은 학생마다 같음, 동시 4 이하,
// 한 학생이 한도(429)에 걸려도 쉬었다가 끝까지, 끝나면 「AI 사용량」 줄
import { open, run, assert, mockClaude } from './helpers.mjs';

const t = await open();
const { page, url, errors } = t;
await page.clock.install({ time: new Date('2026-11-03T09:00:00') });
await page.addInitScript(() => {
  if (!localStorage.getItem('ssam:engine')) localStorage.setItem('ssam:engine', JSON.stringify({ engine: 'claude', keys: { claude: 'sk-test' }, remember: true }));
  if (!localStorage.getItem('ssam:activity:set')) localStorage.setItem('ssam:activity:set', JSON.stringify({ pagesPer: 1, maskOn: false, mask: [], maskAll: false }));
});
const reqs = [];
let now = 0, max = 0, rateOnce = 1;
await mockClaude(page, async ({ prompt, content }) => {
  const head = prompt.split('\n')[0];
  if (head === '[쪽 나누기]') return JSON.stringify({ pages: [{ i: 0, role: 'teacher' }] });
  if (head !== '[활동지 채점]') return '{}';
  const n = reqs.push(content);
  now++; max = Math.max(max, now);
  await new Promise(r => setTimeout(r, 120));
  now--;
  if (rateOnce && n === 2) { rateOnce--; return { status: 429 }; }
  return { text: JSON.stringify({ items: [1, 2, 3, 4].map(no => ({ no, read: '', mark: 'n', why: '', sure: true })), good: '', next: '', level: 'ok', levelWhy: '' }), usage: { input_tokens: 200, cache_read_input_tokens: 1500, output_tokens: 300 } };
});
const P = 'section[data-menu="evaluate"]';
const ACT = { id: 'acC1', meta: { subject: '과학', unit: '1', lesson: '2', pages: '12~13쪽', title: '물의 여행', date: '2026-11-03', term: 2 }, sheet: { student: '1. 고르기\n2. 빈칸\n3. 설명\n4. 그리기', teacher: '' },
  items: [{ no: 1, type: 'choice', ask: '고르기', answer: '③', ok: '', part: '', src: 'answer' }, { no: 2, type: 'short', ask: '빈칸', answer: '증발', ok: '', part: '', src: 'answer' }, { no: 3, type: 'write', ask: '설명', answer: '증발·구름·비', ok: '셋 다', part: '일부', src: 'ai' }, { no: 4, type: 'draw', ask: '그리기', answer: '', ok: '바다·구름·비', part: '일부', src: 'ai' }],
  confirmed: true, students: [], done: false, link: null, createdAt: 1 };
const act = () => page.evaluate(() => JSON.parse(localStorage.getItem('ssam:activity:a:acC1')));
const until = async (fn, ms = 10000) => { const end = Date.now() + ms; while (!(await fn())) { if (Date.now() > end) throw new Error('시간 초과'); await new Promise(r => setTimeout(r, 50)); } };
const pngs = n => page.evaluate(async n => {
  const out = [];
  for (let i = 0; i < n; i++) { const c = document.createElement('canvas'); c.width = 300; c.height = 420; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 300, 420); g.fillStyle = '#123'; g.fillRect(30 + i * 7, 90, 140, 30); out.push(c.toDataURL('image/png').split(',')[1]); }
  return out;
}, n);
await page.goto(url);
await page.waitForTimeout(300);
await page.evaluate(a => { localStorage.setItem('ssam:activity:a:acC1', JSON.stringify(a)); localStorage.setItem('ssam:activity:list', JSON.stringify([{ id: 'acC1', title: '물의 여행', subject: '과학', date: '2026-11-03', term: 2, n: 0, done: false, at: 1 }])); }, ACT);
await page.reload(); await page.waitForTimeout(400);

await run('ai-cache-activity', [
  ['채점: 공통 글(cache_control) → 학생 그림 → 학생 글, 공통은 학생마다 같음, 한도에 걸려도 끝까지, 동시 4 이하, 사용량 줄', async () => {
    await page.click('nav.app-side [data-menu-go="evaluate"]'); await page.click('#menuTabs [data-tab="activity"]');
    await page.click(`${P} [data-ac-open="acC1"]`);
    await page.waitForSelector(`${P} [data-bundle-pick="act3"]`);
    await page.setInputFiles('#bundleFile-act3', (await pngs(6)).map((b, i) => ({ name: `스캔${i + 1}.png`, mimeType: 'image/png', buffer: Buffer.from(b, 'base64') })));
    await page.waitForSelector('#sheetRoot #bundleCard');
    await page.click('#sheetRoot #bundleOk');
    await until(async () => (await act()).students.length === 5);
    await page.click(`${P} [data-ac="toGrade"]`);
    await page.click(`${P} [data-ac="grade"]`);
    await page.waitForFunction(s => document.querySelector(s).textContent.includes('AI 한도에 걸려 잠깐 쉬어요'), P, { timeout: 8000 });
    await page.clock.runFor(25000);
    await until(async () => (await act()).students.every(s => s.status === 'done'), 15000);
    assert(!(await page.textContent('#toast')).includes('멈췄어요'), await page.textContent('#toast'));
    assert(reqs.length === 6, '요청 ' + reqs.length);
    assert(reqs.every(c => c.map(x => x.type).join(',') === 'text,image,text' && c[0].cache_control && !c[2].cache_control), reqs.map(c => c.map(x => x.type).join(',')).join(' / '));
    assert(new Set(reqs.map(c => c[0].text)).size === 1, '공통 글이 학생마다 다름');
    assert(reqs.every(c => /바로 위 그림 1장은 한 학생의 활동지/.test(c[2].text)), reqs[0][2].text);
    assert(max >= 3 && max <= 4, '동시 ' + max);
    await page.waitForSelector(`${P} #acAiUse`);
    assert((await page.textContent(`${P} #acAiUse`)).includes('캐시로 싸게'), await page.textContent(`${P} #acAiUse`));
    const u = (await act()).aiUse;
    assert(u && u.sent === 8500 && u.cached === 7500 && u.out === 1500, JSON.stringify(u));
  }],
  ['페이지 오류 없음', async () => { const e = errors.filter(x => !/status of 429/.test(x)); assert(e.length === 0, e.join(' | ')); }]
]);
await t.close();
