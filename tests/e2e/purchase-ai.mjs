// 업무별 AI 「품의」: AI 줄(품의 모델), 초안·넣기 요청이 품의 AI로, 다른 업무는 기본 AI
// 검토를 켜면 초안 뒤 [품의 검토] 한 번 → 제목·첫 문장 두 의견, [검토 안 쓰기]면 첫 문장만 바뀜(가~붙임 그대로),
// 손으로 고치면 의견 사라짐, 검토 실패면 초안 그대로 「검토하지 못했어요」, 강사 칸 글은 검토에도 안 보냄, 설정 › AI 5줄
import { open, run, assert } from './helpers.mjs';

const t = await open();
const { page, url, errors } = t;
// 품의 칸을 다루는 시험: [자세히 고치기]를 펼친 채로 (처음 화면은 purchase-oneshot.mjs)
await page.addInitScript(() => { if (!localStorage.getItem('ssam:purchase:view')) localStorage.setItem('ssam:purchase:view', JSON.stringify('full')); });
const HAIKU = { engine: 'claude', model: 'claude-haiku-5-5' }, OPUS = { engine: 'claude', model: 'claude-opus-5-5' };
await page.addInitScript(() => {
  if (!localStorage.getItem('ssam:engine')) localStorage.setItem('ssam:engine', JSON.stringify({ engine: 'claude', keys: { claude: 'sk-test' }, remember: true }));
});
const calls = [];
let rvFail = false;
await page.route('https://api.anthropic.com/**', async route => {
  const body = JSON.parse(route.request().postData());
  const c = body.messages[0].content;
  const prompt = typeof c === 'string' ? c : c.filter(x => x.type === 'text').map(x => x.text).join('\n');
  const head = prompt.split('\n')[0];
  calls.push({ model: body.model, head, prompt });
  if (head === '[품의 검토]' && rvFail) { await route.fulfill({ status: 401, body: JSON.stringify({ error: { type: 'authentication_error', message: 'bad key' } }) }).catch(() => {}); return; }
  let out = JSON.stringify({ title: '3학년 1반 교실 물품 구입 30,000원', intro: '교실 물품을 30,000원에 다음과 같이 구입하고자 합니다.' });
  if (head === '[품의 넣기]') out = JSON.stringify({ items: [{ name: '칭찬 도장', spec: '', unit: '개', qty: 1, price: 5000, vendor: '' }], shipping: [], fields: {} });
  else if (head === '[품의 검토]') out = JSON.stringify({ items: [{ field: 'title', problem: '제목에 금액을 씀', fix: '3학년 1반 교실 물품 구입' }, { field: 'intro', problem: '문장에 금액을 씀', fix: '교실 물품을 다음과 같이 구입하고자 합니다.' }, { field: 'reason', problem: 'x', fix: 'y' }] });
  await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: [{ type: 'content_block_delta', delta: { type: 'text_delta', text: out } }, { type: 'message_delta', delta: { stop_reason: 'end_turn' } }].map(e => 'data: ' + JSON.stringify(e) + '\n\n').join('') }).catch(() => {});
});
const P = 'section[data-menu="purchase"]';
const until = async (fn, ms = 8000) => { const end = Date.now() + ms; while (!(await fn())) { if (Date.now() > end) throw new Error('시간 초과'); await new Promise(r => setTimeout(r, 50)); } };
const reviews = () => calls.filter(c => c.head === '[품의 검토]');
const setRoles = r => page.evaluate(r => localStorage.setItem('ssam:ai-roles', JSON.stringify(r)), r);
const fresh = (type = 'goods', items = [{ name: '실험 재료', spec: '', unit: '개', qty: '10', price: '3000' }]) => page.evaluate(([type, items]) => localStorage.setItem('ssam:purchase:current', JSON.stringify({ form: { type, project: '교실 물품', purpose: '수업 준비', date: '2026-11-10', target: '3학년 1반', items }, draft: null })), [type, items]);
const go = async () => { await page.reload(); await page.waitForTimeout(400); await page.click('nav.app-side [data-menu-go="purchase"]'); await page.click('#menuTabs [data-tab="new"]'); await page.waitForSelector(`${P} #pcIntake`); };
const draft = async () => { await page.click(`${P} [data-pc="draft"]`); await page.waitForFunction(s => document.querySelector(`${s} #pcReason`), P, { timeout: 8000 }); };
await page.goto(url);
await page.waitForTimeout(300);

