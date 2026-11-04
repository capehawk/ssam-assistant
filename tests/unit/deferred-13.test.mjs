// 계획 13 뒤 미뤄 둔 작은 것: 품의 이름 가리기, 확정 전 활동지·같은 이름 다른 영역 참고, 이름 줄 가리기, 교사용 글로 기준 표
import test from 'node:test';
import assert from 'node:assert/strict';
import { maskNames } from '../../web/menus/purchase/intake.js';

test('M1 품의 이름 가리기: 사람 이름 모양만 가리고(직함·과목 낱말은 그대로), 직함 뒤 이름도 가림', () => {
  assert.equal(maskNames('3학년 담임교사 회의 다과'), '3학년 담임교사 회의 다과');
  assert.equal(maskNames('체육 강사님 간식'), '체육 강사님 간식');
  assert.equal(maskNames('김철수 강사 2시간'), '○○○ 강사 2시간');
  assert.equal(maskNames('이영희 선생님께 드릴 꽃'), '○○○ 선생님께 드릴 꽃');
  assert.equal(maskNames('강사 김철수 2시간'), '강사 ○○○ 2시간');
  assert.equal(maskNames('외부강사 김철수'), '외부강사 ○○○');
  assert.equal(maskNames('강사: 박하늘'), '강사: ○○○');
  assert.equal(maskNames('남궁민수 강사'), '○○○ 강사');
});

test('M2·M3 참고 목록: 확정 전 활동지는 빼고, 이어 둔 영역이 평가계획에 그대로 있으면 이름만 같은 다른 영역에는 안 나옴', async () => {
  const store = await import('../../web/core/store.js');
  const m = new Map(); store.useStorage({ getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) });
  const { newActivity, saveActivity, linkedTo } = await import('../../web/menus/evaluate/activity/activity-model.js');
  const { newTest, saveTest, unitLinkedTo } = await import('../../web/menus/evaluate/unit/unit-model.js');
  const L = { unitId: 'u1', subject: '과학', label: '물질 · 물의 상태 변화' };
  const done = newActivity({ subject: '과학', title: '확정함', date: '2026-09-10' }); done.link = L; done.done = true; saveActivity(done);
  const open = newActivity({ subject: '과학', title: '확정 전', date: '2026-09-11' }); open.link = L; saveActivity(open);
  const t = newTest({ meta: { subject: '과학', unitNo: 1, date: '2026-09-20' } }); t.link = L; saveTest(t);
  const ids = r => r.map(x => x.id);
  assert.deepEqual(ids(linkedTo({ unitId: 'u1', subject: '과학', label: L.label, known: ['u1', 'u2'] })), [done.id]);
  // 1·2학기에 같은 평가요소(u2)가 있어도 u1이 평가계획에 있으면 u2에는 안 나옴
  assert.deepEqual(linkedTo({ unitId: 'u2', subject: '과학', label: L.label, known: ['u1', 'u2'] }), []);
  assert.deepEqual(unitLinkedTo({ unitId: 'u2', subject: '과학', label: L.label, known: ['u1', 'u2'] }), []);
  // 평가계획을 다시 넣어 u1이 없어졌으면 이름으로 이어짐
  assert.deepEqual(ids(linkedTo({ unitId: 'u9', subject: '과학', label: L.label, known: ['u9'] })), [done.id]);
  assert.deepEqual(ids(unitLinkedTo({ unitId: 'u9', subject: '과학', label: L.label, known: ['u9'] })), [t.id]);
});

test('M8 활동지 글 넣기: 「이름: 김하늘」은 이름만 지우고, 「이름: 교사용」·빈 이름 칸은 그대로, 전화번호·주민번호 줄은 뺌', async () => {
  const { cleanSheet } = await import('../../web/menus/evaluate/activity/activity-read.js');
  const r = cleanSheet(['물의 여행 그리기', '3학년 2반 5번 이름: 김하늘', '반 번 이름: 교사용', '반 번 이름:', '문의 010-1234-5678', '1. 그려 봅시다.'].join('\n'));
  assert.ok(!r.text.includes('김하늘') && r.text.includes('3학년 2반 5번 이름:'), r.text);
  assert.ok(r.text.includes('이름: 교사용') && r.text.includes('반 번 이름:') && !r.text.includes('010-') && r.text.includes('그려 봅시다'), r.text);
  assert.ok(r.cut >= 2, String(r.cut));
});

test('M6 교사용 글이 있으면 AI 없이 문항·예시 답안 표: 학생용 문항 줄, 교사용에서 채운 괄호·칸·더한 줄, 머리 줄은 문항 아님', async () => {
  const { itemsFromSheets } = await import('../../web/menus/evaluate/activity/activity-ai.js');
  const stu = ['1. 물의 여행 > [2차시] 물의 여행 그리기 (교과서 12~13쪽)', '과학 3-2', '3학년 반 번 이름:', '1. 물이 하늘로 올라가는 까닭을 고르세요.  (      )', '① 바람이 불어서   ② 햇볕을 받아 증발해서',
    '2. 물이 수증기가 되는 것을 무엇이라고 하나요?  (              )', '3. 물의 여행을 설명해 봅시다.', '설명', '4. 물이 여행하는 길을 그려 봅시다.', '그림', '(5) 이웃을 도운 경험 | ➡ | '].join('\n');
  const tea = ['1. 물의 여행 > [2차시] 물의 여행 그리기 (교과서 12~13쪽)', '과학 3-2', '3학년 반 번 이름: 교사용', '1. 물이 하늘로 올라가는 까닭을 고르세요.  ( ② )', '① 바람이 불어서   ② 햇볕을 받아 증발해서',
    '2. 물이 수증기가 되는 것을 무엇이라고 하나요?  ( 증발 )', '3. 물의 여행을 설명해 봅시다.', '설명', '(예시) 바다의 물이 증발해 구름이 됩니다.', '4. 물이 여행하는 길을 그려 봅시다.', '그림', '(5) 이웃을 도운 경험 | ➡ | 무거운 짐을 들어 드렸어요.'].join('\n');
  const it = itemsFromSheets(stu, tea);
  assert.deepEqual(it.map(x => x.no), [1, 2, 3, 4, 5]);
  assert.deepEqual(it.map(x => x.type), ['choice', 'short', 'write', 'draw', 'write']);
  assert.deepEqual(it.map(x => x.answer), ['②', '증발', '바다의 물이 증발해 구름이 됩니다.', '', '무거운 짐을 들어 드렸어요.']);
  assert.ok(it.every(x => x.src === 'teacher' && x.ok === '' && x.part === ''));
  assert.equal(it[0].ask, '물이 하늘로 올라가는 까닭을 고르세요.');
  assert.deepEqual(itemsFromSheets(stu, ''), []);
});

test('M6 정답 글 맞추기(applyKey)는 채운 교사용 문항 줄(묻는 말 + 괄호 답)을 답으로 쓰지 않음', async () => {
  const { applyKey } = await import('../../web/menus/evaluate/activity/activity-ai.js');
  const items = [{ no: 1, type: 'choice', ask: '물이 하늘로 올라가는 까닭을 고르세요.', answer: '②', ok: '', part: '', src: 'teacher' }];
  const r = applyKey(items, '3학년 반 번 이름: 교사용\n1. 물이 하늘로 올라가는 까닭을 고르세요.  ( ② )');
  assert.equal(r[0].answer, '②');
  assert.equal(applyKey([{ ...items[0], answer: '' }], '[정답]\n1. ③')[0].answer, '③');
});
