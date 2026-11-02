/* 학급운영계획 자료와 계산 (화면 없음 — Node 시험에서도 씀).
   목록은 ssam:classplans, 보고 있는 계획은 ssam:classplan:current. 올린 파일은 저장하지 않고 읽은 글·요약만 저장 */
import { stripNames } from '../../core/privacy.js';
import { get, set } from '../../core/store.js';
import { getSchool } from '../../core/settings.js';
import { normRv } from './plan-rv.js';

const LIST_KEY = 'classplans', CUR_KEY = 'classplan:current';
export const MAX_SRC = 60000, MAX_BODY = 1500, MAX_EVAL = 20000;
export const KIND_NAME = { jindo: '진도표', eval: '평가계획', other: '첨부' };
const ROMAN = 'ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ';

const str = v => (typeof v === 'string' ? v : v == null ? '' : typeof v === 'number' ? String(v) : '');
const text = v => (Array.isArray(v) ? v.filter(x => typeof x === 'string' && x.trim()).join('\n') : str(v)).trim();
const strs = v => (Array.isArray(v) ? v.filter(x => typeof x === 'string' && x.trim()).map(x => x.trim()) : []);
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const int = (v, lo, hi) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= lo && n <= hi ? n : null; };
const norm = s => String(s || '').replace(/[\s\p{P}\p{S}]/gu, '');
export const newId = () => 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/* ---------- 목차 ---------- */
/* 칸의 역할: 시수표·(교과)평가 표·월별 표가 들어갈 칸 */
export function roleOf(title) {
  const t = String(title || '');
  if (/시간\s*배당|시수/.test(t)) return 'hours';
  if (/월별/.test(t)) return 'monthly';
  if (/평가\s*계획/.test(t) && !/창의적|창체|행동|교육과정|운영/.test(t)) return 'eval';
  return '';
}
/* 아래 칸이 없는 칸(글을 쓰는 칸)마다, 역할은 처음 칸 하나에만 */
export function withRoles(list) {
  const used = new Set();
  return list.map((x, i) => {
    const leaf = x.level === 2 || !(list[i + 1] && list[i + 1].level === 2);
    const r = leaf ? roleOf(x.title) : '';
    const role = r && !used.has(r) ? (used.add(r), r) : '';
    return { ...x, role };
  });
}
export const leaves = outline => (outline || []).filter((x, i, a) => x.level === 2 || !(a[i + 1] && a[i + 1].level === 2));

const L1 = new RegExp(`^([${ROMAN}])\\.\\s*(\\S.*)$`), NUM = /^(\d{1,2})\.\s*(\S.*)$/, GA = /^([가-하])\.\s*(\S.*)$/;
const PAGE = /(\s*[.·…‥ㆍ]{2,}\s*|\s{2,})\d{1,3}$/, LESSON = /\d{1,2}\s*\/\s*\d{1,2}/, GA_ORDER = '가나다라마바사아자차카타파하';
/* 글에서 머리 줄 찾기: [{ line, level, title }]. 표 줄(|)·차례 줄(쪽수 탭)·차시 줄(1/12)·41자 넘는 줄은 빼고,
   번호는 차례에 맞는 것만(앞 번호와 같거나 하나·둘 큰 것 — 표 안 단원 번호·본문 번호 목록 거르기). 차례가 먼저 나오면 본문이 다시 시작할 때 차례 것은 버림 */
function headings(src) {
  const lines = String(src || '').split('\n');
  const roman = lines.some(l => L1.test(l.trim()) && !l.includes('|'));
  let out = [], seen = new Set(), inTop = false, prev1 = 0, prev2 = 0, parent = '';
  lines.forEach((raw, i) => {
    const l = raw.trim().replace(PAGE, '');
    if (!l || l.includes('|') || l.includes('\t') || l.length > 41 || LESSON.test(l)) return;
    let m, level = 0, n = 0;
    if (roman) {
      if ((m = L1.exec(l))) { level = 1; n = ROMAN.indexOf(m[1]) + 1; }
      else if ((m = NUM.exec(l)) && inTop) { level = 2; n = +m[1]; }
    } else if ((m = NUM.exec(l))) { level = 1; n = +m[1]; }
    else if ((m = GA.exec(l)) && inTop) { level = 2; n = GA_ORDER.indexOf(m[1]) + 1; }
    if (!level) return;
    const title = m[2].trim();
    if (level === 1 && n === 1 && out.length && norm(title) === norm(out[0].title)) { out = []; seen = new Set(); prev1 = 0; }
    const ok = prev => n >= Math.max(1, prev) && n <= prev + 2; // 같은 번호 거듭·하나 건너뜀은 잘못 매긴 번호로 봄
    if (level === 2 ? !ok(prev2) : !roman && !ok(prev1)) return;
    if (level === 1) { inTop = true; prev1 = n; prev2 = 0; parent = norm(title); } else prev2 = n;
    const key = level === 1 ? '1' + norm(title) : `2${parent}/${norm(title)}`; // 작은 칸은 큰 칸마다 따로
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ line: i, level, title });
  });
  return out;
}
/* 작년 계획서 글 → 목차 [{ id, title, level(1·2), role }] */
export const parseOutline = src => withRoles(headings(src).map((h, i) => ({ id: 's' + (i + 1), title: h.title, level: h.level })));

