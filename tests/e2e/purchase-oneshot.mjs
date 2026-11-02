// 품의 「한 칸 → 바로 초안」: 처음엔 넣기 칸과 [초안 만들기]만, 칸은 [자세히 고치기]에 접힘 → 한 줄 넣고 한 번 누르면 초안·확인할 것 칩,
// 칩 누르면 그 칸, 강사 수당은 넣은 글을 AI로 보내지 않음, 선생님이 쓴 칸은 AI가 덮지 않음
import { open, run, assert, mockClaude } from './helpers.mjs';

const t = await open();
const { page, url, errors } = t;
await page.addInitScript(() => {
  if (!localStorage.getItem('ssam:engine')) localStorage.setItem('ssam:engine', JSON.stringify({ engine: 'claude', keys: { claude: 'sk-test' }, remember: true }));
});
const prompts = [];
await mockClaude(page, async ({ prompt }) => {
  prompts.push(prompt);
  if (prompt.startsWith('[품의 초안]')) return JSON.stringify({ title: '과학 실험 재료 구입', intro: '과학 실험 재료를 다음과 같이 구입하고자 합니다.', fields: { purpose: '과학 실험 수업', date: '2026. 11. 12.', place: '과학실' }, type: 'goods' });
  return '{}';
});
const P = 'section[data-menu="purchase"]';
const drafts = () => prompts.filter(p => p.startsWith('[품의 초안]'));
const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('ssam:purchase:current') || 'null'));
await page.goto(url);
await page.waitForTimeout(400);

await run('purchase-oneshot', [
  ['처음 화면: 넣기 칸·[초안 만들기]만, 칸들은 [자세히 고치기]에 접힘', async () => {
    await page.click('nav.app-side [data-menu-go="purchase"]');
    await page.waitForSelector(`${P} #pcIntake`);
    assert(await page.isVisible(`${P} [data-pc="go"]`), '초안 만들기');
    assert(!(await page.isVisible(`${P} #pcProject`)), '사업명 칸이 보임');
    assert(await page.evaluate(s => !document.querySelector(`${s} #pcMore`).open, P), '자세히가 열림');
  }],
  ['한 줄 넣고 [초안 만들기] → AI 한 번에 넣은 글 → 초안(목적·일시·장소 줄)·산출 내역·확인할 것 칩', async () => {
    await page.fill(`${P} #pcIntake`, '알코올램프 10개 5000원');
    await page.click(`${P} [data-pc="go"]`);
    await page.waitForFunction(s => (document.querySelector(`${s} #pcTitle`) || {}).value === '과학 실험 재료 구입', P);
    assert(drafts().length === 1 && drafts()[0].includes('알코올램프 10개 5000원'), drafts().map(p => p.slice(0, 80)).join(' | '));
    const reason = await page.inputValue(`${P} #pcReason`);
    assert(reason.includes('가. 목적: 과학 실험 수업') && reason.includes('일시: 2026. 11. 12.') && reason.includes('장소: 과학실') && !reason.includes('대상:'), reason);
    assert((await page.textContent(`${P} #pcCalc`)).includes('알코올램프'), '산출 내역');
    const chips = await page.textContent(`${P} #pcChips`);
    assert(chips.includes('예산 과목 · 행정실 확인') && chips.includes('목적 · AI가 짐작함'), chips);
    assert((await state()).form.guessed.includes('purpose'), '짐작 표시 저장');
  }],
  ['칩 「예산 과목」 → [자세히 고치기]가 열리고 예산 과목 칸, 다시 그려도 열림', async () => {
    await page.click(`${P} #pcChips [data-chip="budget"]`);
    await page.waitForFunction(s => document.querySelector(`${s} #pcMore`).open && document.activeElement && document.activeElement.id === 'pcBudget', P);
    assert(await page.evaluate(() => JSON.parse(localStorage.getItem('ssam:purchase:view'))) === 'full', '열림 기억');
    await page.click('nav.app-side [data-menu-go="class"]'); await page.click('nav.app-side [data-menu-go="purchase"]');
    await page.waitForSelector(`${P} #pcIntake`);
    assert(await page.evaluate(s => document.querySelector(`${s} #pcMore`).open, P), '다시 그리면 닫힘');
  }],
  ['선생님이 쓴 목적은 AI가 덮지 않음(짐작 칩 없음)', async () => {
    await page.click(`${P} [data-pc="fresh"]`);
    await page.waitForSelector(`${P} #pcPurpose`);
    await page.fill(`${P} #pcPurpose`, '1학기 실험');
    await page.fill(`${P} #pcIntake`, '비커 5개 3000원');
    await page.click(`${P} [data-pc="go"]`);
    await page.waitForFunction(() => { const s = JSON.parse(localStorage.getItem('ssam:purchase:current') || 'null'); return s && s.draft && s.form.items.some(i => i.name === '비커'); });
    const s = await state();
    assert(s.form.purpose === '1학기 실험' && !s.form.guessed.includes('purpose'), JSON.stringify(s.form).slice(0, 200));
    assert(!(await page.textContent(`${P} #pcChips`)).includes('AI가 짐작함'), '짐작 칩');
  }],
  ['강사 수당: 넣은 글(강사 이름)을 초안 AI로 보내지 않음', async () => {
    await page.click(`${P} [data-pc="fresh"]`);
    await page.click(`${P} [data-pctype="lecturer"]`);
    await page.fill(`${P} #pcIntake`, '김철수 강사 2시간 10만원');
    const n0 = drafts().length;
    await page.click(`${P} [data-pc="go"]`);
    await page.waitForFunction(n => window.__n !== undefined || true, n0);
    await page.waitForFunction(() => { const s = JSON.parse(localStorage.getItem('ssam:purchase:current') || 'null'); return s && s.draft; }, null, { timeout: 8000 });
    const p = drafts().at(-1);
    assert(drafts().length === n0 + 1 && !p.includes('김철수') && !p.includes('10만원') && p.includes('강사 1명'), p);
  }],
  ['페이지 오류 없음', async () => { assert(errors.length === 0, errors.join(' | ')); }]
]);
await t.close();
