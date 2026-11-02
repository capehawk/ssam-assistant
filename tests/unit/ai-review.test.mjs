// 검토 AI 공통: 필요한 곳 고르기, 검토 프롬프트(이름 없음), 답 읽기, 같은지 판정, 두 의견 HTML, 검토 AI 부르기
import test from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../../web/core/store.js';

function mem() { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; }
store.useStorage(mem());
// 가짜 평가 메뉴 AI: 부른 옵션을 기록
const calls = [];
let reply = () => ({ text: '{"items":[]}' });
globalThis.window = { SSAM: { ai: {
  generate: async (prompt, o) => { calls.push({ prompt, o }); return reply(prompt, o); },
  providers: () => [{ id: 'claude', name: 'Claude', label: 'Claude API', models: [['claude-sonnet-5-5', 'Claude Sonnet 5.5'], ['claude-opus-5-5', 'Claude Opus 5.5']], hasKey: true }, { id: 'gemini', name: 'Gemini', label: 'Gemini API', models: [['gemini-3.8-flash', 'Gemini 3.8 Flash']], hasKey: false }],
  current: () => ({ engine: 'claude', model: 'claude-sonnet-5-5' }),
  engineReady: () => true, errMsg: c => c
} } };
const R = await import('../../web/core/ai-review.js');
const { setTaskRole, resetRoles } = await import('../../web/core/ai-roles.js');

const ITEMS = [
  { no: 1, type: 'choice', answer: '③', points: 10, content: '중심 문장 찾기' },
  { no: 2, type: 'short', answer: '도서관', points: 10, content: '낱말' },
  { no: 3, type: 'essay', answer: '예시 답', points: 15, criteria: '까닭 포함', content: '생각 쓰기' },
  { no: 4, type: 'essay', answer: '예시', points: 15, content: '느낌 쓰기' }
];
const TEST = { meta: { grade: 3, subject: '국어', unit: '2단원', title: '중요한 내용', round: 1 }, key: { items: ITEMS }, paper: { text: '' } };
const C = (o) => ({ read: '', pts: 0, ai: 0, flag: '', why: '', ok: false, manual: false, ...o });

test('채점 검토할 칸: 확신 없음·뜻으로 판단·다름·서술형 부분 점수만, 손으로 고친 칸·확인한 칸은 빼기', () => {
  const st = { no: 3, items: {
    1: C({ read: '③', pts: 10, ai: 10, flag: 'low' }),
    2: C({ read: '도서관에', pts: 10, ai: 10, flag: 'similar' }),
    3: C({ read: '…', pts: 9, ai: 9, flag: 'essay' }),
    4: C({ read: '…', pts: 15, ai: 15, flag: 'essay' })
  } };
  assert.deepEqual(R.gradeTargets(TEST, st), [1, 2, 3]);
  st.items[1].manual = true; st.items[2].ok = true;
  assert.deepEqual(R.gradeTargets(TEST, st), [3]);
  st.items[3] = C({ read: '', pts: 0, ai: 0, flag: 'essay' });
  assert.deepEqual(R.gradeTargets(TEST, st), [], '서술형 0점은 검토 안 함');
  assert.deepEqual(R.gradeTargets(TEST, { no: 1, items: { 1: C({ read: '②', pts: 0, ai: 10, flag: 'differ' }) } }), [1]);
});

test('채점 검토 프롬프트: 머리, 그 문항의 정답표 줄만, 학생은 번호로만, 메인 답은 보내지 않음', () => {
  const p = R.gradeReviewPrompt(TEST, 7, [2, 3]);
  assert.ok(p.startsWith('[채점 검토]'));
  assert.ok(p.includes('2 | 단답 | 도서관 | 10') && p.includes('3 | 서술형 | 예시 답 | 15 | 까닭 포함'));
  assert.ok(!p.includes('1 | 고르기'), '다른 문항 줄');
  assert.ok(p.trimEnd().endsWith('[학생] 7번'));
});

test('채점 검토 답 읽기: 고른 문항만, 모양 틀린 것 버림', () => {
  const v = R.normGradeReview({ items: [{ no: 2, read: '도서관', points: 10, why: '같은 뜻' }, { no: 9, read: 'x', points: 1 }, { no: 3, read: '글', points: 'abc' }, null] }, [2, 3]);
  assert.deepEqual(Object.keys(v), ['2']);
  assert.deepEqual(v[2], { read: '도서관', points: 10, why: '같은 뜻' });
  assert.deepEqual(R.normGradeReview([{ no: 3, read: '', points: 4 }], [3]), { 3: { read: '', points: 4, why: '' } });
  assert.deepEqual(R.normGradeReview('x', [1]), {});
});

test('같은 채점인지: 정답 맞추기 규칙으로 같은 점수면 같음', () => {
  assert.equal(R.sameGrade(ITEMS[0], C({ read: '③', pts: 10 }), { read: '3', points: 10 }), true);
  assert.equal(R.sameGrade(ITEMS[0], C({ read: '③', pts: 10 }), { read: '②', points: 0 }), false);
  assert.equal(R.sameGrade(ITEMS[2], C({ read: '…', pts: 9 }), { read: '…', points: 9 }), true);
  assert.equal(R.sameGrade(ITEMS[2], C({ read: '…', pts: 9 }), { read: '…', points: 12 }), false);
});