/* 칸마다 작년 글: 그 머리 줄부터 다음 머리 줄 앞까지 (1,500자까지) */
export function sectionBodies(src, outline) {
  const lines = String(src || '').split('\n'), hs = headings(src), out = {}, used = new Set();
  for (const x of outline || []) {
    const k = hs.findIndex((h, j) => !used.has(j) && h.level === x.level && norm(h.title) === norm(x.title));
    if (k < 0) continue;
    used.add(k);
    const end = hs[k + 1] ? hs[k + 1].line : lines.length;
    const body = lines.slice(hs[k].line + 1, end).join('\n').trim();
    if (body) out[x.id] = body.slice(0, MAX_BODY);
  }
  return out;
}

/* 표준 목차 (작년 계획서가 없을 때): 교사 매체·학교 사례와 학교 「학급 교육과정 운영 평가」 항목을 모아 정함 */
const STD = [
  ['학급 현황', ['학급 실태', '학급 조직(임원·1인 1역·모둠)']],
  ['학급 교육 목표', ['급훈과 학급 교육 목표', '학급 경영 방침']],
  ['학급 교육과정 편성', ['편성 방향', '편제 및 시간 배당', '교과 지도 계획(기초학력·독서·수준별 지도)']],
  ['학급 특색 교육', ['목적과 방침', '세부 운영 내용', '기대 효과']],
  ['생활 및 인성 교육', ['기본 생활 습관과 학급 규칙', '안전 교육과 학교폭력 예방', '상담 계획']],
  ['창의적 체험활동', ['자율·자치활동', '동아리·진로활동']],
  ['학부모 소통', ['소통과 상담 계획']],
  ['평가 계획', ['교과 평가 계획', '창의적 체험활동·행동발달 평가', '학급 교육과정 운영 평가']],
  ['월별 운영 계획', ['월별 주요 활동']]
];
export const STANDARD = withRoles(STD.flatMap(([t, subs], i) => [{ id: 'std' + (i + 1), title: t, level: 1 }, ...subs.map((s, j) => ({ id: `std${i + 1}_${j + 1}`, title: s, level: 2 }))]));

/* 첨부 종류 짐작: 파일 이름 먼저, 그다음 글 */
export function attachKind(name, body) {
  const n = String(name || ''), t = String(body || '').slice(0, 20000);
  if (/평가\s*계획|평가계획|성취기준/.test(n)) return 'eval';
  if (/진도|연간지도계획|지도\s*계획/.test(n)) return 'jindo';
  if (/연간지도계획/.test(t)) return 'jindo';
  if (/성취기준|평가\s*방법|평가\s*계획/.test(t)) return 'eval';
  return 'other';
}

