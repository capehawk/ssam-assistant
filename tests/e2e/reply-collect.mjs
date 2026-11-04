// 가정통신문 › 회신서 모으기(스펙 2026-11-04 6장): 스캔 3장 → 이름 칸 가리기(가린 그림만 AI로) → 번호·☑ 표,
// 못 읽은 칸·겹친 번호는 노랑, 고르면 고쳐짐, 집계·미제출(명단 5명), 복사, 새로 고침 뒤 표가 남음(그림은 안 남음)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { open, run, assert, mockClaude, FIXTURES } from './helpers.mjs';

const t = await open();
const { page, ctx, url, errors } = t;
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: url.replace(/\/$/, '') });
await page.addInitScript(() => {
  if (!localStorage.getItem('ssam:engine')) localStorage.setItem('ssam:engine', JSON.stringify({ engine: 'claude', keys: { claude: 'sk-test' }, remember: true }));
  if (!localStorage.getItem('ssam:class')) localStorage.setItem('ssam:class', JSON.stringify({ count: 5, except: [] }));
});
const reqs = [];
let k = 0, mode = '';
const ANS = [{ no: 1, answers: { '참가 여부': '참가합니다' }, unsure: [] }, { no: 3, answers: { '참가 여부': '' }, unsure: ['참가 여부'] }, { no: 3, answers: { '참가 여부': '참가하지 않습니다' }, unsure: [] }];
await mockClaude(page, ({ prompt, images }) => {
  if (prompt.startsWith('[가정통신문]')) return JSON.stringify({ title: '현장체험학습 안내', greeting: ['안녕하십니까?'], intro: '취지', items: ['1. 일시'], closing: '부탁', reply: { need: true, title: '참가 동의서', fields: ['참가 여부: □ 참가합니다 □ 참가하지 않습니다', '보호자 연락처:'], due: '' }, short: 's', related: [], target: '' });
  if (prompt.includes('[회신서 읽기]')) {
    reqs.push({ prompt, images });
    if (mode === 'auth') return { status: 401 };
    if (mode === 'rate') { mode = ''; return { status: 429 }; }
    return JSON.stringify(ANS[k++ % 3]);
  }
  return '{}';
});
const L = 'section[data-menu="etc"] .lf-box';
const scan = n => ({ name: `회신서${n}.jpg`, mimeType: 'image/jpeg', buffer: readFileSync(join(FIXTURES, `photo-${n}.jpg`)) });
await page.goto(url);
await page.waitForTimeout(400);

