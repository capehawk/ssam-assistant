// 최종 검토에서 고친 것(품의 화면): 넣기·종류 바꾸기 뒤에도 사유 다시 맞춤, 첫 문장만 고치면 계속 맞춤,
// 초안 쓰는 중 [새로 쓰기] → 쓰던 품의와 초안은 최근 작성에, 떠 있는 버튼 「새 품의로」는 새 품의,
// 목적만 써도 바꾸기 전에 물어봄([새로 쓰기]도), 엑셀 칸 붙여넣기(그림이 같이 와도 글로), 개인정보 줄 안내
import { join } from 'node:path';
import { open, run, assert } from './helpers.mjs';

const ROOT = join(import.meta.dirname, '..', '..');
const t = await open();
const { page, url, errors } = t;
await page.addInitScript(() => {
  if (!localStorage.getItem('ssam:engine')) localStorage.setItem('ssam:engine', JSON.stringify({ engine: 'claude', keys: { claude: 'sk-test' }, remember: true }));
});
const calls = [];
let slow = 0;
await page.route('https://api.anthropic.com/**', async route => {
  const body = JSON.parse(route.request().postData());
  const c = body.messages[0].content;
  const prompt = typeof c === 'string' ? c : c.find(x => x.type === 'text').text;
  const head = prompt.split('\n')[0];
  calls.push({ head, prompt, images: typeof c === 'string' ? 0 : c.filter(x => x.type === 'image').length });
  let out = JSON.stringify({ title: '교실 물품 구입', intro: '교실 물품을 다음과 같이 구입하고자 합니다.' });
  if (head === '[품의 넣기]') out = JSON.stringify({ items: [{ name: '칭찬 스티커', spec: '', unit: '장', qty: 10, price: 500, vendor: '' }], shipping: [], fields: {} });
  else if (slow) await new Promise(r => setTimeout(r, slow));
  await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: [{ type: 'content_block_delta', delta: { type: 'text_delta', text: out } }, { type: 'message_delta', delta: { stop_reason: 'end_turn' } }].map(e => 'data: ' + JSON.stringify(e) + '\n\n').join('') }).catch(() => {});
});
const P = 'section[data-menu="purchase"]';
const until = async (fn, ms = 8000) => { const end = Date.now() + ms; while (!(await fn())) { if (Date.now() > end) throw new Error('시간 초과'); await new Promise(r => setTimeout(r, 50)); } };
const cur = () => page.evaluate(() => JSON.parse(localStorage.getItem('ssam:purchase:current')));
const recent = () => page.evaluate(() => JSON.parse(localStorage.getItem('ssam:purchase:recent') || '[]'));
const fresh = (form = {}) => page.evaluate(form => localStorage.setItem('ssam:purchase:current', JSON.stringify({ id: 'pcA', form: { type: 'goods', project: '교실 물품', purpose: '수업 준비', date: '2026-11-10', target: '3학년 1반', items: [{ name: '실험 재료', spec: '', unit: '개', qty: '10', price: '3000' }], ...form }, draft: null })), form);
const go = async () => { await page.reload(); await page.waitForTimeout(400); await page.click('nav.app-side [data-menu-go="purchase"]'); await page.click('#menuTabs [data-tab="new"]'); await page.waitForSelector(`${P} #pcIntake`); };
const draft = async () => { await page.click(`${P} [data-pc="draft"]`); await page.waitForFunction(s => document.querySelector(`${s} #pcReason`), P, { timeout: 8000 }); };
const reason = () => page.inputValue(`${P} #pcReason`);
const tailOk = () => page.evaluate(async () => { const r = await import('./menus/purchase/rules.js'); const c = JSON.parse(localStorage.getItem('ssam:purchase:current')); return c.draft.reason.endsWith(r.reasonTail(c.form)) && document.querySelector('#pcReason').value === c.draft.reason; });
await page.goto(url);
await page.waitForTimeout(300);

