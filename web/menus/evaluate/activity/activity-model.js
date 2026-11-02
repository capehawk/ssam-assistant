/* 활동지 저장(스펙 5장): 학년도 자료 activity:list(요약)·activity:a:<id>(활동지 하나)·activity:set(올리기 설정).
   학생 결과는 번호만(이름 없음) */
import * as store from '../../../core/store.js';

const LIST = 'activity:list', A = id => 'activity:a:' + id, SET = 'activity:set';
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const newId = () => 'ac' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);

export function newActivity(meta = {}) {
  return {
    id: newId(),
    meta: { subject: '', unit: '', lesson: '', pages: '', title: '', date: today(), term: null, ...meta },
    sheet: { student: '', teacher: '' }, items: [], confirmed: false, students: [], done: false, link: null, createdAt: Date.now()
  };
}
const valid = a => isObj(a) && typeof a.id === 'string' && isObj(a.meta) && Array.isArray(a.items) && Array.isArray(a.students);
export function getActivity(id) { const a = store.get(A(id), null); return valid(a) ? a : null; }

const summary = a => ({ id: a.id, title: a.meta.title || '', subject: a.meta.subject || '', date: a.meta.date || '', term: a.meta.term || null,
  n: a.students.filter(s => !s.skip && s.status === 'done').length, done: !!a.done, at: a.createdAt || 0 });
/* 저장할 때 긴 글을 자름 */
const trimmed = a => ({
  ...a, sheet: { student: String((a.sheet && a.sheet.student) || '').slice(0, 12000), teacher: String((a.sheet && a.sheet.teacher) || '').slice(0, 12000) },
  students: a.students.map(s => ({ ...s, marks: Object.fromEntries(Object.entries(s.marks || {}).map(([k, c]) => [k, { ...c, read: String((c && c.read) || '').slice(0, 120), why: String((c && c.why) || '').slice(0, 80) }])) }))
});
const rawList = () => { const l = store.get(LIST, []); return (Array.isArray(l) ? l : []).filter(x => isObj(x) && typeof x.id === 'string'); };
export function listActivities() {
  return rawList().slice().sort((a, b) => String(b.date).localeCompare(String(a.date)) || (b.at - a.at));
}
export function saveActivity(a) {
  if (!store.set(A(a.id), trimmed(a))) return false;
  return store.set(LIST, [...rawList().filter(x => x.id !== a.id), summary(a)]);
}
export function removeActivity(id) {
  store.remove(A(id));
  store.set(LIST, rawList().filter(x => x.id !== id));
}
export const getSet = () => ({ pagesPer: 1, maskOn: true, mask: [], maskAll: false, ...(isObj(store.get(SET, null)) ? store.get(SET, null) : {}) });
export const saveSet = s => store.set(SET, s);

const all = () => listActivities().map(s => getActivity(s.id)).filter(Boolean);
/* 학생별 기록(스펙 4.6): 확정한 활동지에서 채점한 학생만, 날짜 차례 */
export function records(no, { subject = '', term = null } = {}) {
  const out = [];
  for (const a of all()) {
    if (!a.done || (subject && a.meta.subject !== subject) || (term && a.meta.term !== term)) continue;
    const s = a.students.find(x => x.no === no && !x.skip && x.status === 'done');
    if (s) out.push({ id: a.id, date: a.meta.date || '', subject: a.meta.subject || '', title: a.meta.title || '', level: s.level || '', good: s.good || '', next: s.next || '' });
  }
  return out.sort((a, b) => String(a.date).localeCompare(String(b.date)));
}
/* 문항별 ○·△·×·안 함 수 (채점한 학생만) */
export function markCounts(a) {
  const out = Object.fromEntries(a.items.map(it => [it.no, { o: 0, t: 0, x: 0, n: 0 }]));
  for (const s of a.students) {
    if (s.skip || s.status !== 'done') continue;
    for (const it of a.items) { const m = s.marks && s.marks[it.no] && s.marks[it.no].mark; if (out[it.no] && m in out[it.no]) out[it.no][m]++; }
  }
  return out;
}
/* 평가 영역에 이어 둔 활동지(스펙 4.8): unitId가 같거나, 교과·영역 이름이 같은 것. 날짜 늦은 것 먼저 */
export function linkedTo({ unitId = '', subject = '', label = '' } = {}) {
  return all().filter(a => a.link && ((unitId && a.link.unitId === unitId) || (label && a.link.subject === subject && a.link.label === label)))
    .map(a => ({ kind: 'activity', id: a.id, title: a.meta.title || '', date: a.meta.date || '' }))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
}
