// 떠 있는 버튼 › 연수·행사 안내: samples/연수안내-공문-예시.hwpx → 카드 「연수·행사 안내」(쪽지로 안내하기) → [실행] → 기타 › 쪽지 작성에 쪽지 제목·붙임(그 파일)
import { join } from 'node:path';
import { open, run, assert, mockClaude, ROOT } from './helpers.mjs';

const t = await open();
const { page, url, errors } = t;
await page.addInitScript(() => {
  if (!localStorage.getItem('ssam:engine')) localStorage.setItem('ssam:engine', JSON.stringify({ engine: 'claude', keys: { claude: 'sk-test' }, remember: true }));
});
const prompts = [];
await mockClaude(page, async ({ prompt }) => {
  prompts.push(prompt);
  if (prompt.startsWith('[쪽지 안내]')) return JSON.stringify({ kind: 'training', title: '2026 AI 활용 수업 역량 강화 연수', when: [{ date: '2026-11-12', time: '15:00~16:30' }], place: '3층 대회의실', target: '관내 초등 교원 희망자', apply: { due: '2026-11-06', how: '업무관리시스템으로 회신' } });
  return '{}';
});
const sheet = '#sheetRoot .sheet', P = 'section[data-menu="etc"]';
await page.goto(url);
await page.waitForTimeout(400);

await run('inbox-message', [
  ['연수 안내 공문 예시 → 카드 「연수·행사 안내」 → [실행] → 쪽지 작성에 제목·붙임', async () => {
    await page.setInputFiles('#inboxFile', join(ROOT, 'samples', '연수안내-공문-예시.hwpx'));
    await page.waitForSelector(sheet);
    assert((await page.textContent(sheet)).includes('연수·행사 안내'), await page.textContent(sheet));
    await page.waitForSelector(`${sheet} #ibRun:not([disabled])`);
    await page.click(`${sheet} #ibRun`);
    await page.waitForFunction(s => (document.querySelector(`${s} #msgTitle`) || {}).value === '[연수 안내] 2026 AI 활용 수업 역량 강화 연수', P);
    assert(prompts.filter(p => p.startsWith('[쪽지 안내]')).length === 1 && prompts[0].includes('역량 강화 연수'), '쪽지 AI');
    const body = await page.inputValue(`${P} #msgBody`);
    assert(body.includes('□ 일시: 2026. 11. 12.(목) 15:00~16:30') && body.includes('붙임  연수안내-공문-예시 1부.  끝.'), body);
    assert(await page.isVisible('#menuTabs [data-tab="message"][aria-current="page"]'), '쪽지 작성 탭');
  }],
  ['페이지 오류 없음', async () => { assert(errors.length === 0, errors.join(' | ')); }]
]);
await t.close();
