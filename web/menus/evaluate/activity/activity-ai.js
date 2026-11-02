/* 활동지 AI(스펙 4.2·4.4): 기준 만들기, 채점, 검토 프롬프트와 답 다듬기, 고르기·짝짓기·빈칸의 앱 판정.
   AI에는 이름 가린 그림과 활동지 글만 보냄(학생 이름 없음). 업무별 AI 「채점」 */
import { autoJudge } from '../unit/unit-grade.js';
import { parseKey } from '../unit/unit-key.js';

export const TYPES = [['choice', '고르기'], ['match', '짝짓기'], ['short', '빈칸·단답'], ['write', '쓰기'], ['draw', '그림·색칠']];
export const MARK = { o: '○', t: '△', x: '×', n: '안 함' };
export const LEVEL = { good: '잘함', ok: '보통', try: '노력' };
const TYPE_NAME = Object.fromEntries(TYPES);
const TYPE_IDS = TYPES.map(t => t[0]);
const MARKS = Object.keys(MARK), LEVELS = Object.keys(LEVEL);
const str = (v, n = 300) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);
const listOf = (v, k) => (Array.isArray(v) ? v : v && Array.isArray(v[k]) ? v[k] : []);
const metaLine = m => [m.subject, m.unit && `${m.unit}단원`.replace(/단원단원$/, '단원'), m.lesson && `${m.lesson}차시`, m.title && `「${m.title}」`, m.pages].filter(Boolean).join(' · ');
const itemLine = it => `[${it.no}] ${TYPE_NAME[it.type] || '쓰기'} | 묻는 말: ${it.ask} | ${['choice', 'match', 'short'].includes(it.type) ? '정답' : '예시 답안'}: ${it.answer || '-'} | ○ 기준: ${it.ok || '-'} | △ 기준: ${it.part || '-'}`;

/* ---------- 기준 만들기 ---------- */
export function criteriaPrompt({ meta = {}, student = '', teacher = '', nImages = 0 } = {}) {
  return ['[활동지 기준]',
    '당신은 초등학교 수업 활동지를 채점할 기준을 미리 정하는 경력 많은 담임교사입니다.',
    `[활동지] ${metaLine(meta) || '(정보 없음)'}`,
    nImages ? `첨부한 그림 ${nImages}장은 이 활동지(빈 활동지·교사용)를 찍은 것입니다.` : '',
    '', '[학생용 활동지 글]', String(student || '(글 없음 — 그림을 보고 판단)').slice(0, 6000),
    ...(String(teacher || '').trim() ? ['', '[교사용·예시·정답]', String(teacher).slice(0, 6000)] : []),
    '', '[할 일] 학생이 답하거나 그리는 칸을 문항으로 나눠 차례대로 번호를 붙이고, 문항마다 아래를 씁니다.',
    `- type: ${TYPES.map(([k, n]) => `${k}(${n})`).join(', ')}`,
    '- ask: 묻는 말(짧게), answer: 고르기·짝짓기·빈칸은 정답, 쓰기·그림은 예시 답안(그림은 무엇이 있으면 되는지)',
    '- ok: ○(잘함)로 볼 기준, part: △(조금 더)로 볼 기준. 쓰기는 꼭 들어갈 내용, 그림은 요구한 것·자세함·정성을 씁니다.',
    '- src: 교사용·예시·정답 글에서 가져왔으면 "teacher", 직접 만들었으면 "ai"',
    '- 정답이 정해지지 않는 열린 문항은 예시 답안과 기준만 씁니다. 활동지에 없는 문항은 만들지 않습니다.',
    '', '[출력] JSON 하나만 출력합니다.',
    '{"items":[{"no":1,"type":"write","ask":"…","answer":"…","ok":"…","part":"…","src":"teacher"}]}'].filter(x => x !== '').join('\n');
}
export function normCriteria(v) {
  const seen = new Set(), out = [];
  for (const x of listOf(v, 'items')) {
    if (!x || typeof x !== 'object' || !str(x.ask)) continue;
    const no = Number(x.no);
    if (Number.isInteger(no) && seen.has(no)) continue;
    if (Number.isInteger(no)) seen.add(no);
    out.push({ type: TYPE_IDS.includes(x.type) ? x.type : 'write', ask: str(x.ask, 200), answer: str(x.answer, 300), ok: str(x.ok, 300), part: str(x.part, 300), src: x.src === 'teacher' ? 'teacher' : 'ai' });
  }
  return out.map((it, i) => ({ no: i + 1, ...it }));
}
/* 정답 글의 번호 붙은 답: 「[정답]」(없으면 처음)부터 「1. ③」, 「1.」 다음 줄 값. 풀이는 뺌 */
export function numberedAnswers(text) {
  const lines = String(text || '').split('\n').map(l => l.trim());
  const start = lines.findIndex(l => /^\[?\s*정답/.test(l));
  const out = {};
  for (let i = start + 1; i < lines.length; i++) {
    const m = /^(\d{1,2})\s*[.)]\s*(.*)$/.exec(lines[i]);
    if (!m) continue;
    let v = m[2].trim();
    if (!v && i + 1 < lines.length && lines[i + 1] && !/^\d{1,2}\s*[.)]/.test(lines[i + 1])) v = lines[i + 1];
    v = v.replace(/<\s*풀이\s*>.*$/, '').replace(/\s*풀이\s*:.*$/, '').trim();
    if (v && !(Number(m[1]) in out)) out[Number(m[1])] = v.slice(0, 120);
  }
  return out;
}
/* 고르기·짝짓기·빈칸은 정답 글의 답으로(출처 「정답에서」) */
export function applyKey(items, teacherText) {
  let ans = numberedAnswers(teacherText);
  if (!Object.keys(ans).length) { const k = parseKey(teacherText); if (k) ans = Object.fromEntries(k.items.map(it => [it.no, it.answer])); }
  return items.map(it => (['choice', 'match', 'short'].includes(it.type) && ans[it.no] ? { ...it, answer: String(ans[it.no]), src: 'answer' } : it));
}

