// 가정통신문 최종 검토 고침(화면): 양식 맞추기에서 날짜를 본문 안 줄에 두면 본문 끝이 날짜 앞으로 줄고 [저장] 알림,
// 순서가 틀린 자리(회신서를 날짜 위)는 고르지 않고 알림, 순서가 틀린 양식은 내려받기 전에 양식 맞추기를 엶,
// AI를 기다리는 동안 다른(최근) 가정통신문을 열어도 그 글의 손으로 고친 기안을 덮지 않음
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { open, run, assert, mockClaude, ROOT } from './helpers.mjs';

const t = await open();
const { page, url, errors } = t;
await page.addInitScript(() => {
  if (!localStorage.getItem('ssam:engine')) localStorage.setItem('ssam:engine', JSON.stringify({ engine: 'claude', keys: { claude: 'sk-test' }, remember: true }));
});
let delay = 0, n = 0;
await mockClaude(page, async () => {
  n++;
  if (delay) await new Promise(r => setTimeout(r, delay));
  return JSON.stringify({ title: `안내 ${n}`, greeting: ['안녕하십니까?'], intro: '취지', items: ['1. 일시: 11. 12.'], closing: '부탁드립니다.', reply: { need: false }, short: '짧은 글', related: [], target: '보호자' });
});
const P = 'section[data-menu="etc"] .lf-box';
const FORM = readFileSync(join(ROOT, 'samples', '가정통신문-양식-예시.hwpx'));
const badge = text => page.evaluate(([s, t]) => { const li = [...document.querySelectorAll(`${s} .lf-lines li`)].find(l => l.querySelector('.lf-text').textContent === t); return li ? li.querySelector('.lf-badge').textContent : ''; }, [P, text]);
const lineIdx = text => page.evaluate(([s, t]) => [...document.querySelectorAll(`${s} .lf-lines li`)].findIndex(l => l.querySelector('.lf-text').textContent === t), [P, text]);
const pickRole = async (text, role) => { await page.click(`${P} [data-lf-line="${await lineIdx(text)}"]`); await page.click(`${P} [data-lf-role="${role}"]`); };

await page.goto(url);
await page.waitForTimeout(400);
await page.click('nav.app-side [data-menu-go="etc"]');
await page.click('#menuTabs [data-tab="letter"]');
await page.waitForSelector(`${P} #lfFormFile`, { state: 'attached' });

await run('letter-fixes', [
  ['양식 맞추기: 날짜를 본문 안 줄에 두면 본문 끝이 그 위로 줄어 「날짜」로 보임, 회신서를 날짜 위에 두면 고르지 않고 알림', async () => {
    await page.setInputFiles(`${P} #lfFormFile`, { name: '양식.hwpx', mimeType: 'application/octet-stream', buffer: FORM });
    await page.waitForFunction(s => (document.querySelector(`${s} #lfForm`) || {}).value, P, { timeout: 8000 });
    await page.click(`${P} [data-lf="map"]`);
    await pickRole('붙임  상담 신청서 1부.', 'date');
    assert((await badge('붙임  상담 신청서 1부.')) === '날짜' && (await badge('2. 신청 방법: 아래 신청서를 3. 11.(수)까지 제출')) === '본문', await badge('붙임  상담 신청서 1부.'));
    await pickRole('    1) 상담 시간은 20분입니다.', 'reply');
    assert((await page.textContent('#toast')).includes('회신서는'), await page.textContent('#toast'));
    assert((await badge('    1) 상담 시간은 20분입니다.')) === '본문', '회신서로 바뀜');
    await pickRole('2026 . 3 . 3 .', 'date');
    await page.click(`${P} [data-lf="mapSave"]`);
    await page.waitForFunction(() => (document.querySelector('#toast') || {}).textContent?.includes('양식 자리를 저장했어요'));
  }],
  ['AI를 기다리는 동안 최근 가정통신문을 열어도 그 글의 손으로 고친 기안은 그대로, 쓴 글은 최근에 들어감', async () => {
    await page.fill(`${P} #lfMemo`, '첫 글');
    await page.click(`${P} [data-lf="write"]`);
    await page.waitForSelector(`${P} #lfSendBody`);
    await page.fill(`${P} #lfSendBody`, '손으로 고친 기안');
    await page.click(`${P} [data-lf="new"]`);
    await page.fill(`${P} #lfMemo`, '둘째 글');
    delay = 1200;
    await page.click(`${P} [data-lf="write"]`);
    await page.waitForTimeout(300);
    await page.click(`${P} #lfRecent [data-lf-open]`);
    await page.waitForTimeout(1600);
    assert((await page.inputValue(`${P} #lfSendBody`)) === '손으로 고친 기안', await page.inputValue(`${P} #lfSendBody`));
    assert(await page.locator(`${P} #lfRecent [data-lf-open]`).count() === 2, '쓴 글이 최근에 없음');
    delay = 0;
  }],
  ['M8·M9 양식을 저장하지 못하면(저장 공간 꽉 참) 알리고 이번에만 쓰고, 다른 탭에 갔다 와도 그 양식 그대로', async () => {
    await page.evaluate(() => { window.__put = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function () { throw new DOMException('full', 'QuotaExceededError'); }; });
    await page.setInputFiles(`${P} #lfFormFile`, { name: '꽉찬양식.hwpx', mimeType: 'application/octet-stream', buffer: FORM });
    await page.waitForFunction(() => (document.querySelector('#toast') || {}).textContent.includes('저장하지 못했어요'), null, { timeout: 8000 });
    assert((await page.textContent('#toast')).includes('이번에만'), await page.textContent('#toast'));
    const sel = () => page.evaluate(s => { const o = document.querySelector(`${s} #lfForm`).selectedOptions[0]; return o ? o.textContent : ''; }, P);
    assert((await sel()).includes('꽉찬양식') && (await sel()).includes('이번에만'), await sel());
    await page.click('#menuTabs [data-tab="message"]');
    await page.click('#menuTabs [data-tab="letter"]');
    await page.waitForTimeout(500);
    assert((await sel()).includes('꽉찬양식'), '다시 열면 양식이 바뀜: ' + await sel());
    await page.evaluate(() => { IDBObjectStore.prototype.put = window.__put; });
  }],
  ['페이지 오류 없음', async () => { assert(errors.length === 0, errors.join(' | ')); }]
]);
await t.close();