/* ---------- 계획 ---------- */
export function newPlan() {
  let info = {};
  try { info = get('class:info', {}) || {}; } catch (e) {}
  return {
    id: 'cp' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    year: getSchool().year, grade: int(info.grade, 1, 6), room: int(info.room, 1, 30), boys: null, girls: null, motto: '',
    sources: { lastPlan: '', guide: '' }, sourceNames: { lastPlan: [], guide: [] },
    outline: [], attach: [], guide: null, draft: null, rv: [], monthly: [], evalRows: [],
    status: 'draft', step: 1, maxStep: 1, updatedAt: 0
  };
}
function normOutline(v) {
  const list = (Array.isArray(v) ? v : []).filter(x => isObj(x) && str(x.id) && str(x.title).trim())
    .map(x => ({ id: str(x.id), title: str(x.title).trim().slice(0, 60), level: x.level === 2 ? 2 : 1 }));
  return withRoles(list);
}
function normAttach(v) {
  return (Array.isArray(v) ? v : []).filter(x => isObj(x) && str(x.name)).map(x => {
    const kind = KIND_NAME[x.kind] ? x.kind : 'other';
    const subjects = isObj(x.summary) && Array.isArray(x.summary.subjects)
      ? x.summary.subjects.filter(s => isObj(s) && str(s.name)).map(s => ({ name: str(s.name), hours: Math.max(0, Math.round(Number(s.hours) || 0)) })) : [];
    // 평가계획은 AI로 다시 읽을 수 있게 글(이름 줄 뺀 것)을 2만 자까지 지님
    return { id: str(x.id) || newId(), name: str(x.name), kind, text: kind === 'eval' ? str(x.text).slice(0, MAX_EVAL) : '', summary: { subjects } };
  });
}
function normPlan(v) {
  if (!isObj(v) || typeof v.id !== 'string' || !v.id) return null;
  const p = newPlan();
  p.id = v.id;
  if (Number.isInteger(v.year)) p.year = v.year;
  p.grade = int(v.grade, 1, 6); p.room = int(v.room, 1, 30);
  p.boys = int(v.boys, 0, 60); p.girls = int(v.girls, 0, 60);
  p.motto = str(v.motto);
  for (const k of ['lastPlan', 'guide']) {
    p.sources[k] = str(isObj(v.sources) ? v.sources[k] : '').slice(0, MAX_SRC);
    p.sourceNames[k] = strs(isObj(v.sourceNames) ? v.sourceNames[k] : []);
  }
  p.outline = normOutline(v.outline);
  p.attach = normAttach(v.attach);
  p.guide = v.guide == null ? null : normGuide(v.guide, p.outline);
  p.draft = isObj(v.draft) ? Object.fromEntries(Object.entries(v.draft).filter(([k, t]) => typeof t === 'string' && p.outline.some(x => x.id === k))) : null;
  p.rv = p.draft ? normRv(v.rv).filter(x => p.outline.some(o => o.id === x.section)) : [];
  p.monthly = normMonthly(v.monthly);
  p.evalRows = normEvalRows(v.evalRows);
  p.status = v.status === 'final' ? 'final' : 'draft';
  const st = n => (Number.isInteger(n) && n >= 1 && n <= 4 ? n : 1);
  p.step = st(v.step);
  p.maxStep = Math.max(p.step, st(v.maxStep));
  p.updatedAt = Number.isFinite(v.updatedAt) ? v.updatedAt : 0;
  return p;
}
const raw = () => { const v = get(LIST_KEY, []); return Array.isArray(v) ? v : []; };
export const listPlans = () => raw().map(normPlan).filter(Boolean).sort((a, b) => b.updatedAt - a.updatedAt);
export const getPlan = id => listPlans().find(p => p.id === id) || null;
/* 저장하면 맨 앞(최근)으로. 저장 공간이 모자라면 null (화면이 알림) */
export function savePlan(plan) {
  const p = normPlan(plan);
  if (!p) return null;
  // 붙여넣은 글도 명단 줄·전화번호는 빼고 이름 칸은 가려서 저장 (파일은 넣을 때 이미 거침)
  for (const k of ['lastPlan', 'guide']) p.sources[k] = stripNames(p.sources[k]).text;
  const list = listPlans();
  p.updatedAt = Math.max(Date.now(), ...list.map(x => x.updatedAt + 1));
  if (!set(LIST_KEY, [p, ...list.filter(x => x.id !== p.id)])) return null;
  return p;
}
export function deletePlan(id) { set(LIST_KEY, listPlans().filter(p => p.id !== id)); }
export const currentId = () => { const v = get(CUR_KEY, null); return typeof v === 'string' ? v : null; };
export const setCurrent = id => set(CUR_KEY, id);

/* ---------- AI 답 다듬기 ---------- */
/* { sections: {칸 id: 글} } → 글을 쓰는 칸 것만, 빈 글은 뺌 */
export function normSections(v, outline) {
  const src = isObj(v) && isObj(v.sections) ? v.sections : isObj(v) ? v : {};
  const ids = new Set(leaves(outline).map(x => x.id)), out = {};
  for (const [k, t] of Object.entries(src)) { const s = text(t); if (ids.has(k) && s) out[k] = s; }
  return out;
}
export function normMonthly(v) {
  const list = isObj(v) && Array.isArray(v.monthly) ? v.monthly : v;
  return (Array.isArray(list) ? list : []).filter(isObj).map(x => ({ month: int(x.month, 1, 12), text: text(x.text) })).filter(x => x.month && x.text);
}
export function normEvalRows(v) {
  const list = isObj(v) && Array.isArray(v.rows) ? v.rows : v;
  return (Array.isArray(list) ? list : []).filter(isObj).map(x => ({ subject: str(x.subject).trim(), unit: str(x.unit).trim(), standard: str(x.standard).trim(), method: str(x.method).trim(), when: str(x.when).trim() }))
    .filter(x => x.subject || x.standard);
}
/* 지침 항목: 모르는 칸이면 첫 칸 */
export function normGuide(v, outline) {
  const ids = leaves(outline).map(x => x.id);
  return (Array.isArray(v) ? v : []).filter(g => isObj(g) && str(g.item).trim()).map(g => ({
    item: str(g.item).trim(), keywords: strs(g.keywords), sentence: str(g.sentence).trim(),
    section: ids.includes(g.section) ? g.section : ids[0] || ''
  }));
}

