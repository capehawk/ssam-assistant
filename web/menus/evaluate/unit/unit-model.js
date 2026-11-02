/* 단원평가 저장·통계 (스펙 2.3·4). 학년도마다 따로인 ssam:unit:* 키에 둠 */
import * as store from '../../../core/store.js';
import { keyTotal } from './unit-key.js';
import { studentTotal } from './unit-grade.js';

const LIST = 'unit:list', T = id => 'unit:t:' + id, SET = 'unit:set', PY = s => 'unit:pyeongeo:' + s;
export const LEVEL_NAME = { top: '최상', high: '상', mid: '중', low: '하' };
const CUTS = { top: 95, high: 80, mid: 60 };
const r1 = x => Math.round(x * 10) / 10;
const mean = a => (a.length ? r1(a.reduce((s, x) => s + x, 0) / a.length) : null);
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const graded = test => ((test && test.students) || []).filter(s => !s.skip && s.status === 'done');
const domainsOf = it => String(it.domain || '').split('·').filter(Boolean);

export function makeTitle(m = {}) {
  const parts = [m.grade ? `${m.grade}학년` : '', m.subject || '', m.unitNo ? `${m.unitNo}단원` : '', m.unitName || '', m.round ? `(${m.round}회)` : ''].filter(Boolean);
  return (parts.join(' ') || '단원평가') + (m.sample ? ' (예시)' : '');
}

export function newTest({ meta = {}, key = {}, paper = {} } = {}) {
  return {
    id: newId(),
    meta: { subject: '', grade: null, term: null, unitNo: null, unitName: '', round: null, date: today(), ...meta },
    key: { domains: [], items: [], ...key }, paper: { text: '', ...paper },
    students: [], done: false, createdAt: Date.now()
  };
}

function summary(t) {
  const g = graded(t);
  return {
    id: t.id, title: makeTitle(t.meta), subject: t.meta.subject || '', grade: t.meta.grade, term: t.meta.term, unitNo: t.meta.unitNo, round: t.meta.round,
    date: t.meta.date || '', total: keyTotal(t.key.items), n: g.length, avg: mean(g.map(s => studentTotal(t, s).pct)), done: !!t.done, at: t.createdAt || 0, sample: !!t.meta.sample, savedAt: Date.now() + Math.random()
  };
}
/* 저장할 때 긴 글을 자름 (한 평가 약 50KB) */
function trimmed(t) {
  return {
    ...t, paper: { ...t.paper, text: String(t.paper.text || '').slice(0, 12000) },
    students: t.students.map(s => ({
      ...s, items: Object.fromEntries(Object.entries(s.items || {}).map(([k, c]) => [k, { ...c, read: String(c.read || '').slice(0, 120), why: String(c.why || '').slice(0, 80) }]))
    }))
  };
}

export function listTests() {
  const l = store.get(LIST, []);
  return (Array.isArray(l) ? l : []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)) || (b.at - a.at));
}
export const getTest = id => store.get(T(id), null);
/* 여러 평가를 읽어 통계에 씀: 저장 뒤 바뀌지 않은 평가는 다시 풀지 않음 (읽기 전용으로만 쓸 것) */
const parsed = new Map();
export function loadTests(summaries) {
  return summaries.map(s => {
    const c = parsed.get(s.id);
    if (c && c.savedAt === s.savedAt && s.savedAt) return c.test;
    const test = getTest(s.id);
    if (test) parsed.set(s.id, { savedAt: s.savedAt, test }); else parsed.delete(s.id);
    return test;
  }).filter(Boolean);
}
export function saveTest(test) {
  if (!store.set(T(test.id), trimmed(test))) return false;
  const l = store.get(LIST, []).filter(x => x.id !== test.id);
  return store.set(LIST, [...l, summary(test)]);
}
export function removeTest(id) {
  store.remove(T(id));
  store.set(LIST, store.get(LIST, []).filter(x => x.id !== id));
}

export const getSet = () => ({ pagesPer: 2, mask: [], maskAll: false, maskOn: true, ...(store.get(SET, {}) || {}) });
export const saveSet = s => store.set(SET, s);
export function getPyeongeo(subject) {
  const v = store.get(PY(subject), null) || {};
  // off: 뺀 평가 id (나중에 마친 같은 교과 평가는 들어감)
  return { students: {}, ...v, off: Array.isArray(v.off) ? v.off : [], cuts: { ...CUTS, ...(v.cuts || {}) } };
}
export const savePyeongeo = (subject, v) => store.set(PY(subject), v);

