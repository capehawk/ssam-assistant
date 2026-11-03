/* 기타 › 쪽지 작성 (스펙 2026-11-02 4장): 공문·계획 → 안내 쪽지. AI는 일시·장소·대상 같은 칸만 뽑고, 쪽지 글은 앱이 맞춤.
   화면 없이 돌아감(시험) */
import { attachText } from '../purchase/rules.js';

export const KINDS = { training: '연수 안내', meeting: '회의 안내', event: '행사 안내', submit: '제출 안내', etc: '안내' };
const PHONE = /0\d{1,2}[-.\s)]?\d{3,4}[-.\s]?\d{4}/g;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/g;
const clean = (v, n) => String(v == null ? '' : v).replace(PHONE, '').replace(EMAIL, '').replace(/\(\s*문의\s*\)|\(\s*\)/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const WD = '일월화수목금토';

/* 'YYYY-MM-DD'·'YYYY.MM.DD'·'MM-DD'(연도는 year) → 'YYYY-MM-DD', 없는 날이면 '' */
function normDate(v, year) {
  const s = String(v == null ? '' : v).trim();
  let m = /^(\d{4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})/.exec(s), y, mo, d;
  if (m) [, y, mo, d] = m.map(Number);
  else if ((m = /^(\d{1,2})\s*[-./월]\s*(\d{1,2})/.exec(s))) { y = Number(year) || new Date().getFullYear(); [, mo, d] = m.map(Number); }
  else return '';
  const t = new Date(Date.UTC(y, mo - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return '';
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
/* '2026-11-12' → '2026. 11. 12.(목)' (학교 공문 꼴), 틀린 날은 ''. noYear: 연도 빼고 '11. 13.(금)' */
export function fmtDay(iso, { noYear = false } = {}) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m || normDate(iso) !== iso) return '';
  const t = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return `${noYear ? '' : `${+m[1]}. `}${+m[2]}. ${+m[3]}.(${WD[t.getUTCDay()]})`;
}
/* 「2026-11-12~2026-11-13」·「11-12 ~ 11-13」 → ['시작', '끝'] (물결만 기간으로 봄, 날짜 안의 - 는 그대로) */
const splitRange = v => String(v == null ? '' : v).split(/\s*[~∼〜]\s*/);
/* 「2026. 11. 12.(목) 15:00~16:30」에서 앞의 날짜를 뺀 나머지(요일 괄호도 뺌) */
const DAY = '(?:\\d{4}\\s*[-./년]\\s*)?\\d{1,2}\\s*[-./월]\\s*\\d{1,2}\\s*[.일]?\\s*(?:\\([월화수목금토일]\\))?';
const afterDate = s => String(s).replace(new RegExp('^' + DAY), '').trim();
/* 글로 온 일시: 「11.12~11.13 09:00」 → 시작·끝·시간(끝 날짜가 시간에 섞이지 않게), 날짜 하나면 날짜·시간, 날짜가 없으면 글 그대로 */
function fromText(x, year) {
  const m = new RegExp('^(' + DAY + ')\\s*[~∼〜]\\s*(' + DAY + ')\\s*(.*)$').exec(String(x).trim());
  if (m && normDate(m[1], year)) return { date: m[1], end: m[2], time: m[3].trim() };
  return normDate(x, year) ? { date: x, time: afterDate(x) } : { note: x };
}

export function messagePrompt(text, { nImages = 0 } = {}) {
  return ['[쪽지 안내]',
    `아래 글(공문·계획서)을 읽고 선생님들께 보낼 안내 쪽지에 쓸 내용을 뽑습니다.${nImages ? ` 첨부한 그림 ${nImages}장도 같은 공문·계획서의 쪽입니다.` : ''}`,
    '- kind: training(연수)·meeting(회의·협의회)·event(행사·대회)·submit(제출·신청 안내)·etc(그 밖) 중 하나',
    '- title: 짧은 제목(예: 2026 AI 활용 수업 연수). 「안내」·「알림」 같은 말과 기관 이름은 빼도 됩니다.',
    '- when: 일시마다 {"date":"YYYY-MM-DD","time":"15:00~16:30","note":""}. 여러 번이면 여러 개, 연도가 없으면 날짜만(MM-DD). 며칠에 걸친 기간이면 {"date":"시작","end":"끝"}.',
    '- place: 장소, target: 대상, apply: {"due":"YYYY-MM-DD"(신청·회신·제출 기한), "how":"방법(예: 이음 쪽지로 회신)"}',
    '- bring: 준비물, notes: 유의 사항 한두 개(짧게), points: 주요 내용 최대 5줄(짧게)',
    '- 글에 없는 것은 빈 글로 둡니다. 지어내지 않습니다. 사람 이름·전화번호·이메일은 쓰지 않습니다.',
    '', '[글]', String(text || '').slice(0, 12000),
    '', '[출력] JSON 하나만 출력합니다.',
    '{"kind":"training","title":"…","when":[{"date":"2026-11-12","time":"15:00~16:30","note":""}],"place":"","target":"","apply":{"due":"","how":""},"bring":"","notes":"","points":["…"]}'].join('\n');
}

/* AI 답 → 쪽지 칸. year: 연도 없는 날에 붙일 학년도 */
export function normMessage(v, { year } = {}) {
  const o = v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  const ap = o.apply && typeof o.apply === 'object' ? o.apply : {};
  // 일시가 글 하나·글 목록으로 와도 받음: 날짜는 읽고 나머지는 시간
  const raw = Array.isArray(o.when) ? o.when : typeof o.when === 'string' ? [o.when] : [];
  const when = raw.map(x => (typeof x === 'string' ? fromText(x, year) : x))
    .filter(x => x && typeof x === 'object').slice(0, 5).map(x => {
      const [d0, d1] = splitRange(x.date);
      const date = normDate(d0, year), endRaw = String(x.end || d1 || '');
      let end = date ? normDate(endRaw, Number(date.slice(0, 4))) : '';
      // 「12-30~01-02」처럼 연도 없이 해를 넘기는 기간은 끝을 다음 해로
      if (end && end <= date && !/^\s*\d{4}/.test(endRaw)) end = normDate(endRaw, Number(date.slice(0, 4)) + 1);
      return { date, end: end > date ? end : '', time: clean(x.time, 40), note: clean(x.note, 60) || (date ? '' : clean(x.date, 40)) };
    }).filter(x => x.date || x.time || x.note);
  const due = normDate(ap.due, year);
  return {
    kind: Object.prototype.hasOwnProperty.call(KINDS, o.kind) ? o.kind : 'etc',
    title: clean(o.title, 80), when, place: clean(o.place, 100), target: clean(o.target, 100),
    apply: { due, dueNote: due ? '' : clean(ap.due, 40), how: clean(ap.how, 100) },
    bring: clean(o.bring, 200), notes: clean(o.notes, 200),
    points: (Array.isArray(o.points) ? o.points : []).map(p => clean(p, 120)).filter(Boolean).slice(0, 5)
  };
}

/* 받침 있으면 「을」, 없으면 「를」 */
const eul = w => { const c = String(w || '').trim().slice(-1).charCodeAt(0) - 0xac00; return c >= 0 && c < 11172 ? (c % 28 ? '을' : '를') : '을(를)'; };
const dayText = w => (w.end ? `${fmtDay(w.date)}~${fmtDay(w.end, { noYear: w.end.slice(0, 4) === w.date.slice(0, 4) })}` : fmtDay(w.date));
const whenText = w => [dayText(w), w.time].filter(Boolean).join(' ') + (w.note ? (w.date || w.time ? ` (${w.note})` : w.note) : '');

/* 쪽지 칸 → { title, body }. len: short(일시·장소·대상·신청) · base(+ 준비물·유의 사항) · long(+ 주요 내용)
   이음 쪽지는 제목 칸이 없어 본문 첫 줄이 제목, 그다음 인사 「안녕하세요 선생님.」 (스펙 2026-11-03 2장) */
export const GREETING = '안녕하세요 선생님.';
export function composeMessage(m, { len = 'base', attach = [], sender = '', again = false } = {}) {
  const x = m || {}, title = String(x.title || '').trim();
  const head = again ? '[다시 안내]' : `[${KINDS[x.kind] || KINDS.etc}]`;
  const full = title ? `${head} ${title}` : head;
  const lines = [full, '', GREETING, `${title ? `${title}${eul(title)} ` : ''}${again ? '다시 한번 안내드립니다.' : '아래와 같이 안내드립니다.'}`, ''];
  const row = (label, v) => { if (String(v || '').trim()) lines.push(`□ ${label}: ${String(v).trim()}`); };
  const ws = (x.when || []).map(whenText).filter(Boolean);
  if (ws.length) lines.push(`□ 일시: ${ws[0]}`, ...ws.slice(1).map(w => `        ${w}`));
  row('장소', x.place);
  row('대상', x.target);
  const ap = x.apply || {};
  row('신청', [ap.due ? `${fmtDay(ap.due)}까지` : ap.dueNote || '', ap.how].filter(Boolean).join(' '));
  if (len !== 'short') row('준비물·유의 사항', [x.bring, x.notes].filter(s => String(s || '').trim()).join(' / '));
  if (len === 'long' && (x.points || []).length) lines.push('□ 주요 내용', ...x.points.map(p => `  - ${p}`));
  const names = (attach || []).map(a => String(a || '').trim()).filter(Boolean);
  if (names.length) lines.push('', attachText(names.map(n => (/\d+\s*부$/.test(n) ? n : `${n} 1부`))));
  lines.push('');
  if (String(sender || '').trim()) lines.push(`문의: ${String(sender).trim()}`);
  lines.push('감사합니다.');
  return { title: full, body: lines.join('\n').replace(/\n{3,}/g, '\n\n') };
}

/* 다시 읽을 때 선생님이 고친 칸은 그대로: keys는 쪽지 칸 이름(title·date·time·place·target·due·how·bring·notes) */
export const FIELD_KEYS = ['title', 'date', 'time', 'place', 'target', 'due', 'how', 'bring', 'notes'];
export function keepFields(next, prev, keys = []) {
  const n = JSON.parse(JSON.stringify(next || {})), p = prev || {};
  for (const k of keys) {
    if (k === 'date' || k === 'time') {
      const w0 = (p.when || [])[0] || {};
      n.when = Array.isArray(n.when) && n.when.length ? n.when : [{ date: '', end: '', time: '', note: '' }];
      n.when[0] = { ...n.when[0], [k]: w0[k] || '', ...(k === 'date' ? { end: w0.end || '' } : {}) };
    } else if (k === 'due' || k === 'how') {
      const pa = p.apply || {};
      n.apply = { ...(n.apply || {}), [k]: pa[k] || '', ...(k === 'due' ? { dueNote: pa.dueNote || '' } : {}) };
    } else if (FIELD_KEYS.includes(k)) n[k] = p[k] || '';
  }
  return n;
}
