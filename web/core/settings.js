/* 설정 값: 학교 정보(방학·재량휴업일 포함), 품의 계약 기준 금액.
   학급 명단·AI·테마는 각각 평가 메뉴(window.SSAM)·core/theme.js가 맡음 */
import { get, set } from './store.js';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const LIMIT_DEFAULT = 20000000;
const int0 = v => Math.max(0, Math.floor(Number(v) || 0));

/* 학년도: 9월까지는 올해, 10월부터는 다음 해를 계획하는 때로 봄 */
export function defaultYear(now = new Date()) {
  return now.getMonth() >= 9 ? now.getFullYear() + 1 : now.getFullYear();
}

function cleanBreaks(list) {
  return (Array.isArray(list) ? list : [])
    .filter(b => b && DATE.test(b.from) && DATE.test(b.to) && b.from <= b.to)
    .map(b => ({ from: b.from, to: b.to, label: String(b.label || '').trim() }));
}

export function getSchool(now = new Date()) {
  const v = get('school', null) || {};
  return {
    name: String(v.name || ''),
    year: Number.isInteger(v.year) ? v.year : defaultYear(now),
    classes: int0(v.classes),
    students: int0(v.students),
    breaks: cleanBreaks(v.breaks)
  };
}

export function setSchool(obj) {
  const cur = getSchool();
  const next = {
    name: obj.name != null ? String(obj.name).trim() : cur.name,
    year: Number.isInteger(+obj.year) && +obj.year > 2000 ? +obj.year : cur.year,
    classes: obj.classes != null ? int0(obj.classes) : cur.classes,
    students: obj.students != null ? int0(obj.students) : cur.students,
    breaks: obj.breaks != null ? cleanBreaks(obj.breaks) : cur.breaks
  };
  // 저장하지 못하면 null (화면이 알림)
  return set('school', next) ? next : null;
}

export function getPurchaseLimit() {
  const v = get('purchaseLimit', LIMIT_DEFAULT);
  return Number.isFinite(v) && v > 0 ? v : LIMIT_DEFAULT;
}

/* 1원 이상 정수만 받음. 받으면 true, 값이 틀리면 false, 저장 공간이 모자라면 'full' */
export function setPurchaseLimit(won) {
  const v = Number(won);
  if (!Number.isFinite(v) || v < 1) return false;
  return set('purchaseLimit', Math.floor(v)) || 'full';
}

/* 협의회 1인 상한(원, 참고용). 교육청·학교마다 달라서 선생님이 정함. 기본 40,000원 */
const MEET_CAP_DEFAULT = 40000;
export function getMeetCap() {
  const v = get('purchaseMeetCap', MEET_CAP_DEFAULT);
  return Number.isFinite(v) && v > 0 ? v : MEET_CAP_DEFAULT;
}
export function setMeetCap(won) {
  const v = Number(won);
  if (!Number.isFinite(v) || v < 1) return false;
  return set('purchaseMeetCap', Math.floor(v)) || 'full';
}
