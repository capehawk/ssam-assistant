/* 학급 › 오늘 수업: 그날 교시별 교과·차시를 보이고 [완료 / 일부 진행 / 못 함]을 체크 (스펙 4.1, 3.3) */
import { onEnter, go } from '../../core/shell.js';
import { toast } from '../../core/ui.js';
import { listEvents, addDays, isDate } from '../../core/calendar.js';
import { makeCtx, dayView, setMark, missingDays, fmtDay, fmtShort, today, unitPos, hasTimetable } from './class-model.js';
import { askSample } from './setup.js';
import { listDocs } from '../etc/gongmun-model.js';
import { dueSoon, ddayText } from '../etc/gongmun-ai.js';

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MARKS = [['done', '완료'], ['part', '일부 진행'], ['skip', '못 함']];
let box = null, curTab = null, date = null;
const visible = () => curTab === 'today' && box && box.isConnected && !box.closest('[hidden]');
const pagesText = p => (/^[\d\s~,.-]+$/.test(p) ? `${p}쪽` : p);

function slotHTML(s) {
  let body;
  if (!s.sub) body = '<span class="muted">진도표 없음</span>';
  else if (!s.lesson) body = '<span class="muted">진도표의 차시를 모두 마쳤어요</span>';
  else {
    const l = s.lesson, pos = unitPos(s.sub, s.index);
    body = `${l.unit ? `<span class="muted cls-l-unit">${esc(l.unit)}</span>` : ''}<span class="cls-l-n">${pos.n}/${pos.of}차시</span>
      <span class="cls-l-t">${esc(l.title)}</span>${l.pages ? `<span class="muted">${esc(pagesText(l.pages))}</span>` : ''}${l.memo ? `<span class="cls-tag">${esc(l.memo)}</span>` : ''}`;
  }
  const marks = s.sub ? `<div class="seg cls-marks" role="group" aria-label="${s.period}교시 ${esc(s.subject)} 체크">${MARKS.map(([k, label]) =>
    `<button type="button" data-mark="${k}" data-p="${s.period}" aria-pressed="${s.status === k}">${label}</button>`).join('')}</div>` : '';
  return `<li class="cls-lesson${s.status ? ' marked' : ''}" data-p="${s.period}"${s.index != null ? ` data-index="${s.index}"` : ''}>
    <span class="cls-l-p">${s.period}교시</span>
    <div class="cls-l-main"><b class="cls-l-s">${esc(s.subject)}</b>${body}</div>${marks}</li>`;
}
function listHTML(ctx) {
  const v = dayView(ctx, date);
  if (v.off) return `<div class="yp-card cls-off"><b>${esc(v.off)}</b><span class="muted">수업이 없는 날이에요.</span></div>`;
  if (!v.slots.length) return '<div class="yp-card"><p class="muted" style="margin:0">이 요일에는 시간표에 수업이 없어요.</p></div>';
  return `<ol class="cls-lessons yp-card">${v.slots.map(slotHTML).join('')}</ol>`;
}
function missingHTML(ctx) {
  const days = missingDays(ctx);
  if (!days.length) return '';
  return `<div class="banner warn cls-missing"><span>체크하지 않은 날:</span>${days.map(d => `<button class="btn text" type="button" data-go-day="${d}">${fmtShort(d)}</button>`).join('')}</div>`;
}
/* 공문 기한 띠(스펙 2026-11-04 5.3): 오늘부터 7일 안(지난 것 포함)·끝나지 않은 공문 3개까지, 누르면 기타 › 공문 처리 */
function bandHTML() {
  const soon = dueSoon(listDocs(), today());
  return soon.length ? `<div class="gm-band banner warn" id="gmBand"><b>공문 기한</b>${soon.map(d => `<button class="btn text" type="button" data-gm-band><b>${esc(ddayText(d.n))}</b> ${esc(d.title || d.name || '공문')}</button>`).join('')}</div>` : '';
}
function render() {
  if (!box) return;
  const ctx = makeCtx();
  const head = '<div class="m-head"><h2>오늘 수업</h2><p class="muted">교시마다 수업한 만큼 체크하면 시수와 진도가 저절로 계산돼요.</p></div>' + bandHTML();
  if (!hasTimetable(ctx.tt)) {
    box.innerHTML = `<div class="m-page cls-page">${head}<div class="yp-card"><p style="margin:0">먼저 진도표·시수 › 준비에서 시간표를 넣어 주세요.</p>
      <div class="row"><button class="btn primary" type="button" data-t="setup">준비로 가기</button><button class="btn" type="button" data-t="sample">예시로 채우기</button></div></div></div>`;
    return;
  }
  const events = listEvents().filter(e => e.date === date);
  box.innerHTML = `<div class="m-page cls-page">${head}
    <div class="cls-day-nav">
      <button class="icon-btn" type="button" data-t="prev" aria-label="전날">‹</button>
      <b class="cls-day" aria-live="polite">${fmtDay(date)}</b>
      <button class="icon-btn" type="button" data-t="next" aria-label="다음 날">›</button>
      <button class="btn text" type="button" data-t="today">오늘</button>
      <input class="field" type="date" id="clsDate" value="${date}" aria-label="날짜 고르기">
    </div>
    ${events.length ? `<div class="cls-events">${events.map(e => `<span class="cls-chip">${esc(e.title)}</span>`).join('')}</div>` : ''}
    <div id="clsMissing">${missingHTML(ctx)}</div>
    <div id="clsLessons">${listHTML(ctx)}</div>
  </div>`;
}
/* 체크하면 교시 목록과 「체크하지 않은 날」만 다시 그림 (같은 교과 뒤 시간의 차시가 바뀌므로 목록 전체) */
function redrawLessons() {
  const ctx = makeCtx();
  const l = box.querySelector('#clsLessons'), m = box.querySelector('#clsMissing');
  if (l) l.innerHTML = listHTML(ctx);
  if (m) m.innerHTML = missingHTML(ctx);
}
function setDate(d) { if (isDate(d)) { date = d; render(); } }

