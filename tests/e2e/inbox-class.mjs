// 떠 있는 버튼 › 학급·명단·품의: 진도표 → 교과 고르기, 시간표 → 학년·반 입력 칸, 명단 → 명단 확인, 견적서 CSV·사진 → 새 품의 품목, 품의 화면 [견적서 넣기]
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { open, run, assert, mockClaude, FIXTURES } from './helpers.mjs';

const t = await open();
const { page, url, errors } = t;
await page.clock.setFixedTime(new Date('2026-10-29T09:00:00'));
await page.addInitScript(() => {
  if (!localStorage.getItem('ssam:engine')) localStorage.setItem('ssam:engine', JSON.stringify({ engine: 'claude', keys: { claude: 'sk-test' }, remember: true }));
});
const prompts = [];
await mockClaude(page, async ({ prompt, images }) => {
  prompts.push({ prompt, images });
  if (prompt.startsWith('[견적서 읽기]') || prompt.startsWith('[품의 넣기]')) return JSON.stringify({ items: [{ name: '돋보기', spec: '10배', qty: 5, price: 2000 }, { name: '합계', price: 10000 }] });
  return '{}';
});
const sheet = '#sheetRoot .sheet';
const pick = files => page.setInputFiles('#inboxFile', files);
const runCard = async () => { await page.waitForSelector(`${sheet} #ibRun:not([disabled])`); await page.click(`${sheet} #ibRun`); };
const ls = k => page.evaluate(k => JSON.parse(localStorage.getItem('ssam:' + k) || 'null'), k);
const items = () => page.evaluate(() => (JSON.parse(localStorage.getItem('ssam:purchase:current') || 'null') || { form: { items: [] } }).form.items.filter(i => i.name));
await page.goto(url);
await page.waitForTimeout(400);