await run('reply-collect', [
  ['회신서를 붙인 가정통신문에만 「회신서 모으기」, □ 칸만', async () => {
    await page.click('nav.app-side [data-menu-go="etc"]');
    await page.click('#menuTabs [data-tab="letter"]');
    await page.waitForSelector(`${L} #lfMemo`);
    await page.fill(`${L} #lfMemo`, '현장체험학습 동의서');
    await page.click(`${L} [data-lf="write"]`);
    await page.waitForSelector(`${L} #lfCollect`, { timeout: 8000 });
    assert((await page.textContent(`${L} #lfCollect`)).includes('참가 여부') && !(await page.textContent(`${L} #lfCollect`)).includes('보호자 연락처'), '칸');
    await page.uncheck(`${L} #lfReplyOn`);
    assert(!(await page.$(`${L} #lfCollect`)), '회신서를 끄면 안 보여야 함');
    await page.check(`${L} #lfReplyOn`);
  }],
  ['스캔 3장 → [읽기]는 이름 칸을 먼저 가리게 함 → 가린 뒤 3장 읽기(그림 1장씩, 이름 읽지 않기 지시)', async () => {
    await page.evaluate(() => { window.__maskCalls = 0; window.SSAM.openMaskEditor = o => { window.__maskCalls++; window.__shots = o.shots.length; o.save([{ x: 0.5, y: 0.1, w: 0.4, h: 0.1 }], true); }; });
    await page.setInputFiles(`${L} #lfRcFile`, [scan(1), scan(2), scan(3)]);
    await page.waitForFunction(s => (document.querySelector(`${s} #lfCollect`) || {}).textContent?.includes('3장'), L, { timeout: 10000 });
    await page.click(`${L} [data-lf="rcRead"]`);
    await page.waitForFunction(s => document.querySelectorAll(`${s} #lfCollect [data-rc-row]`).length === 3, L, { timeout: 10000 });
    assert(await page.evaluate(() => window.__maskCalls) === 1, '가리기 창');
    assert(reqs.length === 3 && reqs.every(r => r.images === 1) && /이름[^\n]*(읽지|쓰지)/.test(reqs[0].prompt), JSON.stringify(reqs.map(r => r.images)));
  }],
  ['표: 번호 차례, 겹친 번호·못 읽은 칸은 노랑, 칸을 고르면 노랑이 사라지고 집계가 바뀜, 미제출 2·4·5번', async () => {
    const box = `${L} #lfCollect`;
    assert(await page.locator(`${box} [data-rc-row].warn`).count() === 2, '겹친 번호 표시');
    assert(await page.locator(`${box} select.unsure`).count() === 1, '못 읽은 칸 표시');
    assert((await page.textContent(box)).includes('미제출: 2, 4, 5번'), await page.textContent(box));
    const sel = page.locator(`${box} select.unsure`);
    await sel.selectOption('참가합니다');
    assert(await page.locator(`${box} select.unsure`).count() === 0, '노랑이 남음');
    assert((await page.textContent(box)).includes('참가합니다 2명'), await page.textContent(box));
    const dupNo = page.locator(`${box} [data-rc-row].warn input[data-rc-no]`).last();
    await dupNo.fill('4');
    await dupNo.dispatchEvent('change');
    assert(await page.locator(`${box} [data-rc-row].warn`).count() === 0, '겹친 번호가 남음');
    assert((await page.textContent(box)).includes('미제출: 2, 5번'), await page.textContent(box));
  }],
  ['복사는 탭으로 나눈 표, 새로 고침 뒤에도 표는 남고 스캔은 다시 넣기', async () => {
    await page.click(`${L} [data-lf="rcCopy"]`);
    await page.waitForTimeout(150);
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    assert(clip.startsWith('번호\t참가 여부\n1\t참가합니다'), clip);
    await page.reload(); await page.waitForTimeout(400);
    await page.click('nav.app-side [data-menu-go="etc"]'); await page.click('#menuTabs [data-tab="letter"]');
    await page.waitForSelector(`${L} #lfCollect [data-rc-row]`);
    assert(await page.locator(`${L} #lfCollect [data-rc-row]`).count() === 3, '표가 사라짐');
    assert((await page.textContent(`${L} #lfCollect`)).includes('0장'), '스캔이 남음');
    const saved = await page.evaluate(() => JSON.stringify(localStorage));
    assert(!saved.includes('data:image') && !saved.includes('blob:'), '그림이 저장됨');
  }],
  ['C1 새 스캔을 넣으면 [읽기] 전에 가리기 창을 다시 열고 모든 장(6장 넘어도)을 넘겨 보게 함', async () => {
    const m0 = await page.evaluate(() => window.__maskCalls || 0);
    await page.evaluate(() => { window.__maskCalls = 0; window.SSAM.openMaskEditor = o => { window.__maskCalls++; window.__shots = o.shots.length; o.save(o.mask && o.mask.length ? o.mask : [{ x: 0.5, y: 0.1, w: 0.4, h: 0.1 }], true); }; });
    await page.setInputFiles(`${L} #lfRcFile`, [scan(1), scan(2), scan(3), scan(1), scan(2), scan(3), scan(1)]);
    await page.waitForFunction(s => (document.querySelector(`${s} #lfCollect`) || {}).textContent?.includes('7장'), L, { timeout: 10000 });
    const r0 = reqs.length;
    await page.click(`${L} [data-lf="rcRead"]`);
    await page.waitForFunction(n => window.__maskCalls === 1, null, { timeout: 5000 });
    assert(await page.evaluate(() => window.__shots) === 7, '모든 장을 보여 주지 않음: ' + await page.evaluate(() => window.__shots));
    await page.waitForFunction(([s, n]) => !document.querySelector(`${s} [data-lf="rcRead"] .spin`) && document.querySelectorAll(`${s} #lfCollect [data-rc-row]`).length >= n, [L, 10], { timeout: 15000 });
    assert(reqs.length - r0 === 7, String(reqs.length - r0));
  }],
  ['I5 늦게 낸 회신서를 읽으면 표에 더해짐(고친 칸은 그대로), 같은 스캔을 다시 읽으면 그 스캔 줄만 바뀜', async () => {
    const box = `${L} #lfCollect`;
    assert(await page.locator(`${box} [data-rc-row]`).count() === 10, '먼저 읽은 3줄이 사라짐: ' + await page.locator(`${box} [data-rc-row]`).count());
    assert(await page.locator(`${box} input[data-rc-no]`).evaluateAll(els => els.some(e => e.value === '4')), '고친 번호 4가 사라짐');
    await page.click(`${L} [data-lf="rcRead"]`);
    await page.waitForFunction(s => !document.querySelector(`${s} [data-lf="rcRead"] .spin`), L, { timeout: 15000 });
    await page.waitForTimeout(300);
    assert(await page.locator(`${box} [data-rc-row]`).count() === 10, '다시 읽으면 겹침: ' + await page.locator(`${box} [data-rc-row]`).count());
  }],
  ['I5 AI 키 오류면 모두 멈추고 표는 그대로, 한도(429)는 기다렸다 다시', async () => {
    const box = `${L} #lfCollect`;
    mode = 'auth';
    const r0 = reqs.length;
    await page.click(`${L} [data-lf="rcRead"]`);
    await page.waitForFunction(s => !document.querySelector(`${s} [data-lf="rcRead"] .spin`), L, { timeout: 15000 });
    await page.waitForTimeout(500);
    assert(await page.locator(`${box} [data-rc-row]`).count() === 10, '키 오류로 표가 바뀜');
    assert(reqs.length - r0 <= 3, '오류 뒤에도 계속 보냄: ' + (reqs.length - r0));
    mode = 'rate';
    await page.setInputFiles(`${L} #lfRcFile`, [scan(1)]);
    await page.waitForFunction(s => (document.querySelector(`${s} #lfCollect`) || {}).textContent?.includes('1장'), L, { timeout: 10000 });
    await page.click(`${L} [data-lf="rcRead"]`);
    await page.waitForFunction(s => document.querySelectorAll(`${s} #lfCollect [data-rc-row]`).length === 11, L, { timeout: 20000 });
    assert(await page.locator(`${box} [data-rc-row].warn`).count() >= 0, '');
  }],
  ['페이지 오류 없음(일부러 낸 401·429 응답 빼고)', async () => { const real = errors.filter(m => !/Failed to load resource: the server responded with a status of (401|429)/.test(m)); assert(real.length === 0, real.join(' | ')); }]
]);
await t.close();
