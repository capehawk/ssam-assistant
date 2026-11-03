// 단원평가 AI 프롬프트와 답 읽기 (스펙 3.2~3.4)
import test from 'node:test';
import assert from 'node:assert/strict';
import { gradePrompt, normGrade, validGrade, keyPrompt, normKeyAI, feedbackPrompt, normFeedback, pyeongeoPrompt, normPyeongeo } from '../../web/menus/evaluate/unit/unit-ai.js';

const ITEMS = [
  { no: 1, content: '글의 내용 파악하기', domain: '이해', type: 'choice', answer: '③', points: 4, criteria: '', pages: '<국어> 36쪽' },
  { no: 2, content: '생각 쓰기', domain: '이해', type: 'essay', answer: '(예) 친구와 이야기함. 등', points: 8, criteria: '비슷하면 정답 처리', pages: '<국어> 44쪽' }
];
const TEST = {
  id: 'a', meta: { subject: '국어', grade: 3, term: 2, unitNo: 1, unitName: '경험과 관련지으며 이해해요', round: 1, date: '2026-10-20' },
  key: { domains: ['지식', '이해'], items: ITEMS }, paper: { text: '1\n말하는 이가 떠올린 사람은?' },
  students: [{ no: 1, skip: false, status: 'done', items: { 1: { read: '비밀답안글', pts: 4 }, 2: { read: '다른비밀글', pts: 4 } }, good: '', cheer: '' }]
};

test('채점 프롬프트: 표지·번호·정답표·평가지 글·출력 모양, 다른 학생 답은 없음', () => {
  const p = gradePrompt(TEST, 3);
  assert.ok(p.startsWith('[단원평가 채점]'));
  assert.ok(p.includes('[학생] 3번'));
  assert.ok(p.includes('1 | 고르기 | ③ | 4 |'));
  assert.ok(p.includes('2 | 서술형 | (예) 친구와 이야기함. 등 | 8 | 비슷하면 정답 처리'));
  assert.ok(p.includes('말하는 이가 떠올린 사람은?'));
  assert.ok(p.includes('"items"') && p.includes('"read"') && p.includes('"sure"'));
  assert.ok(p.includes('(3)처럼') && p.includes('(1)-①, (2)-②처럼'));
  assert.ok(!p.includes('비밀답안글') && !p.includes('다른비밀글'));
  const long = gradePrompt({ ...TEST, paper: { text: 'ㄱ'.repeat(20000) } }, 1);
  assert.ok(long.includes('ㄱ'.repeat(12000)) && !long.includes('ㄱ'.repeat(12001)));
  assert.ok(!gradePrompt({ ...TEST, paper: { text: '' } }, 1).includes('[평가지 글]'));
});

test('채점 답 읽기: 배열·{items} 모두, 번호는 숫자, 모르는 번호는 버림', () => {
  assert.deepEqual(normGrade([{ no: '2', read: '③', points: '4' }, { no: 99, read: 'x', points: 1 }], ITEMS), { 2: { read: '③', points: 4, sure: true, why: '' } });
  assert.deepEqual(normGrade({ items: [{ no: 1, read: null, points: 'abc', sure: false, why: '흐림' }] }, ITEMS), { 1: { read: '', points: 0, sure: false, why: '흐림' } });
  assert.equal(validGrade({ items: [] }), true); assert.equal(validGrade([]), true); assert.equal(validGrade({ a: 1 }), false); assert.equal(validGrade(null), false);
});

test('정답지 프롬프트·답 읽기: 유형이 없거나 틀리면 짐작', () => {
  const p = keyPrompt('1 | 시 읽기 | ③ | 4');
  assert.ok(p.startsWith('[단원평가 정답지]') && p.includes('1 | 시 읽기 | ③ | 4') && p.includes('"items"'));
  assert.ok(keyPrompt('').includes('첨부한'));
  const k = normKeyAI({ meta: { subject: '국어', grade: '3', unitNo: 1 }, domains: ['지식'], items: [{ no: '2', content: 'b', answer: '㉯', points: '4' }, { no: 1, content: 'a', answer: '③', points: 4, type: 'xx' }, { no: 0, answer: 'z' }] });
  assert.deepEqual(k.items.map(i => [i.no, i.type, i.points]), [[1, 'choice', 4], [2, 'symbol', 4]]);
  assert.deepEqual(k.meta, { term: null, grade: 3, subject: '국어', unitNo: 1, round: null });
  assert.deepEqual(k.domains, ['지식']);
  assert.equal(normKeyAI({ items: [] }), null); assert.equal(normKeyAI(null), null);
});

test('피드백 프롬프트: 점수·평가 내용·학년, 학생이 쓴 글은 보내지 않음', () => {
  const p = feedbackPrompt(TEST, TEST.students);
  assert.ok(p.startsWith('[단원평가 피드백]'));
  assert.ok(p.includes('1번') && p.includes('점수 8/12') && p.includes('글의 내용 파악하기') && p.includes('생각 쓰기'));
  assert.ok(p.includes('3학년'));
  assert.ok(!p.includes('비밀답안글'));
  assert.deepEqual(normFeedback({ students: [{ no: '1', good: ' 잘했어요 ', cheer: '힘내요' }, { no: 'x' }] }), { 1: { good: '잘했어요', cheer: '힘내요' } });
});

test('평어 프롬프트·답 읽기', () => {
  const p = pyeongeoPrompt('국어', [{ no: 2, level: 'high', good: ['글의 내용 파악하기'], weak: ['생각 쓰기'] }]);
  assert.ok(p.startsWith('[단원평가 평어]') && p.includes('국어') && p.includes('2번') && p.includes('수준 상') && p.includes('생각 쓰기'));
  assert.ok(p.includes('~함.'));
  assert.deepEqual(normPyeongeo([{ no: 2, text: ' 잘 읽음. ' }]), { 2: '잘 읽음.' });
});

test('다듬기: AI 점수가 「4점」처럼 글이어도 앞의 수를 읽음', () => {
  assert.equal(normGrade([{ no: 1, read: '③', points: '4점' }], ITEMS)[1].points, 4);
  assert.equal(normGrade([{ no: 1, read: '③', points: '만점' }], ITEMS)[1].points, 0);
});

test('채점 프롬프트는 학생 번호만 맨 끝에서 달라짐 (앞부분이 같아 AI 회사의 앞글 캐시를 탈 수 있게)', () => {
  const a = gradePrompt(TEST, 3).split('\n'), b = gradePrompt(TEST, 4).split('\n');
  assert.deepEqual(a.slice(0, -1), b.slice(0, -1));
  assert.equal(a.at(-1), '[학생] 3번 — 바로 위 그림이 이 학생의 평가지예요.');
});
