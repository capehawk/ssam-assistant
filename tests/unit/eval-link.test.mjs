// 평가 영역 이음: 평가계획 영역 목록(없으면 빈 목록), 이어 둔 영역 찾기(id → 교과·이름)
import test from 'node:test';
import assert from 'node:assert/strict';
import { planUnits, findUnit } from '../../web/core/eval-link.js';

const U = [{ id: 'u1', subject: '과학', label: '물질 · 물의 상태 변화' }, { id: 'u2', subject: '국어', label: '읽기 · 경험 나누기' }];

test('평가계획이 없으면 빈 목록', () => {
  assert.deepEqual(planUnits(), []);
  globalThis.window = { SSAM: { planUnits: () => U } };
  assert.deepEqual(planUnits(), U);
  globalThis.window = { SSAM: { planUnits: () => { throw new Error('x'); } } };
  assert.deepEqual(planUnits(), []);
  delete globalThis.window;
});

test('이어 둔 영역 찾기: id가 같으면 그것, 아니면 교과·영역 이름이 같은 것, 없으면 null', () => {
  assert.equal(findUnit({ unitId: 'u1', subject: '과학', label: '아무거나' }, U).id, 'u1');
  assert.equal(findUnit({ unitId: 'old', subject: '과학', label: '물질 · 물의 상태 변화' }, U).id, 'u1');
  assert.equal(findUnit({ unitId: 'old', subject: '과학', label: '바뀐 이름' }, U), null);
  assert.equal(findUnit(null, U), null);
});
