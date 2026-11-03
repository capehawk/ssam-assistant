// 계획 › 결과 보고 (스펙 2026-11-03 5장): 넣은 문서 종류 짐작, AI 프롬프트·답 정리, 결과 보고 공문·보고서 맞추기, 저장
import test from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../../web/core/store.js';
import { SOURCE_KINDS, guessSourceKind, reportPrompt, normReport, reportBase, reportTitle, composeReportLetter, reportDoc, letterQueueItems } from '../../web/menus/plan/report-ai.js';

function mem() { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; }
store.useStorage(mem());

const RAW = {
  name: '2026 과학의 날 행사', related: [{ no: '○○초-1234', date: '2026-03-10', title: '2026 과학의 날 행사 운영 계획' }],
  period: { start: '2026-04-21', end: '', time: '' }, place: '본교 강당', target: '전교생', count: '320명',
  summary: '학년별 과학 탐구 실험과 발명품 전시',
  sections: [{ h: '목적', lines: ['과학에 대한 흥미를 높임'] }, { h: '추진 내용', lines: ['1~2학년: 비눗방울 실험', '- 3~6학년: 발명품 만들기'] }, { h: '성과', lines: ['참여 학생 만족도 높음'] }, { h: '반성 및 개선 방안', lines: ['실험 재료를 미리 나눔'] }],
  photos: ['모둠별 실험 장면', '결과 발표']
};

test('문서 종류 짐작: 작년 결과 보고서 · 공문 · 계획서', () => {
  assert.deepEqual(SOURCE_KINDS.map(k => k[0]), ['plan', 'official', 'last', 'etc']);
  assert.equal(guessSourceKind('2025 과학의 날 결과보고.hwpx', '2025 과학의 날 행사 운영 결과 보고서\n1. 개요', 2026), 'last');
  assert.equal(guessSourceKind('작년 보고.pdf', '', 2026), 'last');
  assert.equal(guessSourceKind('공문.hwp', '', 2026), 'official');
  assert.equal(guessSourceKind('x.hwpx', '○○교육청\n수신  수신자 참조\n(경유)\n제목  2026 과학의 날 운영 안내', 2026), 'official');
  assert.equal(guessSourceKind('2026 과학의 날 운영 계획.hwpx', '2026 과학의 날 행사 운영 계획\n1. 목적\n...결과 보고: 5월', 2026), 'plan');
});

test('프롬프트: 종류별 글(긴 글은 잘림)·한 일 메모·사진 수·작년 짜임 따르기·JSON 꼴, 지어내지 않음', () => {
  const p = reportPrompt({ sources: [{ kind: 'plan', name: '계획.hwpx', text: '계획 글' + '가'.repeat(9000) }, { kind: 'last', name: '작년.hwpx', text: '작년 보고 글' }, { kind: 'official', name: '공문', text: '공문 글' }], memo: '4월 21일 강당에서 했음', nPhotos: 2, year: 2026 });
  assert.ok(p.includes('[계획서: 계획.hwpx]') && p.includes('[작년 보고서: 작년.hwpx]') && p.includes('[관련 공문: 공문]'), p.slice(0, 400));
  assert.ok(p.includes('[한 일]\n4월 21일 강당에서 했음'));
  assert.ok(p.includes('사진 2장') && p.includes('작년 보고서의 소제목 차례와 문체'));
  assert.ok(!p.includes('가'.repeat(6001)), '긴 글을 자르지 않음');
  assert.ok(p.includes('"sections"') && p.includes('"photos"') && p.includes('지어내지'));
  assert.ok(!reportPrompt({ sources: [], memo: 'x', nPhotos: 0, year: 2026 }).includes('사진 '), '사진 없는데 사진');
  const scan = reportPrompt({ sources: [], memo: 'x', nPhotos: 2, nDocImages: 1, year: 2026 });
  assert.ok(scan.includes('앞의 사진 2장은 행사 장면') && scan.includes('그 뒤 그림 1장은 글로 읽지 못한 문서'), scan.slice(0, 300));
});

test('답 정리: 날짜·전화번호·소제목·사진 설명 수', () => {
  const r = normReport({ ...RAW, place: '본교 강당(문의 041-123-4567)', period: { start: '04-21', end: '04-22', time: '09:00~12:00' }, sections: [...RAW.sections, { h: '', lines: [] }, 'x'], photos: ['a', 3] }, { year: 2026 });
  assert.equal(r.place, '본교 강당');
  assert.deepEqual(r.period, { start: '2026-04-21', end: '2026-04-22', time: '09:00~12:00' });
  assert.equal(r.sections.length, 4);
  assert.deepEqual(r.sections[1].lines, ['1~2학년: 비눗방울 실험', '- 3~6학년: 발명품 만들기']);
  assert.deepEqual(r.photos, ['a', '']);
  assert.deepEqual(r.related[0], { no: '○○초-1234', date: '2026-03-10', title: '2026 과학의 날 행사 운영 계획' });
  const e = normReport(null);
  assert.equal(e.name, ''); assert.deepEqual(e.sections, []); assert.deepEqual(e.related, []);
});

