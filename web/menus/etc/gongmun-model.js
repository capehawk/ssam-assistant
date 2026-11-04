/* 공문 처리 저장 (학년도 자료 「gongmun:list」, 40개까지): 글은 명단·전화번호 줄을 뺀 것 8천 자까지(원본 파일은 저장하지 않음).
   바꿀 때마다 학사일정(달력)의 「gongmun」 일정을 다시 맞춤 */
import { get, set } from '../../core/store.js';
import { setEvents } from '../../core/calendar.js';
import { KINDS, MAX_TEXT, dueEvents, sortDocs } from './gongmun-ai.js';

const KEY = 'gongmun:list', MAX = 40;
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const str = (v, n) => String(v == null ? '' : v).slice(0, n);
const date = v => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : '');
const IDS = KINDS.map(k => k[0]);
export const newDocId = () => 'gm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
/* { id, name, title, from, no, date, due, dueNote, summary, tasks: [{ text, due, done }], kinds, text, at, done, read(AI로 읽었나) } */
function norm(d) {
  if (!isObj(d) || typeof d.id !== 'string') return null;
  return { id: str(d.id, 40), name: str(d.name, 120), title: str(d.title, 150), from: str(d.from, 80), no: str(d.no, 60), date: date(d.date), due: date(d.due),
    dueNote: str(d.dueNote, 120), summary: str(d.summary, 400),
    tasks: (Array.isArray(d.tasks) ? d.tasks : []).filter(isObj).slice(0, 12).map(t => ({ text: str(t.text, 120), due: date(t.due), done: !!t.done })),
    kinds: (Array.isArray(d.kinds) ? d.kinds : []).filter(k => IDS.includes(k)), text: str(d.text, MAX_TEXT), at: Number(d.at) || 0, done: !!d.done, read: !!d.read };
}
export const listDocs = () => { const v = get(KEY, []); return sortDocs((Array.isArray(v) ? v : []).map(norm).filter(Boolean)); };
function write(list) {
  // 넘치면 끝난 것·오래된 것부터 버림
  const keep = [...list].sort((a, b) => (a.done - b.done) || (b.at - a.at)).slice(0, MAX);
  const ok = set(KEY, keep);
  setEvents('gongmun', dueEvents(keep));
  return ok;
}
export function putDoc(d) { const n = norm(d); if (!n) return false; return write([n, ...listDocs().filter(x => x.id !== n.id)]); }
export function removeDoc(id) { return write(listDocs().filter(x => x.id !== id)); }
export const getDoc = id => listDocs().find(x => x.id === id) || null;
