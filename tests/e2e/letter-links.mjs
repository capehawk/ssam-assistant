// 본문 표·양식 잇기(스펙 2026-11-04 3·4장): 가정통신문 본문 「|」 줄 → 표 미리보기·한글 파일의 표,
// 결과 보고서를 저장한 학교 양식으로 내려받기(개요 표·사진 표), 자리가 안 맞는 양식은 알림
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { open, run, assert, mockClaude, ROOT, FIXTURES } from './helpers.mjs';

const t = await open();
const { page, url, errors } = t;
await page.addInitScript(() => {
  if (!localStorage.getItem('ssam:engine')) localStorage.setItem('ssam:engine', JSON.stringify({ engine: 'claude', keys: { claude: 'sk-test' }, remember: true }));
});
await mockClaude(page, ({ prompt }) => (prompt.startsWith('[가정통신문]')
  ? JSON.stringify({ title: '현장체험학습 안내', greeting: ['안녕하십니까?'], intro: '취지', items: ['1. 일정', '| 시간 | 내용 |', '| 09:00 | 출발 |'], closing: '부탁드립니다.', reply: { need: false }, short: '짧은 글', related: [], target: '보호자' })
  : JSON.stringify({ name: '2026 과학의 날 행사', period: { start: '2026-04-21' }, place: '강당', target: '전교생', summary: '실험', sections: [{ h: '목적', lines: ['흥미'] }], photos: ['모둠별 실험 장면'] })));
const L = 'section[data-menu="etc"] .lf-box', P = 'section[data-menu="plan"] .rp-box';
const FORM = readFileSync(join(ROOT, 'samples', '가정통신문-양식-예시.hwpx'));
const dec = u8 => new TextDecoder().decode(u8);
const unzipDl = async dl => { const { unzip } = await import('../../web/core/zip.js'); return unzip(new Uint8Array(readFileSync(await dl.path()))); };

await page.goto(url);
await page.waitForTimeout(400);

await run('letter-links', [
  ['가정통신문: 본문 「|」 줄은 표 미리보기, 고치면 바로 바뀜, 한글 파일에는 표', async () => {
    await page.click('nav.app-side [data-menu-go="etc"]');
    await page.click('#menuTabs [data-tab="letter"]');
    await page.waitForSelector(`${L} #lfFormFile`, { state: 'attached' });
    await page.waitForTimeout(400);
    await page.setInputFiles(`${L} #lfFormFile`, { name: '새싹 양식.hwpx', mimeType: 'application/octet-stream', buffer: FORM });
    await page.waitForFunction(s => (document.querySelector(`${s} #lfForm`) || {}).value, L, { timeout: 8000 });
    await page.fill(`${L} #lfMemo`, '11월 12일 현장체험학습');
    await page.click(`${L} [data-lf="write"]`);
    await page.waitForSelector(`${L} #lfTbl table`, { timeout: 8000 });
    assert((await page.textContent(`${L} #lfTbl th`)) === '시간', await page.textContent(`${L} #lfTbl`));
    const body = await page.inputValue(`${L} [data-lo="body"]`);
    await page.fill(`${L} [data-lo="body"]`, body.replace('| 09:00 | 출발 |', '| 09:00 | 출발 |\n| 15:00 | 도착 |'));
    assert((await page.textContent(`${L} #lfTbl`)).includes('도착'), '미리보기가 안 바뀜');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click(`${L} [data-lf="download"]`)]);
    const sec = dec((await unzipDl(dl)).get('Contents/section0.xml'));
    assert(sec.includes('rowCnt="3" colCnt="2"') && !sec.includes('| 09:00 |'), '표가 아님');
  }],
  ['결과 보고: 저장한 학교 양식을 고르면 그 양식으로 내려받기(개요 표·사진 표·새 제목)', async () => {
    await page.click('nav.app-side [data-menu-go="plan"]');
    await page.click('#menuTabs [data-tab="report"]');
    await page.waitForSelector(`${P} #rpFile`, { state: 'attached' });
    await page.setInputFiles(`${P} #rpFile`, [{ name: '사진1.jpg', mimeType: 'image/jpeg', buffer: readFileSync(join(FIXTURES, 'photo-1.jpg')) }]);
    await page.waitForSelector(`${P} [data-rp-cap]`);
    await page.click(`${P} [data-rp="write"]`);
    await page.waitForSelector(`${P} #rpForm`, { timeout: 8000 });
    await page.waitForFunction(s => document.querySelectorAll(`${s} #rpForm option`).length > 1, P, { timeout: 5000 });
    await page.selectOption(`${P} #rpForm`, { label: '새싹 양식' });
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click(`${P} [data-rp="formExport"]`)]);
    assert(dl.suggestedFilename().endsWith('.hwpx'), dl.suggestedFilename());
    const z = await unzipDl(dl), sec = dec(z.get('Contents/section0.xml'));
    assert(sec.includes('결과 보고서') && sec.includes('개요') && sec.includes('<hc:img binaryItemIDRef="ssamimg'), '보고서·사진');
    assert(sec.includes('꿈을 키우는 새싹 교육') && !sec.includes('학부모 상담 주간 안내'), '양식 머리가 없거나 옛 제목이 남음');
    assert([...z.keys()].some(k => /^BinData\/ssamimg\d+\.jpg$/.test(k)), '사진 파일');
  }],
  ['결과 보고: 다시 들어와도 고른 학교 양식이 남음', async () => {
    await page.click('#menuTabs [data-tab="event"]');
    await page.click('#menuTabs [data-tab="report"]');
    await page.waitForFunction(s => { const o = document.querySelector(`${s} #rpForm`); return o && o.selectedOptions[0] && o.selectedOptions[0].textContent.includes('새싹 양식'); }, P, { timeout: 5000 });
  }],
  ['페이지 오류 없음', async () => { assert(errors.length === 0, errors.join(' | ')); }]
]);
await t.close();
