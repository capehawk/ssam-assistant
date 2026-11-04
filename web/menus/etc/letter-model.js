/* 가정통신문 저장 (학년도 자료): 지금 쓰는 것·최근 20개(글만), 마지막에 고른 양식 id */
import { get, set } from '../../core/store.js';

const CUR = 'letter:cur', LIST = 'letter:list', FORM = 'letter:form';
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const str = (v, n) => String(v == null ? '' : v).slice(0, n);
const strs = (v, k, n) => (Array.isArray(v) ? v : []).slice(0, k).map(x => str(x, n));
export const newLetterId = () => 'lt' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const getFormId = () => str(get(FORM, ''), 40);
export const setFormId = id => set(FORM, str(id, 40));

/* 회신서 모으기: 가린 칸(0~1 비율 사각형)과 줄(번호·고른 선택지·못 읽은 칸)만 — 이름·그림은 저장하지 않음 */
const num01 = v => Math.min(1, Math.max(0, Number(v) || 0));
function normCollect(c) {
  const o = isObj(c) ? c : {};
  return { mask: (Array.isArray(o.mask) ? o.mask : []).filter(isObj).slice(0, 8).map(r => ({ x: num01(r.x), y: num01(r.y), w: num01(r.w), h: num01(r.h) })),
    rows: (Array.isArray(o.rows) ? o.rows : []).filter(isObj).slice(0, 80).map(r => {
      const n = Number(r.no), a = isObj(r.answers) ? r.answers : {};
      return { no: Number.isInteger(n) && n >= 1 && n <= 99 ? n : null, answers: Object.fromEntries(Object.entries(a).slice(0, 8).map(([k, v]) => [str(k, 60), str(v, 60)])), unsure: strs(r.unsure, 8, 60) };
    }) };
}
/* { id, sources: [{ name, text }], memo, related, target, out: { title, date, body: [줄], replyOn, reply: { title, fields, due }, short }, send: { title, body }, sendEdited } */
function norm(d) {
  if (!isObj(d) || typeof d.id !== 'string') return null;
  const o = isObj(d.out) ? d.out : {}, rp = isObj(o.reply) ? o.reply : {}, sd = isObj(d.send) ? d.send : {};
  return { id: d.id,
    sources: (Array.isArray(d.sources) ? d.sources : []).filter(isObj).slice(0, 10).map(s => ({ name: str(s.name, 100), text: str(s.text, 20000) })),
    memo: str(d.memo, 6000), target: str(d.target, 60),
    related: (Array.isArray(d.related) ? d.related : []).filter(isObj).slice(0, 3).map(r => ({ no: str(r.no, 40), date: str(r.date, 10), title: str(r.title, 100) })),
    out: o.title || (o.body || []).length ? { title: str(o.title, 100), date: str(o.date, 10), body: strs(o.body, 200, 2000), replyOn: !!o.replyOn,
      reply: { title: str(rp.title, 60), fields: strs(rp.fields, 8, 120), due: str(rp.due, 120) }, short: str(o.short, 1200) } : null,
    send: { title: str(sd.title, 200), body: str(sd.body, 4000) }, sendEdited: !!d.sendEdited, collect: normCollect(d.collect) };
}
export const getCurrent = () => norm(get(CUR, null));
export const saveCurrent = d => { const n = norm(d); return n ? set(CUR, n) : false; };
export const clearCurrent = () => set(CUR, null);
/* 최근: 글이 있는 것만, 원문 공문은 넣지 않음(이름만) */
const item = x => { const n = norm(x); return n && n.out ? { ...n, sources: n.sources.map(s => ({ name: s.name, text: '' })), at: Number(x.at) || 0 } : null; };
export const listLetters = () => { const v = get(LIST, []); return (Array.isArray(v) ? v : []).map(item).filter(Boolean).sort((a, b) => b.at - a.at); };
let lastAt = 0;
export function pushLetter(x) {
  lastAt = Math.max(Date.now(), lastAt + 1);
  const e = item({ ...x, at: lastAt });
  if (!e) return false;
  return set(LIST, [e, ...listLetters().filter(y => y.id !== e.id)].slice(0, 20));
}
