/* 기타 › 공문 처리 (스펙 2026-11-04 5장): 공문 글 → AI 한 번 → 제목·발신·문서번호·날짜·제출 기한·요약·할 일·넘길 곳.
   기한 차례·D-n·달력 일정·오늘 수업 띠 규칙. 화면 없이 돌아감(시험) */
import { normDate } from './message-ai.js';

export const KINDS = [['message', '쪽지'], ['letter', '가정통신문'], ['purchase', '품의'], ['report', '결과 보고']];
const KIND_IDS = KINDS.map(k => k[0]);
const PHONE = /0\d{1,2}[-.\s)]?\d{3,4}[-.\s]?\d{4}/g, EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/g;
const clean = (v, n) => String(v == null ? '' : v).replace(PHONE, '').replace(EMAIL, '').replace(/\(\s*\)/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
export const MAX_TEXT = 8000;

export function gongmunPrompt({ name = '', text = '', today = '', year } = {}) {
  return ['[공문 처리]',
    `학교 선생님이 받은 공문입니다. 오늘: ${today}, 학년도: ${year || ''}(3월~다음 해 2월).`,
    '공문에서 아래를 뽑아 JSON 하나로만 답하세요. 공문에 없는 것은 지어내지 말고 빈칸.',
    '- title: 공문 제목, from: 보낸 곳(기관·부서), no: 문서번호(예: 과학과-1234), date: 공문 날짜',
    '- due: 학교가 내야 하는 제출·회신·보고 기한(YYYY-MM-DD, 없으면 ""), dueNote: 무엇을 내는지(예: 참가 신청서 공문 회신)',
    '- summary: 선생님이 할 일 중심 요약 1~2문장',
    '- tasks: 학교(담당 선생님)가 할 일 6개까지 [{"text":"…","due":"YYYY-MM-DD 또는 \\"\\""}] (예: 참가 학생 조사, 신청서 제출, 결과 보고)',
    '- kinds: 이어서 쓸 만한 것 — "message"(선생님들께 쪽지 안내), "letter"(보호자 가정통신문), "purchase"(물품 구입·예산 품의), "report"(결과 보고). 맞는 것만',
    '날짜는 연도가 없으면 오늘 이후 가장 가까운 그 날로 채우세요. 학생 이름·전화번호는 쓰지 마세요.',
    '{"title":"…","from":"…","no":"…","date":"2026-11-02","due":"2026-11-20","dueNote":"…","summary":"…","tasks":[{"text":"…","due":""}],"kinds":["message"]}',
    `[공문: ${String(name || '공문').slice(0, 80)}]`, String(text || '').slice(0, MAX_TEXT)].join('\n');
}

/* 기한 칸 값: 2000~2100년의 맞는 날만(키보드로 연도를 고치는 중간 값 「0002-…」은 버림) */
export const validDue = v => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v || '')); return !!m && +m[1] >= 2000 && +m[1] <= 2100 && normDate(v) === v; };
const isoOf = (y, m, d) => { const t = new Date(Date.UTC(y, m - 1, d)); return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : ''; };
const addDaysIso = (iso, n) => { const t = new Date(`${iso}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
/* 날짜: 연도가 없으면 학년도(1~2월은 다음 해), 그 날이 오늘보다 60일 넘게 앞이면 한 해 뒤(2월에 받은 새 학년도 공문) */
function schoolDate(v, year, today = '') {
  const s = String(v == null ? '' : v).trim();
  if (/^\d{4}/.test(s) || !year) return normDate(s, year);
  const m = /^(\d{1,2})\s*[-./월]\s*(\d{1,2})/.exec(s);
  if (!m) return '';
  const mo = +m[1], d = +m[2];
  let y = mo <= 2 ? +year + 1 : +year, iso = isoOf(y, mo, d);
  if (/^\d{4}-\d{2}-\d{2}$/.test(today) && (!iso || iso < addDaysIso(today, -60))) { y++; iso = isoOf(y, mo, d); }
  return iso;
}
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
export function normGongmun(v, { year, today = '' } = {}) {
  const o = isObj(v) ? v : {};
  return {
    title: clean(o.title, 150), from: clean(o.from, 80), no: clean(o.no, 60), date: schoolDate(o.date, year, today), due: schoolDate(o.due, year, today),
    dueNote: clean(o.dueNote, 120), summary: clean(o.summary, 400),
    tasks: (Array.isArray(o.tasks) ? o.tasks : []).map(t => (typeof t === 'string' ? { text: t } : isObj(t) ? t : {}))
      .map(t => ({ text: clean(t.text, 120), due: schoolDate(t.due, year, today), done: false })).filter(t => t.text).slice(0, 6),
    kinds: [...new Set((Array.isArray(o.kinds) ? o.kinds : []).filter(k => KIND_IDS.includes(k)))]
  };
}

/* D-n: 기한 - 오늘(날 수), 기한 없으면 null */
const day = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '')); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / 864e5 : null; };
export const dday = (due, today) => { const a = day(due), b = day(today); return a == null || b == null ? null : Math.round(a - b); };
export const ddayText = n => (n == null ? '' : n === 0 ? '오늘' : n > 0 ? `D-${n}` : `${-n}일 지남`);

/* 차례: 끝나지 않은 것 먼저, 기한 가까운 것(기한 없는 것은 뒤), 같으면 넣은 차례(늦은 것 먼저) */
export function sortDocs(list) {
  const key = d => [d.done ? 1 : 0, d.due ? 0 : 1, d.due || '', -(+d.at || 0)];
  return [...(list || [])].sort((a, b) => { const x = key(a), y = key(b); for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1; return 0; });
}
/* 달력(학사일정) 일정: 끝나지 않은 문서의 기한, 기한 있는 할 일(끝난 것 빼고) */
export function dueEvents(list) {
  const out = [];
  for (const d of list || []) {
    if (!d || d.done) continue;
    if (d.due) out.push({ date: d.due, title: `[제출] ${d.title || d.name || '공문'}` });
    for (const t of d.tasks || []) if (t && t.due && !t.done) out.push({ date: t.due, title: `[할 일] ${t.text}` });
  }
  return out;
}
/* 오늘 수업 띠: 오늘부터 days일 안(지난 것 포함)·끝나지 않은 문서, 가까운 차례 max개 */
export function dueSoon(list, today, { days = 7, max = 3 } = {}) {
  return sortDocs(list).filter(d => !d.done && d.due).map(d => ({ ...d, n: dday(d.due, today) })).filter(d => d.n != null && d.n <= days).slice(0, max);
}
