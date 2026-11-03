// 계획 › 결과 보고: 계획서·작년 보고서·공문(글)·사진 2장 넣기 → 종류 칩, 명단·전화번호 줄 빼기 → AI 한 번(사진 2장 그림) →
// 결과 보고 공문(관련·가나다라·붙임)·보고서 칸, 칸 고치면 공문도, 손으로 고친 공문은 그대로, 한글 내려받기에 사진 2장,
// 새로 고침 뒤 글·칸은 남고 사진은 다시 넣기 안내, 최근 결과 보고, 행사계획에서 넣기
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { open, run, assert, mockClaude, FIXTURES } from './helpers.mjs';

const t = await open();
const { page, ctx, url, errors } = t;
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: url.replace(/\/$/, '') });
await page.addInitScript(() => {
  if (!localStorage.getItem('ssam:engine')) localStorage.setItem('ssam:engine', JSON.stringify({ engine: 'claude', keys: { claude: 'sk-test' }, remember: true }));
});
const reqs = [];
await mockClaude(page, ({ prompt, images }) => {
  reqs.push({ prompt, images });
  return JSON.stringify({
    name: '2026 과학의 날 행사', related: [{ no: '○○초-1234', date: '2026-03-10', title: '2026 과학의 날 행사 운영 계획' }],
    period: { start: '2026-04-21', end: '', time: '' }, place: '본교 강당', target: '전교생', count: '320명', summary: '학년별 과학 탐구 실험과 발명품 전시',
    sections: [{ h: '목적', lines: ['과학에 대한 흥미를 높임'] }, { h: '추진 내용', lines: ['1~2학년: 비눗방울 실험', '3~6학년: 발명품 만들기'] }, { h: '성과', lines: ['모든 학년이 참여함'] }, { h: '반성 및 개선 방안', lines: ['발표 시간을 늘림'] }],
    photos: ['모둠별 실험 장면', '발명품 발표']
  });
});
const P = 'section[data-menu="plan"] .rp-box';
const PLAN = '2026 과학의 날 행사 운영 계획\n1. 목적: 과학에 대한 흥미\n2. 일시: 2026. 4. 21.(화)\n3. 장소: 본교 강당\n담당 교사 연락처 010-1234-5678';
const LAST = '2025 과학의 날 행사 운영 결과 보고서\n1. 개요\n2. 추진 내용\n3. 성과\n4. 반성 및 개선 방안';
const GONG = '○○교육청\n수신  수신자 참조\n(경유)\n제목  2026 과학의 날 운영 안내\n참가 명단: 김가람 이나래 박하늘';

await page.goto(url);
await page.waitForTimeout(400);

