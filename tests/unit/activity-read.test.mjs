// 활동지 머리 읽기(교과·단원·차시·쪽·활동 이름)와 학기 — 글은 지어낸 것(선생님 파일과 같은 모양)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readMeta, termOf, SUBJECTS } from '../../web/menus/evaluate/activity/activity-read.js';

test('과학 모양: 「[과학] 3-2-4-03 제목 (쪽)」', () => {
  assert.deepEqual(readMeta('[과학] 3-2-4-03 물은 어디로 갈까? (50~51쪽)\n물의 여행 그리기\n◉ 그려 봅시다.'),
    { subject: '과학', unit: '4', lesson: '3', pages: '50~51쪽', title: '물은 어디로 갈까?' });
});

test('국어 모양: 「국어 | | 단원 | 국어책 쪽」 + 「[N차시] 제목」', () => {
  assert.deepEqual(readMeta('국어 |  | 2. 마음을 전해요 | 국어책 40~43쪽\n | [3차시] 편지 쓰기\n | 학년 반 번 이름:'),
    { subject: '국어', unit: '2. 마음을 전해요', lesson: '3', pages: '40~43쪽', title: '편지 쓰기' });
});

test('도덕·사회 모양: 「단원 > [N차시]제목(교과서 쪽)」 + 교과 이름 줄', () => {
  assert.deepEqual(readMeta('3. 함께 사는 세상 > [4차시]서로 돕기(교과서 60-63쪽)\n친구 돕기 계획\n도덕\n반 번 이름:'),
    { subject: '도덕', unit: '3. 함께 사는 세상', lesson: '4', pages: '60-63쪽', title: '서로 돕기' });
  assert.equal(readMeta('1. 이웃과 함께 > [14~15차시] 서로 돕는 마을 (교과서 30~31쪽)\n사회 3-2').lesson, '14~15');
  assert.equal(readMeta('1. 이웃과 함께 > [14~15차시] 서로 돕는 마을 (교과서 30~31쪽)\n사회 3-2').subject, '사회');
});

test('수학 모양: 단원 줄 + [N차시] 줄 + 교과서 쪽 + 교과 줄', () => {
  assert.deepEqual(readMeta('4. 분수\n[5차시] 진분수와 가분수를 알아볼까요\n교과서 94~95쪽 / 수익 62~63쪽\n수학'),
    { subject: '수학', unit: '4. 분수', lesson: '5', pages: '94~95쪽', title: '진분수와 가분수를 알아볼까요' });
});

test('모르는 글은 모두 빈칸', () => {
  assert.deepEqual(readMeta('아무 글'), { subject: '', unit: '', lesson: '', pages: '', title: '' });
  assert.deepEqual(readMeta(''), { subject: '', unit: '', lesson: '', pages: '', title: '' });
  assert.ok(SUBJECTS.includes('바른 생활') && SUBJECTS.includes('과학'));
});

test('학기: 여름방학 끝 다음 날부터 2학기, 없으면 3~8월 1학기·9~2월 2학기', () => {
  assert.equal(termOf('2026-07-10', []), 1);
  assert.equal(termOf('2026-09-01', []), 2);
  assert.equal(termOf('2027-02-10', []), 2);
  assert.equal(termOf('2026-03-02', []), 1);
  const br = [{ label: '여름방학', from: '2026-07-25', to: '2026-08-16' }];
  assert.equal(termOf('2026-08-20', br), 2);
  assert.equal(termOf('2026-08-10', br), 1);
  assert.equal(termOf('', []), termOf(new Date().toISOString().slice(0, 10), []));
});
