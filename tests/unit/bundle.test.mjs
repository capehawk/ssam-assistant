// 한꺼번에 넣기 나누기 규칙: 한 문서 안 학생용·교사용(교사용·(예시)·[정답]·같은 머리 다시), 스캔 앞뒤 쪽, AI 쪽 나누기 답, 확인 카드가 필요한지
// 글은 모두 지어낸 것(선생님이 올린 파일과 같은 모양만)
import test from 'node:test';
import assert from 'node:assert/strict';
import { splitDoc, edgeIdx, pageRolesPrompt, normPageRoles, pickRoles, needsCard, ROLE_NAME } from '../../web/core/bundle.js';

const KOR = ['국어 |  | 2. 마음을 전해요 | 국어책 40~43쪽', ' | [3차시] 편지 쓰기', ' | 학년      반      번   이름:', '1. 고마운 사람을 떠올려 보세요.', '누구? | ', '2. 편지를 써 보세요.', ' | ',
  '국어 |  | 2. 마음을 전해요 | 국어책 40~43쪽', ' | [3차시] 편지 쓰기', ' | 학년      반      번   이름: 교사용', '1. 고마운 사람을 떠올려 보세요.', '누구? | 할머니', '2. 편지를 써 보세요.', ' | 할머니 늘 맛있는 밥을 해 주셔서 고맙습니다.'].join('\n');
const SOC = ['1. 이웃과 함께 > [5차시] 서로 돕는 마을 (교과서 30~31쪽)', '이웃을 돕는 방법 알아보기', '사회 3-2', '반     번   이름:', '※ 물음에 답해 봅시다.', '(1) 이웃을 도운 경험 | ➡ | ',
  '1. 이웃과 함께 > [5차시] 서로 돕는 마을 (교과서 30~31쪽)', '이웃을 돕는 방법 알아보기', '사회 3-2', '반     번   이름:', '(예시)', '※ 물음에 답해 봅시다.', '(1) 이웃을 도운 경험 | ➡ | 무거운 짐을 들어 드렸어요.'].join('\n');
const MATH = ['3. 나눗셈', '[2차시] 나눗셈을 알아볼까요', '수학', '1. 6 ÷ 2 = □', '2. 8 ÷ 4 = □', '3. 알맞은 것을 고르세요.', '[정답]', '1. 3', '2. 2', '3. ②'].join('\n');
const SCI = ['[과학] 3-2-1-02 물은 어디로 갈까? (12~13쪽)', '물의 여행 그리기', '◉ 물이 여행하는 길을 그려 봅시다.', '번호 | 그림', '1 | '].join('\n');

test('국어 모양: 같은 머리 다시 + 이름 칸 「교사용」 → 머리 줄에서 나눔', () => {
  const r = splitDoc(KOR);
  assert.equal(r.how, 'marker');
  assert.ok(!r.student.includes('교사용') && r.student.includes('누구? |'), r.student);
  assert.ok(r.teacher.startsWith('국어 |  | 2. 마음을 전해요') && r.teacher.includes('할머니'), r.teacher);
});

test('사회 모양: 같은 머리 다시 + 「(예시)」 → 머리 줄에서 나눔', () => {
  const r = splitDoc(SOC);
  assert.equal(r.how, 'marker');
  assert.ok(r.teacher.startsWith('1. 이웃과 함께 > [5차시]') && r.teacher.includes('무거운 짐') && !r.student.includes('무거운 짐'), r.teacher);
});

test('수학 모양: 「[정답]」 줄에서 나눔', () => {
  const r = splitDoc(MATH);
  assert.equal(r.how, 'marker');
  assert.ok(r.teacher.startsWith('[정답]') && r.student.endsWith('3. 알맞은 것을 고르세요.'), JSON.stringify(r));
});

test('과학 모양(표시 없음, 머리 한 번): 나누지 않음', () => {
  const r = splitDoc(SCI);
  assert.deepEqual(r, { student: SCI.trim(), teacher: '', how: 'none' });
  assert.deepEqual(splitDoc(''), { student: '', teacher: '', how: 'none' });
});

