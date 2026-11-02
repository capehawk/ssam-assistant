/* 학년도: 지금 학년도의 자료는 기존 ssam: 키에 그대로 두고, 다른 학년도는 보관함(archive.js)에 둠.
   공통 키(AI 키·테마 등)는 학년도와 상관없이 그대로. 백업 파일에는 공통 키를 넣지 않음 */
import { schoolYearOf } from './calendar.js';

const PREFIX = 'ssam:';
export const GLOBAL = ['engine', 'theme', 'nav', 'mode', 'updSkip', 'years', 't', 'backupAt', 'inbox', 'bubble', 'export', 'ai-roles'];
export const isYearKey = k => !!k && !GLOBAL.includes(k) && !k.startsWith('mig:');
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const pad = n => String(n).padStart(2, '0');
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

/* ls가 없으면(저장소가 막힘) 오늘이 든 학년도 */
export function getYears(ls, today = todayStr()) {
  try { const v = JSON.parse(ls.getItem(PREFIX + 'years')); if (isObj(v) && Number.isInteger(v.current)) return { current: v.current }; } catch (e) {}
  return { current: schoolYearOf(today) };
}
/* 처음 연 날의 학년도를 저장해 둠 (날짜가 3월을 넘어도 지금 자료의 학년도가 저절로 바뀌지 않게) */
export function ensureYears(ls, today = todayStr()) {
  const y = getYears(ls, today);
  try { if (!isObj(parse(ls.getItem(PREFIX + 'years')))) ls.setItem(PREFIX + 'years', JSON.stringify(y)); } catch (e) {}
  return y;
}

const yearKeys = ls => {
  const out = [];
  if (!ls) return out;
  for (let i = 0; i < ls.length; i++) { const k = ls.key(i); if (k && k.startsWith(PREFIX) && isYearKey(k.slice(PREFIX.length))) out.push(k); }
  return out;
};
/* 지금 학년도의 자료 묶음: { 키(ssam: 뺀 것): 저장된 글 } */
export function snapshot(ls) {
  const out = {};
  for (const k of yearKeys(ls)) out[k.slice(PREFIX.length)] = ls.getItem(k);
  return out;
}

const parse = t => { try { return JSON.parse(t); } catch (e) { return null; } };
/* 새 학년도에 가져가는 것: 연간계획·행사계획·학급운영계획, 새 학년도(3월 1일부터) 학사일정, 학교명·학급 수·학생 수,
   설정(평어·행특 설정, 채점 설정(예외 번호는 비움), 나이스 입력 설정, 품의 기준 금액). 학생 자료는 비움.
   classSetup: 2월에 새 학년도 준비를 미리 넣었으면 학급 명단·학급 정보·시간표·진도표도 (진도 위치는 처음부터, 체크·주간학습안내는 비움) */
export function carryOver(snap, newYear, { classSetup = false } = {}) {
  const out = {};
  for (const k of ['yearplans', 'yearplan:current', 'events', 'event:current', 'classplans', 'classplan:current', 'purchaseLimit']) if (typeof snap[k] === 'string') out[k] = snap[k];
  for (const k of Object.keys(snap)) if ((k === 'neis' || k.startsWith('neis:')) && typeof snap[k] === 'string') out[k] = snap[k];
  const pf = parse(snap.prefs);
  if (isObj(pf) && isObj(pf.settings)) out.prefs = JSON.stringify({ current: null, settings: pf.settings });
  const hk = parse(snap.hk);
  if (isObj(hk) && isObj(hk.settings)) out.hk = JSON.stringify({ settings: hk.settings, students: [] });
  const gr = parse(snap.grset);
  if (isObj(gr)) out.grset = JSON.stringify({ ...gr, startNo: 1, except: [] });
  const cal = parse(snap.calendar);
  if (Array.isArray(cal)) out.calendar = JSON.stringify(cal.filter(e => e && typeof e.date === 'string' && e.date >= `${newYear}-03-01`));
  const sc = parse(snap.school);
  if (isObj(sc)) out.school = JSON.stringify({ name: String(sc.name || ''), classes: Number(sc.classes) || 0, students: Number(sc.students) || 0, breaks: [] });
  if (classSetup) {
    for (const k of ['class', 'class:info', 'class:timetable']) if (typeof snap[k] === 'string') out[k] = snap[k];
    const subs = parse(snap['class:subjects']);
    if (Array.isArray(subs)) out['class:subjects'] = JSON.stringify(subs.filter(isObj).map(x => ({ ...x, offset: 0, start: '' })));
  }
  return out;
}

