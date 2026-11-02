// 단원평가 평가 영역 이음: unitId가 같거나, 없으면 교과·영역 이름이 같은 단원평가 (날짜 늦은 것 먼저)
import test from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../../web/core/store.js';
import { newTest, saveTest, unitLinkedTo } from '../../web/menus/evaluate/unit/unit-model.js';

function mem() { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; }
store.useStorage(mem());

test('이어 둔 단원평가 찾기', () => {
  const a = newTest({ meta: { subject: '과학', unitNo: 1, date: '2026-09-01' }, key: { items: [{ no: 1, answer: '③', points: 100 }] } });
  a.link = { unitId: 'u1', subject: '과학', label: '물질 · 물의 상태 변화' };
  saveTest(a);
  const b = newTest({ meta: { subject: '과학', unitNo: 2, date: '2026-09-20' }, key: { items: [{ no: 1, answer: '①', points: 100 }] } });
  b.link = { unitId: 'old', subject: '과학', label: '물질 · 물의 상태 변화' };
  saveTest(b);
  saveTest(newTest({ meta: { subject: '과학', unitNo: 3, date: '2026-09-25' }, key: { items: [{ no: 1, answer: '①', points: 100 }] } }));
  const r = unitLinkedTo({ unitId: 'u1', subject: '과학', label: '물질 · 물의 상태 변화' });
  assert.deepEqual(r.map(x => [x.kind, x.date]), [['unit', '2026-09-20'], ['unit', '2026-09-01']]);
  assert.ok(r[0].title.includes('과학'));
  assert.deepEqual(unitLinkedTo({ unitId: 'zz', subject: '과학', label: '다른 영역' }), []);
});