test('표시 없이 같은 머리가 두 번이면 두 번째 머리부터 교사용(repeat)', () => {
  const t = ['[과학] 3-2-1-02 물은 어디로 갈까? (12~13쪽)', '1 | ', '[과학] 3-2-1-02 물은 어디로 갈까? (12~13쪽)', '1 | 바다로 갔다가 구름이 돼요.'].join('\n');
  const r = splitDoc(t);
  assert.equal(r.how, 'repeat');
  assert.ok(r.teacher.startsWith('[과학]') && r.teacher.includes('구름') && !r.student.includes('구름'), JSON.stringify(r));
});

test('스캔 앞 2쪽·뒤 2쪽', () => {
  assert.deepEqual(edgeIdx(0), []);
  assert.deepEqual(edgeIdx(1), [0]);
  assert.deepEqual(edgeIdx(3), [0, 1, 2]);
  assert.deepEqual(edgeIdx(10), [0, 1, 8, 9]);
});

test('AI 쪽 나누기: 프롬프트 머리, 답은 범위 안·아는 표시만, 모르면 학생', () => {
  const p = pageRolesPrompt(4);
  assert.ok(p.startsWith('[쪽 나누기]') && p.includes('4장') && /"role"/.test(p), p);
  assert.deepEqual(normPageRoles({ pages: [{ i: 0, role: 'teacher' }, { i: 3, role: 'zzz' }, { i: 9, role: 'blank' }, { i: 2, role: 'blank' }] }, 4), ['teacher', 'student', 'blank', 'student']);
  assert.deepEqual(normPageRoles(null, 2), ['student', 'student']);
});

test('쪽 표시 고르기: 글자층 30자 이상은 정답·교사용, 아니면 AI 답, 아니면 학생', () => {
  assert.deepEqual(pickRoles([{ text: '[정답] 1. ③ 2. ① 3. ④ 4. ② 5. 진분수 6. 가분수 7. ⑤ 8. 대분수' }, {}, {}], { 2: 'blank' }), ['teacher', 'student', 'blank']);
  assert.deepEqual(pickRoles([{ text: '짧음' }, {}], null), ['student', 'student']);
});

test('확인 카드: 나눌 것이 없으면(학생 스캔만) 필요 없음', () => {
  assert.equal(needsCard({ doc: { teacher: '' }, roles: ['student', 'student'] }), false);
  assert.equal(needsCard({ doc: { teacher: '[정답] 1. ③' }, roles: [] }), true);
  assert.equal(needsCard({ doc: { teacher: '' }, roles: ['teacher', 'student'] }), true);
  assert.deepEqual(ROLE_NAME, { teacher: '정답·교사용', blank: '빈 활동지', student: '학생' });
});

test('teacherFile: 따로 넣은 교사용 파일 알아보기(이름·첫 줄 표시·앞쪽 「이름: 교사용」), 학생용·합본은 아님', async () => {
  const { teacherFile } = await import('../../web/core/bundle.js');
  assert.equal(teacherFile('분수(교사용).hwp', '4. 분수'), true);
  assert.equal(teacherFile('국어 정답.hwp', ''), true);
  assert.equal(teacherFile('a.txt', '[정답]\n1. ③'), true);
  assert.equal(teacherFile('a.txt', '4. 분수\n[5차시] 진분수\n교과서 94~95쪽\n학년 반 번 이름: 교사용\n1. □'), true);
  assert.equal(teacherFile('분수(학생용).hwp', '4. 분수\n[5차시] 진분수\n학년 반 번 이름:\n1. □'), false);
  const long = ['4. 분수', ...Array.from({ length: 10 }, (_, i) => `${i + 1}. 문제`), '이름: 교사용', '1. 답'].join('\n');
  assert.equal(teacherFile('분수.hwp', long), false);
});