/* ---------- 글 계산 ---------- */
export const draftText = draft => Object.values(draft || {}).filter(t => typeof t === 'string').join('\n');
/* 지침 항목이 초안에 들어갔는지: 핵심어의 절반 이상(올림)이 있으면 반영됨 (띄어쓰기·문장부호 무시) */
export function guideStatus(items, draft) {
  const all = norm(draftText(draft));
  return (items || []).map(g => {
    const kws = (g.keywords && g.keywords.length ? g.keywords : [g.item]).map(norm).filter(Boolean);
    const hit = kws.filter(k => all.includes(k)).length;
    return { ...g, included: !!draft && hit >= Math.max(1, Math.ceil(kws.length / 2)) };
  });
}
export function insertSentence(draft, id, sentence) {
  const d = { ...(draft || {}) }, prev = String(d[id] || '').trimEnd();
  d[id] = (prev ? prev + '\n' : '') + String(sentence || '').trim();
  return d;
}
/* 진도표 첨부의 교과별 시수를 더해 [[교과, 시수] …, [합계, n]] */
export function hoursRows(attach) {
  const m = new Map();
  for (const a of attach || []) if (a.kind === 'jindo') for (const s of (a.summary && a.summary.subjects) || []) m.set(s.name, (m.get(s.name) || 0) + (s.hours || 0));
  if (!m.size) return [];
  const rows = [...m].map(([n, h]) => [n, String(h)]);
  return [...rows, ['합계', String([...m.values()].reduce((a, b) => a + b, 0))]];
}

/* ---------- 한글 파일 ---------- */
export const planTitle = p => `${p.year}학년도 ${p.grade && p.room ? `${p.grade}학년 ${p.room}반 ` : ''}학급 교육과정 운영 계획`;
const EVAL_HEAD = ['교과', '단원(영역)', '성취기준', '평가 방법', '시기'];
/* 목차 번호는 차례대로 다시 매김(1단계 Ⅰ·Ⅱ…, 2단계 1·2…) */
function numbered(outline) {
  let a = 0, b = 0;
  return (outline || []).map(x => (x.level === 1 ? (a++, b = 0, `${ROMAN[a - 1] || a}. ${x.title}`) : `${++b}. ${x.title}`));
}
export function planDoc(plan) {
  const blocks = [], heads = numbered(plan.outline), d = plan.draft || {};
  (plan.outline || []).forEach((x, i) => {
    blocks.push({ type: 'h', text: heads[i] });
    for (const line of String(d[x.id] || '').split('\n')) if (line.trim()) blocks.push({ type: 'p', text: line.trim() });
    if (x.role === 'hours') { const r = hoursRows(plan.attach); if (r.length) blocks.push({ type: 'table', head: true, rows: [['교과', '시수'], ...r] }); }
    if (x.role === 'eval' && (plan.evalRows || []).length) blocks.push({ type: 'table', head: true, rows: [EVAL_HEAD, ...plan.evalRows.map(e => [e.subject, e.unit, e.standard, e.method, e.when])] });
    if (x.role === 'monthly' && (plan.monthly || []).length) blocks.push({ type: 'table', head: true, rows: [['월', '주요 활동'], ...plan.monthly.map(m => [`${m.month}월`, m.text])] });
  });
  if ((plan.attach || []).length) {
    blocks.push({ type: 'h', text: '붙임' });
    plan.attach.forEach((a, i) => blocks.push({ type: 'p', text: `${i + 1}. ${KIND_NAME[a.kind] || '첨부'}(${a.name}) 1부.` }));
  }
  return { title: planTitle(plan), blocks };
}
/* 지난 계획을 글로: 다음 해 「작년 계획서」 칸에 넣음 (표는 칸을 ' | '로). 붙임 목록은 목차로 읽히지 않게 뺌 */
export function planText(plan) {
  const doc = planDoc({ ...plan, attach: [] });
  return [doc.title, ...doc.blocks.map(b => (b.type === 'table' ? b.rows.map(r => r.join(' | ')).join('\n') : b.text))].join('\n');
}
