// 파일 형식 고르기: [○○로 내려받기][▾] — ▾에서 한글·워드·PDF를 고르면 그 형식으로 바로, 고른 형식은 모든 메뉴가 기억,
// 워드 파일은 제목·표가 든 .docx, PDF는 인쇄 창(문서만 인쇄), 한글은 그대로 .hwpx
import { readFileSync } from 'node:fs';
import { open, run, assert } from './helpers.mjs';
import { unzip } from '../../web/core/zip.js';

const t = await open();
const { page, url, errors } = t;
await page.clock.setFixedTime(new Date('2026-10-29T09:00:00'));
const C = 'section[data-menu="class"]', E = 'section[data-menu="evaluate"] .unit-box';
const tab = async (m, id) => { await page.click(`nav.app-side [data-menu-go="${m}"]`); await page.click(`#menuTabs [data-tab="${id}"]`); };
const dec = u => new TextDecoder().decode(u);
await page.goto(url);
await page.waitForTimeout(400);
await tab('class', 'progress');
await page.click(`${C} [data-c="sample"]`);
await tab('class', 'weekly');
const main = `${C} [data-w="hwpx"]`;
const more = `${C} .exp-split:has([data-w="hwpx"]) [data-exp-menu]`;

await run('doc-export', [
  ['주간학습안내: [한글로 내려받기][▾], 처음엔 한글 · .hwpx', async () => {
    assert((await page.textContent(main)).trim() === '한글로 내려받기', await page.textContent(main));
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click(main)]);
    assert(dl.suggestedFilename().endsWith('.hwpx'), dl.suggestedFilename());
  }],
  ['▾ → 한글·워드·PDF 목록(지금 것 표시) → 워드를 고르면 바로 .docx, 기억', async () => {
    await page.click(more);
    await page.waitForSelector('#expMenu');
    const items = await page.$$eval('#expMenu [data-exp-fmt]', els => els.map(e => [e.dataset.expFmt, e.getAttribute('aria-checked')]));
    assert(JSON.stringify(items) === JSON.stringify([['hwpx', 'true'], ['docx', 'false'], ['pdf', 'false']]), JSON.stringify(items));
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#expMenu [data-exp-fmt="docx"]')]);
    assert(dl.suggestedFilename().endsWith('.docx') && dl.suggestedFilename().includes('주간학습안내'), dl.suggestedFilename());
    const m = await unzip(new Uint8Array(readFileSync(await dl.path())));
    const d = dec(m.get('word/document.xml'));
    assert(d.includes('주간학습안내') && d.includes('<w:tbl>'), '워드 본문');
    assert(await page.isHidden('#expMenu'), '목록이 남음');
    assert((await page.textContent(main)).trim() === '워드로 내려받기', await page.textContent(main));
    assert((await page.evaluate(() => JSON.parse(localStorage.getItem('ssam:export')))).format === 'docx', '기억');
  }],
  ['다른 메뉴(단원평가 성적 일람표)도 기억한 형식: 워드로 내려받기 → .docx', async () => {
    await tab('evaluate', 'unit');
    await page.click(`${E} [data-un="sample"]`);
    await page.click(`${E} [data-unv="results"]`);
    const b = `${E} [data-un="tableHwpx"]`;
    await page.waitForSelector(b);
    assert((await page.textContent(b)).trim() === '워드로 내려받기', await page.textContent(b));
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click(b)]);
    assert(dl.suggestedFilename().endsWith('.docx'), dl.suggestedFilename());
  }],
  ['▾ 목록이 떠 있는 동안 화면이 다시 그려져도 고른 형식으로 내려받음', async () => {
    await tab('class', 'weekly');
    await page.click(more);
    await page.evaluate(() => { const m = document.querySelector('section[data-menu="class"] [data-w="hwpx"]'); m.replaceWith(m.cloneNode(true)); });
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#expMenu [data-exp-fmt="docx"]')]);
    assert(dl.suggestedFilename().endsWith('.docx'), dl.suggestedFilename());
  }],
  ['PDF: 인쇄 창으로 문서만 인쇄(인쇄하는 동안만 문서 칸), 안내, 파일 이름은 문서 이름', async () => {
    await page.evaluate(() => { window.__printed = null; window.print = () => { window.__printed = { cls: document.body.classList.contains('printing-doc'), text: document.getElementById('printDoc').textContent, title: document.title }; }; });
    await tab('class', 'weekly');
    await page.click(more);
    await page.click('#expMenu [data-exp-fmt="pdf"]');
    await page.waitForFunction(() => window.__printed);
    const p = await page.evaluate(() => window.__printed);
    assert(p.cls && p.text.includes('주간학습안내'), JSON.stringify(p).slice(0, 200));
    assert(p.title.startsWith('3학년 1반 주간학습안내('), '저장할 이름: ' + p.title);
    // A4 쪽 설정은 내보낸 문서에만(다른 [인쇄]는 가로·여백을 그대로 고를 수 있게)
    assert(!/@page\s*\{/.test(await page.evaluate(() => document.getElementById('printDocCss').textContent)), '이름 없는 @page');
    assert((await page.textContent(main)).trim() === 'PDF로 저장', await page.textContent(main));
    assert((await page.textContent('body')).includes('PDF로 저장'), '안내');
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    assert(!(await page.evaluate(() => document.body.classList.contains('printing-doc'))), '인쇄가 끝나도 문서 칸이 남음');
    assert(await page.evaluate(() => document.title) === '쌤비서', '창 제목이 돌아오지 않음: ' + await page.evaluate(() => document.title));
  }],
  ['인쇄 창이 안 떴어도(브라우저가 무시) 다음 [인쇄]는 그 화면을 인쇄(문서 칸이 남지 않음)', async () => {
    await page.evaluate(() => { window.__printed = null; window.print = () => { window.__printed = true; }; }); // 이벤트 없이 무시됨
    await page.click(more);
    await page.click('#expMenu [data-exp-fmt="pdf"]');
    await page.waitForFunction(() => window.__printed);
    await page.waitForTimeout(3200);
    await page.evaluate(() => window.dispatchEvent(new Event('beforeprint'))); // 주간학습안내 [인쇄]·Ctrl+P
    assert(!(await page.evaluate(() => document.body.classList.contains('printing-doc'))), '문서 칸이 남음');
  }],
  ['다시 한글을 고르면 .hwpx', async () => {
    await page.click(more);
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#expMenu [data-exp-fmt="hwpx"]')]);
    assert(dl.suggestedFilename().endsWith('.hwpx'), dl.suggestedFilename());
  }],
  ['페이지 오류 없음', async () => { assert(errors.length === 0, errors.join(' | ')); }]
]);
await t.close();
