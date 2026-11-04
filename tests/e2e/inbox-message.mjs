// 떠 있는 버튼 › 안내·제출 공문: samples/연수안내-공문-예시.hwpx → 카드 「안내·제출 공문」(공문 처리로) → [실행] → 기타 › 공문 처리(기한·할 일) → [쪽지] → 쪽지 작성에 쪽지 제목
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
  if (prompt.startsWith('[공문 처리]')) return JSON.stringify({ title: '2026 AI 활용 수업 역량 강화 연수', due: '2026-11-06', dueNote: '참가 신청', tasks: [{ text: '희망자 조사', due: '' }], kinds: ['message'] });
  if (prompt.startsWith('[쪽지 안내]')) return JSON.stringify({ kind: 'training', title: '2026 AI 활용 수업 역량 강화 연수', when: [{ date: '2026-11-12', time: '15:00~16:30' }], place: '3층 대회의실', target: '관내 초등 교원 희망자', apply: { due: '2026-11-06', how: '업무관리시스템으로 회신' } });
  return '{}';
});
const sheet = '#sheetRoot .sheet', P = 'section[data-menu="etc"]';
await page.goto(url);
await page.waitForTimeout(400);

await run('inbox-message', [
  ['연수 안내 공문 예시 → 카드 「안내·제출 공문」 → [실행] → 공문 처리에 기한·할 일 → [쪽지] → 쪽지 작성에 제목', async () => {
    await page.setInputFiles('#inboxFile', join(ROOT, 'samples', '연수안내-공문-예시.hwpx'));
    await page.waitForSelector(sheet);
    assert((await page.textContent(sheet)).includes('안내·제출 공문'), await page.textContent(sheet));
    await page.waitForSelector(`${sheet} #ibRun:not([disabled])`);
    await page.click(`${sheet} #ibRun`);
    await page.waitForFunction(s => (document.querySelector(`${s} .gm-doc`) || {}).textContent?.includes('희망자 조사'), P, { timeout: 8000 });
    assert(await page.isVisible('#menuTabs [data-tab="gongmun"][aria-current="page"]'), '공문 처리 탭');
    assert(prompts.filter(p => p.startsWith('[공문 처리]')).length === 1 && prompts[0].includes('역량 강화 연수'), '공문 AI');
    await page.click(`${P} .gm-doc [data-gm-go="message"]`);
    await page.waitForFunction(s => ((document.querySelector(`${s} #msgBody`) || {}).value || '').startsWith('[연수 안내] 2026 AI 활용 수업 역량 강화 연수' + '\n'), P);
    const body = await page.inputValue(`${P} #msgBody`);
    assert(body.includes('□ 일시: 2026. 11. 12.(목) 15:00~16:30') && body.includes('붙임  연수안내-공문-예시 1부.  끝.'), body);
    assert(await page.isVisible('#menuTabs [data-tab="message"][aria-current="page"]'), '쪽지 작성 탭');
  }],
  ['페이지 오류 없음', async () => { assert(errors.length === 0, errors.join(' | ')); }]
]);
await t.close();
