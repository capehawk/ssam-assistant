/* 개인정보 규칙: 사람 이름 모양, 명단·담임 표·전화번호 줄 빼기 (학생 이름은 저장하지도 AI로 보내지도 않음) */
export const SURNAME = new Set('김이박최정강조윤장임한오서신권황안송전홍유류고문양손배백허남심노하곽성차주우구민진나지엄채원천방공현함변염여추도소석선설마길연위표명기반왕금옥육인맹제모탁국어은편용예봉경'.split(''));
const DOUBLE = /^(남궁|황보|제갈|선우|독고)[가-힣]{2}$/;
// 흔한 성씨 글자로 시작하는 세 글자 낱말 (이름으로 세지 않음)
const COMMON = new Set(['이야기', '우리반', '우리말', '우리들', '도서관', '한국어', '국어과', '기본적', '문제점', '안전한', '공동체', '주제별', '방과후', '진로반', '고학년', '저학년', '중학년', '정리함', '조사표', '기초적', '문화재', '노래방', '한마음', '나눔터']);
const PHONE = /\(?0\d{1,2}\)?[-.\s)]{0,2}\d{3,4}[-.\s]?\d{4}/;

/* 이름처럼 보이는 낱말: 2~4글자 한글, 흔한 성으로 시작 (설문 답 판단용) */
export const looksLikeName = s => /^[가-힣]{2,4}$/.test(s) && SURNAME.has(s[0]);
/* 줄 안의 이름 세기: 세 글자 이름(흔한 낱말·조사로 끝나는 낱말 빼고)과 두 글자 성 + 두 글자 */
const ENDING = /[을를의에과와한할해요고며로도만적형께]$/;
const nameish = t => (/^[가-힣]{3}$/.test(t) && SURNAME.has(t[0]) && !COMMON.has(t) && !ENDING.test(t)) || DOUBLE.test(t);

/* 표 칸·직책 옆의 이름: 칸 전체가 세 글자 이름 모양 (조사·어미로 끝나면 낱말. 이름 끝에 흔한 「한·형·도」는 이름으로 봄) */
const PART = /[을를의에과와할해요고며로만적께]$/;
const cellName = c => (/^[가-힣]{3}$/.test(c) && SURNAME.has(c[0]) && !COMMON.has(c) && !PART.test(c)) || DOUBLE.test(c);
/* 칸·낱말 하나가 사람 이름 모양인지(세 글자 흔한 성 + 흔한 낱말 아님, 두 글자 성 + 두 글자) */
export const nameCell = c => cellName(String(c || ''));
const ROLE = '부?담임|부?회장|부?반장|서기|총무|학생|교사|전담|대표|교감|교장';
const ROLE_NAME = new RegExp(`((?:${ROLE})(?:\\s*[:：|]\\s*|\\s+))([가-힣]{3,4})(?![가-힣])`, 'g');
const CUE = new RegExp(`^(\\d{1,2}|남|여|남자|여자|${ROLE})$`), HEAD = /^(이름|성명|성 명|학생명|학생 이름)$/;
const NUMBERED = /^(\s*\d{1,2}[.)]?\s+)([가-힣]{3})(?=\s|$)/;
const numName = l => { const m = NUMBERED.exec(l); return !!m && cellName(m[2]); };
export const MASK = '○○○';

/* 명단·담임 표처럼 이름이 늘어선 줄과 전화번호 줄은 빼고, 한 줄에 하나씩 적힌 이름(임원·학생 명단 표, 직책 옆 이름, 번호 명단)은 ○○○로 가림
   → { text, dropped(뺀 줄), masked(가린 이름) } */
export function stripNames(text) {
  const src = String(text || '');
  if (!src) return { text: '', dropped: 0, masked: 0 };
  let dropped = 0, masked = 0;
  const ls = src.split('\n').filter(line => {
    const words = line.split(/[\s|,·/()]+/).filter(t => /^[가-힣]+$/.test(t)), names = words.filter(nameish).length;
    const cells = line.includes('|') ? line.split('|').map(c => c.trim()).filter(Boolean) : [], cn = cells.filter(cellName).length;
    if ((names >= 3 && names / words.length >= 0.6) || (cn >= 3 && cn / cells.length >= 0.5) || PHONE.test(line)) { dropped++; return false; }
    return true;
  });
  // 직책 옆 이름 (「회장 김가람」, 「담임: 김준형」, 「회장 | 이나래」)
  for (let i = 0; i < ls.length; i++) ls[i] = ls[i].replace(ROLE_NAME, (m, pre, n) => (cellName(n) ? (masked++, pre + MASK) : m));
  // 표: 「이름」 머리 칸 아래, 또는 번호·남녀·직책 옆에 이름이 세 줄 이상 있는 칸
  for (let a = 0; a < ls.length;) {
    if (!ls[a].includes('|')) { a++; continue; }
    let b = a;
    while (b < ls.length && ls[b].includes('|')) b++;
    const rows = ls.slice(a, b).map(l => l.split('|')), width = Math.max(...rows.map(r => r.length));
    for (let j = 0; j < width; j++) {
      const cell = r => (r[j] || '').trim(), hits = rows.filter(r => cellName(cell(r)));
      const head = rows.some(r => HEAD.test(cell(r)));
      const cued = hits.filter(r => CUE.test((r[j - 1] || '').trim()) || CUE.test((r[j + 1] || '').trim())).length;
      if (!(head && hits.length) && !(hits.length >= 3 && cued >= 3)) continue;
      for (const r of hits) { r[j] = r[j].replace(cell(r), MASK); masked++; }
    }
    rows.forEach((r, k) => { ls[a + k] = r.join('|'); });
    a = b;
  }
  // 번호 명단 (PDF처럼 칸 구분 없이 「1 김가람 남」이 세 줄 이상 이어짐)
  for (let a = 0; a < ls.length;) {
    let b = a;
    while (b < ls.length && numName(ls[b])) b++;
    if (b - a >= 3) for (let k = a; k < b; k++) { ls[k] = ls[k].replace(NUMBERED, (m, pre) => pre + MASK); masked++; }
    a = Math.max(b, a + 1);
  }
  return { text: ls.join('\n'), dropped, masked };
}