/* 1번부터(또는 start부터) 예외 번호를 건너뛰며 n개 */
export function numbersFor(n, except = [], start = 1) {
  const ex = new Set(except.map(Number)), out = [];
  for (let no = Math.max(1, start | 0); out.length < n; no++) if (!ex.has(no)) out.push(no);
  return out;
}
/* 결석 번호 글(「5, 12」)에서 1~99 번호 */
export const parseNos = text => [...new Set((String(text || '').match(/\d+/g) || []).map(Number).filter(n => n >= 1 && n <= 99))].sort((a, b) => a - b);
/* 답안 차례는 그대로 두고 번호만 다시: 명단 예외와 이 평가의 결석 번호를 건너뜀 */
export function renumber(test, except = []) {
  const nos = numbersFor(test.students.length, [...except, ...(test.absent || [])]);
  test.students.forEach((s, i) => { s.no = nos[i]; });
  return test;
}
/* 이 평가의 이름 칸 가림 (정하지 않았으면 null) */
export const maskOf = t => (t && Array.isArray(t.mask) ? { mask: t.mask, all: !!t.maskAll } : null);
export const termOf = date => { const m = Number(String(date || '').slice(5, 7)); return m >= 3 && m <= 8 ? 1 : 2; };
export const filterTests = (list, { subject = '', term = 0 } = {}) =>
  list.filter(s => (!subject || s.subject === subject) && (!term || termOf(s.date) === Number(term)));

const order = (a, b) => String(a.meta.subject).localeCompare(String(b.meta.subject), 'ko') || ((a.meta.unitNo || 0) - (b.meta.unitNo || 0)) || ((a.meta.round || 0) - (b.meta.round || 0)) || String(a.meta.date).localeCompare(String(b.meta.date));

export function summaryTable(tests) {
  const ts = tests.slice().sort(order);
  const nos = [...new Set(ts.flatMap(t => graded(t).map(s => s.no)))].sort((a, b) => a - b);
  const pctOf = (t, no) => { const s = graded(t).find(x => x.no === no); return s ? studentTotal(t, s).pct : null; };
  const rows = nos.map(no => {
    const cells = Object.fromEntries(ts.map(t => [t.id, pctOf(t, no)]));
    return { no, cells, avg: mean(Object.values(cells).filter(v => v != null)) };
  });
  const colAvg = Object.fromEntries(ts.map(t => [t.id, mean(graded(t).map(s => studentTotal(t, s).pct))]));
  return { cols: ts.map(t => ({ id: t.id, title: makeTitle(t.meta), subject: t.meta.subject })), rows, colAvg };
}

export function studentHistory(tests, no) {
  const ts = tests.slice().sort((a, b) => String(a.meta.date).localeCompare(String(b.meta.date)));
  const rows = [], dom = new Map(), weak = new Map();
  for (const t of ts) {
    const s = graded(t).find(x => x.no === no);
    if (!s) continue;
    const tot = studentTotal(t, s);
    rows.push({ id: t.id, title: makeTitle(t.meta), date: t.meta.date, score: tot.score, total: tot.total, pct: tot.pct, classAvg: mean(graded(t).map(x => studentTotal(t, x).pct)) });
    for (const d of t.key.domains || []) if (!dom.has(d)) dom.set(d, [0, 0]);
    for (const it of t.key.items) {
      const got = Number(s.items[it.no] && s.items[it.no].pts) || 0, full = Number(it.points) || 0;
      for (const d of domainsOf(it)) { const v = dom.get(d) || [0, 0]; v[0] += got; v[1] += full; dom.set(d, v); }
      const w = weak.get(it.content) || { content: it.content, lost: 0, pages: it.pages };
      w.lost += full - got; weak.set(it.content, w);
    }
  }
  return {
    rows,
    domains: [...dom].filter(([, v]) => v[1]).map(([name, v]) => ({ name, rate: v[0] / v[1] })),
    weak: [...weak.values()].filter(w => w.lost > 0).sort((a, b) => b.lost - a.lost).slice(0, 5)
  };
}

