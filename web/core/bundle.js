/* 한꺼번에 넣기 (스펙 3장): 문서 안 학생용·교사용 나누기, 스캔 쪽 표시(정답·교사용 / 빈 활동지 / 학생), 확인 카드.
   활동지·단원평가·평가지 채점이 같이 씀. 이 파일의 규칙 함수는 화면 없이도 돌아감(시험) */

export const ROLE_NAME = { teacher: '정답·교사용', blank: '빈 활동지', student: '학생' };
const ROLES = Object.keys(ROLE_NAME);

/* ---------- 문서 안 나누기 ---------- */
// 줄 머리의 교사용·(예시)·예시 답안·모범 답안·[정답]·정답(및 해설)·채점 기준, 또는 이름 칸 끝의 「교사용」
const MARK = /^\s*(\|\s*)*(교사용|\(예시\)|예시\s*답안|모범\s*답안|\[정답\]|정답(\s*및\s*해설지?)?|채점\s*기준)\s*(\||$)/;
const NAME_TEACHER = /이름\s*:?.*교사용\s*\)?\s*$/;
const cut = (lines, at, how) => ({ student: lines.slice(0, at).join('\n').trim(), teacher: lines.slice(at).join('\n').trim(), how });

/* → { student, teacher, how: 'marker'|'repeat'|'none' }. 표시가 있으면 그 줄(바로 앞 8줄 안에 첫 머리 줄이 다시 나오면 그 머리 줄)에서,
   표시 없이 첫 머리 줄이 다시 나오면 거기서 나눔(학생용 쪽 다음 같은 양식의 교사용 쪽) */
export function splitDoc(text) {
  const src = String(text || '').trim();
  if (!src) return { student: '', teacher: '', how: 'none' };
  const lines = src.split('\n');
  const head = (lines.find(l => l.trim().length >= 4) || '').trim();
  const isHead = l => !!head && l.trim() === head;
  const m = lines.findIndex((l, i) => i > 0 && (MARK.test(l) || NAME_TEACHER.test(l)));
  if (m > 0) {
    let at = m;
    for (let j = m; j >= Math.max(1, m - 8); j--) if (isHead(lines[j])) { at = j; break; }
    return cut(lines, at, 'marker');
  }
  const r = lines.findIndex((l, i) => i > 0 && isHead(l));
  if (r > 0) return cut(lines, r, 'repeat');
  return { student: src, teacher: '', how: 'none' };
}

/* ---------- 스캔 쪽 표시 ---------- */
/* 정답·교사용 쪽은 보통 맨 앞이나 맨 뒤: 앞 2쪽·뒤 2쪽 */
export function edgeIdx(n) {
  const out = [];
  for (const i of [0, 1, n - 2, n - 1]) if (i >= 0 && i < n && !out.includes(i)) out.push(i);
  return out.sort((a, b) => a - b);
}

export function pageRolesPrompt(k) {
  return ['[쪽 나누기]',
    `첨부한 그림 ${k}장은 한 반의 활동지·평가지를 스캔한 묶음에서 고른 쪽입니다(차례대로 0번부터). 이름 칸은 가려져 있을 수 있습니다.`,
    '쪽마다 아래 셋 중 하나를 고릅니다.',
    '- teacher: 정답·예시 답안·교사용으로 인쇄된 쪽(손글씨 없이 답이 인쇄되어 있음)',
    '- blank: 아무것도 쓰지 않은 빈 활동지·평가지',
    '- student: 학생이 손으로 쓴 답·그림이 있는 쪽',
    '', '[출력] JSON 하나만 출력합니다.', '{"pages":[{"i":0,"role":"teacher|blank|student"}]}'].join('\n');
}
/* AI 답 → 길이 k의 표시 배열(범위 밖·모르는 표시는 버림, 없으면 학생) */
export function normPageRoles(v, k) {
  const out = Array.from({ length: k }, () => 'student');
  const list = Array.isArray(v) ? v : v && Array.isArray(v.pages) ? v.pages : [];
  for (const x of list) {
    const i = Number(x && x.i);
    if (Number.isInteger(i) && i >= 0 && i < k && ROLES.includes(x.role)) out[i] = x.role;
  }
  return out;
}
/* 쪽마다 표시: 글자층(인쇄본 PDF 쪽)이 30자 이상이면 정답·교사용, 아니면 AI 답({쪽 번호: 표시}), 아니면 학생 */
export function pickRoles(pages, ai) {
  return (pages || []).map((p, i) => {
    if (p && String(p.text || '').replace(/\s/g, '').length >= 30) return 'teacher';
    const r = ai && ai[i];
    return ROLES.includes(r) ? r : 'student';
  });
}
/* 나눌 것이 있을 때만 확인 카드(학생 스캔만이면 바로 넣음) */
export const needsCard = ({ doc, roles } = {}) => !!(doc && String(doc.teacher || '').trim()) || (roles || []).some(r => r !== 'student');
