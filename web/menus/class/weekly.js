/* 학급 › 주간학습안내: 교시별 학습 표(진도표대로 이어지는 예상 차시) + 요일별 알림(한주한장알림장 칸) → 한글 파일·인쇄·복사 (스펙 4.3).
   AI 알림은 시작할 때의 주(월요일)에, 비어 있는 칸만 채움 */
import { onEnter, go } from '../../core/shell.js';
import * as ai from '../../core/ai.js';
import { toast, copyText } from '../../core/ui.js';
import { exportButton, exportDoc } from '../../core/doc-export.js';
import { listEvents, addDays } from '../../core/calendar.js';
import {
  makeCtx, getInfo, getWeekly, saveWeekly, weekView, defaultWeek, weeklyTitle, weekCell, weeklyDoc, weekPeriods, normNotes, NOTE_ROWS, fmtDay, today, migrateWeeklyEvents, hasTimetable } from './class-model.js';
import { askSample } from './setup.js';

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const WD = '월화수목금';
const md = d => `${+d.slice(5, 7)}/${+d.slice(8, 10)}`;
const dotted = d => `${+d.slice(5, 7)}.${+d.slice(8, 10)}`;
const FULL = '저장 공간이 모자라 저장하지 못했어요';
const AI_KEYS = ['prep', 'safety', 'homework', 'notice'];
let box = null, curTab = null, monday = null;
migrateWeeklyEvents();
const busy = {}; // 월요일 → AI가 쓰는 중
const visible = () => curTab === 'weekly' && box && box.isConnected && !box.closest('[hidden]');

/* 학사일정 줄: 고쳐 쓴 글이 있으면 그것, 없으면 그 주 학사일정 */
const autoEvents = date => listEvents().filter(e => e.date === date).map(e => e.title).join(', ');
function sheet(mon) {
  const days = weekView(makeCtx(), mon);
  const w = getWeekly(mon);
  const notes = {};
  days.forEach((d, i) => { notes[i] = { ...w.notes[i], events: w.notes[i].events == null ? autoEvents(d.date) : w.notes[i].events }; });
  return { days, w, notes, title: w.title || weeklyTitle(getInfo()) };
}
const save = (mon, w) => { if (!saveWeekly(mon, w)) toast(FULL, 6000); };