await run('purchase-fixes', [
  ['초안 뒤 넣기 칸으로 품목을 더하면 사유(소요 예산)도 다시 맞춤', async () => {
    await fresh(); await go(); await draft();
    assert((await reason()).includes('금30,000원'), await reason());
    await page.fill(`${P} #pcIntake`, 'A4 용지 5박스 2만원');
    await page.click(`${P} [data-pc="intake"]`);
    await page.waitForSelector('#sheetRoot #pcMergeAdd');
    await page.click('#sheetRoot #pcMergeAdd');
    await until(async () => (await reason()).includes('금130,000원'));
    assert(await tailOk(), '저장된 사유');
    assert(!(await page.$(`${P} [data-pc="resync"]`)), '다시 맞추기 단추');
  }],
  ['종류를 바꾸면 사유(붙임)도 다시 맞춤', async () => {
    await page.click(`${P} [data-pctype="event"]`);
    await until(async () => (await reason()).includes('행사 계획서'));
    assert(await tailOk(), '저장된 사유');
  }],
  ['첫 문장만 고치면: 품목이 바뀌어도 고친 첫 문장 그대로 가~붙임은 계속 맞춤', async () => {
    await fresh(); await go(); await draft();
    const r = await reason();
    await page.fill(`${P} #pcReason`, '선생님이 고친 첫 문장입니다.' + r.slice(r.indexOf('\n\n')));
    await page.fill(`${P} [data-item="0"][data-f="qty"]`, '20');
    await page.waitForTimeout(150);
    const r2 = await reason();
    assert(r2.startsWith('선생님이 고친 첫 문장입니다.\n\n') && r2.includes('금60,000원'), r2);
    assert(await tailOk(), '저장된 사유');
    assert(!(await page.$(`${P} [data-pc="resync"]`)), '다시 맞추기 단추');
  }],
  ['목적만 쓴 품의도 템플릿 불러오기 전에 물어봄 · [새로 쓰기]도 초안이 없으면 물어봄', async () => {
    await page.evaluate(() => localStorage.setItem('ssam:purchase:templates', JSON.stringify([{ id: 't1', name: '실험 재료', savedAt: 1, form: { type: 'goods', project: '실험 재료', items: [{ name: '비커', qty: '8', price: '4500' }] } }])));
    await fresh({ project: '', items: [{ name: '', spec: '', qty: '', price: '' }], purpose: '모둠 활동', target: '', date: '' });
    await go();
    await page.click('#menuTabs [data-tab="templates"]');
    await page.click(`${P} [data-tpl-load]`);
    await page.waitForSelector('#sheetRoot #pcSwapOk');
    await page.click('#sheetRoot [data-close]');
    assert((await cur()).form.purpose === '모둠 활동', '물어보기 전에 바뀜');
    await page.click('#menuTabs [data-tab="new"]');
    await page.click(`${P} [data-pc="fresh"]`);
    await page.waitForSelector('#sheetRoot #pcSwapOk');
    await page.click('#sheetRoot #pcSwapOk');
    await until(async () => (await cur()).form.purpose === '');
    assert(await page.inputValue(`${P} #pcPurpose`) === '', '빈 품의');
  }],
  ['초안을 쓰는 중에 [새로 쓰기] → 새 품의는 비어 있고, 쓰던 품의와 그 초안은 최근 작성에', async () => {
    await page.evaluate(() => localStorage.removeItem('ssam:purchase:recent'));
    await fresh({ project: '과학 실험 재료' }); await go();
    slow = 1500;
    await page.click(`${P} [data-pc="draft"]`);
    await page.waitForTimeout(200);
    await page.click(`${P} [data-pc="fresh"]`);
    await page.waitForSelector('#sheetRoot #pcSwapOk');
    await page.click('#sheetRoot #pcSwapOk');
    await until(async () => (await recent()).some(x => x.form.project === '과학 실험 재료' && x.draft && x.draft.title === '교실 물품 구입'), 6000);
    slow = 0;
    const c = await cur();
    assert(!c.form.project && !c.draft, JSON.stringify(c).slice(0, 200));
    assert(!(await page.$(`${P} #pcTitle`)), '새 품의에 초안');
    assert((await recent()).length === 1, JSON.stringify(await recent()).slice(0, 300));
  }],
  ['떠 있는 버튼 「새 품의로」: 새 품의(새 번호), 쓰던 품의는 최근 작성에 그대로', async () => {
    await page.evaluate(() => localStorage.removeItem('ssam:purchase:recent'));
    await fresh({ project: '쓰던 품의' }); await go(); await draft();
    const before = await recent();
    assert(before.length === 1 && before[0].id === 'pcA', JSON.stringify(before).slice(0, 200));
    await page.setInputFiles('#inboxFile', join(ROOT, 'tests', 'fixtures', 'quote.csv'));
    await page.waitForSelector('#sheetRoot .sheet [data-ib-field="where"]');
    await page.selectOption('#sheetRoot .sheet [data-ib-field="where"]', 'new');
    await page.click('#sheetRoot .sheet #ibRun');
    await until(async () => (await cur()).form.items.filter(i => i.name).length === 3);
    const c = await cur();
    assert(c.id !== 'pcA' && !c.form.project, JSON.stringify(c).slice(0, 200));
    await page.fill(`${P} #pcPurpose`, '실험'); await page.fill(`${P} #pcDate`, '2026-11-20'); await page.fill(`${P} #pcTarget`, '5학년');
    await draft();
    const after = await recent();
    assert(after.length === 2 && after.some(x => x.id === 'pcA' && x.form.project === '쓰던 품의'), JSON.stringify(after.map(x => [x.id, x.form.project])));
  }],
  ['엑셀 칸을 붙여넣으면(그림이 같이 와도) 글로 읽음 — AI 없이 품목·규격·단위·수량·단가', async () => {
    await fresh({ items: [{ name: '', spec: '', qty: '', price: '' }] }); await go();
    const n0 = calls.length;
    await page.evaluate(async () => {
      const c = document.createElement('canvas'); c.width = 40; c.height = 30;
      const blob = await new Promise(r => c.toBlob(r, 'image/png'));
      const dt = new DataTransfer(); dt.items.add(new File([blob], 'image.png', { type: 'image/png' }));
      dt.setData('text/plain', '비커\t500ml\t개\t8\t4500\t36000\n유리 막대\t30cm\t개\t4\t1200\t4800');
      document.querySelector('#pcIntake').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    });
    await until(async () => (await cur()).form.items.filter(i => i.name).length === 2);
    const it = (await cur()).form.items[0];
    assert(it.name === '비커' && it.spec === '500ml' && it.unit === '개' && it.qty === '8' && it.price === '4500', JSON.stringify(it));
    assert(calls.length === n0, 'AI를 부름');
  }],
  ['개인정보 모양 줄은 AI로 보내지 않고 「개인정보가 있는 줄 1개는 읽지 않았어요」', async () => {
    const n0 = calls.length;
    await page.fill(`${P} #pcIntake`, '칭찬 스티커 좀 사고\n강사 김철수 800101-1234567');
    await page.click(`${P} [data-pc="intake"]`);
    await page.waitForSelector('#sheetRoot #pcMergeAdd');
    await page.click('#sheetRoot #pcMergeAdd');
    await until(async () => (await page.textContent('#toast')).includes('개인정보가 있는 줄 1개는 읽지 않았어요'));
    const q = calls.slice(n0).filter(x => x.head === '[품의 넣기]');
    assert(q.length === 1 && !q[0].prompt.includes('800101') && !q[0].prompt.includes('김철수'), q.map(x => x.prompt.slice(-120)).join(' | '));
  }],
  ['페이지 오류 없음', async () => { assert(errors.length === 0, errors.join(' | ')); }]
]);
await t.close();
