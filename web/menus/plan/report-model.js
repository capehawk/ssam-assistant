/* 결과 보고 저장 (스펙 2026-11-03 5.1): 지금 쓰는 결과 보고·최근 20개(학년도 자료). 원본 파일·사진은 저장하지 않음(글·칸·사진 설명만) */
import { get, set } from '../../core/store.js';
import { isKind } from './report-ai.js';

const CUR = 'report:cur', LIST = 'report:list';
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
export const newReportId = () => 'rp' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const strs = (v, n, len) => (Array.isArray(v) ? v : []).slice(0, n).map(x => String(x == null ? '' : x).slice(0, len));
const normLetter = l => ({ title: String((isObj(l) && l.title) || '').slice(0, 200), body: String((isObj(l) && l.body) || '').slice(0, 8000) });

/* 지금 결과 보고: { id, sources: [{ kind, name, text }], memo, r(칸), letter, letterEdited, captions } */
function normCur(d) {
  if (!isObj(d) || typeof d.id !== 'string') return null;
  return { id: d.id,
    sources: (Array.isArray(d.sources) ? d.sources : []).filter(isObj).slice(0, 12).map(s => ({ kind: isKind(s.kind) ? s.kind : 'etc', name: String(s.name || '').slice(0, 100), text: String(s.text || '').slice(0, 20000) })),
    memo: String(d.memo || '').slice(0, 6000), r: isObj(d.r) ? d.r : null, letter: normLetter(d.letter), letterEdited: !!d.letterEdited,
    captions: strs(d.captions, 12, 120) };
}
export const getCurrent = () => normCur(get(CUR, null));
export const saveCurrent = d => { const n = normCur(d); return n ? set(CUR, n) : false; };
export const clearCurrent = () => set(CUR, null);

/* 최근 결과 보고: [{ id, at, title, r, letter, captions, memo, sources }] 늦은 것 먼저, 20개까지 */
const normItem = x => { const c = normCur(x); return c && c.r ? { ...c, at: Number(x.at) || 0, title: String(x.title || '').slice(0, 120) } : null; };
export const listReports = () => { const v = get(LIST, []); return (Array.isArray(v) ? v : []).map(normItem).filter(Boolean).sort((a, b) => b.at - a.at); };
let lastAt = 0;
export function pushReport(x) {
  lastAt = Math.max(Date.now(), lastAt + 1); // 같은 밀리초에 여러 번 넣어도 차례가 남게
  const e = normItem({ ...x, at: lastAt });
  if (!e) return false;
  return set(LIST, [e, ...listReports().filter(y => y.id !== e.id)].sort((a, b) => b.at - a.at).slice(0, 20));
}
