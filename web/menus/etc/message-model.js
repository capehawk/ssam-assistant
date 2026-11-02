/* 쪽지 저장 (스펙 2026-11-02 4.4·4.6): 보내는 사람(GLOBAL), 지금 쓰는 쪽지·최근 쪽지 20개(학년도 자료). 붙임 파일은 저장하지 않고 이름만 */
import { get, set } from '../../core/store.js';

const SENDER = 'msg:sender', DRAFT = 'msg:draft', LIST = 'msg:list';
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const LENS = ['short', 'base', 'long'];
export const newMessageId = () => 'msg' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export const getSender = () => String(get(SENDER, '') || '').trim();
export const setSender = s => set(SENDER, String(s || '').trim().slice(0, 80));

/* 지금 쪽지: { id, m(쪽지 칸), len, attach: [{ name, on }], edited(본문을 손으로 고침), body, title } */
function normDraft(d) {
  if (!isObj(d) || typeof d.id !== 'string' || !isObj(d.m)) return null;
  return { id: d.id, m: d.m, len: LENS.includes(d.len) ? d.len : 'base',
    attach: (Array.isArray(d.attach) ? d.attach : []).filter(isObj).map(a => ({ name: String(a.name || '').slice(0, 80), on: a.on !== false })).filter(a => a.name),
    edited: !!d.edited, body: String(d.body || ''), title: String(d.title || ''), again: !!d.again };
}
export const getDraft = () => normDraft(get(DRAFT, null));
export const saveDraft = d => { const n = normDraft(d); return n ? set(DRAFT, n) : false; };
export const clearDraft = () => set(DRAFT, null);

/* 최근 쪽지: [{ id, at, title, kind, m, len, attachNames }] 늦은 것 먼저 */
const normItem = x => (isObj(x) && typeof x.id === 'string' && isObj(x.m)
  ? { id: x.id, at: Number(x.at) || 0, title: String(x.title || ''), kind: String(x.kind || 'etc'), m: x.m, len: LENS.includes(x.len) ? x.len : 'base',
    attachNames: (Array.isArray(x.attachNames) ? x.attachNames : []).map(String).filter(Boolean).slice(0, 20),
    body: String(x.body || '').slice(0, 6000), edited: !!x.edited, again: !!x.again } : null);
export const listMessages = () => { const v = get(LIST, []); return (Array.isArray(v) ? v : []).map(normItem).filter(Boolean).sort((a, b) => b.at - a.at); };
/* 같은 id는 그 자리를 고쳐 맨 앞으로, 20개까지 */
export function pushMessage(x) {
  const e = normItem({ at: Date.now(), ...x });
  if (!e) return false;
  return set(LIST, [e, ...listMessages().filter(y => y.id !== e.id)].sort((a, b) => b.at - a.at).slice(0, 20));
}