test('문장 검토 프롬프트: 머리, 평가 정보, 번호 붙인 문장 10개까지, 이름 칸 없음', () => {
  const texts = Array.from({ length: 12 }, (_, i) => `문장 ${i + 1}을 씀.`);
  const p = R.textReviewPrompt('pyeongeo', '[성취기준] [4국05-02] 작품 감상', texts);
  assert.ok(p.startsWith('[문장 검토]'));
  assert.ok(p.includes('[4국05-02]'));
  assert.ok(p.includes('10. 문장 10을 씀.') && !p.includes('11. 문장 11'));
  assert.ok(/"i":\s*1/.test(p), '출력 모양');
});

test('문장 검토 답 읽기: 범위 안·문제와 고친 문장이 있는 것만, 번호마다 하나', () => {
  const v = R.normTextReview({ items: [{ i: 2, problem: '끝맺음', fix: '고친 문장임.' }, { i: 2, problem: 'x', fix: 'y' }, { i: 0, problem: 'p', fix: 'f' }, { i: 5, problem: 'p', fix: 'f' }, { i: 3, problem: '', fix: 'f' }, { i: 4, problem: 'p', fix: '' }] }, 4);
  assert.deepEqual(v, [{ i: 2, problem: '끝맺음', fix: '고친 문장임.' }]);
  assert.deepEqual(R.normTextReview([{ i: '1', problem: '이름', fix: '바꿈' }], 1), [{ i: 1, problem: '이름', fix: '바꿈' }]);
});

test('계획 검토: 머리, 칸 이름·글·지침, 답 읽기는 있는 칸만', () => {
  const p = R.planReviewPrompt('2027 독서 교육 계획', [{ key: 'purpose', label: '목적', text: '책 읽기' }, { key: 'policy', label: '방침', text: '2025년 3월 시작' }], '- 독서 시간 확보');
  assert.ok(p.startsWith('[계획 검토]') && p.includes('[purpose] 목적') && p.includes('2025년 3월 시작') && p.includes('독서 시간 확보'));
  const v = R.normPlanReview({ items: [{ section: 'policy', problem: '작년 날짜', fix: '2027년 3월 시작' }, { section: 'zzz', problem: 'p', fix: 'f' }, { section: 'purpose', problem: '', fix: 'f' }] }, ['purpose', 'policy']);
  assert.deepEqual(v, [{ section: 'policy', problem: '작년 날짜', fix: '2027년 3월 시작' }]);
});

test('피드백·알림 검토: 머리, 번호·점수만(이름 없음), 답 읽기는 있는 칸만', () => {
  const p = R.notesReviewPrompt('feedback', [{ key: 3, field: 'cheer', label: '3번 격려 (점수 70/100)', text: '조금 더 해 봐요.' }]);
  assert.ok(p.startsWith('[글 검토]') && p.includes('3번 격려') && p.includes('조금 더 해 봐요.'));
  const v = R.normNotesReview({ items: [{ key: 3, field: 'cheer', problem: '점수 숫자', fix: '다시 봐요.' }, { key: 4, field: 'good', problem: 'p', fix: 'f' }, { key: 3, field: 'zzz', problem: 'p', fix: 'f' }] }, ['3|cheer']);
  assert.deepEqual(v, [{ key: '3', field: 'cheer', problem: '점수 숫자', fix: '다시 봐요.' }]);
});

test('품의 검토: 머리, 메모·제목·첫 문장, 강사 칸 글 없음, 답 읽기는 title·intro만(칸마다 하나)', async () => {
  const { draftMemo } = await import('../../web/menus/purchase/rules.js');
  const memo = draftMemo({ type: 'lecturer', project: '진로 특강', purpose: '진로 탐색', date: '2026-11-20', target: '6학년', place: '강당', memo: '', items: [{ name: '김강사', spec: '', unit: '시간', qty: '2', price: '100000' }] });
  assert.ok(!memo.includes('김강사') && memo.includes('강사 1명') && memo.includes('합계: 200,000원'), memo);
  const p = R.purchaseReviewPrompt(memo, { title: '6학년 진로 특강 강사 수당 지급', intro: '진로 특강 강사 수당을 다음과 같이 지급하고자 합니다.' });
  assert.ok(p.startsWith('[품의 검토]') && p.includes('진로 특강') && p.includes('6학년 진로 특강 강사 수당 지급') && p.includes('다음과 같이 지급하고자 합니다.'), p);
  assert.ok(!p.includes('김강사'));
  const v = R.normPurchaseReview({ items: [{ field: 'intro', problem: '금액을 씀', fix: '진로 특강을 다음과 같이 운영하고자 합니다.' }, { field: 'intro', problem: '둘째', fix: 'x' }, { field: 'reason', problem: 'p', fix: 'f' }, { field: 'title', problem: '', fix: 'f' }] });
  assert.deepEqual(v, [{ field: 'intro', problem: '금액을 씀', fix: '진로 특강을 다음과 같이 운영하고자 합니다.' }]);
  assert.deepEqual(R.normPurchaseReview([{ field: 'title', problem: '30자 넘음', fix: '진로 특강 강사 수당' }]), [{ field: 'title', problem: '30자 넘음', fix: '진로 특강 강사 수당' }]);
});

