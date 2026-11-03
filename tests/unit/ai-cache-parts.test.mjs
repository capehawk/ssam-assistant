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
