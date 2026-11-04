// 평가지 채점에서 참고할 단원평가·활동지: 이어 둔 것 목록(날짜 늦은 것 먼저), 학생 한 명의 참고 줄(번호만, 600자까지)
import test from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../../web/core/store.js';
import { newActivity, saveActivity } from '../../web/menus/evaluate/activity/activity-model.js';
import { newTest, saveTest } from '../../web/menus/evaluate/unit/unit-model.js';
import { linked, lines } from '../../web/core/eval-refs.js';

function mem() { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; }
store.useStorage(mem());
const LINK = { unitId: 'u1', subject: '과학', label: '물질 · 물의 상태 변화' };
const a = newActivity({ subject: '과학', title: '물의 여행', date: '2026-09-10', term: 2 });
a.link = LINK; a.done = true;
a.students = [{ no: 3, skip: false, status: 'done', marks: {}, good: '물의 여행을 차례대로 설명함', next: '화살표를 더해 보기', level: 'good' }, { no: 4, skip: false, status: 'done', marks: {}, good: 'x'.repeat(900), next: '', level: 'ok' }];
saveActivity(a);
const t = newTest({ meta: { subject: '과학', unitNo: 1, unitName: '물의 상태', date: '2026-09-20' }, key: { items: [{ no: 1, answer: '③', points: 50, content: '증발' }, { no: 2, answer: '①', points: 50, content: '응결' }] } });
t.link = LINK;
t.students = [{ no: 3, skip: false, status: 'done', items: { 1: { pts: 50 }, 2: { pts: 0 } }, good: '증발을 잘 앎', cheer: '' }];
saveTest(t);

test('이어 둔 것: 단원평가·활동지를 날짜 늦은 것 먼저', () => {
  const r = linked({ id: 'u1', subject: '과학', label: '물질 · 물의 상태 변화' });
  assert.deepEqual(r.map(x => x.kind), ['unit', 'activity']);
  assert.deepEqual(linked({ id: 'u9', subject: '과학', label: '다른 영역' }), []);
});

test('참고 줄: 활동지 수준·잘한 점·더 해 볼 점, 단원평가 %·잘한 점·보완할 것(틀린 문항), 번호만, 600자까지', () => {
  const refs = [{ kind: 'activity', id: a.id }, { kind: 'unit', id: t.id }];
  const l = lines(refs, 3);
  assert.ok(l.includes('활동지 「물의 여행」 잘함') && l.includes('물의 여행을 차례대로 설명함') && l.includes('화살표를 더해 보기'), l);
  assert.ok(l.includes('단원평가') && l.includes('50%') && l.includes('증발을 잘 앎') && l.includes('보완할 것: 응결'), l);
  assert.ok(lines(refs, 4).length <= 600);
  assert.equal(lines(refs, 9), '');
  assert.equal(lines([], 3), '');
  assert.equal(lines([{ kind: 'activity', id: 'nope' }], 3), '');
});
