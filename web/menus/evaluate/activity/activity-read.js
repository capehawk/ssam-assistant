/* 활동지 머리 읽기(스펙 4.1): 교과·단원·차시·쪽·활동 이름, 그리고 학기. 못 찾으면 빈칸(선생님이 고침) */
import { stripNames } from '../../../core/privacy.js';

/* 넣은 활동지 글 다듬기: 주민번호 모양 줄은 빼고, 이름·전화번호가 적힌 줄(privacy.js)은 빼거나 가리고, 「이름: 김하늘」은 이름만 지움
   (「이름: 교사용」·빈 이름 칸은 그대로) → { text, cut(뺀 줄·가린 이름 수) } */
const RRN = /\d{6}\s*-\s*[1-4]\d{6}/;
const FILLED = /((?:이\s*름|성\s*명)\s*[:：]\s*)(?!교사용|학생용)[가-힣]{2,4}(?![가-힣])/g;
export function cleanSheet(text) {
  const src = String(text || '').split('\n');
  let named = 0;
  const kept = src.filter(l => !RRN.test(l)).map(l => l.replace(FILLED, (m, pre) => { named++; return pre.replace(/\s+$/, ''); }));
  const r = stripNames(kept.join('\n'));
  return { text: r.text.trim(), cut: r.dropped + r.masked + named + (src.length - kept.length) };
}

export const SUBJECTS = ['국어', '수학', '사회', '과학', '도덕', '영어', '음악', '미술', '체육', '실과', '바른 생활', '슬기로운 생활', '즐거운 생활'];
const SUBJ = new RegExp(`^(${SUBJECTS.join('|')})(?=\\s|\\d|$)`);
const EMPTY = () => ({ subject: '', unit: '', lesson: '', pages: '', title: '' });
const cellsOf = l => l.split('|').map(c => c.trim()).filter(Boolean);

export function readMeta(text) {
  const out = EMPTY();
  const lines = String(text || '').split('\n').map(l => l.trim()).filter(Boolean).slice(0, 8);
  if (!lines.length) return out;
  const all = lines.join('\n');
  // 「[과학] 3-2-4-03 제목 (50~51쪽)」: 학년-학기-단원-차시
  const sci = /\[([^\]]+)\]\s*\d+-\d+-(\d+)-(\d+)\s*(.+?)\s*\((\d+\s*[~\-]\s*\d+)\s*쪽\)/.exec(all);
  if (sci) {
    if (SUBJECTS.includes(sci[1].trim())) out.subject = sci[1].trim();
    out.unit = String(Number(sci[2])); out.lesson = String(Number(sci[3])); out.title = sci[4].trim(); out.pages = sci[5].replace(/\s/g, '') + '쪽';
  }
  if (!out.subject) for (const l of lines) {
    const hit = cellsOf(l).map(c => SUBJ.exec(c)).find(Boolean) || SUBJ.exec(l);
    if (hit) { out.subject = hit[1]; break; }
  }
  const ls = /\[(\d+(?:\s*~\s*\d+)?)\s*차시\]\s*([^(|\n]*)/.exec(all);
  if (ls && !out.lesson) { out.lesson = ls[1].replace(/\s/g, ''); if (!out.title) out.title = ls[2].trim(); }
  if (!out.unit) {
    const gt = /^(.+?)\s*>\s*\[/m.exec(all);
    const cell = lines.flatMap(cellsOf).find(c => /^\d+\.\s*\S/.test(c) && !/[.?]$/.test(c));
    const line = lines.slice(0, 3).find(l => /^\d+\.\s*[가-힣]/.test(l) && !/[.?]$/.test(l) && !l.includes('|'));
    out.unit = (gt && gt[1].trim()) || cell || line || '';
  }
  if (!out.pages) { const pg = /(\d+\s*[~\-]\s*\d+)\s*쪽/.exec(all); if (pg) out.pages = pg[1].replace(/\s/g, '') + '쪽'; }
  return out;
}

/* 학기: 학교 정보의 여름방학 끝 다음 날부터 2학기. 없으면 3~8월 1학기, 9~2월 2학기 */
export function termOf(date, breaks = []) {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(String(date || '')) ? String(date) : new Date().toISOString().slice(0, 10);
  const y = d.slice(0, 4), m = Number(d.slice(5, 7));
  if (m <= 2 || m >= 9) return 2;
  const bs = (breaks || []).filter(b => b && b.from && b.to && String(b.to).slice(0, 4) === y);
  const summer = bs.find(b => /여름/.test(String(b.label || ''))) || bs.find(b => /^\d{4}-0[78]/.test(String(b.from)));
  if (summer && d > String(summer.to)) return 2;
  return 1;
}