await run('report', [
  ['계획 메뉴에 「결과 보고」 탭', async () => {
    await page.click('nav.app-side [data-menu-go="plan"]');
    assert((await page.textContent('#menuTabs')).includes('결과 보고'), '탭');
    await page.click('#menuTabs [data-tab="report"]');
    await page.waitForSelector(`${P} #rpFile`, { state: 'attached' });
    assert(await page.isHidden('section[data-menu="plan"] .yp-box') || !(await page.$('section[data-menu="plan"] .yp-box')), '연간계획이 보임');
  }],
  ['문서 3개·사진 2장 넣기 → 종류(계획서·작년 보고서·관련 공문), 사진 칸 2개, 명단·전화번호 줄 빼기 안내', async () => {
    await page.setInputFiles(`${P} #rpFile`, [
      { name: '2026 과학의 날 운영 계획.txt', mimeType: 'text/plain', buffer: Buffer.from(PLAN) },
      { name: '2025 과학의 날 결과보고.txt', mimeType: 'text/plain', buffer: Buffer.from(LAST) },
      { name: '안내 공문.txt', mimeType: 'text/plain', buffer: Buffer.from(GONG) },
      { name: '사진1.jpg', mimeType: 'image/jpeg', buffer: readFileSync(join(FIXTURES, 'photo-1.jpg')) },
      { name: '사진2.jpg', mimeType: 'image/jpeg', buffer: readFileSync(join(FIXTURES, 'photo-2.jpg')) }]);
    await page.waitForFunction(s => document.querySelectorAll(`${s} [data-rp-cap]`).length === 2 && document.querySelectorAll(`${s} [data-rp-kind]`).length === 3, P);
    const kinds = await page.$$eval(`${P} [data-rp-kind]`, els => els.map(e => e.value));
    assert(JSON.stringify(kinds) === JSON.stringify(['plan', 'last', 'official']), JSON.stringify(kinds));
    assert((await page.textContent('#toast')).includes('빼고'), await page.textContent('#toast'));
  }],
  ['[결과 보고 쓰기] → AI 한 번(사진 2장 그림, 작년 짜임, 한 일, 전화번호·명단 없음) → 공문·보고서', async () => {
    await page.fill(`${P} #rpMemo`, '4월 21일 강당에서 전교생 참여. 발표 시간이 모자랐음.');
    await page.click(`${P} [data-rp="write"]`);
    await page.waitForFunction(s => (document.querySelector(`${s} #rpBody`) || {}).value, P, { timeout: 8000 });
    assert(reqs.length === 1 && reqs[0].images === 2, JSON.stringify(reqs.map(r => r.images)));
    const p = reqs[0].prompt;
    assert(p.includes('[작년 보고서: 2025 과학의 날 결과보고.txt]') && p.includes('작년 보고서의 소제목 차례와 문체') && p.includes('발표 시간이 모자랐음') && p.includes('앞의 사진 2장'), p.slice(0, 500));
    assert(!p.includes('010-1234-5678') && !p.includes('김가람'), '개인정보');
    assert((await page.inputValue(`${P} #rpTitle`)) === '2026 과학의 날 행사 운영 결과 보고', await page.inputValue(`${P} #rpTitle`));
    const body = await page.inputValue(`${P} #rpBody`);
    assert(body.startsWith('1. 관련: ○○초-1234(2026. 3. 10.) 「2026 과학의 날 행사 운영 계획」\n2. 위 호와 관련하여') && body.includes('  다. 대상: 전교생(320명)') && body.endsWith('붙임  2026 과학의 날 행사 운영 결과 보고서 1부.  끝.'), body);
    const caps = await page.$$eval(`${P} [data-rp-cap]`, els => els.map(e => e.value));
    assert(JSON.stringify(caps) === JSON.stringify(['모둠별 실험 장면', '발명품 발표']), JSON.stringify(caps));
    assert(await page.locator(`${P} [data-rs-h]`).count() === 4, '소제목 수');
  }],
  ['장소 칸을 고치면 공문도, 공문을 손으로 고치면 그대로·[칸으로 다시 맞추기]', async () => {
    await page.fill(`${P} [data-rf="place"]`, '체육관');
    await page.waitForFunction(s => document.querySelector(`${s} #rpBody`).value.includes('나. 장소: 체육관'), P);
    await page.fill(`${P} #rpBody`, (await page.inputValue(`${P} #rpBody`)) + '\n덧붙임');
    await page.fill(`${P} [data-rf="place"]`, '운동장');
    await page.waitForTimeout(150);
    assert((await page.inputValue(`${P} #rpBody`)).includes('나. 장소: 체육관') && (await page.inputValue(`${P} #rpBody`)).includes('덧붙임'), '고친 공문을 덮음');
    await page.click(`${P} [data-rp="resync"]`);
    await page.waitForFunction(s => document.querySelector(`${s} #rpBody`).value.includes('나. 장소: 운동장') && !document.querySelector(`${s} #rpBody`).value.includes('덧붙임'), P);
  }],
  ['[모두 복사] → 제목과 본문', async () => {
    await page.click(`${P} [data-rp="copyAll"]`);
    await page.waitForTimeout(150);
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    assert(clip.startsWith('2026 과학의 날 행사 운영 결과 보고\n\n1. 관련:'), clip.slice(0, 80));
  }],
  ['한글로 내려받기 → 보고서(개요 표·소제목·사진 2장·고친 설명)', async () => {
    await page.fill(`${P} [data-rp-cap="1"]`, '발명품 발표 장면');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click(`${P} [data-rp="export"]`)]);
    assert(dl.suggestedFilename() === '2026 과학의 날 행사 운영 결과 보고서.hwpx', dl.suggestedFilename());
    const { unzip } = await import('../../web/core/zip.js');
    const z = await unzip(new Uint8Array(readFileSync(await dl.path())));
    const keys = [...z.keys()];
    assert(keys.includes('BinData/image1.jpg') && keys.includes('BinData/image2.jpg') && !keys.includes('BinData/image3.jpg'), keys.join(','));
    const sec = new TextDecoder().decode(z.get('Contents/section0.xml'));
    assert(sec.includes('1. 개요') && sec.includes('6. 사진 자료') && sec.includes('발명품 발표 장면') && sec.includes('운동장'), '보고서 글');
  }],
  ['새로 고침 → 글·칸·공문은 남고 사진은 「다시 넣어 주세요」, 최근 결과 보고에 남음', async () => {
    await page.reload(); await page.waitForTimeout(500);
    await page.click('nav.app-side [data-menu-go="plan"]'); await page.click('#menuTabs [data-tab="report"]');
    await page.waitForSelector(`${P} #rpBody`);
    assert((await page.inputValue(`${P} #rpBody`)).includes('나. 장소: 운동장'), '공문');
    assert((await page.textContent(`${P} #rpPhotos`)).includes('다시 넣어'), await page.textContent(`${P} #rpPhotos`));
    assert((await page.inputValue(`${P} #rpMemo`)).includes('발표 시간'), '메모');
    assert((await page.textContent(`${P} #rpRecent`)).includes('2026 과학의 날 행사 운영 결과 보고서'), '최근');
  }],
  ['[새 결과 보고] → 빈 화면, 최근에서 [열기] → 다시', async () => {
    await page.click(`${P} [data-rp="new"]`);
    assert(!(await page.$(`${P} #rpBody`)) && (await page.inputValue(`${P} #rpMemo`)) === '', '비지 않음');
    await page.click(`${P} #rpRecent [data-rp-open]`);
    await page.waitForSelector(`${P} #rpBody`);
    assert((await page.inputValue(`${P} #rpTitle`)) === '2026 과학의 날 행사 운영 결과 보고', '열기');
  }],
  ['행사계획에서 넣기(putReportSources) → 결과 보고 탭, 계획서·설문 보고서 글, 메모에 행사 정보', async () => {
    await page.evaluate(async () => { const m = await import('./menus/plan/report.js'); m.putReportSources({ sources: [{ kind: 'plan', name: '체육대회 계획서', text: '2026 체육대회 운영 계획' }, { kind: 'etc', name: '설문 결과 보고서', text: '' }], memo: '행사명: 2026 체육대회\n' }); });
    await page.waitForFunction(s => document.querySelectorAll(`${s} [data-rp-kind]`).length === 1, P);
    assert((await page.inputValue(`${P} #rpMemo`)).startsWith('행사명: 2026 체육대회'), '메모');
    assert(await page.isVisible(`${P} [data-rp="write"]`), '결과 보고 탭');
  }],
  ['페이지 오류 없음', async () => { assert(errors.length === 0, errors.join(' | ')); }]
]);
await t.close();
