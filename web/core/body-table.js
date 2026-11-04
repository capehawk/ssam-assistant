/* 본문 표(스펙 2026-11-04 3장): 「| 시간 | 내용 |」처럼 「|」로 시작하고 끝나는 줄이 이어지면 표 하나.
   첫 줄은 머리, 「|---|---|」 구분 줄은 버림, 칸 수는 가장 긴 줄에 맞춤(모자란 칸은 빈칸). 화면 없이 돌아감 */
export const isTableLine = t => /^\s*\|.*\|\s*$/.test(String(t == null ? '' : t)) && String(t).trim().length >= 2;
const isSep = t => /^\s*\|(\s*:?-{2,}:?\s*\|)+\s*$/.test(t);
export const splitCells = t => String(t).trim().slice(1, -1).split('|').map(c => c.trim());

/* 줄 목록 → [{ type: 'line', text } | { type: 'table', rows: [[칸]] }] */
export function parseTableLines(lines) {
  const out = [];
  let rows = null;
  const end = () => {
    if (rows && rows.length) { const n = Math.max(...rows.map(r => r.length)); out.push({ type: 'table', rows: rows.map(r => [...r, ...Array(n - r.length).fill('')]) }); }
    rows = null;
  };
  for (const raw of Array.isArray(lines) ? lines : []) {
    const t = String(raw == null ? '' : raw);
    if (isTableLine(t)) { if (!rows) rows = []; if (!isSep(t)) rows.push(splitCells(t)); continue; }
    end();
    out.push({ type: 'line', text: t });
  }
  end();
  return out;
}

/* 쌤비서 문서 { title, blocks } → 학교 양식 글 { title, body: [줄], photos }(스펙 2026-11-04 4.2).
   소제목·가운데 줄은 그 줄, 문단은 줄마다, 표는 「|」 줄(칸 안 줄바꿈은 「 / 」), 사진은 photos(본문 끝 사진 표) */
const cellText = c => String(c == null ? '' : c).replace(/\|/g, '/').replace(/\s*\n\s*/g, ' / ').trim();
export function docToLetter(doc) {
  const d = doc || {}, body = [], photos = [];
  for (const b of d.blocks || []) {
    if (!b) continue;
    if (b.type === 'h' || b.type === 'c') body.push(String(b.text || ''));
    else if (b.type === 'p') body.push(...String(b.text || '').split('\n'));
    else if (b.type === 'table') { for (const r of b.rows || []) if (Array.isArray(r) && r.length) body.push(`| ${r.map(cellText).join(' | ')} |`); }
    else if (b.type === 'photos') photos.push(...(b.items || []).filter(it => it && it.bytes && it.bytes.length));
  }
  return { title: String(d.title || ''), body, photos };
}