function render() {
  if (!box) return;
  const ctx = makeCtx();
  const head = '<div class="m-head"><h2>주간학습안내</h2><p class="muted">진도표대로 이어지는 다음 주 학습 내용과 요일별 알림을 한 장으로 만들어요. 칸은 모두 고칠 수 있어요.</p></div>';
  if (!hasTimetable(ctx.tt)) {
    box.innerHTML = `<div class="m-page cls-page">${head}<div class="yp-card"><p style="margin:0">먼저 진도표·시수 › 준비에서 시간표를 넣어 주세요.</p>
      <div class="row"><button class="btn primary" type="button" data-w="setup">준비로 가기</button><button class="btn" type="button" data-w="sample">예시로 채우기</button></div></div></div>`;
    return;
  }
  const { days, w, notes, title } = sheet(monday);
  const th = days.map((d, i) => `<th scope="col">${WD[i]} ${md(d.date)}</th>`).join('');
  const rows = Array.from({ length: ctx.tt.periods }, (_, p) => `<tr><th scope="row">${p + 1}교시</th>${days.map((d, i) =>
    `<td><textarea class="field cls-wc" data-wc="${i}-${p + 1}" rows="2" aria-label="${WD[i]}요일 ${p + 1}교시">${esc(weekCell(days, w, i, p + 1))}</textarea></td>`).join('')}</tr>`).join('');
  const nrows = NOTE_ROWS.map(([k, label]) => `<tr><th scope="row">${label}</th>${days.map((d, i) =>
    `<td><textarea class="field cls-wn" data-wn="${i}-${k}" rows="2" aria-label="${WD[i]}요일 ${label}">${esc(notes[i][k])}</textarea></td>`).join('')}</tr>`).join('');
  const b = busy[monday];
  box.innerHTML = `<div class="m-page cls-page">${head}
    <div class="cls-week-nav">
      <button class="icon-btn" type="button" data-w="prev" aria-label="전 주">‹</button>
      <b class="cls-day">${fmtDay(days[0].date)} ~ ${fmtDay(days[4].date)}</b>
      <button class="icon-btn" type="button" data-w="next" aria-label="다음 주">›</button>
      <span class="grow"></span>
      <button class="btn text" type="button" data-w="refill">다시 채우기</button>
      <button class="btn tonal" type="button" data-w="ai"${b ? ' disabled' : ''}>${b ? 'AI가 쓰는 중…' : 'AI로 알림 쓰기'}</button>
      <button class="btn" type="button" data-w="copy">복사</button>
      <button class="btn" type="button" data-w="print">인쇄</button>
      ${exportButton('data-w="hwpx"', { cls: 'primary' })}
    </div>
    <div class="yp-card cls-sheet">
      <input class="field cls-w-title" id="clsWTitle" value="${esc(title)}" aria-label="제목">
      <p class="muted cls-w-range">${fmtDay(days[0].date)} ~ ${fmtDay(days[4].date)}</p>
      <div class="cls-tbl-wrap"><table class="cls-week"><thead><tr><th scope="col">교시</th>${th}</tr></thead><tbody>${rows}</tbody></table></div>
      <h3 class="cls-w-h">요일별 알림</h3>
      <div class="cls-tbl-wrap"><table class="cls-week"><thead><tr><th scope="col">구분</th>${th}</tr></thead><tbody>${nrows}</tbody></table></div>
    </div>
  </div>`;
}

/* ---------- AI 알림 ---------- */
function notesPrompt(days, notes) {
  const lines = days.map((d, i) => {
    const head = `${WD[i]}요일(${md(d.date)})`;
    if (d.off) return `${head}: 수업 없음(${d.off})`;
    const ls = d.slots.map(s => `${s.period}교시 ${s.subject}${s.lesson ? ` — ${s.lesson.unit ? s.lesson.unit + ' · ' : ''}${s.lesson.title}` : ''}`).join('; ');
    const ev = notes[i].events ? ` / 학사일정: ${notes[i].events}` : '';
    const have = AI_KEYS.filter(k => notes[i][k]).map(k => `${k}=${notes[i][k]}`).join(', ');
    return `${head}: ${ls || '수업 없음'}${ev}${have ? ` / 이미 쓴 칸: ${have}` : ''}`;
  }).join('\n');
  return `[주간학습안내]\n초등학교 담임이 학부모·학생에게 보내는 주간학습안내의 요일별 알림을 써 주세요.\n\n${lines}\n\n`
    + '규칙:\n- prep(준비물): 그날 수업에 필요한 것만 짧게(예: 색연필, 실내화). 없으면 ""\n- safety(안전): 그날에 맞는 안전 한 줄\n'
    + '- homework(과제), notice(안내장): 학사일정에서 짐작되는 것이 있을 때만, 없으면 ""\n- 학부모·학생이 읽기 쉬운 짧은 말, 학생 이름은 쓰지 않음\n- 수업 없는 날은 모두 ""\n\n'
    + '답은 JSON 하나만: {"days":[{"prep":"…","safety":"…","homework":"","notice":""}, …5개(월~금)]}';
}
async function runAi() {
  const mon = monday;
  if (busy[mon]) return;
  if (!ai.ready()) { toast('설정 › AI에서 키를 넣어 주세요', 5000); return; }
  busy[mon] = true;
  render();
  try {
    const { days, notes } = sheet(mon);
    const v = await ai.generateJSON(notesPrompt(days, notes), { task: 'notes', valid: x => x && Array.isArray(x.days) });
    const got = normNotes(v.days);
    const w = getWeekly(mon); // 그사이 선생님이 쓴 칸은 덮지 않음
    const filled = [];
    for (let d = 0; d < 5; d++) for (const k of AI_KEYS) {
      if (!w.notes[d][k].trim() && got[d][k].trim()) { w.notes[d][k] = got[d][k].trim(); filled.push([d, k]); }
    }
    save(mon, w);
    if (visible() && monday === mon) {
      for (const [d, k] of filled) { const el = box.querySelector(`textarea[data-wn="${d}-${k}"]`); if (el && document.activeElement !== el) el.value = w.notes[d][k]; }
    }
    toast(filled.length ? `빈 칸 ${filled.length}개를 채웠어요` : '채울 빈 칸이 없었어요');
  } catch (err) { toast(ai.errorMessage(err && err.code, err), 6000); }
  delete busy[mon];
  if (visible() && monday === mon) { const b = box.querySelector('[data-w="ai"]'); if (b) { b.disabled = false; b.textContent = 'AI로 알림 쓰기'; } }
}

