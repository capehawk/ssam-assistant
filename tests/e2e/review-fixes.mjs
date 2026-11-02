// 검토 고침(최종 검토): 검토하는 동안에도 메인 결과는 먼저 저장(창을 닫아도 남음),
// 검토는 이번에 쓴 것만(검토를 켜기 전에 쓴 문장은 다시 보지 않음), 창체 [멈추기]면 검토하지 않음
import { open, run, assert } from './helpers.mjs';

const t = await open();
const { page, url, errors } = t;
await page.addInitScript(() => {
  if (!localStorage.getItem('ssam:engine')) localStorage.setItem('ssam:engine', JSON.stringify({ engine: 'claude', keys: { claude: 'sk-test' }, remember: true }));
  if (!localStorage.getItem('ssam:ai-roles')) localStorage.setItem('ssam:ai-roles', JSON.stringify({ review: null, tasks: { writing: { main: null, reviewOn: false, review: { engine: 'claude', model: 'claude-opus-5-5' } } } }));
  if (!localStorage.getItem('ssam:hk')) localStorage.setItem('ssam:hk', JSON.stringify({ settings: {}, students: [{ id: 'a', no: 1, label: '', memo: '우유 당번을 성실히 함', done: 0, results: [] }] }));
});
const calls = [];
let seq = 0, slowReview = 0, slowMain = 0;
const syl = n => String.fromCharCode(0xAC00 + (n % 399) * 28);
const long = j => `학급 일에 책임감을 가지고 참여하며 ${j}번째로 친구를 돕는 모습이 돋보임. `.repeat(7).trim();
await page.route('https://api.anthropic.com/**', async route => {
  const body = JSON.parse(route.request().postData());
  const c = body.messages[0].content;
  const prompt = typeof c === 'string' ? c : c.find(x => x.type === 'text').text;
  const rec = { model: body.model, head: prompt.split('\n')[0], prompt, done: false };
  calls.push(rec);
  let out;
  if (prompt.startsWith('[문장 검토]')) { if (slowReview) await new Promise(r => setTimeout(r, slowReview)); out = '{"items":[]}'; }
  else if (prompt.startsWith('아래 행동특성 및 종합의견을')) out = long(9);
  else if (prompt.includes('행동특성 및 종합의견을')) out = [long(1), long(2)].join('\n');
  else if (/학생 (\d+)명에게/.test(prompt) || prompt.includes('창의적 체험활동')) {
    if (slowMain) await new Promise(r => setTimeout(r, slowMain));
    seq++; const n = +(prompt.match(/학생 (\d+)명에게/) || [])[1] || 3;
    out = Array.from({ length: n }, (_, j) => `${syl(seq * 13 + j)}${syl(j + 5)} 교실을 깨끗하게 하는 방법을 정해 꾸준히 실천함.`).join('\n');
  } else { seq++; out = Array.from({ length: 60 }, (_, j) => `${syl(seq * 61 + j)}${syl(j * 7 + seq)} 장면을 생활과 연결하여 감상을 근거와 함께 씀.`).join('\n'); }
  rec.done = true;
  await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: [{ type: 'content_block_delta', delta: { type: 'text_delta', text: out } }, { type: 'message_delta', delta: { stop_reason: 'end_turn' } }].map(e => 'data: ' + JSON.stringify(e) + '\n\n').join('') }).catch(() => {});
});
const reviews = () => calls.filter(c => c.head === '[문장 검토]');
const sentOf = p => [...p.split('[문장]')[1].split('[살펴볼 것]')[0].matchAll(/^\d+\. (.+)$/gm)].map(m => m[1]);
const until = async (fn, ms = 15000) => { const end = Date.now() + ms; while (!(await fn())) { if (Date.now() > end) throw new Error('시간 초과 · ' + calls.length); await new Promise(r => setTimeout(r, 80)); } };
const reviewOn = on => page.evaluate(on => { const r = JSON.parse(localStorage.getItem('ssam:ai-roles')); r.tasks.writing.reviewOn = on; localStorage.setItem('ssam:ai-roles', JSON.stringify(r)); }, on);
const savedSets = () => page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('ssam:sets:')).map(k => localStorage.getItem(k)).join(''));
await page.goto(url);
await page.waitForTimeout(500);

