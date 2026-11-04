// 새 품의: 종류 안내, 필수 칸, 초안(제목·사유·산출 내역), 확인 목록, 표 복사, 개인정보 막기, AI 답 못 읽음, 한글 파일, 저장, 좁은 화면
import { open, run, assert, mockClaude } from './helpers.mjs';

const t = await open();
const { page, ctx, url, errors } = t;
// 품의 칸을 다루는 시험: [자세히 고치기]를 펼친 채로 (처음 화면은 purchase-oneshot.mjs)
await page.addInitScript(() => { if (!localStorage.getItem('ssam:purchase:view')) localStorage.setItem('ssam:purchase:view', JSON.stringify('full')); });
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: url.replace(/\/$/, '') });
await page.addInitScript(() => {
  if (!localStorage.getItem('ssam:engine')) localStorage.setItem('ssam:engine', JSON.stringify({ engine: 'claude', keys: { claude: 'sk-test' }, remember: true }));
});
let answer = 'ok';
const prompts = [];
await mockClaude(page, ({ prompt }) => {
  prompts.push(prompt);
  if (answer === 'garbage') return '죄송해요, 지금은 답할 수 없어요.';
  return '```json\n' + JSON.stringify({ title: '5학년 과학 실험 재료(용해와 용액) 구입', intro: '5학년 과학 실험에 쓸 재료를 다음과 같이 구입하고자 합니다.' }) + '\n```';
});
const P = 'section[data-menu="purchase"]';
await page.goto(url);
await page.waitForTimeout(500);
await page.click('nav.app-side [data-menu-go="purchase"]');
await page.click('#menuTabs [data-tab="new"]');

const fill = async (sel, v) => { await page.fill(`${P} ${sel}`, v); };
const item = async (i, name, spec, qty, price) => {
  await fill(`[data-item="${i}"][data-f="name"]`, name); await fill(`[data-item="${i}"][data-f="spec"]`, spec);
  await fill(`[data-item="${i}"][data-f="qty"]`, qty); await fill(`[data-item="${i}"][data-f="price"]`, price);
};

