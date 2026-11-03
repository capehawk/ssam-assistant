// 계획 14 뒤 미뤄 둔 작은 것(화면): 품의 — AI가 되면 빈 목적은 빨간 칸이 아님, [새로 쓰기]·예전 품의도 고른 종류를 지킴,
// AI가 쓰는 동안 넣기 칸에 친 글을 지킴, 떠 있는 버튼 견적서도 「빠진 것만 물어보기」 /
// 쪽지 — AI가 실패해도 붙여 넣은 글이 남음, 뺀 줄·가린 이름 따로 알림, 파일을 더 넣어도 고친 칸·본문은 그대로, 쪽지는 검토 스위치 없음
import { join } from 'node:path';
import { open, run, assert, mockClaude, FIXTURES } from './helpers.mjs';

const t = await open();
const { page, url, errors } = t;
await page.addInitScript(() => {
  if (!localStorage.getItem('ssam:engine')) localStorage.setItem('ssam:engine', JSON.stringify({ engine: 'claude', keys: { claude: 'sk-test' }, remember: true }));
});
const prompts = [];
let oneshotReply = null, gate = null, msgBad = 0;
const MSG = { kind: 'training', title: 'AI 활용 수업 연수', when: [{ date: '2026-11-12', time: '15:00~16:30' }], place: '시청각실', target: '전 교직원', apply: { due: '2026-11-06', how: '이음 쪽지로 회신' } };
await mockClaude(page, async ({ prompt }) => {
  prompts.push(prompt);
  if (prompt.startsWith('[품의 초안]')) { if (gate) await gate; return JSON.stringify(oneshotReply || { title: '물품 구입', intro: '물품을 다음과 같이 구입하고자 합니다.', fields: {}, type: 'goods' }); }
  if (prompt.startsWith('[쪽지 안내]')) { if (msgBad > 0) { msgBad--; return '이건 JSON이 아니에요'; } return JSON.stringify(MSG); }
  return '{}';
});
const P = 'section[data-menu="purchase"]', E = 'section[data-menu="etc"]';
const drafts = () => prompts.filter(p => p.startsWith('[품의 초안]'));
const msgs = () => prompts.filter(p => p.startsWith('[쪽지 안내]'));
const state = () => page.evaluate(() => JSON.parse(localStorage.getItem('ssam:purchase:current') || 'null'));
const hasDraft = () => page.waitForFunction(() => { const s = JSON.parse(localStorage.getItem('ssam:purchase:current') || 'null'); return s && s.draft && s.draft.title; }, null, { timeout: 10000 });
const fresh = async () => { await page.click(`${P} [data-pc="fresh"]`); await page.waitForTimeout(150); if (await page.$('#sheetRoot #pcSwapOk')) await page.click('#sheetRoot #pcSwapOk'); await page.waitForTimeout(150); };
const GONGMUN = ['제목 2026 AI 활용 수업 연수 안내', '1. 일시: 2026. 11. 12.(목) 15:00~16:30', '2. 장소: 시청각실', '3. 대상: 전 교직원',
  '담당: 장학사 김민수 041-123-4567', '연수 명단: 김가람 이나래 박하늘 최보람', '이름: 홍길동', '붙임 1. 연수 계획 1부.  끝.'].join('\n');
await page.goto(url);
await page.waitForTimeout(400);