await run('review-fixes', [
  ['검토를 끈 채 교과 평어 50문장(수준 4개) → 검토 요청 없음', async () => {
    await page.click('nav.app-side [data-menu-go="evaluate"]'); await page.click('#menuTabs [data-tab="pyeongeo"]');
    await page.click('#srcPaste');
    await page.fill('#pasteBox', await page.getAttribute('#pasteBox', 'placeholder'));
    await page.click('#pasteGo');
    await page.keyboard.press('Escape');
    await page.waitForSelector('#units .unit');
    await page.click('#units .unit');
    await page.click('#pane [data-act="genUnit"]');
    await until(async () => calls.length >= 4 && await page.locator('#listBox .sent').count() === 50 && !(await page.locator('#listBox .skel').count()));
    await page.waitForTimeout(500);
    assert(reviews().length === 0, '검토 요청 ' + reviews().length);
  }],
  ['검토를 켜고 [10개 더] → 새 10문장만 검토 1번, 검토가 끝나기 전에 새 문장이 이미 저장됨', async () => {
    await reviewOn(true);
    slowReview = 2500;
    const old = new Set(await page.$$eval('#listBox .sent .t', els => els.map(e => e.textContent)));
    await page.click('#pane [data-act="more"]');
    await until(async () => reviews().length >= 1);
    await page.waitForTimeout(900);
    assert(!reviews()[0].done, '검토가 이미 끝남(시험이 느린 검토를 기다리지 못함)');
    const fresh = sentOf(reviews()[0].prompt);
    assert(fresh.length === 10 && fresh.every(x => !old.has(x)), `보낸 문장 ${fresh.length}개, 지난 문장 ${fresh.filter(x => old.has(x)).length}개`);
    const st = await savedSets();
    assert(fresh.every(x => st.includes(x)), '검토하는 동안 새 문장이 저장되지 않음');
    await until(async () => reviews().every(r => r.done));
    await page.waitForTimeout(400);
    assert(reviews().length === 1, '검토 요청 ' + reviews().length);
    slowReview = 0;
  }],
  ['행특: 검토하는 동안에도 후보가 이미 저장됨', async () => {
    slowReview = 2500;
    await page.click('#menuTabs [data-tab="hk"]');
    await page.waitForTimeout(300);
    if (!(await page.locator('#hkList [data-hkstu]').count())) { await page.fill('#hkCount', '1'); await page.click('#hkList [data-hk="roster"]'); }
    await page.click('#hkList [data-hkstu]');
    await page.waitForSelector('#hkMemo');
    if (!(await page.inputValue('#hkMemo'))) { await page.fill('#hkMemo', '우유 당번을 성실히 함'); await page.waitForTimeout(500); }
    const n = reviews().length;
    await page.click('#hkEditor [data-hk="gen"]');
    await until(async () => reviews().length === n + 1);
    await page.waitForTimeout(900);
    assert(!reviews().at(-1).done, '검토가 이미 끝남');
    const hk = await page.evaluate(() => JSON.parse(localStorage.getItem('ssam:hk')));
    assert(hk.students.some(s => (s.results || []).length === 2), '검토하는 동안 후보가 저장되지 않음');
    await until(async () => reviews().every(r => r.done));
    slowReview = 0;
  }],
  ['창체: 검토를 끈 채 3명 → 켜고 2번만 다시 쓰기 → 그 문장 하나만 검토', async () => {
    await reviewOn(false);
    await page.evaluate(() => window.SSAM.setMode('cc'));
    await page.fill('#ccSetup [data-cls="count"]', '3'); await page.press('#ccSetup [data-cls="count"]', 'Tab');
    await page.fill('[data-ccf="name"][data-cck="auto"]', '교실 환경 지킴이');
    await page.fill('[data-ccf="desc"][data-cck="auto"]', '교실을 깨끗하게 하는 방법을 정해 실천함');
    await page.click('#ccGrade');
    await page.click('[data-cc="gen"]');
    await until(async () => await page.locator('#ccResults [data-ccre]').count() === 3 && !(await page.locator('#ccResults .chip.run').count()));
    await page.waitForTimeout(400);
    const n = reviews().length;
    assert(n === reviews().length, '');
    await reviewOn(true);
    await page.click('#ccResults [data-ccre="2"]');
    await until(async () => reviews().length === n + 1);
    await until(async () => reviews().every(r => r.done));
    await page.waitForTimeout(400);
    const s = sentOf(reviews().at(-1).prompt);
    assert(reviews().length === n + 1 && s.length === 1, `검토 ${reviews().length - n}번, 문장 ${s.length}개`);
  }],
  ['창체 [멈추기]로 멈추면 검토하지 않음', async () => {
    slowMain = 1500;
    const n = reviews().length;
    await page.click('#ccResults [data-cc="fresh"]');
    await page.click('#sheetRoot #ccFreshGo');
    await page.waitForSelector('#ccResults [data-cc="stop"]');
    await page.click('#ccResults [data-cc="stop"]');
    await page.waitForTimeout(2500);
    assert(reviews().length === n, `멈춘 뒤 검토 ${reviews().length - n}번`);
    slowMain = 0;
  }],
  ['페이지 오류 없음', async () => { assert(errors.length === 0, errors.join(' | ')); }]
]);
await t.close();
