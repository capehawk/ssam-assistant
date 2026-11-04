/* 날짜·공휴일·학사일정. 날짜는 'YYYY-MM-DD' 글, 요일은 UTC로 계산(시간대에 따라 밀리지 않게).
   학사일정(ssam:calendar)은 연간계획·행사계획을 확정하면 들어감 — 나중에 학급 메뉴·서버가 씀 */
import { get, set } from './store.js';

const KEY = 'calendar';

/* 2026~2028년 공휴일 (대체공휴일·선거일 포함). 제헌절은 공휴일이 아니어서 뺌.
   2028년은 2027학년도 1·2월(설날)과 2028학년도 계획에 씀 */
export const HOLIDAYS = {
  '2026-01-01': '신정', '2026-02-16': '설날', '2026-02-17': '설날', '2026-02-18': '설날',
  '2026-03-01': '삼일절', '2026-03-02': '대체공휴일(삼일절)', '2026-05-05': '어린이날',
  '2026-05-24': '부처님오신날', '2026-05-25': '대체공휴일(부처님오신날)', '2026-06-03': '전국동시지방선거',
  '2026-06-06': '현충일', '2026-08-15': '광복절', '2026-08-17': '대체공휴일(광복절)',
  '2026-09-24': '추석', '2026-09-25': '추석', '2026-09-26': '추석',
  '2026-10-03': '개천절', '2026-10-05': '대체공휴일(개천절)', '2026-10-09': '한글날', '2026-12-25': '성탄절',
  '2027-01-01': '신정', '2027-02-06': '설날', '2027-02-07': '설날', '2027-02-08': '설날', '2027-02-09': '대체공휴일(설날)',
  '2027-03-01': '삼일절', '2027-05-05': '어린이날', '2027-05-13': '부처님오신날', '2027-06-06': '현충일',
  '2027-08-15': '광복절', '2027-08-16': '대체공휴일(광복절)',
  '2027-09-14': '추석', '2027-09-15': '추석', '2027-09-16': '추석',
  '2027-10-03': '개천절', '2027-10-04': '대체공휴일(개천절)', '2027-10-09': '한글날', '2027-10-11': '대체공휴일(한글날)',
  '2027-12-25': '성탄절', '2027-12-27': '대체공휴일(성탄절)',
  '2028-01-01': '신정', '2028-01-26': '설날', '2028-01-27': '설날', '2028-01-28': '설날',
  '2028-03-01': '삼일절', '2028-04-12': '국회의원선거', '2028-05-02': '부처님오신날', '2028-05-05': '어린이날', '2028-06-06': '현충일',
  '2028-08-15': '광복절', '2028-10-02': '추석', '2028-10-03': '추석·개천절', '2028-10-04': '추석', '2028-10-05': '대체공휴일(개천절)',
  '2028-10-09': '한글날', '2028-12-25': '성탄절'
};

const RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const toUTC = s => { const m = RE.exec(s); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN; };
const fromUTC = t => new Date(t).toISOString().slice(0, 10);

export function isDate(s) {
  const t = toUTC(String(s || ''));
  return Number.isFinite(t) && fromUTC(t) === s;
}
export const addDays = (s, n) => fromUTC(toUTC(s) + n * 86400000);
/* 학년도: 3~12월은 그해, 1~2월은 전해 */
export function schoolYearOf(date) {
  const y = +String(date).slice(0, 4), m = +String(date).slice(5, 7);
  return m <= 2 ? y - 1 : y;
}
export const weekday = s => new Date(toUTC(s)).getUTCDay();

/* ---------- 학사일정 ---------- */
export function listEvents() {
  const v = get(KEY, []);
  return (Array.isArray(v) ? v : [])
    .filter(e => e && isDate(e.date) && typeof e.title === 'string' && typeof e.source === 'string')
    .map(e => ({ date: e.date, title: e.title, source: e.source }));
}
/* 그 출처(예: 'year:<id>', 'event:<id>')의 일정을 통째로 바꿈 */
export function setEvents(source, items) {
  const keep = listEvents().filter(e => e.source !== source);
  const add = (Array.isArray(items) ? items : [])
    .filter(e => e && isDate(e.date)).map(e => ({ date: e.date, title: String(e.title || '').trim() || '일정', source }));
  set(KEY, [...keep, ...add]);
}
export const removeEvents = source => setEvents(source, []);

/* ---------- 겹침과 추천 ---------- */
const DAY = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

/* 그날 행사·일정을 잡기 어려운 이유들. 빈 배열이면 괜찮은 날 */
export function dayIssues(date, { breaks = [], events = [], source = null } = {}) {
  if (!isDate(date)) return [];
  const out = [];
  const w = weekday(date);
  if (w === 0 || w === 6) out.push(DAY[w]);
  if (HOLIDAYS[date]) out.push(`공휴일(${HOLIDAYS[date]})`);
  for (const b of breaks || []) if (b && b.from <= date && date <= b.to) { out.push(String(b.label || '').trim() || '방학·재량휴업일'); break; }
  // 공문 제출 기한·할 일(source gongmun)은 그날을 차지하는 일정이 아니라 겹침으로 세지 않음
  for (const e of events || []) if (e && e.date === date && e.source !== source && e.source !== 'gongmun') out.push(`「${e.title}」 일정과 겹쳐요`);
  return out;
}

/* 가까운 가능한 날짜: +1, −1, +2, −2 … 순서로 60일 안에서 찾은 순서대로 n개 */
export function suggestDates(date, ctx = {}, n = 2) {
  if (!isDate(date)) return [];
  const out = [];
  for (let d = 1; d <= 60 && out.length < n; d++) {
    for (const s of [addDays(date, d), addDays(date, -d)]) {
      if (out.length < n && !dayIssues(s, ctx).length) out.push(s);
    }
  }
  return out;
}