/* ---------- 내보내기 ---------- */
function docOf() {
  const { days, w, notes, title } = sheet(monday);
  return { days, title, doc: weeklyDoc(days, { ...w, title, notes }), notes, w };
}
async function downloadHwpx() {
  const { days, title, doc } = docOf();
  try { toast(await exportDoc(doc, `${title}(${dotted(days[0].date)}~${dotted(days[4].date)})`), 6000); }
  catch (err) { toast('파일을 저장하지 못했어요'); }
}
function plainText() {
  const { days, title, w, notes } = docOf();
  const out = [`${title} (${fmtDay(days[0].date)} ~ ${fmtDay(days[4].date)})`];
  const P = weekPeriods(days, w);
  days.forEach((d, i) => {
    out.push('', `[${WD[i]} ${md(d.date)}]`);
    if (d.off) out.push(d.off);
    else for (let p = 1; p <= P; p++) { const c = weekCell(days, w, i, p); if (c) out.push(`${p}교시 ${c}`); }
    for (const [k, label] of NOTE_ROWS) if (notes[i][k]) out.push(`${label}: ${notes[i][k]}`);
  });
  return out.join('\n');
}

/* ---------- 입력 ---------- */
function onInput(el) {
  const w = getWeekly(monday);
  if (el.id === 'clsWTitle') w.title = el.value;
  else if (el.dataset.wc) w.cells[el.dataset.wc] = el.value;
  else if (el.dataset.wn) { const [d, k] = el.dataset.wn.split('-'); w.notes[d][k] = el.value; }
  else return;
  save(monday, w);
}

onEnter('class', (tab, section) => {
  if (!box || !section.contains(box)) { box = document.createElement('div'); box.className = 'cls-weekly'; section.append(box); }
  if (tab === 'weekly' && curTab !== 'weekly') monday = defaultWeek(today());
  curTab = tab;
  box.hidden = tab !== 'weekly';
  if (tab === 'weekly') render();
});
document.addEventListener('class:changed', () => { if (visible()) render(); });
document.addEventListener('input', e => { if (box && box.contains(e.target) && visible()) onInput(e.target); });
document.addEventListener('click', e => {
  if (!box || !box.contains(e.target) || !visible()) return;
  const b = e.target.closest('[data-w]');
  if (!b) return;
  const a = b.dataset.w;
  if (a === 'prev' || a === 'next') { monday = addDays(monday, a === 'prev' ? -7 : 7); render(); }
  else if (a === 'refill') { const w = getWeekly(monday); w.cells = {}; save(monday, w); render(); toast('학습 칸을 진도표대로 다시 채웠어요'); }
  else if (a === 'ai') runAi();
  else if (a === 'hwpx') downloadHwpx();
  else if (a === 'copy') copyText(plainText()).then(ok => toast(ok ? '복사했어요' : '복사하지 못했어요'));
  else if (a === 'print') window.print();
  else if (a === 'setup') go('class', 'progress');
  else if (a === 'sample') askSample();
});
