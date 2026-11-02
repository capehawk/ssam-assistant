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
/* '2026-11-12' → '2026. 11. 12.(목)' (학교 공문 꼴), 틀린 날은 '' */
export function fmtDay(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m || normDate(iso) !== iso) return '';
  const t = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return `${+m[1]}. ${+m[2]}. ${+m[3]}.(${WD[t.getUTCDay()]})`;
}

export function messagePrompt(text, { nImages = 0 } = {}) {
  return ['[쪽지 안내]',
    `아래 글(공문·계획서)을 읽고 선생님들께 보낼 안내 쪽지에 쓸 내용을 뽑습니다.${nImages ? ` 첨부한 그림 ${nImages}장도 같은 공문·계획서의 쪽입니다.` : ''}`,
    '- kind: training(연수)·meeting(회의·협의회)·event(행사·대회)·submit(제출·신청 안내)·etc(그 밖) 중 하나',
    '- title: 짧은 제목(예: 2026 AI 활용 수업 연수). 「안내」·「알림」 같은 말과 기관 이름은 빼도 됩니다.',
    '- when: 일시마다 {"date":"YYYY-MM-DD","time":"15:00~16:30","note":""}. 여러 번이면 여러 개, 연도가 없으면 날짜만(MM-DD).',
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
  const when = (Array.isArray(o.when) ? o.when : []).filter(x => x && typeof x === 'object').slice(0, 5).map(x => {
    const date = normDate(x.date, year);
    return { date, time: clean(x.time, 40), note: clean(x.note, 60) || (date ? '' : clean(x.date, 40)) };
  }).filter(x => x.date || x.time || x.note);
  return {
    kind: Object.prototype.hasOwnProperty.call(KINDS, o.kind) ? o.kind : 'etc',
    title: clean(o.title, 80), when, place: clean(o.place, 100), target: clean(o.target, 100),
    apply: { due: normDate(ap.due, year), how: clean(ap.how, 100) },
    bring: clean(o.bring, 200), notes: clean(o.notes, 200),
    points: (Array.isArray(o.points) ? o.points : []).map(p => clean(p, 120)).filter(Boolean).slice(0, 5)
  };
}

/* 받침 있으면 「을」, 없으면 「를」 */
const eul = w => { const c = String(w || '').trim().slice(-1).charCodeAt(0) - 0xac00; return c >= 0 && c < 11172 ? (c % 28 ? '을' : '를') : '을(를)'; };
const whenText = w => [fmtDay(w.date), w.time].filter(Boolean).join(' ') + (w.note ? (w.date || w.time ? ` (${w.note})` : w.note) : '');

/* 쪽지 칸 → { title, body }. len: short(일시·장소·대상·신청) · base(+ 준비물·유의 사항) · long(+ 주요 내용) */
export function composeMessage(m, { len = 'base', attach = [], sender = '', again = false } = {}) {
  const x = m || {}, title = String(x.title || '').trim();
  const head = again ? '[다시 안내]' : `[${KINDS[x.kind] || KINDS.etc}]`;
  const lines = ['선생님들, 안녕하세요.', `${title ? `${title}${eul(title)} ` : ''}${again ? '다시 한번 안내드립니다.' : '아래와 같이 안내드립니다.'}`, ''];
  const row = (label, v) => { if (String(v || '').trim()) lines.push(`□ ${label}: ${String(v).trim()}`); };
  const ws = (x.when || []).map(whenText).filter(Boolean);
  if (ws.length) lines.push(`□ 일시: ${ws[0]}`, ...ws.slice(1).map(w => `        ${w}`));
  row('장소', x.place);
  row('대상', x.target);
  const ap = x.apply || {};
  row('신청', [ap.due ? `${fmtDay(ap.due)}까지` : '', ap.how].filter(Boolean).join(' '));
  if (len !== 'short') row('준비물·유의 사항', [x.bring, x.notes].filter(s => String(s || '').trim()).join(' / '));
  if (len === 'long' && (x.points || []).length) lines.push('□ 주요 내용', ...x.points.map(p => `  - ${p}`));
  const names = (attach || []).map(a => String(a || '').trim()).filter(Boolean);
  if (names.length) lines.push('', attachText(names.map(n => (/\d+\s*부$/.test(n) ? n : `${n} 1부`))));
  lines.push('');
  if (String(sender || '').trim()) lines.push(`문의: ${String(sender).trim()}`);
  lines.push('감사합니다.');
  return { title: title ? `${head} ${title}` : head, body: lines.join('\n').replace(/\n{3,}/g, '\n\n') };
}
