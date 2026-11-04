/* 연간계획 자료와 계산 (화면 없음 — Node 시험에서도 씀).
   계획 목록은 ssam:yearplans, 보고 있는 계획은 ssam:yearplan:current. 올린 파일은 저장하지 않고 읽은 글만 저장 */
import { get, set } from '../../core/store.js';
import { isDate } from '../../core/calendar.js';
import { getSchool } from '../../core/settings.js';
import { normRv } from './plan-rv.js';

const LIST_KEY = 'yearplans', CUR_KEY = 'yearplan:current';

export const SECTIONS = [['purpose', '목적'], ['policy', '방침'], ['details', '세부 추진 계획'], ['schedule', '월별 추진 일정'], ['budget', '예산'], ['evaluation', '평가 계획']];
export const TEXT_SECTIONS = ['purpose', 'policy', 'details', 'evaluation'];
const SRC = ['lastPlan', 'lastResult', 'guide'];

const str = v => (typeof v === 'string' ? v : v == null ? '' : typeof v === 'number' ? String(v) : '');
// AI가 섹션을 목록(배열)으로 주면 줄로 이음
const text = v => (Array.isArray(v) ? v.filter(x => typeof x === 'string' && x.trim()).join('\n') : str(v));
const strs = v => (Array.isArray(v) ? v.filter(x => typeof x === 'string' && x.trim()).map(x => x.trim()) : []);
const num = v => { const n = Number(String(v == null ? '' : v).replace(/[,\s원₩]/g, '')); return Number.isFinite(n) ? Math.round(n) : 0; };
const won = n => Number(n).toLocaleString('ko-KR');
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);

/* ---------- 계획 ---------- */
export function newPlan() {
  return {
    id: 'yp' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: '', year: getSchool().year, goal: '', owner: '', budget: '',
    sources: { lastPlan: '', lastResult: '', guide: '' }, sourceNames: { lastPlan: [], lastResult: [], guide: [] },
    review: null, guide: null, draft: null, rv: [], status: 'draft', step: 1, maxStep: 1, updatedAt: 0
  };
}

function normPlan(v) {
  if (!isObj(v) || typeof v.id !== 'string' || !v.id) return null;
  const p = newPlan();
  p.id = v.id;
  for (const k of ['name', 'goal', 'owner', 'budget']) p[k] = str(v[k]);
  if (Number.isInteger(v.year)) p.year = v.year;
  for (const k of SRC) {
    p.sources[k] = str(isObj(v.sources) ? v.sources[k] : '');
    p.sourceNames[k] = strs(isObj(v.sourceNames) ? v.sourceNames[k] : []);
  }
  p.review = normReview(v.review);
  p.guide = v.guide == null ? null : normGuide(v.guide);
  p.draft = normDraft(v.draft);
  p.rv = p.draft ? normRv(v.rv) : [];
  p.status = v.status === 'final' ? 'final' : 'draft';
  // 화면 단계(1~5)와 가 본 가장 먼 단계
  const st = n => (Number.isInteger(n) && n >= 1 && n <= 5 ? n : 1);
  p.step = st(v.step);
  p.maxStep = Math.max(p.step, st(v.maxStep));
  p.updatedAt = Number.isFinite(v.updatedAt) ? v.updatedAt : 0;
  return p;
}

const raw = () => { const v = get(LIST_KEY, []); return Array.isArray(v) ? v : []; };
export const listPlans = () => raw().map(normPlan).filter(Boolean).sort((a, b) => b.updatedAt - a.updatedAt);
export const getPlan = id => listPlans().find(p => p.id === id) || null;

/* 저장하면 맨 앞(최근)으로. 같은 밀리초에 두 번 저장해도 순서가 지켜지게 늘 앞선 값보다 크게 */
export function savePlan(plan) {
  const p = normPlan(plan);
  if (!p) return null;
  const list = listPlans();
  p.updatedAt = Math.max(Date.now(), ...list.map(x => x.updatedAt + 1));
  // 저장 공간이 모자라면 null (화면이 알림)
  if (!set(LIST_KEY, [p, ...list.filter(x => x.id !== p.id)])) return null;
  return p;
}
export function deletePlan(id) { set(LIST_KEY, listPlans().filter(p => p.id !== id)); }
export const currentId = () => { const v = get(CUR_KEY, null); return typeof v === 'string' ? v : null; };
export const setCurrent = id => set(CUR_KEY, id);

/* ---------- AI 답 다듬기 ---------- */
export function normReview(v) {
  if (!isObj(v)) return null;
  return {
    good: strs(v.good),
    bad: (Array.isArray(v.bad) ? v.bad : []).filter(b => isObj(b) && str(b.text).trim()).map(b => ({ text: str(b.text).trim(), ideas: strs(b.ideas) })),
    numbers: strs(v.numbers),
    picked: strs(v.picked)
  };
}

export function normGuide(v) {
  return (Array.isArray(v) ? v : []).filter(g => isObj(g) && str(g.item).trim()).map(g => ({
    item: str(g.item).trim(), keywords: strs(g.keywords), sentence: str(g.sentence).trim(),
    section: TEXT_SECTIONS.includes(g.section) ? g.section : 'details'
  }));
}

export function normDraft(v) {
  if (!isObj(v)) return null;
  const d = {};
  for (const k of TEXT_SECTIONS) d[k] = text(v[k]);
  d.schedule = (Array.isArray(v.schedule) ? v.schedule : []).filter(s => isObj(s) && str(s.title).trim()).map(s => {
    const date = isDate(s.date) ? s.date : '';
    const m = date ? +date.slice(5, 7) : Number.isInteger(+s.month) && +s.month >= 1 && +s.month <= 12 ? +s.month : null;
    return { title: str(s.title).trim(), date, month: m };
  });
  d.budget = (Array.isArray(v.budget) ? v.budget : []).filter(b => isObj(b) && str(b.name).trim()).map(b => ({ name: str(b.name).trim(), amount: num(b.amount), note: str(b.note).trim() }));
  return d;
}