/* 다른 메뉴에 갔다 오거나 켜 둔 채 날이 바뀌면 오늘로 (shownOn: 그 날짜를 보기 시작한 실제 날) */
let away = false, shownOn = '';
const toToday = () => { date = today(); shownOn = date; };
document.addEventListener('menu:go', e => { if (e.detail.menu !== 'class') away = true; });
window.addEventListener('focus', () => {
  if (!visible() || shownOn === today()) return;
  if (date === shownOn) { toToday(); render(); } else shownOn = today(); // 선생님이 고른 다른 날은 그대로
});
onEnter('class', (tab, section) => {
  if (!box || !section.contains(box)) { box = document.createElement('div'); box.className = 'cls-today'; section.append(box); }
  if (tab === 'today' && (curTab !== 'today' || away || shownOn !== today())) toToday();
  away = false;
  curTab = tab;
  box.hidden = tab !== 'today';
  if (tab === 'today') render();
});
document.addEventListener('class:changed', e => { if (visible() && !(e.detail && e.detail.from === 'today')) render(); });
document.addEventListener('change', e => { if (box && box.contains(e.target) && visible() && e.target.id === 'clsDate') setDate(e.target.value); });
document.addEventListener('click', e => {
  if (!box || !box.contains(e.target) || !visible()) return;
  const m = e.target.closest('[data-mark]');
  if (m) {
    const p = +m.dataset.p;
    const slot = dayView(makeCtx(), date).slots.find(s => s.period === p);
    if (!slot) return;
    const next = slot.status === m.dataset.mark ? null : m.dataset.mark;
    if (!setMark(date, p, slot.subject, next)) { toast('저장 공간이 모자라 저장하지 못했어요', 6000); return; }
    redrawLessons();
    document.dispatchEvent(new CustomEvent('class:changed', { detail: { from: 'today' } }));
    return;
  }
  if (e.target.closest('[data-gm-band]')) { go('etc', 'gongmun'); return; }
  const g = e.target.closest('[data-go-day]');
  if (g) { setDate(g.dataset.goDay); return; }
  const b = e.target.closest('[data-t]');
  if (!b) return;
  const t = b.dataset.t;
  if (t === 'prev') setDate(addDays(date, -1));
  else if (t === 'next') setDate(addDays(date, 1));
  else if (t === 'today') setDate(today());
  else if (t === 'setup') go('class', 'progress');
  else if (t === 'sample') askSample();
});