export function itemStats(test) {
  const g = graded(test);
  return test.key.items.map(it => {
    const full = Number(it.points) || 0;
    const got = g.reduce((s, st) => s + (Number(st.items[it.no] && st.items[it.no].pts) || 0), 0);
    const wrong = [];
    if (it.type === 'choice' || it.type === 'symbol') {
      const m = new Map();
      for (const st of g) {
        const c = st.items[it.no];
        if (!c || !c.read || (Number(c.pts) || 0) >= full) continue;
        const k = c.read.replace(/\s+/g, '');
        m.set(k, { answer: (m.get(k) || {}).answer || c.read, count: ((m.get(k) || {}).count || 0) + 1 });
      }
      wrong.push(...[...m.values()].sort((a, b) => b.count - a.count).slice(0, 3));
    }
    return { no: it.no, content: it.content, domain: it.domain, type: it.type, rate: full && g.length ? got / (full * g.length) : 0, wrong, pages: it.pages };
  });
}
export const reteach = test => itemStats(test).filter(x => x.rate < 0.6).sort((a, b) => a.rate - b.rate);

export function domainStats(tests) {
  const dom = new Map();
  for (const t of tests) {
    for (const d of t.key.domains || []) if (!dom.has(d)) dom.set(d, [0, 0]);
    for (const st of graded(t)) for (const it of t.key.items) {
      const got = Number(st.items[it.no] && st.items[it.no].pts) || 0;
      for (const d of domainsOf(it)) { const v = dom.get(d) || [0, 0]; v[0] += got; v[1] += Number(it.points) || 0; dom.set(d, v); }
    }
  }
  return [...dom].filter(([, v]) => v[1]).map(([name, v]) => ({ name, rate: v[0] / v[1] }));
}

export function levelOf(pct, cuts = CUTS) {
  const c = { ...CUTS, ...cuts };
  return pct >= c.top ? 'top' : pct >= c.high ? 'high' : pct >= c.mid ? 'mid' : 'low';
}

export function feedbackOf(test, st) {
  const { score, total } = studentTotal(test, st);
  const wrong = [], partial = [];
  for (const it of test.key.items) {
    const c = st.items[it.no] || {}, pts = Number(c.pts) || 0, full = Number(it.points) || 0;
    if (pts <= 0) wrong.push({ no: it.no, content: it.content, read: c.read || '', answer: it.answer, pages: it.pages });
    else if (pts < full) partial.push({ no: it.no, content: it.content, pts, points: full });
  }
  return { score, total, wrong, partial };
}

export function feedbackText(test, st) {
  const f = feedbackOf(test, st);
  const out = [`[${makeTitle(test.meta)}] ${st.no}번 · 점수 ${f.score}/${f.total}`];
  const items = [
    ...f.wrong.map(w => ({ no: w.no, line: `- ${w.no}번 ${w.content}${w.pages ? ` (${w.pages})` : ''}` })),
    ...f.partial.map(p => { const it = test.key.items.find(i => i.no === p.no) || {}; return { no: p.no, line: `- ${p.no}번 ${p.content} (부분 점수 ${p.pts}/${p.points}${it.pages ? `, ${it.pages}` : ''})` }; })
  ].sort((a, b) => a.no - b.no);
  if (items.length) out.push('다시 볼 문항', ...items.map(x => x.line));
  else out.push('다시 볼 문항: 없어요. 모두 맞혔어요!');
  if (st.good) out.push(`잘한 점: ${st.good}`);
  if (st.cheer) out.push(`한마디: ${st.cheer}`);
  return out.join('\n');
}

/* 평가 영역에 이어 둔 단원평가(활동지 스펙 4.8): unitId가 같거나, 교과·영역 이름이 같은 것. 날짜 늦은 것 먼저 */
export function unitLinkedTo({ unitId = '', subject = '', label = '' } = {}) {
  return listTests().map(s => getTest(s.id)).filter(t => t && t.link && ((unitId && t.link.unitId === unitId) || (label && t.link.subject === subject && t.link.label === label)))
    .map(t => ({ kind: 'unit', id: t.id, title: makeTitle(t.meta), date: t.meta.date || '' }))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
}