/* ---------- 글 계산 ---------- */
export function draftText(draft) {
  if (!draft) return '';
  return [...TEXT_SECTIONS.map(k => draft[k] || ''), ...(draft.schedule || []).map(s => s.title), ...(draft.budget || []).map(b => b.name)].join('\n');
}

/* 줄과 문장 끝(. ! ?)에서 나눔. 「가.」「1)」 같은 번호만 있는 조각은 뒤 문장 앞에 붙임 */
const MARK = /^(?:[가-하]|\d{1,2}|[a-z]|[①-⑳])[.)]$/;
export function sentences(text) {
  const out = [];
  for (const line of String(text || '').split(/\n+/)) {
    let carry = '';
    for (const piece of line.split(/(?<=[.!?])\s+/)) {
      const p = piece.trim();
      if (!p) continue;
      if (MARK.test(p)) { carry += p + ' '; continue; }
      out.push(carry + p); carry = '';
    }
    if (carry.trim()) out.push(carry.trim());
  }
  return out;
}

const LAW = /제\s*\d+\s*조/;
const norm = s => String(s).replace(/[\s\p{P}\p{S}]/gu, '');
const bigrams = s => { const b = new Set(); for (let i = 0; i < s.length - 1; i++) b.add(s.slice(i, i + 2)); return b; };
function dice(a, b) {
  if (!a.size || !b.size) return 0;
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return (2 * n) / (a.size + b.size);
}

/* 올해 초안 문장 중 작년 계획과 (거의) 같은 문장의 비율. 법령 문장은 뺌. 작년 글이 비면 null.
   draft는 연간계획 초안({purpose, …}) 또는 글 (학급운영계획) */
export function overlap(lastText, draft) {
  if (!String(lastText || '').trim()) return null;
  const last = sentences(lastText).filter(s => !LAW.test(s)).map(norm).filter(Boolean);
  const exact = new Set(last);
  const lastB = last.map(s => ({ len: s.length, b: bigrams(s) }));
  const mine = sentences(typeof draft === 'string' ? draft : TEXT_SECTIONS.map(k => (draft && draft[k]) || '').join('\n')).filter(s => !LAW.test(s));
  const same = [];
  for (const s of mine) {
    const n = norm(s);
    if (!n) continue;
    if (exact.has(n)) { same.push(s); continue; }
    const b = bigrams(n);
    // 길이가 너무 다르면 0.8을 넘을 수 없어서 건너뜀
    if (lastB.some(x => Math.min(x.len, n.length) / Math.max(x.len, n.length) >= 0.6 && dice(b, x.b) >= 0.8)) same.push(s);
  }
  const total = mine.filter(s => norm(s)).length;
  return { percent: total ? Math.round((100 * same.length) / total) : 0, same };
}

/* 지침 항목이 초안에 들어갔는지: 핵심어의 절반 이상(올림)이 있으면 반영됨 (띄어쓰기·문장부호 무시) */
export function guideStatus(items, draft) {
  const text = draft ? norm(draftText(draft)) : '';
  return (items || []).map(g => {
    const kws = (g.keywords && g.keywords.length ? g.keywords : [g.item]).map(norm).filter(Boolean);
    const hit = kws.filter(k => text.includes(k)).length;
    return { ...g, included: !!draft && hit >= Math.max(1, Math.ceil(kws.length / 2)) };
  });
}

export function insertSentence(draft, section, sentence) {
  const d = { ...(draft || normDraft({})) };
  const k = TEXT_SECTIONS.includes(section) ? section : 'details';
  const prev = String(d[k] || '').trimEnd();
  d[k] = (prev ? prev + '\n' : '') + String(sentence || '').trim();
  return d;
}

/* 한글 파일(.hwpx)로 내보낼 문서 */
export function planDoc(plan) {
  const d = plan.draft || normDraft({});
  const blocks = [];
  SECTIONS.forEach(([k, label], i) => {
    blocks.push({ type: 'h', text: `${i + 1}. ${label}` });
    if (k === 'schedule') {
      if (d.schedule.length) blocks.push({ type: 'table', head: true, rows: [['날짜', '내용'], ...d.schedule.map(s => [s.date || (s.month ? `${s.month}월` : ''), s.title])] });
      else blocks.push({ type: 'p', text: '(없음)' });
    } else if (k === 'budget') {
      if (d.budget.length) {
        const sum = d.budget.reduce((s, b) => s + b.amount, 0);
        blocks.push({ type: 'table', head: true, rows: [['항목', '금액', '비고'], ...d.budget.map(b => [b.name, won(b.amount), b.note]), ['합계', won(sum), '']] });
      } else blocks.push({ type: 'p', text: '(없음)' });
    } else blocks.push({ type: 'p', text: d[k] || '' });
  });
  return { title: `${plan.year}학년도 ${plan.name || '업무'} 운영 계획`, blocks };
}

/* 지난 계획을 글로: 다음 해 「작년 계획서」 칸에 넣음 (표는 칸을 ' | '로) */
export function planText(plan) {
  const doc = planDoc(plan);
  return [doc.title, ...doc.blocks.map(b => (b.type === 'table' ? b.rows.map(r => r.join(' | ')).join('\n') : b.text))].join('\n');
}
