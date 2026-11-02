/* [예시로 채우기]: 지어낸 과학 활동지와 학생 6명 결과(번호만). 실제 학교·학생 자료 아님 */
import { newActivity } from './activity-model.js';

const ITEMS = [
  { no: 1, type: 'choice', ask: '물이 하늘로 올라가는 까닭을 고르세요.', answer: '②', ok: '', part: '', src: 'answer' },
  { no: 2, type: 'short', ask: '물이 수증기가 되는 것을 무엇이라고 하나요?', answer: '증발', ok: '', part: '', src: 'answer' },
  { no: 3, type: 'write', ask: '물의 여행을 설명해 봅시다.', answer: '바다의 물이 증발해 구름이 되고 비로 내려 다시 바다로 갑니다.', ok: '증발·구름·비를 차례대로 씀', part: '두 가지만 씀', src: 'teacher' },
  { no: 4, type: 'draw', ask: '물의 여행을 그려 봅시다.', answer: '바다·구름·비와 화살표', ok: '바다·구름·비가 모두 있고 화살표로 이음', part: '일부만 그림', src: 'ai' }
];
const S = (no, m, good, next, level) => ({
  no, skip: false, status: 'done', level, levelWhy: '', good, next,
  marks: Object.fromEntries(ITEMS.map((it, i) => [it.no, { read: m[i] === 'n' ? '' : '(예시 답)', mark: m[i], why: '', sure: true, chk: false }]))
});

export function sampleActivity() {
  const a = newActivity({ subject: '과학', unit: '1', lesson: '2', pages: '12~13쪽', title: '물의 여행 그리기 (예시)', term: 2, sample: true });
  a.sheet = { student: '[과학] 3-2-1-02 물은 어디로 갈까? (12~13쪽)\n물의 여행 그리기\n1. 물이 하늘로 올라가는 까닭을 고르세요.\n2. 물이 수증기가 되는 것을 무엇이라고 하나요?\n3. 물의 여행을 설명해 봅시다.\n4. 물의 여행을 그려 봅시다.', teacher: '(예시)\n3. 바다의 물이 증발해 구름이 되고 비로 내려 다시 바다로 갑니다.' };
  a.items = ITEMS.map(it => ({ ...it }));
  a.confirmed = true;
  a.students = [
    S(1, 'ooot', '물의 여행을 차례대로 설명했어요.', '그림에 화살표를 더해 보세요.', 'good'),
    S(2, 'oxto', '그림에 바다·구름·비를 모두 그렸어요.', '증발이라는 말을 써 보세요.', 'ok'),
    S(3, 'oooo', '설명과 그림이 모두 꼼꼼해요.', '친구에게 설명해 보세요.', 'good'),
    S(4, 'xntt', '그림을 끝까지 그렸어요.', '2번 빈칸을 다시 채워 보세요.', 'try'),
    S(5, 'ootx', '빈칸 답을 바르게 썼어요.', '구름이 되는 까닭을 더 써 보세요.', 'ok'),
    S(6, 'oooo', '자기 말로 쉽게 설명했어요.', '비가 내린 뒤도 그려 보세요.', 'good')
  ];
  return a;
}