test('제목: 「운영」을 한 번만, 「결과 보고」·「결과 보고서」', () => {
  assert.equal(reportBase({ name: '2026 과학의 날 행사' }), '2026 과학의 날 행사 운영');
  assert.equal(reportBase({ name: '2026 독서교육 운영' }), '2026 독서교육 운영');
  assert.equal(reportTitle({ name: '2026 과학의 날 행사' }), '2026 과학의 날 행사 운영 결과 보고서');
  assert.equal(reportBase({ name: '' }), '행사 운영');
});

test('공문: 관련 → 보고합니다 → 가·나·다·라 → 붙임 보고서 1부. 끝.', () => {
  const l = composeReportLetter(normReport(RAW, { year: 2026 }));
  assert.equal(l.title, '2026 과학의 날 행사 운영 결과 보고');
  assert.equal(l.body, [
    '1. 관련: ○○초-1234(2026. 3. 10.) 「2026 과학의 날 행사 운영 계획」',
    '2. 위 호와 관련하여 2026 과학의 날 행사 운영 결과를 다음과 같이 보고합니다.',
    '  가. 일시: 2026. 4. 21.(화)',
    '  나. 장소: 본교 강당',
    '  다. 대상: 전교생(320명)',
    '  라. 주요 내용: 학년별 과학 탐구 실험과 발명품 전시',
    '',
    '붙임  2026 과학의 날 행사 운영 결과 보고서 1부.  끝.'].join('\n'));
});

test('공문: 관련이 둘이면 가·나, 없으면 「1. … 보고합니다.」, 빈 칸은 빼고 다시 매김', () => {
  const two = composeReportLetter(normReport({ ...RAW, related: [{ no: 'A-1', date: '2026-03-02', title: '계획' }, { title: '안내' }] }, { year: 2026 })).body;
  assert.ok(two.startsWith('1. 관련: 가. A-1(2026. 3. 2.) 「계획」\n         나. 「안내」\n2. 위 호와 관련하여'), two);
  const none = composeReportLetter(normReport({ ...RAW, related: [], place: '', period: { start: '2026-04-21', end: '2026-04-23', time: '' } }, { year: 2026 })).body;
  assert.ok(none.startsWith('1. 2026 과학의 날 행사 운영 결과를 다음과 같이 보고합니다.\n  가. 일시: 2026. 4. 21.(화)~4. 23.(목)\n  나. 대상: 전교생(320명)\n  다. 주요 내용:'), none);
});

test('보고서: 개요 표 · 소제목 2.~ · 줄 앞 「- 」 · 사진 자료(설명은 선생님이 고친 것)', () => {
  const r = normReport(RAW, { year: 2026 });
  const photos = [{ bytes: new Uint8Array([1]), w: 4, h: 3 }, { bytes: new Uint8Array([2]), w: 4, h: 3 }];
  const d = reportDoc(r, photos, ['실험', '']);
  assert.equal(d.title, '2026 과학의 날 행사 운영 결과 보고서');
  assert.deepEqual(d.blocks[0], { type: 'h', text: '1. 개요' });
  assert.deepEqual(d.blocks[1].rows, [['구분', '내용'], ['행사명', '2026 과학의 날 행사'], ['일시', '2026. 4. 21.(화)'], ['장소', '본교 강당'], ['대상', '전교생(320명)'], ['관련', '○○초-1234(2026. 3. 10.) 「2026 과학의 날 행사 운영 계획」']]);
  assert.deepEqual(d.blocks.filter(b => b.type === 'h').map(b => b.text), ['1. 개요', '2. 목적', '3. 추진 내용', '4. 성과', '5. 반성 및 개선 방안', '6. 사진 자료']);
  assert.equal(d.blocks[5].text, '- 1~2학년: 비눗방울 실험\n- 3~6학년: 발명품 만들기');
  const pb = d.blocks.at(-1);
  assert.equal(pb.type, 'photos');
  assert.deepEqual(pb.items.map(x => x.caption), ['실험', '결과 발표']);
  assert.ok(!reportDoc(r, [], []).blocks.some(b => b.type === 'photos' || /사진/.test(b.text || '')), '사진 없는데 사진 자료');
});

test('에듀파인 기안 차례로 붙여넣기 조각: 제목 → 본문', () => {
  assert.deepEqual(letterQueueItems({ title: 'T', body: 'B' }), [{ label: '제목', text: 'T' }, { label: '본문', text: 'B' }]);
});

test('저장: 지금 결과 보고·최근 20개(사진 바이트는 저장 안 함)', async () => {
  const { saveCurrent, getCurrent, pushReport, listReports, newReportId } = await import('../../web/menus/plan/report-model.js');
  const id = newReportId();
  saveCurrent({ id, sources: [{ kind: 'plan', name: '계획.hwpx', text: '글' }], memo: '한 일', r: normReport(RAW, { year: 2026 }), letter: { title: 'T', body: 'B' }, captions: ['a'], photos: [{ bytes: [1, 2] }] });
  const c = getCurrent();
  assert.equal(c.id, id); assert.equal(c.memo, '한 일'); assert.equal(c.sources[0].text, '글'); assert.deepEqual(c.captions, ['a']);
  assert.ok(!('photos' in c), '사진 저장');
  for (let i = 0; i < 22; i++) pushReport({ id: 'r' + i, title: 't' + i, r: normReport(RAW), letter: { title: '', body: '' }, captions: [] });
  assert.equal(listReports().length, 20);
  assert.equal(listReports()[0].id, 'r21');
});