await run('purchase', [
  ['종류 4개, 강사 수당을 고르면 안내와 예시, 주민번호·계좌 칸 없음', async () => {
    assert(await page.locator(`${P} [data-pctype]`).count() === 4, '종류 수');
    await page.click(`${P} [data-pctype="lecturer"]`);
    assert((await page.textContent(`${P} #pcHint`)).includes('외부 강사를 부를 때'), '안내');
    assert((await page.getAttribute(`${P} #pcProject`, 'placeholder')).includes('진로 체험 특강'), '예시');
    const bad = await page.evaluate(s => [...document.querySelectorAll(`${s} input, ${s} textarea`)].filter(el => /주민|계좌/.test((el.name || '') + (el.placeholder || '') + (el.getAttribute('aria-label') || ''))).length, P);
    assert(bad === 0, '주민번호·계좌 칸이 있음');
    await page.click(`${P} [data-pctype="goods"]`);
  }],
  ['품목이 비면 AI를 부르지 않고 빨간 칸 (목적은 AI가 짐작, 일시는 필수 아님)', async () => {
    await fill('#pcTarget', '5학년 4개 반');
    await page.click(`${P} [data-pc="draft"]`);
    assert(prompts.length === 0, 'AI를 부름');
    assert(await page.locator(`${P} [data-item="0"][data-f="name"].bad`).count() === 1, '품목 빨간 칸 아님');
    assert(await page.locator(`${P} #pcPurpose.bad`).count() === 0 && await page.locator(`${P} #pcDate.bad`).count() === 0, '목적·일시가 빨간 칸');
  }],
  ['칸을 채우면 합계가 보이고 초안(제목·사유·산출 내역)이 나옴', async () => {
    await fill('#pcProject', '5학년 과학 실험 재료 구입');
    await fill('#pcPurpose', '용해와 용액 모둠 실험');
    await fill('#pcDate', '2026-11-10');
    await fill('#pcPlace', '과학실');
    await item(0, '비커', '500ml', '2', '3,000');
    await page.click(`${P} [data-pc="addItem"]`);
    await item(1, '시험관', '', '10', '500');
    assert((await page.textContent(`${P} #pcSum`)).includes('11,000'), '합계: ' + await page.textContent(`${P} #pcSum`));
    await page.click(`${P} [data-pc="draft"]`);
    await page.waitForFunction(s => document.querySelector(`${s} #pcTitle`) && document.querySelector(`${s} #pcTitle`).value.includes('용해와 용액'), P, { timeout: 8000 });
    assert((await page.inputValue(`${P} #pcReason`)).includes('가. 목적: 용해와 용액 모둠 실험'), '사유');
    assert((await page.inputValue(`${P} #pcReason`)).includes('라. 장소: 과학실'), '장소 줄');
    assert((await page.textContent(`${P} #pcCalc`)).includes('11,000'), '산출 내역 합계');
    assert(/11,?000/.test(prompts.at(-1)), '프롬프트에 합계 없음');
  }],
  ['확인 목록: 예산 과목 경고, 개인정보 확인', async () => {
    const warn = await page.locator(`${P} #pcChecks li.warn`).allInnerTexts();
    const ok = await page.locator(`${P} #pcChecks li.ok`).allInnerTexts();
    assert(warn.some(w => w.includes('예산 과목 · 행정실 확인 필요')), '경고: ' + warn.join(' / '));
    assert(ok.some(w => w.includes('주민번호·계좌번호가 들어 있지 않아요')), '확인: ' + ok.join(' / '));
  }],
  ['[표 복사]는 탭으로 나눈 산출 내역', async () => {
    await page.click(`${P} [data-copy="calc"]`);
    await page.waitForTimeout(150);
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    assert(clip === '품명\t규격\t단위\t수량\t단가\t금액\n비커\t500ml\t개\t2\t3000\t6000\n시험관\t\t개\t10\t500\t5000\n합계\t\t\t\t\t11000', '클립보드: ' + JSON.stringify(clip));
  }],
  ['메모에 주민번호가 있으면 막고 알려 줌', async () => {
    const before = prompts.length;
    await fill('#pcMemo', '강사 900101-1234567');
    await page.click(`${P} [data-pc="draft"]`);
    assert(prompts.length === before, 'AI를 부름');
    assert(await page.locator(`${P} #pcMemo.bad`).count() === 1, '메모 칸이 빨갛지 않음');
    assert((await page.textContent(`${P} #pcChecks`)).includes('개인정보는 넣지 말아 주세요'), '안내 없음');
    await fill('#pcMemo', '');
  }],
  ['AI가 두 번 다 JSON이 아니면 「AI 답을 읽지 못했어요」, 입력은 그대로', async () => {
    answer = 'garbage';
    const before = prompts.length;
    await page.click(`${P} [data-pc="draft"]`);
    await page.waitForFunction(s => document.querySelector(s).textContent.includes('AI 답을 읽지 못했어요'), P, { timeout: 8000 });
    assert(prompts.length === before + 2, 'AI 요청 수: ' + (prompts.length - before));
    assert(prompts.at(-1).includes('JSON만 답하세요'), '다시 묻는 말 없음');
    assert(await page.inputValue(`${P} #pcPurpose`) === '용해와 용액 모둠 실험', '입력이 사라짐');
    answer = 'ok';
  }],
  ['[한글로 내려받기](처음 형식)는 .hwpx', async () => {
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click(`${P} [data-pc="export"]`)]);
    assert(dl.suggestedFilename().endsWith('.hwpx'), '이름: ' + dl.suggestedFilename());
  }],
  ['새로고침해도 쓰던 입력과 초안이 남음', async () => {
    await page.reload(); await page.waitForTimeout(500);
    assert(await page.inputValue(`${P} #pcPurpose`) === '용해와 용액 모둠 실험', '목적');
    assert(await page.inputValue(`${P} [data-item="1"][data-f="name"]`) === '시험관', '품목');
    assert((await page.inputValue(`${P} #pcTitle`)).includes('용해와 용액'), '초안 제목');
  }],
  ['390px 폭에서 본문이 가로로 넘치지 않음', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(200);
    const w = await page.evaluate(() => [document.querySelector('#app').scrollWidth, document.querySelector('#app').clientWidth]);
    assert(w[0] <= w[1], '넘침: ' + w);
    await page.setViewportSize({ width: 1280, height: 860 });
  }],
  ['페이지 오류 없음', async () => { assert(errors.length === 0, errors.join(' | ')); }]
]);
await t.close();
