// 품의 종류별 계산 도우미·예산 칩·붙임 체크리스트·기안문 모양 사유(다시 맞추기)·형식 고르기·협의회 상한 설정
import { readFileSync } from 'node:fs';
import { open, run, assert } from './helpers.mjs';
import { unzip } from '../../web/core/zip.js';

const t = await open();
const { page, url, errors } = t;
await page.addInitScript(() => {
  if (!localStorage.getItem('ssam:engine')) localStorage.setItem('ssam:engine', JSON.stringify({ engine: 'claude', keys: { claude: 'sk-test' }, remember: true }));
});
const prompts = [];
await page.route('https://api.anthropic.com/**', async route => {
  const body = JSON.parse(route.request().postData());
  const c = body.messages[0].content;
  const prompt = typeof c === 'string' ? c : c.find(x => x.type === 'text').text;
  prompts.push(prompt);
  const out = JSON.stringify({ title: '교실 물품 구입', intro: '교실 물품을 다음과 같이 구입하고자 합니다.' });
  await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: [{ type: 'content_block_delta', delta: { type: 'text_delta', text: out } }, { type: 'message_delta', delta: { stop_reason: 'end_turn' } }].map(e => 'data: ' + JSON.stringify(e) + '\n\n').join('') }).catch(() => {});
});
const P = 'section[data-menu="purchase"]';
const fresh = (type = 'goods') => page.evaluate(type => localStorage.setItem('ssam:purchase:current', JSON.stringify({ form: { type, purpose: '수업 준비', date: '2026-11-10', target: '3학년 1반', items: [{ name: '', spec: '', qty: '', price: '' }] }, draft: null })), type);
const go = async () => { await page.reload(); await page.waitForTimeout(400); await page.click('nav.app-side [data-menu-go="purchase"]'); await page.click('#menuTabs [data-tab="new"]'); await page.waitForSelector(`${P} #pcIntake`); };
const item = async (i, name, qty, price) => {
  await page.fill(`${P} [data-item="${i}"][data-f="name"]`, name);
  await page.fill(`${P} [data-item="${i}"][data-f="qty"]`, qty);
  await page.fill(`${P} [data-item="${i}"][data-f="price"]`, price);
};
const draft = async () => { await page.click(`${P} [data-pc="draft"]`); await page.waitForFunction(s => document.querySelector(`${s} #pcReason`), P, { timeout: 8000 }); };
await page.goto(url);
await page.waitForTimeout(300);