await run('minor-14', [
  ['품의: AI가 되면 목적이 비어도 확인 목록에 「빨간색 칸」이 없음(AI가 목적을 못 채워도)', async () => {
    await page.click('nav.app-side [data-menu-go="purchase"]');
    await page.waitForSelector(`${P} #pcIntake`);
    await page.fill(`${P} #pcIntake`, '알코올램프 10개 5000원');
    await page.click(`${P} [data-pc="go"]`);
    await hasDraft();
    await page.waitForTimeout(200);
    const c = await page.textContent(`${P} #pcDraftCard`);
    assert(!c.includes('빨간색 칸'), c.slice(0, 300));
  }],
  ['품의: [새로 쓰기]는 고른 종류를 지킴, 예전에 저장한 품의(물품이 아닌 종류)도 AI가 종류를 바꾸지 않음', async () => {
    await page.click(`${P} [data-pctype="event"]`);
    await fresh();
    const s = await state();
    assert(s.form.type === 'event' && s.form.typeSet === true, JSON.stringify({ type: s.form.type, typeSet: s.form.typeSet }));
    await page.evaluate(() => localStorage.setItem('ssam:purchase:current', JSON.stringify({ id: 'old1', form: { type: 'meeting', purpose: '학년 협의회', items: [{ name: '다과', qty: '10', price: '5000' }] }, draft: null })));
    await page.reload(); await page.waitForTimeout(400);
    await page.click('nav.app-side [data-menu-go="purchase"]');
    const n0 = drafts().length;
    await page.click(`${P} [data-pc="go"]`);
    await hasDraft();
    const s2 = await state();
    assert(drafts().length === n0 + 1 && s2.form.type === 'meeting' && !s2.form.typeGuessed, JSON.stringify({ type: s2.form.type, g: s2.form.typeGuessed }));
  }],
  ['품의: AI가 초안을 쓰는 동안 넣기 칸에 친 글은 지우지 않음', async () => {
    await fresh();
    await page.click(`${P} [data-pctype="goods"]`);
    await page.fill(`${P} #pcIntake`, '비커 4개 3000원');
    let release; gate = new Promise(r => { release = r; });
    const n0 = drafts().length;
    await page.click(`${P} [data-pc="go"]`);
    for (let i = 0; i < 50 && drafts().length === n0; i++) await page.waitForTimeout(100);
    await page.fill(`${P} #pcIntake`, '스포이트 20개 500원');
    release(); gate = null;
    await hasDraft();
    await page.waitForTimeout(300);
    assert(await page.inputValue(`${P} #pcIntake`) === '스포이트 20개 500원', await page.inputValue(`${P} #pcIntake`));
  }],
  ['품의: 「빠진 것만 물어보기」면 떠 있는 버튼 견적서도 목적을 먼저 물어봄', async () => {
    await page.evaluate(() => localStorage.setItem('ssam:purchase:flow', JSON.stringify('ask')));
    await page.fill(`${P} #pcIntake`, '');
    await fresh();
    const n0 = drafts().length;
    await page.setInputFiles('#inboxFile', join(FIXTURES, 'quote.csv'));
    await page.waitForSelector('#sheetRoot .sheet #ibRun:not([disabled])');
    await page.click('#sheetRoot .sheet #ibRun');
    await page.waitForSelector('#sheetRoot #pcAskPurpose', { timeout: 8000 });
    assert(drafts().length === n0, '묻기 전에 초안 AI');
    await page.fill('#sheetRoot #pcAskPurpose', '과학 실험 수업');
    await page.click('#sheetRoot #pcAskOk');
    await page.waitForFunction(() => { const s = JSON.parse(localStorage.getItem('ssam:purchase:current') || 'null'); return s && s.draft && s.form.purpose === '과학 실험 수업'; }, null, { timeout: 10000 });
    await page.evaluate(() => localStorage.setItem('ssam:purchase:flow', JSON.stringify('oneshot')));
  }],
  ['쪽지: AI 답을 못 읽어도 붙여 넣은 글이 남아 [쪽지 쓰기]를 다시 누르면 됨, 뺀 줄·가린 이름을 따로 알림', async () => {
    await page.click('nav.app-side [data-menu-go="etc"]');
    await page.waitForSelector(`${E} #msgPaste`);
    await page.fill(`${E} #msgPaste`, GONGMUN);
    msgBad = 2;
    await page.click(`${E} [data-msg="read"]`);
    await page.waitForFunction(() => (document.querySelector('#toast') || {}).textContent.includes('다시 눌러'));
    await page.waitForFunction(() => !document.querySelector('[data-msg="read"][disabled]'));
    assert(await page.inputValue(`${E} #msgPaste`) === GONGMUN, '붙여 넣은 글이 사라짐');
    await page.click(`${E} [data-msg="read"]`);
    await page.waitForFunction(s => (document.querySelector(`${s} #msgTitle`) || {}).value === '[연수 안내] AI 활용 수업 연수', E);
    const toast = await page.textContent('#toast');
    assert(toast.includes('줄 2곳은 뺐어요') && toast.includes('이름 1개는 가렸어요'), toast);
  }],
  ['쪽지: 파일을 더 넣어 다시 읽어도 선생님이 고친 칸은 그대로, 손으로 고친 본문도 그대로([칸으로 다시 맞추기])', async () => {
    await page.fill(`${E} [data-mf="place"]`, '강당');
    await page.waitForFunction(s => document.querySelector(`${s} #msgBody`).value.includes('□ 장소: 강당'), E);
    const n0 = msgs().length;
    await page.setInputFiles(`${E} #msgFile`, [{ name: '연수 계획.txt', mimeType: 'text/plain', buffer: Buffer.from('연수 계획\n일시: 11. 12.\n장소: 시청각실') }]);
    for (let i = 0; i < 50 && msgs().length === n0; i++) await page.waitForTimeout(100);
    await page.waitForFunction(() => !document.querySelector('[data-msg="read"][disabled]'));
    await page.waitForTimeout(200);
    assert(msgs().length === n0 + 1, '다시 읽기');
    assert(await page.inputValue(`${E} [data-mf="place"]`) === '강당' && (await page.inputValue(`${E} #msgBody`)).includes('□ 장소: 강당'), await page.inputValue(`${E} #msgBody`));
    const b0 = await page.inputValue(`${E} #msgBody`);
    await page.fill(`${E} #msgBody`, b0 + '\n덧붙인 한 줄');
    await page.waitForTimeout(150);
    await page.setInputFiles(`${E} #msgFile`, [{ name: '참고.txt', mimeType: 'text/plain', buffer: Buffer.from('참고 자료\n준비물: 노트북') }]);
    for (let i = 0; i < 50 && msgs().length === n0 + 1; i++) await page.waitForTimeout(100);
    await page.waitForFunction(() => !document.querySelector('[data-msg="read"][disabled]'));
    await page.waitForTimeout(200);
    assert((await page.inputValue(`${E} #msgBody`)).includes('덧붙인 한 줄') && await page.isVisible(`${E} [data-msg="resync"]`), await page.inputValue(`${E} #msgBody`));
  }],
  ['쪽지: [새 쪽지]를 누르면 붙여 넣은 글을 비움', async () => {
    await page.click(`${E} [data-msg="new"]`);
    assert(await page.inputValue(`${E} #msgPaste`) === '', '비우지 않음');
  }],
  ['쪽지: AI 줄 [바꾸기]에 「검토 AI로 한 번 더 보기」가 없음', async () => {
    await page.waitForSelector(`${E} [data-ai-edit="message"]`);
    await page.click(`${E} [data-ai-edit="message"]`);
    await page.waitForSelector('#sheetRoot #aiRoleSheet');
    assert(!(await page.isVisible('#sheetRoot #arReviewOn')) && !(await page.isVisible('#sheetRoot #arReviewF')), '검토 스위치');
    await page.click('#sheetRoot [data-close]');
  }],
  ['페이지 오류 없음', async () => { assert(errors.length === 0, errors.join(' | ')); }]
]);
await t.close();
