// 활동지 저장·목록·학생별 기록·문항별 셈·평가 영역 이음
import test from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../../web/core/store.js';
import { isYearKey } from '../../web/core/years.js';
import { newActivity, listActivities, getActivity, saveActivity, removeActivity, getSet, saveSet, records, markCounts, linkedTo } from '../../web/menus/evaluate/activity/activity-model.js';

function mem() { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), key: i => [...m.keys()][i], get length() { return m.size; } }; }
store.useStorage(mem());
const stu = (no, o = {}) => ({ no, skip: false, status: 'done', marks: { 1: { read: 'a', mark: 'o', why: '', sure: true } }, good: `${no}번 잘한 점`, next: `${no}번 더 해 볼 점`, level: 'good', levelWhy: '', ...o });

test('새 활동지: 기본 모양, 저장·목록(날짜 늦은 것 먼저)·불러오기·지우기, 학년도 자료 키', () => {
  const a = newActivity({ subject: '과학', title: '물의 여행', date: '2026-09-10', term: 2 });
  assert.equal(a.meta.subject, '과학');
  assert.deepEqual([a.items, a.students, a.confirmed, a.done, a.link], [[], [], false, false, null]);
  assert.ok(saveActivity(a));
  const b = newActivity({ subject: '국어', title: '편지', date: '2026-10-01', term: 2 });
  saveActivity(b);
  assert.deepEqual(listActivities().map(x => x.title), ['편지', '물의 여행']);
  assert.equal(getActivity(a.id).meta.title, '물의 여행');
  removeActivity(b.id);
  assert.deepEqual(listActivities().map(x => x.id), [a.id]);
  assert.ok(isYearKey('activity:list') && isYearKey('activity:a:x') && isYearKey('activity:set'));
  assert.deepEqual(getSet().pagesPer, 1);
  saveSet({ ...getSet(), pagesPer: 2 });
  assert.equal(getSet().pagesPer, 2);
});

test('망가진 저장값은 버림', () => {
  store.set('activity:list', 'x');
  assert.deepEqual(listActivities(), []);
  store.set('activity:a:zz', { id: 'zz' });
  assert.equal(getActivity('zz'), null);
  assert.equal(getActivity('nope'), null);
});

test('학생별 기록: 확정한 활동지만, 교과·학기로 거름, 채점 안 한 학생은 뺌, 날짜 차례', () => {
  const mk = (subject, date, term, done, students) => { const a = newActivity({ subject, title: `${subject} ${date}`, date, term }); a.done = done; a.students = students; saveActivity(a); return a; };
  mk('과학', '2026-09-20', 2, true, [stu(3), stu(4)]);
  mk('과학', '2026-09-05', 2, true, [stu(3, { level: 'ok' })]);
  mk('과학', '2026-05-05', 1, true, [stu(3)]);
  mk('국어', '2026-09-07', 2, true, [stu(3)]);
  mk('과학', '2026-09-25', 2, false, [stu(3)]);
  mk('과학', '2026-09-26', 2, true, [stu(3, { skip: true })]);
  const r = records(3, { subject: '과학', term: 2 });
  assert.deepEqual(r.map(x => [x.date, x.level]), [['2026-09-05', 'ok'], ['2026-09-20', 'good']]);
  assert.deepEqual(Object.keys(r[0]).sort(), ['date', 'good', 'id', 'level', 'next', 'subject', 'title']);
  assert.equal(records(3).length, 4);
  assert.equal(records(9).length, 0);
});

test('문항별 셈: ○·△·×·안 함, 채점 안 한 학생은 셈하지 않음', () => {
  const a = newActivity();
  a.items = [{ no: 1 }, { no: 2 }];
  a.students = [
    { no: 1, status: 'done', marks: { 1: { mark: 'o' }, 2: { mark: 'x' } } },
    { no: 2, status: 'done', marks: { 1: { mark: 't' }, 2: { mark: 'n' } } },
    { no: 3, status: 'idle', marks: { 1: { mark: 'o' } } },
    { no: 4, status: 'done', skip: true, marks: { 1: { mark: 'o' } } }
  ];
  assert.deepEqual(markCounts(a), { 1: { o: 1, t: 1, x: 0, n: 0 }, 2: { o: 0, t: 0, x: 1, n: 1 } });
});

test('평가 영역 이음: unitId가 같거나, 없으면 교과·영역 이름이 같은 것', () => {
  const a = newActivity({ subject: '과학', title: '물', date: '2026-09-01', term: 2 });
  a.link = { unitId: 'u1', subject: '과학', label: '물질 · 물의 상태 변화' };
  saveActivity(a);
  const b = newActivity({ subject: '과학', title: '얼음', date: '2026-09-09', term: 2 });
  b.link = { unitId: 'old', subject: '과학', label: '물질 · 물의 상태 변화' };
  saveActivity(b);
  assert.deepEqual(linkedTo({ unitId: 'u1', subject: '과학', label: '물질 · 물의 상태 변화' }).map(x => x.title), ['얼음', '물']);
  assert.deepEqual(linkedTo({ unitId: 'u2', subject: '과학', label: '다른 영역' }), []);
  assert.equal(linkedTo({ unitId: 'u1', subject: '과학', label: '' }).length, 1);
  assert.equal(linkedTo({ unitId: 'u1', subject: '과학', label: '' })[0].kind, 'activity');
});