await run('purchase-more', [
  ['물품: 공급가액 기준 견적 안내(부가세 포함 체크)', async () => {
    await fresh(); await go();
    await item(0, '노트북', '1', '22000000');
    await page.waitForTimeout(100);
    assert((await page.textContent(`${P} #pcQuoteNote`)).includes('1인 견적'), await page.textContent(`${P} #pcQuoteNote`));
    await page.click(`${P} #pcVat`);
    await page.waitForTimeout(100);
    assert((await page.textContent(`${P} #pcQuoteNote`)).includes('2인 이상'), await page.textContent(`${P} #pcQuoteNote`));
  }],
  ['예산 칩: 「실험 재료」 → 교육운영비 → 누르면 예산 과목 칸', async () => {
    await item(0, '실험 재료', '10', '3000');
    await page.waitForSelector(`${P} [data-budget-hint="교육운영비"]`);
    await page.click(`${P} [data-budget-hint="교육운영비"]`);
    assert(await page.inputValue(`${P} #pcBudget`) === '교육운영비', await page.inputValue(`${P} #pcBudget`));
  }],
  ['붙임: 지출품의서 1부 먼저 · 견적서(기본) · 사업자등록증 · 직접 더한 것 → 사유 끝, 소요 예산·산출 근거 줄', async () => {
    assert(await page.isChecked(`${P} [data-attach="quote"]`), '견적서 기본 체크');
    await page.check(`${P} [data-attach="bizreg"]`);
    await page.fill(`${P} #pcAttachMore`, '참고 자료');
    await page.click(`${P} [data-pc="attachAdd"]`);
    await draft();
    const r = await page.inputValue(`${P} #pcReason`);
    assert(r.startsWith('교실 물품을 다음과 같이 구입하고자 합니다.'), r.slice(0, 40));
    assert(r.endsWith('붙임  1. 지출품의서 1부.\n      2. 견적서 1부.\n      3. 사업자등록증 사본 1부.\n      4. 참고 자료 1부.  끝.'), r);
    assert(r.includes('소요 예산: 금30,000원(금삼만원)') && r.includes('산출 근거: 실험 재료 3,000원 × 10개 = 30,000원') && r.includes('예산 과목: 교육운영비'), r);
  }],
  ['초안 뒤 붙임을 끄면 사유가 다시 맞춰짐(첫 문장 그대로) · 손으로 고친 사유는 그대로 + [사유 다시 맞추기]', async () => {
    await page.uncheck(`${P} [data-attach="bizreg"]`);
    await page.waitForTimeout(150);
    let r = await page.inputValue(`${P} #pcReason`);
    assert(!r.includes('사업자등록증') && r.includes('3. 참고 자료 1부.  끝.') && r.startsWith('교실 물품을'), r);
    await page.fill(`${P} #pcReason`, '선생님이 고친 첫 문장입니다.\n\n가. 목적: 수업 준비');
    await page.fill(`${P} [data-item="0"][data-f="qty"]`, '20');
    await page.waitForTimeout(150);
    r = await page.inputValue(`${P} #pcReason`);
    assert(r === '선생님이 고친 첫 문장입니다.\n\n가. 목적: 수업 준비', '손으로 고친 사유가 바뀜: ' + r);
    await page.waitForSelector(`${P} [data-pc="resync"]`);
    await page.click(`${P} [data-pc="resync"]`);
    r = await page.inputValue(`${P} #pcReason`);
    assert(r.startsWith('선생님이 고친 첫 문장입니다.\n\n가. 목적: 수업 준비\n나. 일시') && r.includes('금60,000원'), r);
  }],
  ['내려받기 ▾ 워드 → .docx, 본문에 산출 근거·붙임', async () => {
    await page.click(`${P} .exp-split:has([data-pc="export"]) [data-exp-menu]`);
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#expMenu [data-exp-fmt="docx"]')]);
    assert(dl.suggestedFilename().endsWith('.docx'), dl.suggestedFilename());
    const d = new TextDecoder().decode((await unzip(new Uint8Array(readFileSync(await dl.path())))).get('word/document.xml'));
    assert(d.includes('산출 근거') && d.includes('지출품의서 1부') && d.includes('단위'), '문서 본문');
  }],
  ['강사 수당: 머리 「강사(역할)·시간·시간당 단가」, 원천징수(참고), 프롬프트에 강사 칸 글 없음', async () => {
    await fresh('lecturer'); await go();
    const head = await page.textContent(`${P} .pc-ihead`);
    assert(head.includes('강사(역할)') && head.includes('시간') && head.includes('시간당 단가'), head);
    await item(0, '김강사', '2', '100000');
    await page.selectOption(`${P} #pcIncome`, 'other');
    await page.waitForTimeout(100);
    let w = await page.textContent(`${P} [data-wh="0"]`);
    assert(w.includes('17,600') && w.includes('182,400'), w);
    await page.selectOption(`${P} #pcIncome`, 'business');
    await page.waitForTimeout(100);
    w = await page.textContent(`${P} [data-wh="0"]`);
    assert(w.includes('6,600'), w);
    await draft();
    assert(!prompts.at(-1).includes('김강사') && prompts.at(-1).includes('강사 1명'), prompts.at(-1));
    assert((await page.inputValue(`${P} #pcReason`)).includes('강사 카드(이력) 1부'), '강사 붙임');
  }],
  ['협의회: 4명 × 50,000원 → 품목 줄, 상한 경고 → 설정에서 60,000원으로 → 경고 없음', async () => {
    await fresh('meeting'); await go();
    await page.fill(`${P} #pcMeetPeople`, '4');
    await page.fill(`${P} #pcMeetPrice`, '50000');
    await page.click(`${P} [data-pc="meetAdd"]`);
    assert(await page.inputValue(`${P} [data-item="0"][data-f="name"]`) === '협의회 다과비', '품명');
    assert(await page.inputValue(`${P} [data-item="0"][data-f="spec"]`) === '4명 × 1회', '규격');
    await draft();
    assert((await page.textContent(`${P} #pcChecks`)).includes('협의회 상한 40,000원'), await page.textContent(`${P} #pcChecks`));
    await page.click('nav.app-side [data-menu-go="settings"]'); await page.click('#menuTabs [data-tab="purchase"]');
    await page.fill('#meetCap', '60000');
    await page.click('[data-set="saveMeetCap"]');
    await page.click('nav.app-side [data-menu-go="purchase"]'); await page.click('#menuTabs [data-tab="new"]');
    await page.waitForSelector(`${P} #pcChecks`);
    assert(!(await page.textContent(`${P} #pcChecks`)).includes('협의회 상한'), await page.textContent(`${P} #pcChecks`));
  }],
  ['페이지 오류 없음', async () => { assert(errors.length === 0, errors.join(' | ')); }]
]);
await t.close();
