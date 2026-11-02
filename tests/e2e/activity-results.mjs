// 평가 › 활동지 5단계: 문항별 통계(× 많은 문항 먼저), 반 표·피드백 쪽지 워드 내려받기(번호만), [확정] → 학생별 모아 보기(교과·학기),
// 「교과 평어에 참고하기」 기본 꺼짐 → 켜면 평가계획 영역 고르기 → 이음 저장, 영역 id가 바뀌어도 이름으로 이어짐, 이름도 바뀌면 「찾지 못했어요」
import { readFileSync } from 'node:fs';
import { open, run, assert } from './helpers.mjs';
import { unzip } from '../../web/core/zip.js';

const t = await open();
const { page, url, errors } = t;
const PLAN = { kind: 'plan', title: '2학기 평가계획', grade: 3, source: '', createdAt: 1, subjects: [{ name: '과학', units: [
  { id: 'u1', subject: '과학', period: '', std: '[4과01-02] 물의 상태 변화를 설명한다.', unit: '1. 물의 여행', area: '물질', elem: '물의 상태 변화', focus: '', crit: { top: '', high: '잘 설명함', mid: '설명함', low: '도움을 받아 설명함' } },
  { id: 'u2', subject: '과학', period: '', std: '[4과02-01] 식물의 한살이를 관찰한다.', unit: '2. 식물', area: '생명', elem: '식물의 한살이', focus: '', crit: { top: '', high: '잘 관찰함', mid: '관찰함', low: '도움을 받아 관찰함' } }] }] };
await page.addInitScript(p => {
  if (!localStorage.getItem('ssam:plans')) { localStorage.setItem('ssam:plan:P1', JSON.stringify(p)); localStorage.setItem('ssam:plans', JSON.stringify(['P1'])); localStorage.setItem('ssam:prefs', JSON.stringify({ current: 'P1' })); }
}, PLAN);
const P = 'section[data-menu="evaluate"]';
const acts = () => page.evaluate(() => (JSON.parse(localStorage.getItem('ssam:activity:list') || '[]')).map(s => JSON.parse(localStorage.getItem('ssam:activity:a:' + s.id))));
const go = async () => { await page.click('nav.app-side [data-menu-go="evaluate"]'); await page.click('#menuTabs [data-tab="activity"]'); };
const docxText = async (attr) => {
  await page.click(`${P} .exp-split:has([data-ac="${attr}"]) [data-exp-menu]`);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#expMenu [data-exp-fmt="docx"]')]);
  return new TextDecoder().decode((await unzip(new Uint8Array(readFileSync(await dl.path())))).get('word/document.xml'));
};
await page.goto(url);
await page.waitForTimeout(500);

await run('activity-results', [
  ['예시 활동지 → 5단계: 문항별 통계는 ×·안 함이 많은 문항 먼저', async () => {
    await go();
    await page.click(`${P} [data-ac="sample"]`);
    const id = (await acts())[0].id;
    await page.click(`${P} [data-ac-open="${id}"]`);
    await page.waitForSelector(`${P} #acStats`);
    const first = await page.textContent(`${P} #acStats li:first-child`);
    assert(first.includes('2번') && first.includes('× 1') && first.includes('안 함 1'), first);
  }],
  ['반 표 워드: 번호·○·잘한 점, 이름 칸 없음 · 피드백 쪽지 워드: 번호·잘한 점·더 해 볼 점', async () => {
    const tbl = await docxText('exportTable');
    assert(tbl.includes('번호') && tbl.includes('○') && tbl.includes('잘한 점') && !tbl.includes('이름'), '표');
    const slips = await docxText('exportSlips');
    assert(slips.includes('1번') && slips.includes('더 해 볼 점') && slips.includes('물의 여행을 차례대로 설명했어요'), '쪽지');
  }],
  ['[확정] → 학생별 모아 보기: 3번 기록, 과학·2학기로 거르면 있고 국어면 없음', async () => {
    await page.click(`${P} [data-ac="done"]`);
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('ssam:activity:list')).some(s => s.done));
    await page.click(`${P} [data-ac="back"]`);
    await page.click(`${P} [data-ac="records"]`);
    await page.waitForSelector(`${P} #recNo`);
    await page.selectOption(`${P} #recNo`, '3');
    await page.waitForFunction(s => document.querySelector(`${s} #recTable`) && document.querySelector(`${s} #recTable`).textContent.includes('물의 여행 그리기'), P);
    assert((await page.textContent(`${P} #recTable`)).includes('설명과 그림이 모두 꼼꼼해요'), '잘한 점');
    await page.selectOption(`${P} #recSubject`, '국어');
    await page.waitForFunction(s => document.querySelector(`${s} #recBody`).textContent.includes('기록이 없어요'), P);
    await page.selectOption(`${P} #recSubject`, '과학');
    await page.selectOption(`${P} #recTerm`, '2');
    await page.waitForFunction(s => (document.querySelector(`${s} #recTable`) || { textContent: '' }).textContent.includes('물의 여행'), P);
  }],
  ['「교과 평어에 참고하기」 기본 꺼짐 → 켜면 교과 자동(과학)·영역 고르기 → 이음 저장·표시', async () => {
    await page.click(`${P} [data-ac="back"]`);
    const id = (await acts())[0].id;
    await page.click(`${P} [data-ac-open="${id}"]`);
    await page.waitForSelector(`${P} [data-ac="link"]`);
    assert(!(await page.isChecked(`${P} [data-ac="link"]`)), '기본 꺼짐');
    await page.check(`${P} [data-ac="link"]`);
    await page.waitForSelector('#sheetRoot #elUnit');
    assert(await page.inputValue('#sheetRoot #elSubject') === '과학', '교과 자동');
    await page.selectOption('#sheetRoot #elUnit', 'u2');
    await page.click('#sheetRoot #elOk');
    await page.waitForFunction(s => document.querySelector(`${s} .el-box`).textContent.includes('생명 · 식물의 한살이'), P);
    const a = (await acts())[0];
    assert(a.link && a.link.unitId === 'u2' && a.link.subject === '과학' && a.link.label === '생명 · 식물의 한살이', JSON.stringify(a.link));
  }],
  ['평가계획 영역 id가 바뀌어도 이름으로 이어짐, 이름도 바뀌면 「이어 둔 영역을 찾지 못했어요」', async () => {
    const set = (id, elem) => page.evaluate(([id, elem]) => { const p = JSON.parse(localStorage.getItem('ssam:plan:P1')); p.subjects[0].units[1].id = id; p.subjects[0].units[1].elem = elem; localStorage.setItem('ssam:plan:P1', JSON.stringify(p)); }, [id, elem]);
    const reopen = async () => { await page.reload(); await page.waitForTimeout(600); await go(); const id = (await acts())[0].id; await page.click(`${P} [data-ac-open="${id}"]`); await page.waitForSelector(`${P} .el-box`); };
    await set('u2new', '식물의 한살이'); await reopen();
    assert((await page.textContent(`${P} .el-box`)).includes('생명 · 식물의 한살이'), await page.textContent(`${P} .el-box`));
    await set('u2new', '식물의 자람'); await reopen();
    assert((await page.textContent(`${P} .el-box`)).includes('이어 둔 영역을 찾지 못했어요'), await page.textContent(`${P} .el-box`));
  }],
  ['페이지 오류 없음', async () => { assert(errors.length === 0, errors.join(' | ')); }]
]);
await t.close();
