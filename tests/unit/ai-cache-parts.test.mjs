// 채점 프롬프트 나누기: 학생마다 같은 공통(shared)과 학생 글(own). 공통에는 학생 번호·쪽 수·다시 볼 문항이 없어야 캐시가 됨
import test from 'node:test';
import assert from 'node:assert/strict';
import { newTest } from '../../web/menus/evaluate/unit/unit-model.js';
import { SAMPLE_META, SAMPLE_ITEMS } from '../../web/menus/evaluate/unit/unit-sample.js';
import { gradeParts, gradePrompt } from '../../web/menus/evaluate/unit/unit-ai.js';
import { gradeReviewParts, gradeReviewPrompt } from '../../web/core/ai-review.js';

const T = newTest({ meta: SAMPLE_META, key: { domains: ['지식'], items: SAMPLE_ITEMS }, paper: { text: '1. 다음 글을 읽고 물음에 답하세요.' } });

test('단원평가: 공통은 학생마다 같고, 번호는 학생 글에만, 이어 붙인 글에는 둘 다', () => {
  const a = gradeParts(T, 1), b = gradeParts(T, 2);
  assert.equal(a.shared, b.shared);
  assert.ok(!/\[학생\]/.test(a.shared) && a.shared.startsWith('[단원평가 채점]'), a.shared.slice(0, 80));
  assert.ok(a.shared.includes('[정답표]') && a.shared.includes(`${SAMPLE_ITEMS[0].no} |`) && a.shared.includes('다음 글을 읽고'));
  assert.ok(a.own.includes('[학생] 1번') && b.own.includes('[학생] 2번'));
  assert.ok(/이 글 (뒤|다음)/.test(a.shared), '그림 차례 안내');
  const p = gradePrompt(T, 1);
  assert.ok(p.startsWith(a.shared) && p.endsWith(a.own), p.slice(-60));
});

test('단원평가 검토: 정답표 전체가 공통(학생마다 같음), 다시 볼 문항과 번호는 학생 글', () => {
  const a = gradeReviewParts(T, 1, [2]), b = gradeReviewParts(T, 3, [3, 9]);
  assert.equal(a.shared, b.shared);
  for (const it of SAMPLE_ITEMS) assert.ok(a.shared.includes(`\n${it.no} | `), '정답표 ' + it.no);
  assert.ok(a.own.includes('[학생] 1번') && /다시 볼 문항: 2(\D|$)/.test(a.own), a.own);
  assert.ok(b.own.includes('[학생] 3번') && /다시 볼 문항: 3, 9/.test(b.own), b.own);
  const p = gradeReviewPrompt(T, 1, [2]);
  assert.ok(p.startsWith(a.shared) && p.endsWith(a.own));
});

/* ---------- 활동지 ---------- */
import { gradeParts as actParts, gradePrompt as actPrompt, reviewParts as actReviewParts, reviewPrompt as actReviewPrompt } from '../../web/menus/evaluate/activity/activity-ai.js';
const ACT = { meta: { subject: '과학', unit: '4', lesson: '3', title: '물은 어디로 갈까?' }, items: [
  { no: 1, type: 'choice', ask: '알맞은 것을 고르세요.', answer: '③', ok: '', part: '' },
  { no: 2, type: 'write', ask: '물의 여행을 설명해 봅시다.', answer: '', ok: '증발과 구름을 넣어 설명함', part: '하나만 씀' },
  { no: 3, type: 'draw', ask: '그려 봅시다.', answer: '', ok: '바다·구름·비', part: '일부만' }] };

test('활동지: 1쪽·2쪽 학생도 공통이 같고, 그림 장수는 학생 글에만', () => {
  const a = actParts(ACT, 1), b = actParts(ACT, 2);
  assert.equal(a.shared, b.shared);
  assert.ok(a.shared.startsWith('[활동지 채점]') && a.shared.includes('증발과 구름을 넣어 설명함') && !/\d장/.test(a.shared), a.shared.slice(0, 200));
  assert.ok(a.own.includes('1장') && b.own.includes('2장') && b.own.includes('차례대로'), b.own);
  const p = actPrompt(ACT, 2);
  assert.ok(p.startsWith(a.shared) && p.endsWith(b.own));
});

test('활동지 검토: 문항과 기준 전체가 공통, 먼저 채점한 결과(다시 볼 칸)는 학생 글', () => {
  const a = actReviewParts(ACT, [{ no: 2, read: '설명', mark: 't', why: '구름 없음' }]), b = actReviewParts(ACT, [{ no: 3, read: '그림', mark: 'o', why: '' }]);
  assert.equal(a.shared, b.shared);
  assert.ok(a.shared.startsWith('[활동지 검토]') && a.shared.includes('[1]') && a.shared.includes('[3]'), a.shared);
  assert.ok(a.own.includes('[2] 읽은 답: 설명') && !a.own.includes('[3]'), a.own);
  assert.ok(actReviewPrompt(ACT, [{ no: 2, read: '설명', mark: 't', why: '' }]).startsWith(a.shared));
});