/* ---------- 채점 ---------- */
export function gradePrompt(act, nImages) {
  return ['[활동지 채점]',
    '당신은 초등학교 수업 활동지를 채점하는 경력 많은 담임교사입니다.',
    `첨부한 그림 ${nImages}장은 한 학생의 활동지${nImages > 1 ? '(차례대로)' : ''}입니다. 이름 칸은 가려져 있을 수 있습니다. 학생 이름을 짐작하거나 쓰지 않습니다.`,
    `[활동지] ${metaLine(act.meta || {}) || '(정보 없음)'}`,
    '', '[문항과 기준]', ...act.items.map(itemLine),
    '', '[채점 규칙]',
    '- 문항마다 read(학생이 쓴 답·그린 것을 짧게), mark, why(짧은 까닭), sure(확신하면 true)를 씁니다.',
    '- mark: o(○ 잘함) · t(△ 조금 더) · x(× 틀림) · n(안 함, 빈칸).',
    '- 고르기·짝짓기·빈칸은 정답과 같으면 o, 다르면 x, 비었으면 n.',
    '- 쓰기는 ○ 기준을 다 담으면 o, 일부면 t, 엉뚱하면 x, 비었으면 n.',
    '- 그림·색칠은 요구한 것이 있는지와 자세함·정성 같은 표현 정도까지 보고 o 또는 t, 요구와 전혀 다르면 x, 비었으면 n.',
    '- good: 잘한 점 한두 문장, next: 더 해 볼 점 한 문장(학생에게 줄 말투, 이름 없이).',
    '- level: good(잘함) · ok(보통) · try(노력) 중 하나, levelWhy: 그렇게 본 까닭 한 문장.',
    '', '[출력] JSON 하나만 출력합니다.',
    '{"items":[{"no":1,"read":"…","mark":"o|t|x|n","why":"…","sure":true}],"good":"…","next":"…","level":"good|ok|try","levelWhy":"…"}'].join('\n');
}
export const validGrade = v => Array.isArray(v) || !!(v && typeof v === 'object' && Array.isArray(v.items));
export function normGrade(v, items) {
  const got = {};
  for (const x of listOf(v, 'items')) {
    const no = Number(x && x.no);
    if (!Number.isInteger(no) || no in got || !items.some(it => it.no === no)) continue;
    const ok = MARKS.includes(x.mark);
    got[no] = { read: str(x.read, 120), mark: ok ? x.mark : '', why: str(x.why, 80), sure: ok && x.sure === true };
  }
  const marks = Object.fromEntries(items.map(it => [it.no, got[it.no] || { read: '', mark: '', why: '읽지 못했어요', sure: false }]));
  const o = v && !Array.isArray(v) && typeof v === 'object' ? v : {};
  return { marks, good: str(o.good, 200), next: str(o.next, 200), level: LEVELS.includes(o.level) ? o.level : '', levelWhy: str(o.levelWhy, 160) };
}
/* 고르기·짝짓기·빈칸에 정답이 있으면 앱이 맞춤(단원평가와 같은 규칙). chk = 노란 칸(확인할 칸) */
const OBJ = ['choice', 'match', 'short'];
export function judgeCell(item, cell) {
  const c = { read: String((cell && cell.read) || ''), mark: (cell && cell.mark) || '', why: (cell && cell.why) || '', sure: !!(cell && cell.sure) };
  if (OBJ.includes(item.type) && String(item.answer || '').trim()) {
    if (!c.read.trim()) return { ...c, mark: 'n', chk: !!c.mark && c.mark !== 'n' };
    const pts = autoJudge({ type: item.type, answer: item.answer, points: 1 }, c.read);
    if (pts != null) { const app = pts > 0 ? 'o' : 'x'; return { ...c, mark: app, chk: !!c.mark && c.mark !== app }; }
  }
  return { ...c, chk: !c.sure || !c.mark };
}

/* ---------- 검토 (노란 칸만) ---------- */
export function reviewPrompt(act, cells) {
  const nos = new Set(cells.map(c => c.no));
  return ['[활동지 검토]',
    '당신은 다른 교사가 채점한 활동지 중 확인이 필요한 칸만 다시 보는 교사입니다. 첨부한 그림은 그 학생의 활동지입니다(이름은 가려져 있을 수 있음).',
    '', '[문항과 기준]', ...act.items.filter(it => nos.has(it.no)).map(itemLine),
    '', '[먼저 채점한 결과]', ...cells.map(c => `[${c.no}] 읽은 답: ${c.read || '-'} | 표시: ${MARK[c.mark] || '없음'} | 까닭: ${c.why || '-'}`),
    '', '[규칙] 위 문항만 다시 봅니다. mark는 o·t·x·n 중 하나입니다.',
    '', '[출력] JSON 하나만 출력합니다.', '{"items":[{"no":1,"mark":"o","why":"까닭"}]}'].join('\n');
}
export function normReview(v, nos) {
  const set = new Set(nos), seen = new Set(), out = [];
  for (const x of listOf(v, 'items')) {
    const no = Number(x && x.no);
    if (!set.has(no) || seen.has(no) || !MARKS.includes(x.mark)) continue;
    seen.add(no); out.push({ no, mark: x.mark, why: str(x.why, 80) });
  }
  return out;
}
