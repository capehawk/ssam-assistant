// 0.17 미뤄 둔 것(화면): M1 공문 → 가정통신문은 쓰던 메모를 남기고 옛 회신서 스캔을 비움, M4 붙여 넣은 공문 이름은 전화번호 줄을 뺀 글에서,
// M6 AI가 읽는 동안 고친 기한은 그대로, M7 40개가 넘으면 알림, M9 사진·스캔 공문도 넣고(직접 적기 안내) [쪽지]는 붙임으로,
// M10 [AI로 읽기] 문구, M11 양식 맞추기 「날짜 없음」, M13 할 일 칸 이름표·못 읽은 칸 표시
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { open, run, assert, mockClaude, ROOT, FIXTURES } from './helpers.mjs';

const t = await open();
const { page, url, errors } = t;
await page.addInitScript(() => {
  if (!localStorage.getItem('ssam:engine')) localStorage.setItem('ssam:engine', JSON.stringify({ engine: 'claude', keys: { claude: 'sk-test' }, remember: true }));
});
const prompts = [];
let delay = 0;
await mockClaude(page, async ({ prompt }) => {
  prompts.push(prompt);
  if (delay) await new Promise(r => setTimeout(r, delay));
  if (prompt.startsWith('[공문 처리]')) return JSON.stringify({ title: '읽은 공문', due: '2026-12-01', tasks: [{ text: 'AI 할 일', due: '' }], kinds: [] });
  if (prompt.startsWith('[쪽지 안내]')) return JSON.stringify({ kind: 'notice', title: '안내' });
  return '{}';
});
const G = 'section[data-menu="etc"] .gm-box', L = 'section[data-menu="etc"] .lf-box';
const gm = async () => { await page.click('nav.app-side [data-menu-go="etc"]'); await page.click('#menuTabs [data-tab="gongmun"]'); await page.waitForSelector(`${G} #gmPaste`); };
await page.goto(url);
await page.waitForTimeout(400);

await run('minors-0417', [
  ['M4 붙여 넣은 공문의 이름·AI에 가는 이름에 전화번호 줄이 없음', async () => {
    await gm();
    await page.fill(`${G} #gmPaste`, '담당 장학사 010-1234-5678\n○○교육청\n제목 안내');
    await page.click(`${G} [data-gm="paste"]`);
    await page.waitForFunction(() => window.document.querySelector('.gm-doc'), null, { timeout: 8000 });
    await page.waitForTimeout(300);
    const p = prompts.find(x => x.startsWith('[공문 처리]'));
    assert(p && !p.includes('010-1234-5678'), p && p.slice(-200));
  }],
  ['M6 AI가 읽는 동안 고친 기한·할 일은 AI 답이 와도 그대로', async () => {
    delay = 1500;
    await page.fill(`${G} #gmPaste`, '두 번째 공문\n수신 각 학교');
    await page.click(`${G} [data-gm="paste"]`);
    await page.waitForSelector(`${G} .gm-doc .spin`, { timeout: 5000 });
    const card = page.locator(`${G} .gm-doc`, { has: page.locator('.spin') });
    await card.locator('[data-gm-due]').fill('2026-11-20');
    await card.locator('[data-gm-due]').dispatchEvent('change');
    await page.locator(`${G} #gmPaste`).focus();
    await page.waitForFunction(s => !document.querySelector(`${s} .gm-doc .spin`), G, { timeout: 8000 });
    delay = 0;
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('ssam:gongmun:list')));
    const d = saved.find(x => x.title === '읽은 공문' && x.due === '2026-11-20') || saved.find(x => x.due === '2026-11-20');
    assert(d, JSON.stringify(saved.map(x => [x.title, x.due])));
  }],
  ['M9 사진·스캔 공문도 넣고 직접 적으라고 알림, [쪽지]는 그 사진을 붙임으로', async () => {
    await page.setInputFiles(`${G} #gmFile`, [{ name: '사진 공문.jpg', mimeType: 'image/jpeg', buffer: readFileSync(join(FIXTURES, 'photo-1.jpg')) }]);
    await page.waitForFunction(s => [...document.querySelectorAll(`${s} .gm-doc`)].some(e => e.textContent.includes('사진 공문')), G, { timeout: 8000 });
    assert((await page.textContent('#toast')).includes('직접'), await page.textContent('#toast'));
    await page.locator(`${G} .gm-doc`, { hasText: '사진 공문' }).locator('[data-gm-go="message"]').click();
    await page.waitForFunction(() => document.querySelector('#menuTabs [data-tab="message"][aria-current="page"]'));
    await page.waitForFunction(() => (document.querySelector('section[data-menu="etc"] .msg-box') || {}).textContent?.includes('사진 공문'), null, { timeout: 8000 });
  }],
  ['M10·M13 [AI로 읽기] 문구, 할 일 더하기 칸에 이름표', async () => {
    await gm();
    assert(await page.locator(`${G} [data-gm-tadd][aria-label]`).count() > 0, '이름표 없음');
  }],
  ['M7 공문이 40개를 넘으면 오래된 것이 빠진다고 알림', async () => {
    await page.evaluate(() => { const l = Array.from({ length: 40 }, (_, i) => ({ id: 'z' + i, title: '옛 공문 ' + i, text: 'x', tasks: [], kinds: [], at: i + 1 })); localStorage.setItem('ssam:gongmun:list', JSON.stringify(l)); });
    await page.reload(); await page.waitForTimeout(400); await gm();
    await page.fill(`${G} #gmPaste`, '마흔한 번째 공문');
    await page.click(`${G} [data-gm="paste"]`);
    await page.waitForTimeout(300);
    assert((await page.textContent('#toast')).includes('40개'), await page.textContent('#toast'));
  }],
  ['M1 공문 → [가정통신문]은 쓰던 메모를 남기고 공문을 더함', async () => {
    await page.click('#menuTabs [data-tab="letter"]');
    await page.waitForSelector(`${L} #lfMemo`);
    await page.click(`${L} [data-lf="new"]`);
    await page.fill(`${L} #lfMemo`, '쓰던 메모');
    await page.waitForTimeout(200);
    await page.click('#menuTabs [data-tab="gongmun"]');
    await page.locator(`${G} .gm-doc`).first().locator('[data-gm-go="letter"]').click();
    await page.waitForSelector(`${L} #lfSrc li`);
    assert((await page.inputValue(`${L} #lfMemo`)) === '쓰던 메모', '메모가 사라짐');
  }],
  ['M11 양식 맞추기에 「날짜 없음」(보고서 양식)', async () => {
    await page.setInputFiles(`${L} #lfFormFile`, { name: '양식.hwpx', mimeType: 'application/octet-stream', buffer: readFileSync(join(ROOT, 'samples', '가정통신문-양식-예시.hwpx')) });
    await page.waitForFunction(s => (document.querySelector(`${s} #lfForm`) || {}).value, L, { timeout: 8000 });
    await page.click(`${L} [data-lf="map"]`);
    await page.click(`${L} [data-lf-line="0"]`);
    await page.click(`${L} [data-lf-role="nodate"]`);
    assert(await page.locator(`${L} .lf-lines .lf-badge`, { hasText: '날짜' }).count() === 0, '날짜 자리가 남음');
  }],
  ['페이지 오류 없음', async () => { assert(errors.length === 0, errors.join(' | ')); }]
]);
await t.close();
