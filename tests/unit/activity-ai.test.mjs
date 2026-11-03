// 활동지 AI: 기준 만들기 프롬프트·답 다듬기, 정답 글로 고르기·짝짓기·빈칸 정답 채우기, 채점 프롬프트·답 다듬기(모르는 번호·표시 버림, 빠진 문항 노란 칸), 앱 판정, 검토
import test from 'node:test';
import assert from 'node:assert/strict';
import { TYPES, MARK, LEVEL, criteriaPrompt, normCriteria, applyKey, numberedAnswers, gradePrompt, validGrade, normGrade, judgeCell, reviewPrompt, normReview } from '../../web/menus/evaluate/activity/activity-ai.js';

const meta = { subject: '과학', unit: '4', lesson: '3', pages: '50~51쪽', title: '물은 어디로 갈까?' };
const ITEMS = [
  { no: 1, type: 'choice', ask: '알맞은 것을 고르세요.', answer: '③', ok: '', part: '', src: 'answer' },
  { no: 2, type: 'short', ask: '빈칸에 알맞은 말', answer: '증발', ok: '', part: '', src: 'ai' },
  { no: 3, type: 'write', ask: '물의 여행을 설명해 봅시다.', answer: '바다의 물이 증발해 구름이 됩니다.', ok: '증발과 구름을 넣어 설명함', part: '하나만 씀', src: 'ai' },
  { no: 4, type: 'draw', ask: '물의 여행을 그려 봅시다.', answer: '', ok: '바다·구름·비가 모두 있고 화살표로 이음', part: '일부만 그림', src: 'ai' }
];

test('종류·표시·수준 이름', () => {
  assert.deepEqual(TYPES.map(t => t[0]), ['choice', 'match', 'short', 'write', 'draw']);
  assert.deepEqual(MARK, { o: '○', t: '△', x: '×', n: '안 함' });
  assert.deepEqual(LEVEL, { good: '잘함', ok: '보통', try: '노력' });
});