await run('purchase-ai', [
  ['품의 AI = Haiku: AI 줄에 Haiku, 초안·넣기 요청 모델 Haiku, 검토 끔이면 검토 요청 없음', async () => {
    await setRoles({ review: null, tasks: { purchase: { main: HAIKU, reviewOn: false, review: null } } });
    await fresh(); await go();
    await page.waitForFunction(s => (document.querySelector(`${s} [data-ai-row="purchase"] .ai-row-t`) || {}).textContent === 'AI: Claude Haiku 5.5 · 검토 끔', P);
    await draft();
    const d = calls.at(-1);
    assert(d.model === 'claude-haiku-5-5' && d.head === '[품의 초안]', d.model + ' ' + d.head);
    await page.fill(`${P} #pcIntake`, '칭찬 도장 좀 사고');
    await page.click(`${P} [data-pc="intake"]`);
    await until(async () => calls.some(c => c.head === '[품의 넣기]'));
    assert(calls.find(c => c.head === '[품의 넣기]').model === 'claude-haiku-5-5', '넣기 모델');
    await page.waitForTimeout(300);
    assert(reviews().length === 0, '검토 요청');
  }],
  ['다른 업무(계획)는 기본 AI 그대로', async () => {
    const m = await page.evaluate(async () => { const r = await import('./core/ai-roles.js'); return [r.pick('plan', 'main'), r.pick('purchase', 'main')]; });
    assert(m[0] === null && m[1].model === 'claude-haiku-5-5', JSON.stringify(m));
  }],
  ['검토 켬(Opus): 초안 뒤 [품의 검토] 1번(Opus, 메모·제목·첫 문장) → 제목·첫 문장 두 의견', async () => {
    await setRoles({ review: null, tasks: { purchase: { main: HAIKU, reviewOn: true, review: OPUS } } });
    await fresh(); await go();
    calls.length = 0;
    await draft();
    await until(async () => reviews().length === 1 && await page.locator(`${P} .rv-op`).count() === 2);
    const r = reviews()[0];
    assert(r.model === 'claude-opus-5-5' && r.prompt.includes('3학년 1반 교실 물품 구입 30,000원') && r.prompt.includes('실험 재료') && r.prompt.includes('교실 물품을 30,000원에'), r.prompt.slice(0, 500));
    assert(await page.locator(`${P} #pcRvTitle .rv-op`).count() === 1 && await page.locator(`${P} #pcRvIntro .rv-op`).count() === 1, '자리');
  }],
  ['첫 문장 [검토 안 쓰기] → 사유 첫 문장만 고친 문장으로(가~붙임 그대로), 의견 사라짐', async () => {
    const before = await page.inputValue(`${P} #pcReason`);
    await page.click(`${P} #pcRvIntro [data-rv-use="intro"]`);
    const after = await page.inputValue(`${P} #pcReason`);
    assert(after.startsWith('교실 물품을 다음과 같이 구입하고자 합니다.\n\n'), after.slice(0, 60));
    assert(after.slice(after.indexOf('\n\n')) === before.slice(before.indexOf('\n\n')), '가~붙임이 바뀜');
    assert(await page.locator(`${P} #pcRvIntro .rv-op`).count() === 0, '의견이 남음');
    const cur = await page.evaluate(() => JSON.parse(localStorage.getItem('ssam:purchase:current')).draft);
    assert(cur.intro === '교실 물품을 다음과 같이 구입하고자 합니다.' && cur.edited === false, JSON.stringify(cur));
    // 그 뒤 품목이 바뀌어도 가~붙임은 다시 맞춰지고 첫 문장은 고친 문장 그대로
    await page.fill(`${P} [data-item="0"][data-f="qty"]`, '20');
    await page.waitForTimeout(150);
    const r2 = await page.inputValue(`${P} #pcReason`);
    assert(r2.startsWith('교실 물품을 다음과 같이 구입하고자 합니다.') && r2.includes('금60,000원'), r2);
  }],
  ['제목 칸을 손으로 고치면 제목 의견 사라짐(새로고침 뒤에도)', async () => {
    await page.fill(`${P} #pcTitle`, '교실 물품 구입');
    await page.waitForFunction(s => !document.querySelector(`${s} #pcRvTitle .rv-op`), P);
    await page.reload(); await page.waitForTimeout(400);
    await page.click('nav.app-side [data-menu-go="purchase"]'); await page.click('#menuTabs [data-tab="new"]');
    await page.waitForSelector(`${P} #pcTitle`);
    assert(await page.locator(`${P} .rv-op`).count() === 0, '의견이 돌아옴');
    assert(await page.inputValue(`${P} #pcTitle`) === '교실 물품 구입', '제목');
  }],
  ['검토 실패(401) → 초안 그대로, 「검토하지 못했어요」', async () => {
    rvFail = true;
    await fresh(); await go();
    calls.length = 0;
    await draft();
    await page.waitForFunction(s => (document.querySelector(`${s} #pcDraftCard`) || {}).textContent.includes('검토하지 못했어요'), P);
    assert(reviews().length === 1, '검토 요청 수');
    assert(await page.inputValue(`${P} #pcTitle`) === '3학년 1반 교실 물품 구입 30,000원', '초안');
    assert(await page.locator(`${P} .rv-op`).count() === 0, '의견');
    rvFail = false;
  }],
  ['강사 수당: 검토 프롬프트에도 강사 칸 글 없음', async () => {
    await fresh('lecturer', [{ name: '김강사', spec: '', unit: '시간', qty: '2', price: '100000' }]); await go();
    calls.length = 0;
    await draft();
    await until(async () => reviews().length === 1);
    assert(!reviews()[0].prompt.includes('김강사') && reviews()[0].prompt.includes('강사 1명'), reviews()[0].prompt.slice(0, 400));
  }],
  ['설정 › AI 업무별 한눈에 8줄(품의 줄에 Haiku·검토 Opus, 쪽지·결과 보고 줄)', async () => {
    await page.click('nav.app-side [data-menu-go="settings"]'); await page.click('#menuTabs [data-tab="ai"]');
    await page.waitForSelector('#setRoleList li');
    assert(await page.locator('#setRoleList li').count() === 8, '줄 수');
    assert((await page.textContent('#setRoleList li:nth-child(6)')).includes('쪽지'), '쪽지 줄');
    assert((await page.textContent('#setRoleList li:nth-child(7)')).includes('결과 보고'), '결과 보고 줄');
    const t5 = await page.textContent('#setRoleList li:nth-child(5)');
    assert(t5.includes('품의') && t5.includes('Haiku') && t5.includes('검토: Claude Opus 5.5'), t5);
  }],
  ['페이지 오류 없음', async () => { const bad = errors.filter(e => !/status of 401/.test(e)); assert(bad.length === 0, bad.join(' | ')); }]
]);
await t.close();