/* 1·2월에 아직 지난 학년도에 있으면 새 학년도(그 해 3월부터)를 먼저 시작하라고 알림: 알릴 학년도, 아니면 0 */
export function prepYear(today, current) {
  const m = +String(today).slice(5, 7), next = schoolYearOf(today) + 1;
  return (m === 1 || m === 2) && current < next ? next : 0;
}

export function makeBackup({ current, snap, archives = {} }, now = new Date()) {
  const years = {};
  for (const [y, s] of Object.entries(archives)) years[y] = s;
  years[current] = snap;
  return { app: 'ssam', kind: 'backup', version: 1, createdAt: now.toISOString(), current, years };
}

/* 백업 파일 글 → { current, years }. 쌤비서 백업이 아니면 { code: 'NOT_BACKUP' }을 던짐 */
export function parseBackup(text) {
  const o = parse(text);
  const bad = () => { throw { code: 'NOT_BACKUP' }; };
  if (!isObj(o) || o.app !== 'ssam' || o.kind !== 'backup' || o.version !== 1 || !isObj(o.years)) bad();
  const years = {};
  for (const [y, s] of Object.entries(o.years)) {
    if (!/^\d{4}$/.test(y) || !isObj(s) || !Object.values(s).every(v => typeof v === 'string')) bad();
    years[y] = Object.fromEntries(Object.entries(s).filter(([k]) => isYearKey(k)));
  }
  return { current: Number.isInteger(o.current) ? o.current : null, years };
}

/* 학년도 옮기기: 저장 멈춤 → 지금 학년도를 보관함에 → 학년도 키를 비우고 가려는 학년도 자료를 씀 → 학년도 표시.
   data가 없으면 보관함의 그 학년도(없으면 빈 자료). 성공하면 멈춘 채로 두고(부른 쪽이 다시 엶) */
export async function moveTo(target, { ls, archive, freeze = () => {}, unfreeze = () => {}, data = null, today, timeout = 20000 } = {}) {
  freeze();
  const cur = getYears(ls, today).current;
  const now = snapshot(ls);
  // 보관함(IndexedDB)이 응답하지 않으면 기다리다 멈춤을 풂 (앱이 저장을 멈춘 채로 남지 않게)
  const T = p => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('timeout')), timeout))]);
  let next = data;
  try {
    // 보관함에 있는 학년도를 새 자료로 시작하지 않음 (그 학년도의 자료를 덮어쓰게 되므로)
    if (data && target !== cur && await T(archive.get(target))) { unfreeze(); return { ok: false, code: 'EXISTS' }; }
  } catch (e) { unfreeze(); return { ok: false, code: 'ARCHIVE_READ' }; }
  try { await T(archive.put(cur, now)); } catch (e) { unfreeze(); return { ok: false, code: 'ARCHIVE_FAILED' }; }
  try { if (!next) next = (await T(archive.get(target))) || {}; } catch (e) { unfreeze(); return { ok: false, code: 'ARCHIVE_READ' }; }
  const write = snap => {
    for (const k of yearKeys(ls)) ls.removeItem(k);
    for (const [k, v] of Object.entries(snap)) if (isYearKey(k) && typeof v === 'string') ls.setItem(PREFIX + k, v);
  };
  try {
    write(next);
    ls.setItem(PREFIX + 'years', JSON.stringify({ current: target }));
  } catch (e) {
    // 지금 자료로 되돌림. 그것도 못 하면 지금 자료는 방금 보관함에 넣은 것으로 남아 있음
    let back = true;
    try { write(now); } catch (e2) { back = false; }
    unfreeze();
    return { ok: false, code: back ? 'WRITE_FAILED' : 'RESTORE_FAILED' };
  }
  return { ok: true };
}