test('기준 프롬프트: 머리, 활동지 정보, 학생용·교사용 글, 그림 수, 출력 모양', () => {
  const p = criteriaPrompt({ meta, student: '1. 물은 어디로 갈까요?', teacher: '(예시) 바다로 가요.', nImages: 2 });
  assert.ok(p.startsWith('[활동지 기준]') && p.includes('과학') && p.includes('물은 어디로 갈까?') && p.includes('1. 물은 어디로 갈까요?') && p.includes('(예시) 바다로 가요.') && p.includes('그림 2장'), p.slice(0, 300));
  assert.ok(/"items":\s*\[/.test(p) && p.includes('"src"'));
  const q = criteriaPrompt({ meta, student: '1. 그려 봅시다.', teacher: '', nImages: 0 });
  assert.ok(!q.includes('[교사용'), '교사용 없으면 그 칸 없음');
});

test('기준 답 다듬기: 모르는 종류는 쓰기, 번호 겹침·빈 묻는 말 버림, 출처는 teacher|ai', () => {
  const v = normCriteria({ items: [{ no: 1, type: 'choice', ask: '고르기', answer: '③', ok: '', part: '', src: 'teacher' }, { no: 1, type: 'short', ask: '겹침' }, { no: 2, type: 'zzz', ask: '설명하기', answer: 'a', ok: 'b', part: 'c', src: 'x' }, { no: 3, ask: '' }, null] });
  assert.deepEqual(v, [
    { no: 1, type: 'choice', ask: '고르기', answer: '③', ok: '', part: '', src: 'teacher' },
    { no: 2, type: 'write', ask: '설명하기', answer: 'a', ok: 'b', part: 'c', src: 'ai' }
  ]);
  assert.deepEqual(normCriteria([{ no: 5, type: 'draw', ask: '그리기' }]).map(x => x.no), [1], '번호는 1부터 다시 매김');
});

test('정답 글의 번호 붙은 답: 「[정답]」 뒤 「1. ③」 줄·「1.」 다음 줄 값, 풀이는 뺌', () => {
  assert.deepEqual(numberedAnswers('[정답]\n1. ③\n2.\n6/5\n3. 진, 가, 가\n7. ⑤ <풀이> 진분수는 …'), { 1: '③', 2: '6/5', 3: '진, 가, 가', 7: '⑤' });
  assert.deepEqual(numberedAnswers('정답 없음'), {});
  const items = applyKey([{ ...ITEMS[0], answer: '②', src: 'ai' }, { ...ITEMS[2] }], '[정답]\n1. ③\n2. 길게 쓴 답');
  assert.equal(items[0].answer, '③'); assert.equal(items[0].src, 'answer');
  assert.equal(items[1].answer, ITEMS[2].answer, '쓰기 문항은 바꾸지 않음');
});

test('채점 프롬프트: 머리, 문항(종류·기준·그림은 표현까지), 학생 이름 쓰지 않기, 출력 모양', () => {
  const p = gradePrompt({ meta, items: ITEMS }, 2);
  assert.ok(p.startsWith('[활동지 채점]') && p.includes('그림 2장') && p.includes('[3] 쓰기') && p.includes('증발과 구름을 넣어 설명함') && p.includes('자세함') && p.includes('이름'), p.slice(0, 500));
  assert.ok(/"mark":"o\|t\|x\|n"/.test(p.replace(/\s/g, '')) && p.includes('"level"'));
});

test('채점 답 다듬기: 기준에 없는 번호·모르는 표시 버림, 빠진 문항은 노란 칸, 수준은 셋 중 하나', () => {
  assert.ok(validGrade({ items: [] }) && validGrade([]) && !validGrade(null));
  const r = normGrade({ items: [{ no: 1, read: '③', mark: 'o', why: '', sure: true }, { no: 2, read: '증발', mark: 'q', why: '' }, { no: 9, read: 'x', mark: 'o' }, { no: 3, read: '설명', mark: 't', why: '구름 없음', sure: true }], good: '잘 그림', next: '구름도', level: 'ok', levelWhy: '대체로' }, ITEMS);
  assert.deepEqual(Object.keys(r.marks).map(Number), [1, 2, 3, 4]);
  assert.deepEqual(r.marks[1], { read: '③', mark: 'o', why: '', sure: true });
  assert.deepEqual(r.marks[2], { read: '증발', mark: '', why: '', sure: false });
  assert.deepEqual(r.marks[4], { read: '', mark: '', why: '읽지 못했어요', sure: false, miss: true });
  assert.deepEqual([r.good, r.next, r.level, r.levelWhy], ['잘 그림', '구름도', 'ok', '대체로']);
  assert.equal(normGrade({ level: 'great' }, ITEMS).level, '');
});

test('앱 판정: 고르기 맞음 ○·틀림 ×·빈 답 안 함, 쓰기는 AI 표시, AI ○인데 앱 ×면 노란 칸', () => {
  assert.deepEqual(judgeCell(ITEMS[0], { read: '3', mark: 'o', why: '', sure: true }), { read: '3', mark: 'o', why: '', sure: true, chk: false });
  assert.equal(judgeCell(ITEMS[0], { read: '②', mark: 'o', why: '', sure: true }).mark, 'x');
  assert.equal(judgeCell(ITEMS[0], { read: '②', mark: 'o', why: '', sure: true }).chk, true);
  assert.equal(judgeCell(ITEMS[0], { read: '', mark: '', why: '', sure: true }).mark, 'n');
  assert.deepEqual(judgeCell(ITEMS[2], { read: '설명', mark: 't', why: '', sure: true }).mark, 't');
  assert.equal(judgeCell(ITEMS[2], { read: '설명', mark: 't', why: '', sure: false }).chk, true);
  assert.equal(judgeCell(ITEMS[1], { read: '증발', mark: '', why: '', sure: false }).mark, 'o', '빈칸 정답은 앱이 맞춤');
  assert.equal(judgeCell({ ...ITEMS[1], answer: '' }, { read: '증발', mark: '', why: '', sure: false }).chk, true, '정답 없고 AI 표시 없음 → 노란 칸');
});

test('검토: 머리, 문항과 기준은 전체(공통·캐시), 먼저 채점한 결과는 노란 칸만, 답은 그 번호만', () => {
  const p = reviewPrompt({ meta, items: ITEMS }, [{ no: 3, read: '설명', mark: 't', why: '구름 없음' }]);
  const done = p.split('[먼저 채점한 결과]')[1];
  assert.ok(p.startsWith('[활동지 검토]') && p.includes('[4] 그림') && done.includes('[3] 읽은 답: 설명') && !done.includes('[4]'), p);
  assert.deepEqual(normReview({ items: [{ no: 3, mark: 'o', why: '구름도 있음' }, { no: 4, mark: 'o', why: '' }, { no: 3, mark: 'z' }] }, [3]), [{ no: 3, mark: 'o', why: '구름도 있음' }]);
});

test('AI가 빠뜨린 고르기·빈칸 문항은 안 함이 아니라 노란 칸(읽지 못함)', () => {
  const r = normGrade({ items: [{ no: 3, read: '설명', mark: 't', why: '', sure: true }] }, ITEMS);
  const c1 = judgeCell(ITEMS[0], r.marks[1]), c2 = judgeCell(ITEMS[1], r.marks[2]);
  assert.equal(c1.mark, ''); assert.equal(c1.chk, true);
  assert.equal(c2.mark, ''); assert.equal(c2.chk, true);
  // AI가 읽고 빈 답이라고 한 것은 그대로 안 함
  assert.deepEqual(judgeCell(ITEMS[1], { read: '', mark: 'n', why: '', sure: true }).mark, 'n');
});