await run('inbox-class', [
  ['진도표 → 학급 › 진도표·시수의 교과 고르기 창 → 넣기', async () => {
    await pick(join(FIXTURES, 'jindo-sample.txt'));
    await page.waitForSelector(sheet);
    assert((await page.textContent(sheet)).includes('진도표'), '종류');
    await runCard();
    await page.waitForSelector('#sheetRoot [data-c="pickOk"]');
    assert(await page.isVisible('#menuTabs [data-tab="progress"][aria-current="page"]'), '진도표·시수 탭');
    await page.click('#sheetRoot [data-c="pickOk"]');
    await page.waitForFunction(() => (JSON.parse(localStorage.getItem('ssam:class:subjects') || '[]')).length >= 2);
  }],
  ['시간표: 학년·반이 없으면 입력 칸 → 학급 정보와 시간표', async () => {
    await pick(join(FIXTURES, 'timetable-sample.txt'));
    await page.waitForSelector(`${sheet} [data-ib-field="room"]`);
    await page.selectOption(`${sheet} [data-ib-field="grade"]`, '3');
    await page.fill(`${sheet} [data-ib-field="room"]`, '2');
    await runCard();
    await page.waitForFunction(() => { const t = JSON.parse(localStorage.getItem('ssam:class:timetable') || 'null'); return t && t.cells && t.cells[0].some(Boolean); });
    const info = await ls('class:info');
    assert(info.grade === 3 && info.room === 2, JSON.stringify(info));
  }],
  ['학급 명단 CSV → 설정 › 학급 명단 확인 창 → 넣기', async () => {
    await pick(join(FIXTURES, 'roster-sample.csv'));
    await runCard();
    await page.waitForSelector('#sheetRoot #rosterOk');
    await page.click('#sheetRoot #rosterOk');
    await page.waitForFunction(() => (JSON.parse(localStorage.getItem('ssam:class') || 'null') || {}).count > 0);
    assert(await page.isVisible('#menuTabs [data-tab="roster"][aria-current="page"]'), '학급 명단 탭');
  }],
  ['견적서 CSV → 새 품의 품목 3줄(AI 없이)', async () => {
    const n0 = prompts.length;
    await pick(join(FIXTURES, 'quote.csv'));
    await page.waitForSelector(sheet);
    assert((await page.textContent(sheet)).includes('견적서'), '종류');
    await runCard();
    await page.waitForFunction(() => (JSON.parse(localStorage.getItem('ssam:purchase:current') || 'null') || { form: { items: [] } }).form.items.filter(i => i.name).length === 3);
    assert(prompts.length === n0 && await page.isVisible('#menuTabs [data-tab="new"][aria-current="page"]'), 'AI·탭');
    assert((await items()).map(i => i.name).join() === '비커,스포이트,실험 장갑', JSON.stringify(await items()));
  }],
  ['지금 쓰는 품의가 있으면 더할지 새로 할지 고름 → 사진 견적서는 AI 한 번(이미지 1장)', async () => {
    const png = await page.screenshot({ clip: { x: 0, y: 0, width: 200, height: 120 } });
    await pick({ name: '견적서.png', mimeType: 'image/png', buffer: png });
    await page.waitForSelector(`${sheet} [data-ib-field="where"]`);
    assert(await page.inputValue(`${sheet} [data-ib-field="where"]`) === 'add', '기본은 더하기');
    await runCard();
    await page.waitForFunction(() => (JSON.parse(localStorage.getItem('ssam:purchase:current') || 'null') || { form: { items: [] } }).form.items.filter(i => i.name).length === 4);
    const q = prompts.filter(p => p.prompt.startsWith('[품의 넣기]'));
    assert(q.length === 1 && q[0].images === 1, JSON.stringify(q.map(p => p.images)));
    assert((await items())[3].name === '돋보기' && (await items())[3].price === '2000', JSON.stringify((await items())[3]));
  }],
  ['품의 화면 넣기 칸 [파일 고르기]도 같은 읽기(빈 줄을 먼저 채움)', async () => {
    await page.evaluate(() => localStorage.setItem('ssam:purchase:current', JSON.stringify({ form: { type: 'goods', items: [{ name: '', spec: '', qty: '', price: '' }] }, draft: null })));
    await page.reload(); await page.waitForTimeout(400);
    await page.click('nav.app-side [data-menu-go="purchase"]');
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('section[data-menu="purchase"] [data-pc="intakeFile"]')]);
    await fc.setFiles(join(FIXTURES, 'quote.csv'));
    await page.waitForFunction(() => document.querySelectorAll('section[data-menu="purchase"] [data-item][data-f="name"]').length === 3);
    assert(await page.inputValue('section[data-menu="purchase"] [data-item="0"][data-f="name"]') === '비커', '첫 줄');
  }],
  ['진도표와 명단을 함께 넣으면 진도표의 교과 고르기 창이 끝난 뒤에 명단 카드(창이 덮이지 않음)', async () => {
    await pick([join(FIXTURES, 'jindo-sample.txt'), join(FIXTURES, 'roster-sample.csv')]);
    await runCard();
    await page.waitForSelector('#sheetRoot [data-c="pickOk"]');
    await page.waitForTimeout(500);
    assert(await page.locator('#sheetRoot [data-c="pickOk"]').count() === 1, '교과 고르기 창이 덮임');
    await page.click('#sheetRoot [data-c="pickOk"]');
    await page.waitForSelector(`${sheet} #ibRun`);
    assert((await page.textContent(sheet)).includes('학급 명단'), await page.textContent(sheet));
    await runCard();
    await page.waitForSelector('#sheetRoot #rosterOk');
    await pick(join(FIXTURES, 'quote.csv'));
    await page.waitForTimeout(500);
    assert(await page.locator('#sheetRoot #rosterOk').count() === 1, '명단 확인 창이 덮임');
    await page.click('#sheetRoot #rosterOk');
    await page.waitForSelector(`${sheet} #ibRun`);
    assert((await page.textContent(sheet)).includes('견적서'), '다음 카드');
    await page.click(`${sheet} [data-close]`);
  }],
  ['품의 화면 넣기 칸 [파일 고르기]: AI가 키 오류(401)면 「키가 맞지 않아요」 안내(파일 탓으로 말하지 않음)', async () => {
    const deny = r => r.fulfill({ status: 401, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }) });
    await page.route('https://api.anthropic.com/**', deny);
    await page.click('nav.app-side [data-menu-go="purchase"]');
    const png = await page.screenshot({ clip: { x: 0, y: 0, width: 200, height: 120 } });
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('section[data-menu="purchase"] [data-pc="intakeFile"]')]);
    await fc.setFiles({ name: '견적서.png', mimeType: 'image/png', buffer: png });
    await page.waitForFunction(() => /키가 맞지 않아요/.test(document.body.textContent), null, { timeout: 15000 });
    assert(!/견적서를 읽지 못했어요/.test(await page.textContent('body')), '파일 탓으로 안내');
    await page.unroute('https://api.anthropic.com/**', deny);
    for (let i = errors.length - 1; i >= 0; i--) if (/status of 401/.test(errors[i])) errors.splice(i, 1);
  }],
  ['진도표 두 개를 함께 넣으면 카드는 한 번, 교과 고르기 창은 파일마다 차례로(앞 창을 닫은 뒤에 다음)', async () => {
    const body = readFileSync(join(FIXTURES, 'jindo-sample.txt'));
    await pick([{ name: '진도표 가.txt', mimeType: 'text/plain', buffer: body }, { name: '진도표 나.txt', mimeType: 'text/plain', buffer: body }]);
    await page.waitForSelector(`${sheet} #ibRun`);
    const card = await page.textContent(sheet);
    assert(card.includes('진도표 가') && card.includes('진도표 나'), card);
    await runCard();
    await page.waitForFunction(() => /진도표 가/.test((document.querySelector('#sheetRoot') || {}).textContent || '') && document.querySelector('#sheetRoot [data-c="pickOk"]'));
    await page.click('#sheetRoot [data-c="pickOk"]');
    await page.waitForFunction(() => /진도표 나/.test((document.querySelector('#sheetRoot') || {}).textContent || '') && document.querySelector('#sheetRoot [data-c="pickOk"]'));
    assert(await page.locator('#sheetRoot #ibRun').count() === 0, '카드가 또 나옴');
    await page.click('#sheetRoot [data-c="pickOk"]');
    await page.waitForFunction(() => !document.querySelector('#sheetRoot').childElementCount);
  }],
  ['페이지 오류 없음', async () => { assert(errors.length === 0, errors.join(' | ')); }]
]);
await t.close();