test('평가지 채점: 읽기 어려움 학생과 수준 경계 위·아래만, 10점 이상이면 다름', () => {
  const S = (id, no, score, level, x = {}) => ({ id, no, score, level, status: 'done', ...x });
  const list = [S('a', 1, 92, 'top'), S('b', 2, 75, 'high'), S('c', 3, 74, 'mid'), S('d', 4, 60, 'mid'), S('e', 5, 40, 'mid', { unreadable: true }), S('f', 6, 50, 'mid', { skip: true })];
  assert.deepEqual(R.grReviewNeeded(list).sort(), ['a', 'b', 'c', 'e']);
  assert.equal(R.grDiffers(70, 79), false);
  assert.equal(R.grDiffers(70, 80), true);
  assert.equal(R.grDiffers(80, 70), true);
});

test('두 의견 HTML: 메인 안·검토 안·까닭·버튼, 글은 이스케이프', () => {
  const h = R.opinionHTML({ title: '3번 문항', main: '<b>메인</b>', alt: '검토 & 안', why: '"까닭"', use: '3-2', keep: '3-2' });
  assert.ok(h.includes('검토 의견') && h.includes('메인 안') && h.includes('검토 안'));
  assert.ok(h.includes('&lt;b&gt;메인&lt;/b&gt;') && h.includes('검토 &amp; 안') && h.includes('&quot;까닭&quot;'));
  assert.ok(h.includes('data-rv-use="3-2"') && h.includes('data-rv-keep="3-2"') && h.includes('검토 안 쓰기') && h.includes('그대로 두기'));
  assert.ok(R.opinionHTML({ main: 'a', alt: 'b', use: 1, keep: 1, useLabel: '고친 문장 쓰기' }).includes('고친 문장 쓰기'));
  assert.equal(R.reviewBar(0, 'data-x'), '');
  assert.ok(R.reviewBar(2, 'data-rv-next').includes('검토 의견 2개') && R.reviewBar(2, 'data-rv-next').includes('data-rv-next'));
  assert.equal(R.REVIEW_FAIL, '검토하지 못했어요');
});

test('검토 AI 부르기: 꺼져 있으면 null(부르지 않음), 켜면 그 AI(use)로, 오류는 던지지 않고 { error }', async () => {
  resetRoles();
  calls.length = 0;
  assert.equal(await R.reviewJSON('grade', '[채점 검토] x'), null);
  assert.equal(calls.length, 0);
  setTaskRole('grade', { reviewOn: true, review: { engine: 'claude', model: 'claude-opus-5-5' } });
  reply = () => ({ text: '{"items":[{"no":1}]}' });
  const v = await R.reviewJSON('grade', '[채점 검토] x', { images: [{ mime: 'image/png', b64: 'AA' }], valid: x => Array.isArray(x.items) });
  assert.deepEqual(v, { items: [{ no: 1 }] });
  assert.deepEqual(calls[0].o.use, { engine: 'claude', model: 'claude-opus-5-5' });
  assert.equal(calls[0].o.images.length, 1);
  reply = () => { throw { code: 'auth' }; };
  assert.deepEqual(await R.reviewJSON('grade', 'x'), { error: 'auth' });
  setTaskRole('grade', { review: { engine: 'gemini', model: 'gemini-3.8-flash' } });
  calls.length = 0;
  assert.equal(await R.reviewJSON('grade', 'x'), null, '검토 AI 키 없음 → 검토 안 함');
  assert.equal(calls.length, 0);
});

test('문장 검토 묶음: 10개씩 나눠 부르고 번호는 전체 차례로, 꺼지면 null', async () => {
  resetRoles();
  calls.length = 0;
  assert.equal(await R.reviewTexts('pyeongeo', '정보', ['a', 'b']), null);
  assert.equal(calls.length, 0);
  setTaskRole('writing', { reviewOn: true, review: { engine: 'claude', model: 'claude-opus-5-5' } });
  reply = p => ({ text: JSON.stringify({ items: [{ i: 2, problem: 'p', fix: 'f' + (p.includes('11. ') ? 'x' : (p.match(/^\d+\. (t\d+)/m) || [])[1]) }] }) });
  const texts = Array.from({ length: 12 }, (_, i) => `t${i + 1}`);
  const v = await R.reviewTexts('pyeongeo', '정보', texts);
  assert.equal(calls.length, 2);
  assert.ok(calls[1].prompt.includes('1. t11') && calls[1].prompt.includes('2. t12'));
  assert.deepEqual(v.map(x => x.i), [2, 12]);
  reply = () => { throw { code: 'quota' }; };
  assert.deepEqual(await R.reviewTexts('pyeongeo', '정보', texts), { error: 'quota', partial: [] });
});
