/* 계획 › 행사계획: 1 행사 정보 → 2 구성안 → 3 문서 → 4 설문·결과 (PRD 5.4).
   연간계획(year.js)과 같은 틀: 지난 행사 목록 + 단계. AI 답은 시작할 때의 행사 id에 저장 */
import { onFlush } from '../../core/store.js';
import { onEnter, go as goMenu } from '../../core/shell.js';
import { registerInbox } from '../../core/inbox.js';
import * as ai from '../../core/ai.js';
import { aiRowHTML } from '../../core/ai-roles.js';
import { readText, fileMessage } from '../../core/files.js';
import { getSchool } from '../../core/settings.js';
import { toast, copyText, saveFile } from '../../core/ui.js';
import { exportButton, exportDoc } from '../../core/doc-export.js';
import { openPurchase } from '../purchase/purchase.js';
import { stepsHTML } from '../../core/steps.js';
import { rvBoxHTML, runPlanReview, onRvClick, markDone, dropOpen, hasOpen, clearState } from './plan-review.js';
import { listEvents as listCalendar, setEvents, removeEvents, dayIssues, suggestDates, weekday, isDate } from '../../core/calendar.js';
import { summarize, formText } from '../../core/survey.js';
import { qrPng } from '../../core/qr.js';
import { readTable } from '../../core/sheet.js';
import { listPlans, planText } from './year-model.js';
import { KINDS, DOCS, REF_KINDS, normRefs, guessKind, refsBlock, normRefNotes, newEvent, listEventPlans, getEvent, saveEvent, deleteEvent, currentEventId, setCurrentEvent, normOptions, normRoles, roleLoad, letterMissing, docDoc, confirmBlockers, normItems } from './event-model.js';

const STEPS = ['행사 정보', '구성안', '문서', '설문·결과'];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const won = n => Number(n || 0).toLocaleString('ko-KR');
const fmtDay = d => `${+d.slice(5, 7)}월 ${+d.slice(8, 10)}일(${'일월화수목금토'[weekday(d)]})`;
const kindName = id => (KINDS.find(k => k[0] === id) || KINDS[3])[1];

let box = null, curTab = null;
let ev = getEvent(currentEventId()) || newEvent();
let saved = !!getEvent(ev.id);
const busy = {}, errs = {};
const MAX_SRC = 60000;                 // 작년 설문 칸에 저장하는 글자 수
const STEP_OF = { options: 2, docs: 3, items: 4, result: 4 }; // AI 일 → 결과를 보이는 단계
const cap = t => String(t).slice(0, MAX_SRC);
let warnedFull = false;
let curDoc = 'plan'; // 3단계에서 보고 있는 문서
let showMemos = false; // 1단계 「지난 행사 개선 메모 불러오기」 목록
let showPlans = false; // 1단계 참고 자료 「연간계획에서 불러오기」 목록
const qrCache = {}; // 폼 주소 → QR 그림(data URL)
const TARGETS = [['student', '학생'], ['parent', '학부모'], ['staff', '교직원']];
const FEW = n => `응답이 적어요(${n}명). 결과를 일반화하기 어려워요.`;
const blankSurvey = () => ({ target: 'student', items: [], formUrl: '', result: null, textSummary: '', report: '', nextMemo: '' });
const survey = () => ev.survey || (ev.survey = blankSurvey());
/* 확정한 행사의 정보·문서를 고치면 다시 「작성 중」, 학사일정에서도 뺌(다시 확정하면 새로 넣음) */
function unconfirm() {
  if (ev.status !== 'final') return;
  ev.status = 'draft';
  removeEvents('event:' + ev.id);
}

/* 글을 칠 때는 잠깐 멈춘 뒤 한 번만 저장 (치는 글자마다 목록 전체를 다시 쓰지 않게). 다른 일을 하기 전에는 flushSave */
let saveT = 0;
function persistSoon() { clearTimeout(saveT); saveT = setTimeout(persist, 400); }
function flushSave() { if (saveT) persist(); }
onFlush(flushSave);
document.addEventListener('menu:go', flushSave); // 다른 메뉴로 갈 때
function persist() {
  clearTimeout(saveT); saveT = 0;
  if (!saved && !ev.name.trim()) return;
  const s = saveEvent(ev);
  if (!s) { if (!warnedFull) { warnedFull = true; toast('저장 공간이 모자라 저장하지 못했어요. 쓰지 않는 행사를 지우거나 긴 자료를 줄여 주세요.', 8000); } return; }
  warnedFull = false;
  ev.updatedAt = s.updatedAt;
  saved = true;
  setCurrentEvent(ev.id);
  renderList();
}
function apply(id, fn) {
  flushSave(); // 친 글을 먼저 저장해야 아래에서 다시 읽어도 남음
  const e = getEvent(id);
  if (!e) return;
  fn(e);
  const s = saveEvent(e);
  if (!s) { toast('저장 공간이 모자라 저장하지 못했어요.', 6000); return; }
  if (ev.id === id) ev = s;
  renderList();
}
/* AI 일이 끝나면 그 결과를 보이는 단계를 보고 있을 때만 다시 그림 (다른 단계에서 치는 글이 끊기지 않게) */
function finish(id, kind) {
  delete busy[id];
  if (!visible() || ev.id !== id) return;
  if (ev.step !== STEP_OF[kind]) { if (errs[id]) toast(errs[id], 6000); return; }
  // 4단계는 결과가 나온 카드만 다시 그림 (폼 링크 등 다른 칸에 치는 글이 끊기지 않게)
  if (kind === 'items' || kind === 'result') { renderCard(kind); if (errs[id]) toast(errs[id], 6000); }
  else renderMain();
}
function renderCard(kind) {
  const el = box && box.querySelector(kind === 'items' ? '#evItemsCard' : '#evResultCard');
  if (!el) { renderMain(); return; }
  el.outerHTML = kind === 'items' ? itemsCardHTML() : resultCardHTML();
}
const visible = () => curTab === 'event' && box && box.isConnected && !box.hidden && !box.closest('[hidden]');
const calCtx = () => ({ breaks: getSchool().breaks, events: listCalendar(), source: 'event:' + ev.id });

/* ---------- 그리기 ---------- */
function render() {
  box.innerHTML = `<div class="m-page yp-page ev-page">
    <div class="m-head"><h2>행사계획</h2><p class="muted">행사 정보를 넣으면 구성안 2~3개, 계획서·역할 분담표·안전 점검표·가정통신문, 설문과 결과 보고서까지 만들어요.</p></div>
    <div class="yp-grid">
      <aside class="yp-side" aria-labelledby="evListH">
        <div class="yp-side-h"><b id="evListH">지난 행사</b><button class="btn text" type="button" data-e="new">+ 새 행사</button></div>
        <ul class="yp-list" id="evList"></ul>
      </aside>
      <section class="yp-main" id="evMain"></section>
    </div>
    <input type="file" id="evFile" accept=".csv,.xlsx,.hwp,.hwpx,.pdf,.txt" hidden>
    <input type="file" id="evRefFile" accept=".hwp,.hwpx,.pdf,.csv,.xlsx,.txt" multiple hidden>
  </div>`;
  renderList();
  renderMain();
}

/* 목록이 그대로면 다시 그리지 않음 (저장할 때마다 단추를 바꾸면 누르는 중인 단추가 사라짐) */
const listShown = new WeakMap();
function renderList() {
  const ul = box && box.querySelector('#evList');
  if (!ul) return;
  const list = listEventPlans();
  const html = list.length ? list.map(e => `<li><button type="button" class="yp-item" data-ev="${esc(e.id)}" ${e.id === ev.id ? 'aria-current="true"' : ''}>
      <b>${esc(e.name || '이름 없는 행사')}</b><span class="muted">${esc(kindName(e.kind))}${e.date ? ' · ' + e.date : ''} · ${e.status === 'final' ? '확정' : '작성 중'}</span></button></li>`).join('')
    : '<li class="muted yp-none">아직 없어요.</li>';
  if (listShown.get(ul) !== html) { ul.innerHTML = html; listShown.set(ul, html); }
}

function renderMain() {
  const main = box && box.querySelector('#evMain');
  if (!main) return;
  const s = ev.step;
  const body = s === 1 ? step1() : s === 2 ? step2() : s === 3 ? step3() : step4();
  main.innerHTML = stepsHTML(STEPS, s, ev.maxStep)
    + (s === 2 || s === 3 ? aiRowHTML('plan') : '')
    + (errs[ev.id] ? `<div class="banner err" role="alert"><span class="grow">${esc(errs[ev.id])}</span></div>` : '')
    + body
    + `<div class="row yp-nav">${s > 1 ? '<button class="btn" type="button" data-e="prev">이전</button>' : ''}<span class="grow"></span>${s < 4 ? '<button class="btn primary" type="button" data-e="next">다음</button>' : ''}</div>`
    + (saved ? `<div class="row yp-del"><button class="btn text yp-danger" type="button" data-e="delete">이 행사 지우기</button></div>` : '');
}

function dateWarnHTML() {
  if (!isDate(ev.date)) return '';
  const ctx = calCtx(), issues = dayIssues(ev.date, ctx);
  if (!issues.length) return '';
  return `<div class="banner warn" id="evDateWarn"><span class="grow"><b>${esc(issues.join(' · '))}</b><br>가까운 가능한 날:
    ${suggestDates(ev.date, ctx).map(d => `<button class="btn tonal" type="button" data-suggest="${d}">${fmtDay(d)}</button>`).join(' ')}</span></div>`;
}

function step1() {
  const f = (id, k, label, { req, ph, type } = {}) => `<label class="yp-f"><span class="lab">${label}${req ? ' <b class="req" aria-hidden="true">*</b>' : ''}</span>
    <input class="field" id="${id}" data-ek="${k}" ${type ? `type="${type}"` : ''} value="${esc(ev[k])}" placeholder="${esc(ph || '')}" autocomplete="off"></label>`;
  return `<div class="yp-card">
      <h3>행사</h3>
      <div class="seg ev-kinds" role="radiogroup" aria-label="행사 종류">${KINDS.map(([id, label]) => `<button type="button" role="radio" data-kind="${id}" aria-pressed="${ev.kind === id}" aria-checked="${ev.kind === id}">${label}</button>`).join('')}</div>
      <div class="yp-fields">
        ${f('evName', 'name', '행사명', { req: true, ph: '예) 가을 운동회' })}
        ${f('evGrades', 'grades', '대상', { req: true, ph: '예) 전교생, 3~4학년' })}
        <label class="yp-f wide"><span class="lab">목적</span><textarea class="field" id="evPurpose" data-ek="purpose" rows="2" placeholder="예) 협동심과 체력 기르기">${esc(ev.purpose)}</textarea></label>
        ${f('evDate', 'date', '날짜', { req: true, type: 'date' })}
        ${f('evPlace', 'place', '장소', { req: true, ph: '예) 운동장' })}
        <div class="yp-f"><span class="lab">실내·야외</span><div class="seg" role="radiogroup" aria-label="실내·야외">
          <button type="button" role="radio" data-outdoor="0" aria-pressed="${!ev.outdoor}" aria-checked="${!ev.outdoor}">실내</button>
          <button type="button" role="radio" data-outdoor="1" aria-pressed="${ev.outdoor}" aria-checked="${ev.outdoor}">야외</button></div></div>
        ${f('evBudget', 'budget', '예산', { ph: '예) 150만 원' })}
      </div>
      <div id="evDateBox">${dateWarnHTML()}</div>
    </div>
    <div class="yp-card">
      <h3>참여 교직원 <span class="muted">(선택 · 이름과 맡은 업무만)</span></h3>
      <div class="ev-staff" id="evStaff">${ev.staff.map((s, i) => `<div class="ev-staff-row">
        <input class="field" data-staff="${i}" data-f="name" value="${esc(s.name)}" placeholder="이름" aria-label="${i + 1}번째 교직원 이름" autocomplete="off">
        <input class="field" data-staff="${i}" data-f="duty" value="${esc(s.duty)}" placeholder="맡은 업무(예: 체육부)" aria-label="${i + 1}번째 교직원 업무" autocomplete="off">
        <button class="icon-btn" type="button" data-staffdel="${i}" aria-label="빼기">×</button></div>`).join('') || '<p class="muted">없으면 역할 분담표를 역할만으로 만들어요.</p>'}</div>
      <div class="row"><button class="btn text" type="button" data-e="staffAdd">+ 교직원 더하기</button></div>
    </div>
    <div class="yp-card">
      <div class="yp-src-h"><h3>작년 설문 결과 <span class="muted">(선택)</span></h3><span class="row"><button class="btn text" type="button" data-e="importMemo">지난 행사 개선 메모 불러오기</button><button class="btn" type="button" data-e="lastFile">파일 넣기</button></span></div>
      ${showMemos ? memosHTML() : ''}
      <p class="muted">있으면 아쉬운 점을 고친 「보완안」도 만들어요. CSV·엑셀·한글 파일이나 붙여넣기.</p>
      <textarea class="field" id="evLast" rows="4" placeholder="작년 설문 결과나 반성 메모" aria-label="작년 설문 결과">${esc(ev.lastSurvey)}</textarea>
    </div>
    ${refsCard()}`;
}

/* ---------- 참고 자료(상위 계획·교육청 공문 등) ---------- */
function refsCard() {
  return `<div class="yp-card" id="evRefs">
    <div class="yp-src-h"><h3>참고 자료 <span class="muted">(선택 · 상위 계획, 교육청 공문 등)</span></h3>
      <span class="row"><button class="btn text" type="button" data-e="refPlan">연간계획에서 불러오기</button><button class="btn text" type="button" data-e="refPaste">붙여넣기</button><button class="btn" type="button" data-e="refFile">파일 넣기</button></span></div>
    ${showPlans ? plansHTML() : ''}
    <p class="muted">AI가 구성안과 문서를 만들 때 참고해요. 공문의 날짜·대상·필수 활동·안전 기준 같은 요구 사항을 지키게 해요. 원본 파일은 저장하지 않고 읽은 글만 저장해요.</p>
    ${ev.refs.length ? `<ul class="ev-refs">${ev.refs.map(r => `<li data-ref="${esc(r.id)}">
      <select class="field" data-refkind="${esc(r.id)}" aria-label="「${esc(r.name)}」 종류">${REF_KINDS.map(([k, l]) => `<option value="${k}"${r.kind === k ? ' selected' : ''}>${l}</option>`).join('')}</select>
      <b>${esc(r.name)}</b><span class="muted">${r.text.length.toLocaleString('ko-KR')}자</span><span class="grow"></span>
      <button class="btn text" type="button" data-e="refView" data-id="${esc(r.id)}">보기·고치기</button><button class="btn text" type="button" data-e="refDel" data-id="${esc(r.id)}">빼기</button></li>`).join('')}</ul>` : '<p class="muted">아직 없어요.</p>'}
  </div>`;
}
function plansHTML() {
  const list = listPlans();
  return `<div class="yp-prev" id="evPlans">${list.length ? list.map(p => `<button class="btn" type="button" data-refplan="${esc(p.id)}">${p.year}학년도 ${esc(p.name || '이름 없는 계획')}</button>`).join('')
    : '<span class="muted">저장한 연간계획이 없어요.</span>'}</div>`;
}
const refTotal = x => x.refs.reduce((n, r) => n + r.text.length, 0);
/* 참고 자료를 그 행사(id)에 더함 — 파일을 읽는 동안 다른 행사로 가도 섞이지 않게 */
/* 참고 자료를 바꾸면: 지난 「반영한 것」은 다시 만들기 전까지 옛 자료 기준이라 표시 */
const refsChanged = x => { if (x.refNotes.options.length || x.refNotes.docs.length) x.refNotes = { ...x.refNotes, stale: true }; };
function addRef(id, ref) {
  if (!String(ref.text || '').trim()) { toast(`「${ref.name}」에는 글이 없어 넣지 않았어요`, 5000); return; }
  const add = x => {
    const before = refTotal(x) + ref.text.length;
    x.refs = normRefs([...x.refs, { ...ref, id: 'ref' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) }]);
    if (refTotal(x) < before) toast('참고 자료는 모두 합쳐 6만 자까지만 저장해요', 5000);
    refsChanged(x);
    if (x.status === 'final') { x.status = 'draft'; removeEvents('event:' + x.id); }
  };
  if (ev.id === id) { add(ev); persist(); if (visible() && ev.step === 1) renderMain(); }
  else apply(id, add);
}
function refSheet(r) {
  const S = window.SSAM;
  if (!S || !S.openSheet) return;
  S.openSheet(`<h3>${r ? '참고 자료 보기·고치기' : '참고 자료 붙여넣기'}</h3>
    <div class="row"><select class="field" id="evRefKind" aria-label="종류">${REF_KINDS.map(([k, l]) => `<option value="${k}"${(r ? r.kind : 'official') === k ? ' selected' : ''}>${l}</option>`).join('')}</select>
      <input class="field" id="evRefName" value="${esc(r ? r.name : '')}" placeholder="이름 (예: 도교육청 체육행사 안내)" aria-label="이름"></div>
    <textarea class="field" id="evRefText" rows="10" placeholder="공문·계획의 글을 붙여 넣어 주세요" aria-label="글">${esc(r ? r.text : '')}</textarea>
    <div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-close>취소</button><button class="btn primary" type="button" id="evRefOk">${r ? '저장' : '넣기'}</button></div>`,
  sh => sh.querySelector('#evRefOk').addEventListener('click', () => {
    const kind = sh.querySelector('#evRefKind').value, name = sh.querySelector('#evRefName').value.trim(), text = sh.querySelector('#evRefText').value;
    if (!text.trim()) { toast('글을 넣어 주세요'); return; }
    S.closeSheet();
    if (!r) { addRef(ev.id, { kind, name: name || '붙여 넣은 자료', text }); return; }
    const before = refTotal(ev) - r.text.length + text.length;
    ev.refs = normRefs(ev.refs.map(x => (x.id === r.id ? { ...x, kind, name: name || x.name, text } : x)));
    if (refTotal(ev) < before) toast('참고 자료는 모두 합쳐 6만 자까지만 저장해요. 넘는 뒷부분은 잘랐어요', 5000);
    refsChanged(ev); unconfirm(); persist(); renderMain();
  }));
}
const refNotesHTML = (list, stale) => (list && list.length ? `<div class="banner info ev-refnotes"><span class="grow"><b>참고 자료에서 반영한 것</b>${stale ? '<span class="muted"> · 참고 자료를 바꿨어요. 다시 만들면 바뀐 자료가 반영돼요</span>' : ''}<ul>${list.map(x => `<li>${esc(x)}</li>`).join('')}</ul></span></div>` : '');
const refsPart = e => { const b = refsBlock(e.refs); return b ? `\n참고 자료(상위 계획·교육청 공문 등):\n${b}\n` : ''; };
const refsRule = e => (e.refs.length ? '- 참고 자료의 요구 사항(날짜·대상·필수 활동·안전 기준·제출할 것 등)을 지키고, 반영한 것을 refNotes에 짧게 씀(3~6개). 참고 자료에 없는 사실은 지어내지 않음\n' : '');

function memosHTML() {
  const list = listEventPlans().filter(x => x.id !== ev.id && x.survey && x.survey.nextMemo.trim())
    .sort((a, b) => (b.kind === ev.kind) - (a.kind === ev.kind));
  return `<div class="yp-prev" id="evMemos">${list.length ? list.map(x => `<button class="btn" type="button" data-memo="${esc(x.id)}">${esc(x.name)} (${esc(kindName(x.kind))}${x.date ? ' · ' + x.date.slice(0, 4) : ''})</button>`).join('')
    : '<span class="muted">내년 개선 메모가 있는 지난 행사가 없어요.</span>'}</div>`;
}

function step2() {
  if (busy[ev.id] === 'options') return `<div class="yp-card"><p class="muted"><span class="spin"></span> 구성안을 만들고 있어요…</p></div>`;
  if (!ev.options || !ev.options.length) return `<div class="yp-card"><p class="muted">구성안을 아직 만들지 않았어요.</p><div class="row"><button class="btn primary" type="button" data-e="options">구성안 만들기</button></div></div>`;
  const card = (o, i) => {
    const picked = ev.picked === i, sum = o.budget.reduce((s, b) => s + b.amount, 0);
    return `<article class="ev-opt${picked ? ' picked' : ''}" data-opt="${i}">
      <div class="ev-opt-h"><span class="yp-tag ${o.label === '보완안' ? 'ok' : 'new'}">${esc(o.label)}</span>${picked ? '<b class="ev-picked">고른 안</b>' : ''}</div>
      ${o.summary ? `<p class="ev-sum">${esc(o.summary)}</p>` : ''}
      <ol class="ev-tt">${o.timetable.map(t => `<li><span class="num">${esc(t.time)}</span> ${esc(t.activity)}${t.place ? ` <span class="muted">· ${esc(t.place)}</span>` : ''}</li>`).join('')}</ol>
      ${o.pros.length ? `<p class="muted">장점: ${o.pros.map(esc).join(', ')}</p>` : ''}
      ${o.staffNeed ? `<p class="muted">필요 인력: ${esc(o.staffNeed)}</p>` : ''}
      ${o.budget.length ? `<p class="muted">예산: ${o.budget.map(b => `${esc(b.name)} ${won(b.amount)}원`).join(', ')} (합계 ${won(sum)}원)</p>` : ''}
      ${picked ? '' : `<button class="btn" type="button" data-pick="${i}">이 안으로</button>`}
    </article>`;
  };
  const p = ev.picked != null ? ev.options[ev.picked] : null;
  return `${refNotesHTML(ev.refNotes.options, ev.refNotes.stale)}<div class="ev-opts">${ev.options.map(card).join('')}</div>
    ${p ? `<div class="yp-card"><h3>고른 안의 시간표 <span class="muted">(고칠 수 있어요)</span></h3>
      <div class="yp-tbl-wrap"><table class="yp-tbl" id="evTT"><thead><tr><th>시간</th><th>활동</th><th>장소</th><th></th></tr></thead><tbody>${p.timetable.map((t, j) => `<tr>
        <td><input class="field" data-tt="${j}" data-f="time" value="${esc(t.time)}" aria-label="시간"></td>
        <td><input class="field" data-tt="${j}" data-f="activity" value="${esc(t.activity)}" aria-label="활동"></td>
        <td><input class="field" data-tt="${j}" data-f="place" value="${esc(t.place)}" aria-label="장소"></td>
        <td><button class="icon-btn" type="button" data-ttdel="${j}" aria-label="이 줄 빼기">×</button></td></tr>`).join('')}</tbody></table></div>
      <div class="row"><button class="btn text" type="button" data-e="ttAdd">+ 줄 더하기</button></div></div>` : '<p class="muted">하나를 골라 주세요. 고른 안으로 문서를 만들어요.</p>'}
    <div class="row"><button class="btn text" type="button" data-e="options">다시 만들기 (고른 안·고친 시간표는 사라져요)</button></div>`;
}

const hasDocs = e => !!(e.docs.plan.trim() || e.docs.letter.trim() || e.docs.safety.trim() || e.docs.roles.length);
function step3() {
  if (busy[ev.id] === 'docs') return `<div class="yp-card"><p class="muted"><span class="spin"></span> 계획서·역할 분담표·안전 점검표·가정통신문을 쓰고 있어요…</p></div>`;
  if (!hasDocs(ev)) return `<div class="yp-card"><h3>문서 세트</h3><p class="muted">고른 안으로 계획서·역할 분담표·안전 점검표·가정통신문을 만들어요.${ev.outdoor ? ' 야외 행사는 우천 시 대체 일정도 써요.' : ''}</p>
    <div class="row"><button class="btn primary" type="button" data-e="docs">문서 만들기</button></div></div>`;
  const d = ev.docs;
  const tabs = `<div class="seg ev-docs" role="tablist">${DOCS.map(([id, label]) => `<button type="button" role="tab" data-doc="${id}" aria-pressed="${curDoc === id}" aria-selected="${curDoc === id}">${label}</button>`).join('')}</div>`;
  let body = '';
  if (curDoc === 'roles') {
    const over = roleLoad(d.roles);
    body = `<p class="muted">역할은 쉼표로 나눠요. 한 사람에게 평균보다 2개 이상 많으면 표시해요.</p>
      <div class="yp-tbl-wrap"><table class="yp-tbl" id="evRoles"><thead><tr><th>이름</th><th>맡은 역할</th><th></th></tr></thead><tbody>${d.roles.map((r, i) => `<tr data-role="${i}" class="${over.includes(r.name) ? 'ev-over' : ''}">
        <td><input class="field" data-rf="name" data-ri="${i}" value="${esc(r.name)}" aria-label="이름"></td>
        <td><input class="field" data-rf="roles" data-ri="${i}" value="${esc(r.roles.join(', '))}" aria-label="맡은 역할">${over.includes(r.name) ? '<span class="ev-over-t">역할이 많아요</span>' : ''}</td>
        <td><button class="icon-btn" type="button" data-roledel="${i}" aria-label="이 줄 빼기">×</button></td></tr>`).join('')}</tbody></table></div>
      <div class="row"><button class="btn text" type="button" data-e="roleAdd">+ 줄 더하기</button></div>`;
  } else {
    body = `<textarea class="field ev-doc${hasOpen(ev, curDoc) ? ' rv-mark' : ''}" data-docf="${curDoc}" rows="14" aria-label="${DOCS.find(x => x[0] === curDoc)[1]}">${esc(d[curDoc])}</textarea>`;
    if (curDoc === 'safety') body += `<label class="yp-f"><span class="lab">우천 시 대체 일정${ev.outdoor ? ' <b class="req" aria-hidden="true">*</b> <span class="muted">(야외 행사는 있어야 확정할 수 있어요)</span>' : ''}</span>
      <textarea class="field${hasOpen(ev, 'rain') ? ' rv-mark' : ''}" id="evRain" rows="3" placeholder="예) 비가 오면 강당에서 학년별로 나누어 운영">${esc(d.rain)}</textarea></label>`;
    if (curDoc === 'letter') {
      const miss = letterMissing(d.letter);
      body += `<div id="evLetterBox">${letterBoxHTML(miss)}</div><div class="ev-qr" id="evLetterQr">${letterQrHTML()}</div>`;
    }
  }
  return `${refNotesHTML(ev.refNotes.docs, ev.refNotes.stale)}<div id="evRvBox">${rvBox()}</div><div class="yp-card">${tabs}${body}
      <div class="row yp-out"><button class="btn" type="button" data-e="copyDoc">복사</button>${exportButton('data-e="hwpx"')}<span class="grow"></span>
        <button class="btn text" type="button" data-e="docs">다시 만들기 (고친 내용은 사라져요)</button></div></div>
    <div class="yp-card"><h3>품의로 이어 가기</h3><p class="muted">품의 › 새 품의로 넘어가며 행사 정보와 고른 안의 예산 줄을 채워요.</p>
      <div class="row"><button class="btn" type="button" data-e="purchase">품의로 이어 가기</button></div></div>`;
}
function letterBoxHTML(miss) {
  return (miss.length ? `<p class="banner warn" id="evLetterMissing"><span class="grow">가정통신문에 빠진 항목: <b>${miss.join('·')}</b></span></p>` : '')
    + `<div class="row"><button class="btn primary" type="button" data-e="letterDone" ${miss.length ? 'disabled' : ''}>${ev.docs.done ? '완성했어요' : '완성'}</button></div>`;
}

function step4() {
  const sv = survey(), blockers = confirmBlockers(ev), fin = ev.status === 'final', bz = busy[ev.id];
  const confirmCard = `<div class="yp-card"><h3>확정</h3>
      <p class="muted">확정하면 행사 날짜를 학사일정에 넣어요. 가정통신문에는 아래 설문 QR 자리를 넣을 수 있어요.</p>
      ${blockers.length ? `<div class="banner warn"><span class="grow">확정하려면 채워 주세요:<ul id="evBlockers" class="yp-ul">${blockers.map(b => `<li>${esc(b)}</li>`).join('')}</ul></span></div>` : ''}
      ${fin ? '<p class="banner ok"><span class="grow">확정한 행사예요. 문서를 고치면 다시 「작성 중」이 돼요.</span></p>' : ''}
      <div class="row"><button class="btn primary" type="button" data-e="final">${fin ? '다시 확정' : '확정'}</button></div></div>`;
  const qrCard = `<div class="yp-card"><h3>폼 링크와 QR</h3>
      <label class="yp-f"><span class="lab">구글 폼 링크</span><input class="field" id="evForm" type="url" value="${esc(sv.formUrl)}" placeholder="https://forms.gle/…" autocomplete="off"></label>
      <div class="ev-qr" id="evQr">${qrHTML()}</div></div>`;
  return confirmCard + itemsCardHTML() + qrCard + resultCardHTML();
}
function itemsCardHTML() {
  const sv = survey(), bz = busy[ev.id];
  const items = sv.items.length ? `<ol class="ev-items" id="evItems">${sv.items.map(it => `<li>${esc(it.q)} <span class="yp-tag ${it.type === 'scale' ? 'new' : 'ok'}">${it.type === 'scale' ? '5점 척도' : '서술형'}</span></li>`).join('')}</ol>` : '';
  return `<div class="yp-card" id="evItemsCard"><h3>만족도 설문 문항</h3>
      <div class="seg" role="radiogroup" aria-label="설문 대상">${TARGETS.map(([id, l]) => `<button type="button" role="radio" data-target="${id}" aria-pressed="${sv.target === id}" aria-checked="${sv.target === id}">${l}</button>`).join('')}</div>
      ${bz === 'items' ? '<p class="muted"><span class="spin"></span> 문항을 만들고 있어요…</p>' : items}
      <div class="row yp-out"><button class="btn${sv.items.length ? '' : ' primary'}" type="button" data-e="items">${sv.items.length ? '문항 다시 만들기' : '문항 만들기'}</button>
        ${sv.items.length ? '<button class="btn" type="button" data-e="formCopy">구글 폼용 복사</button>' : ''}</div>
      <p class="muted">구글 폼에서 새 설문을 만들고 복사한 문항을 붙여넣은 뒤, 보내기 링크를 아래에 넣으면 QR을 만들어요.</p></div>`;
}
function resultCardHTML() {
  const sv = survey(), bz = busy[ev.id], r = sv.result;
  return `<div class="yp-card" id="evResultCard"><h3>설문 결과</h3>
      <p class="muted">구글 폼 응답을 CSV로 내려받아 올리면 문항별 결과·서술형 요약·결과 보고서 초안·내년 개선 메모를 만들어요.</p>
      <div class="row"><button class="btn" type="button" data-e="csv">응답 CSV 올리기</button></div>
      ${bz === 'result' ? '<p class="muted"><span class="spin"></span> 결과 보고서를 쓰고 있어요…</p>' : ''}
      ${r ? resultHTML(r) : ''}
      ${r && bz !== 'result' ? `<label class="yp-f"><span class="lab">결과 보고서</span><textarea class="field ev-doc" id="evReport" rows="12">${esc(sv.report)}</textarea></label>
        <div class="row yp-out"><button class="btn" type="button" data-e="reportCopy">복사</button>${exportButton('data-e="reportHwpx"')}</div>
        <label class="yp-f"><span class="lab">내년 개선 메모 <span class="muted">(다음 해 같은 종류 행사의 「작년 설문 결과」로 불러올 수 있어요)</span></span><textarea class="field" id="evNext" rows="4">${esc(sv.nextMemo)}</textarea></label>` : ''}
      <input type="file" id="evCsv" accept=".csv,.xlsx" hidden></div>`;
}
function qrHTML() {
  const url = survey().formUrl.trim();
  if (!url) return '';
  if (!qrCache[url]) { makeQr(url); return '<p class="muted"><span class="spin"></span> QR을 만드는 중…</p>'; }
  if (qrCache[url] === 'error') return '<p class="banner err"><span class="grow">링크가 너무 길어 QR을 만들지 못했어요. 구글 폼의 「URL 단축」을 켜고 복사해 주세요.</span></p>';
  return `<img src="${qrCache[url]}" alt="설문 QR: ${esc(url)}" width="180" height="180">
    <div class="row yp-out"><button class="btn" type="button" data-e="qrDown">QR 내려받기</button><button class="btn" type="button" data-e="qrLetter">가정통신문에 넣기</button></div>`;
}
/* 가정통신문 탭의 QR 미리보기 (한글 파일에는 링크 글만 들어감) */
function letterQrHTML() {
  const url = survey().formUrl.trim();
  if (!url) return '';
  if (!qrCache[url]) { makeQr(url); return ''; }
  if (qrCache[url] === 'error') return '';
  return `<img src="${qrCache[url]}" alt="설문 QR: ${esc(url)}" width="120" height="120"><span class="muted">설문 QR 미리보기 · 한글 파일에는 링크 글만 들어가요. QR 그림은 4단계에서 내려받아 붙여 주세요.</span>`;
}
async function makeQr(url) {
  try {
    const blob = await qrPng(url, 8);
    qrCache[url] = await new Promise(ok => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(blob); });
  } catch (e) { qrCache[url] = 'error'; }
  if (!box || survey().formUrl.trim() !== url) return;
  const q = box.querySelector('#evQr'); if (q) q.innerHTML = qrHTML();
  const lq = box.querySelector('#evLetterQr'); if (lq) lq.innerHTML = letterQrHTML();
}
function resultHTML(r) {
  const qs = r.questions.map(q => q.type === 'scale'
    ? `<div class="ev-q"><b>${esc(q.q)}</b> <span class="muted">평균 ${q.mean}점</span>
        <div class="ev-bars">${q.counts.map((c, i) => `<div class="ev-bar-row"><span class="ev-bar-l">${i + 1}</span><span class="ev-bar" style="width:${r.n ? Math.round((c / r.n) * 100) : 0}%"></span><span class="ev-bar-n">${c}</span></div>`).join('')}</div></div>`
    : `<div class="ev-q"><b>${esc(q.q)}</b> <span class="muted">서술형 ${q.count ?? q.answers.length}개</span>
        <ul class="yp-ul">${q.answers.slice(0, 5).map(a => `<li>${esc(a)}</li>`).join('')}${(q.count ?? q.answers.length) > 5 ? `<li class="muted">외 ${(q.count ?? q.answers.length) - 5}개</li>` : ''}</ul></div>`).join('');
  const ex = (r.excluded || []).length ? `<p class="hint">개인정보로 보이는 열은 빼고 읽었어요: ${esc(r.excluded.join(', '))}</p>` : '';
  return `<div id="evResult" class="ev-result"><p><b>응답 ${r.n}명</b>${r.few ? ` · <span class="ev-few">${FEW(r.n)}</span>` : ''}</p>${ex}${qs}
    ${survey().textSummary ? `<p class="ev-sumtext"><b>서술형 요약</b><br>${esc(survey().textSummary)}</p>` : ''}</div>`;
}

/* ---------- AI: 설문 문항·결과 ---------- */
function itemsPrompt(e) {
  const target = TARGETS.find(t => t[0] === survey().target)[1];
  return `[설문 문항]\n학교 행사 만족도 설문 문항을 만들어 주세요.\n\n행사: ${e.name} (${kindName(e.kind)})\n목적: ${e.purpose || '(없음)'}\n대상 학년: ${e.grades}\n설문 대상: ${target}\n`
    + '\n규칙:\n- 5점 척도 문항 4~6개(type "scale") + 서술형 1~2개(type "text")\n'
    + (survey().target === 'student' ? '- 학생이 읽기 쉬운 짧은 말로\n' : '') + '- 한 문항에 하나만 묻기\n\n'
    + '답은 JSON 하나만: {"items":[{"type":"scale","q":"…"},{"type":"text","q":"…"}]}';
}
async function runItems() {
  const id = ev.id;
  if (busy[id]) return;
  if (!ai.ready()) { errs[id] = '문항을 만들 AI를 먼저 정해 주세요. 왼쪽 아래 AI에서 정할 수 있어요.'; renderMain(); return; }
  busy[id] = 'items'; delete errs[id];
  renderMain();
  try {
    const v = await ai.generateJSON(itemsPrompt(ev), { task: 'plan', valid: x => x && normItems(x.items).length >= 3 });
    apply(id, e => { e.survey = { ...blankSurvey(), ...(e.survey || {}), items: normItems(v.items) }; });
  } catch (err) { errs[id] = ai.errorMessage(err && err.code, err); }
  finish(id, 'items');
}
function resultPrompt(e, r) {
  let budget = 200;
  const lines = r.questions.map(q => {
    if (q.type === 'scale') return `- ${q.q}: 평균 ${q.mean}점 (1점 ${q.counts[0]}명, 2점 ${q.counts[1]}명, 3점 ${q.counts[2]}명, 4점 ${q.counts[3]}명, 5점 ${q.counts[4]}명)`;
    const a = q.answers.slice(0, Math.max(0, budget)); budget -= a.length;
    return `- ${q.q} (서술형 ${q.answers.length}개):\n${a.map(x => '  · ' + x.replace(/\s+/g, ' ').slice(0, 200)).join('\n')}`;
  }).join('\n');
  return `[설문 결과]\n학교 행사 만족도 설문 결과로 보고서를 써 주세요.\n\n행사: ${e.name} (${kindName(e.kind)}), ${e.date}, ${e.place}\n응답: ${r.n}명\n\n문항별 결과:\n${lines}\n\n`
    + '규칙:\n- textSummary: 서술형 답 요약 3~5줄\n- report: 결과 보고서 초안(개요 · 참여 현황 · 문항별 결과 · 서술형 요약 · 잘된 점과 개선할 점), 학교 보고서 문체\n'
    + '- nextMemo: 내년에 고칠 점 3~5줄(「- 」 목록)\n- 결과에 없는 숫자는 지어내지 않음\n\n'
    + '답은 JSON 하나만: {"textSummary":"…","report":"…","nextMemo":"…"}';
}
async function addCsv(file) {
  const id = ev.id;
  let r;
  try { r = summarize(await readTable(file.name, new Uint8Array(await file.arrayBuffer()))); }
  catch (err) { toast('CSV를 읽지 못했어요. 구글 폼 응답의 「CSV 다운로드」 파일인지 확인해 주세요.', 6000); return; }
  if (!r.n || !r.questions.length) { toast('응답을 찾지 못했어요. 첫 줄이 문항 제목인 CSV인지 확인해 주세요.', 6000); return; }
  apply(id, e => { e.survey = { ...blankSurvey(), ...(e.survey || {}), result: r, textSummary: '', report: r.few ? FEW(r.n) : '', nextMemo: '' }; });
  if (r.excluded.length) toast(`개인정보로 보이는 열 ${r.excluded.length}개(${r.excluded.join(', ')})는 빼고 읽었어요. 저장하지도 AI로 보내지도 않아요.`, 7000);
  if (ev.id === id && visible()) renderMain();
  const target = getEvent(id); // 그사이 다른 행사로 갔어도 프롬프트는 이 행사
  if (!target) return;
  if (!ai.ready()) { errs[id] = '보고서를 쓸 AI를 정하면 결과 보고서 초안도 만들어요. 왼쪽 아래 AI에서 정할 수 있어요.'; if (visible()) renderMain(); return; }
  busy[id] = 'result'; delete errs[id];
  if (visible() && ev.id === id) renderMain();
  try {
    const v = await ai.generateJSON(resultPrompt(target, r), { valid: x => x && typeof x.report === 'string' });
    const t = x => (Array.isArray(x) ? x.filter(y => typeof y === 'string').join('\n') : typeof x === 'string' ? x : '');
    apply(id, e => { e.survey = { ...e.survey, textSummary: t(v.textSummary), report: (r.few ? FEW(r.n) + '\n\n' : '') + t(v.report), nextMemo: t(v.nextMemo) }; });
  } catch (err) { errs[id] = ai.errorMessage(err && err.code, err); }
  finish(id, 'result');
}
function confirmEvent() {
  const bl = confirmBlockers(ev);
  if (bl.length) { renderMain(); toast('확정하려면 빠진 것을 채워 주세요'); return; }
  ev.status = 'final';
  persist();
  setEvents('event:' + ev.id, isDate(ev.date) ? [{ date: ev.date, title: ev.name }] : []);
  renderList(); renderMain();
  toast('확정했어요. 학사일정에 행사 날짜를 넣었어요');
}

/* ---------- AI: 문서 세트 ---------- */
function docsPrompt(e) {
  const o = picked();
  const s = getSchool();
  return `[행사 문서]\n학교 행사 문서를 써 주세요: 계획서, 역할 분담표, 안전 점검표, 가정통신문${e.outdoor ? ', 우천 시 대체 일정' : ''}.\n\n`
    + `종류: ${kindName(e.kind)}\n행사명: ${e.name}\n목적: ${e.purpose || '(없음)'}\n대상: ${e.grades}\n날짜: ${e.date}\n장소: ${e.place} (${e.outdoor ? '야외' : '실내'})\n예산: ${e.budget || '(정하지 않음)'}\n학교: ${s.name || '(학교명 없음)'}\n`
    + (o ? `\n고른 구성안(${o.label}): ${o.summary}\n시간표:\n${o.timetable.map(t => `- ${t.time} ${t.activity}${t.place ? ' (' + t.place + ')' : ''}`).join('\n')}\n필요 인력: ${o.staffNeed || '-'}\n예산 내역: ${o.budget.map(b => `${b.name} ${b.amount}원`).join(', ') || '-'}\n` : '')
    + refsPart(e)
    + (e.staff.length ? `\n참여 교직원(이 이름만 쓰세요):\n${e.staff.filter(x => x.name.trim()).map(x => `- ${x.name}${x.duty ? ' (' + x.duty + ')' : ''}`).join('\n')}\n` : '\n참여 교직원 명단이 없어요. 역할 분담표의 name에는 「진행 담당」처럼 역할 이름을 쓰세요.\n')
    + '\n규칙:\n- plan: 학교 계획서 문체(「가.」「1)」 목록), 개요·운영 방침·세부 운영·안전 대책·평가 순\n'
    + '- roles: [{"name":"…","roles":["…"]}] 사람마다 고르게 나눔\n- safety: 「- 」로 시작하는 점검 항목 목록\n'
    + '- letter: 학부모가 읽기 쉬운 말로. 날짜(일시)·준비물·복장·문의처(학교 교무실 전화)를 꼭 넣음\n'
    + (e.outdoor ? '- rain: 비가 오면 어떻게 할지(장소·시간 바꾸기) 두세 줄\n' : '- rain: 빈 글\n')
    + refsRule(e)
    + '- 메모에 없는 사실은 지어내지 않음\n\n답은 JSON 하나만: {"plan":"…","roles":[…],"safety":"…","letter":"…","rain":"…"' + (e.refs.length ? ',"refNotes":["…"]' : '') + '}';
}
async function runDocs() {
  const id = ev.id;
  if (busy[id]) return;
  if (!ai.ready()) { errs[id] = '문서를 쓸 AI를 먼저 정해 주세요. 왼쪽 아래 AI에서 정할 수 있어요.'; renderMain(); return; }
  busy[id] = 'docs'; delete errs[id];
  renderMain();
  try {
    const v = await ai.generateJSON(docsPrompt(ev), { task: 'plan', valid: x => x && !Array.isArray(x) && typeof x === 'object' && (typeof x.letter === 'string' || typeof x.plan === 'string') });
    const t = x => (Array.isArray(x) ? x.filter(y => typeof y === 'string').join('\n') : typeof x === 'string' ? x : '');
    apply(id, e => { e.docs = { plan: t(v.plan), safety: t(v.safety), letter: t(v.letter), rain: t(v.rain), roles: normRoles(v.roles, e.staff.filter(x => x.name.trim())), done: false }; e.rv = []; e.refNotes = { ...e.refNotes, docs: normRefNotes(v.refNotes), stale: false }; if (e.status === 'final') e.status = 'draft'; });
    clearState(id);
    finish(id, 'docs');
    reviewDocs(id);
    return;
  } catch (err) { errs[id] = ai.errorMessage(err && err.code, err); }
  finish(id, 'docs');
}
/* 검토 AI: 계획서·안전 점검표·가정통신문(·우천 시 대체 일정)을 한 번 봄 */
const DOC_LABEL = { ...Object.fromEntries(DOCS), rain: '우천 시 대체 일정' };
function reviewDocs(id) {
  const e = getEvent(id);
  if (!e) return;
  const keys = ['plan', 'safety', 'letter', ...(e.outdoor ? ['rain'] : [])];
  runPlanReview(id, {
    title: `${e.name || '행사'} (${kindName(e.kind)}, ${e.date || '날짜 미정'}, ${e.place || '장소 미정'})`,
    sections: keys.map(k => ({ key: k, label: DOC_LABEL[k], text: e.docs[k] })),
    guide: '',
    current: () => { flushSave(); const x = getEvent(id); return x && x.docs; },
    save: items => apply(id, x => { x.rv = items; }),
    update: () => updateRv(id)
  });
}
const rvBox = () => rvBoxHTML(ev, { text: k => ev.docs[k] || '', label: k => DOC_LABEL[k] || k });
function updateRv(id) {
  if (!visible() || ev.id !== id || ev.step !== 3) return;
  const b = box.querySelector('#evRvBox');
  if (b) b.innerHTML = rvBox();
  box.querySelectorAll('textarea[data-docf]').forEach(t => t.classList.toggle('rv-mark', hasOpen(ev, t.dataset.docf)));
  const r = box.querySelector('#evRain'); if (r) r.classList.toggle('rv-mark', hasOpen(ev, 'rain'));
}

async function downloadDoc() {
  const doc = docDoc(ev, curDoc);
  try { toast(await exportDoc(doc, doc.title), 6000); }
  catch (err) { toast('파일을 저장하지 못했어요'); }
}
async function downloadReport() {
  const sv = survey(), r = sv.result;
  const blocks = [{ type: 'p', text: sv.report }];
  if (r) blocks.push({ type: 'h', text: '문항별 결과' }, { type: 'table', head: true, rows: [['문항', '평균', '응답'], ...r.questions.filter(q => q.type === 'scale').map(q => [q.q, String(q.mean), String(q.counts.reduce((a, b) => a + b, 0))])] });
  try { toast(await exportDoc({ title: `${ev.name} 결과 보고서`, blocks }, `${ev.name || '행사'} 결과 보고서`), 6000); }
  catch (err) { toast('파일을 저장하지 못했어요'); }
}
function toPurchase() {
  const o = picked();
  openPurchase({
    project: ev.name, purpose: ev.purpose, date: ev.date, target: ev.grades, place: ev.place,
    memo: ev.budget ? `행사 예산: ${ev.budget}` : '',
    items: o && o.budget.length ? o.budget.map(b => ({ name: b.name, spec: '', qty: '1', price: String(b.amount) })) : undefined
  });
}

/* ---------- AI: 구성안 ---------- */
function optionsPrompt(e) {
  const s = getSchool();
  const hasLast = !!e.lastSurvey.trim();
  return `[행사 구성안]\n학교 행사 계획을 돕는 도우미예요. 아래 행사의 구성안을 ${hasLast ? '3' : '2'}개 만들어 주세요.\n\n`
    + `종류: ${kindName(e.kind)}\n행사명: ${e.name}\n목적: ${e.purpose || '(없음)'}\n대상: ${e.grades}\n날짜: ${e.date}\n장소: ${e.place} (${e.outdoor ? '야외' : '실내'})\n예산: ${e.budget || '(정하지 않음)'}\n`
    + `학교: ${s.name || '(학교명 없음)'}, 학급 ${s.classes || '-'}개, 학생 ${s.students || '-'}명\n`
    + (e.staff.length ? `참여 교직원 ${e.staff.length}명\n` : '')
    + (hasLast ? `\n작년 설문 결과:\n"""\n${e.lastSurvey.slice(0, 8000)}\n"""\n` : '')
    + refsPart(e)
    + '\n규칙:\n'
    + (hasLast ? '- 첫 안은 label "보완안": 작년 설문의 아쉬운 점을 고친 안. 나머지는 label "새로운 안": 새 활동을 넣은 안\n' : '- 작년 자료가 없으니 보완안은 만들지 마세요. 모두 label "새로운 안"\n')
    + '- summary: 한 줄 소개\n- timetable: 6~12줄, [{"time":"09:00","activity":"…","place":"…"}]\n- pros: 장점 2~3개\n- staffNeed: 필요 인력 한 줄\n'
    + '- budget: [{"name":"…","amount":0}] (원, 숫자. 예산이 있으면 그 안으로)\n- 안전을 먼저 생각하고, 메모에 없는 사실은 지어내지 않음\n'
    + refsRule(e) + '\n'
    + '답은 JSON 하나만: {"options":[{"label":"…","summary":"…","timetable":[…],"pros":["…"],"staffNeed":"…","budget":[…]}]' + (e.refs.length ? ',"refNotes":["…"]' : '') + '}';
}
async function runOptions() {
  const id = ev.id;
  if (busy[id]) return;
  if (!ai.ready()) { errs[id] = '구성안을 만들 AI를 먼저 정해 주세요. 왼쪽 아래 AI에서 정할 수 있어요.'; renderMain(); return; }
  busy[id] = 'options'; delete errs[id];
  renderMain();
  try {
    const v = await ai.generateJSON(optionsPrompt(ev), { task: 'plan', valid: x => x && normOptions(x.options).length > 0 });
    apply(id, e => { e.options = normOptions(v.options); e.picked = null; e.refNotes = { ...e.refNotes, options: normRefNotes(v.refNotes), stale: false }; });
  } catch (err) { errs[id] = ai.errorMessage(err && err.code, err); }
  finish(id, 'options');
}

/* ---------- 단계 이동 ---------- */
function goStep(n) {
  ev.step = n;
  ev.maxStep = Math.max(ev.maxStep, n);
  persist();
  renderMain();
  if (n === 2 && !ev.options) runOptions();
}
function next() {
  if (ev.step === 1) {
    const need = [['evName', 'name'], ['evGrades', 'grades'], ['evDate', 'date'], ['evPlace', 'place']];
    box.querySelectorAll('.field.bad').forEach(el => el.classList.remove('bad'));
    const bad = need.filter(([, k]) => k === 'date' ? !isDate(ev.date) : !String(ev[k]).trim());
    bad.forEach(([id]) => box.querySelector('#' + id).classList.add('bad'));
    if (bad.length) { box.querySelector('.field.bad').focus(); return; }
  }
  if (ev.step === 2 && ev.picked == null) { toast('구성안 하나를 골라 주세요'); return; }
  goStep(Math.min(4, ev.step + 1));
}

function picked() { return ev.options && ev.picked != null ? ev.options[ev.picked] : null; }

function askDelete() {
  const id = ev.id, S = window.SSAM;
  if (!S || !S.openSheet) return;
  S.openSheet(`<h3>「${esc(ev.name || '이름 없는 행사')}」 지우기</h3>
    <p class="muted" style="margin:0">구성안·문서·설문 결과가 모두 지워지고, 학사일정에 넣은 행사 날짜도 빠져요. 되돌릴 수 없어요.</p>
    <div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-close>그만두기</button><button class="btn primary" type="button" data-e="deleteYes">지우기</button></div>`,
  sh => sh.querySelector('[data-e="deleteYes"]').addEventListener('click', () => {
    deleteEvent(id); removeEvents('event:' + id);
    S.closeSheet();
    ev = listEventPlans()[0] || newEvent(); saved = !!getEvent(ev.id);
    if (saved) setCurrentEvent(ev.id);
    render(); toast('지웠어요');
  }));
}

/* ---------- 입력·누르기 ---------- */
document.addEventListener('input', e => {
  if (!box || !box.contains(e.target) || curTab !== 'event') return;
  const el = e.target;
  if (el.dataset.ek && el.type !== 'date') { ev[el.dataset.ek] = el.value; if (el.value.trim()) el.classList.remove('bad'); unconfirm(); }
  else if (el.id === 'evLast') { if (el.value.length > MAX_SRC) { el.value = cap(el.value); toast('앞 6만 자만 저장해요', 4000); } ev.lastSurvey = el.value; }
  else if (el.dataset.staff != null) { const s = ev.staff[+el.dataset.staff]; if (s) s[el.dataset.f] = el.value; }
  else if (el.dataset.tt != null) { const t = picked() && picked().timetable[+el.dataset.tt]; if (t) t[el.dataset.f] = el.value; }
  else if (el.dataset.docf) {
    ev.docs[el.dataset.docf] = el.value;
    // 손으로 고친 문서의 검토 의견은 사라짐
    if (hasOpen(ev, el.dataset.docf)) { ev.rv = dropOpen(ev.rv, el.dataset.docf); updateRv(ev.id); }
    if (el.dataset.docf === 'letter') { ev.docs.done = false; const b = box.querySelector('#evLetterBox'); if (b) b.innerHTML = letterBoxHTML(letterMissing(el.value)); }
  } else if (el.id === 'evRain') { ev.docs.rain = el.value; if (hasOpen(ev, 'rain')) { ev.rv = dropOpen(ev.rv, 'rain'); updateRv(ev.id); } }
  else if (el.id === 'evForm') { survey().formUrl = el.value; const q = box.querySelector('#evQr'); if (q) q.innerHTML = qrHTML(); }
  else if (el.id === 'evReport') survey().report = el.value;
  else if (el.id === 'evNext') survey().nextMemo = el.value;
  else if (el.dataset.rf) {
    const r = ev.docs.roles[+el.dataset.ri]; if (!r) return;
    if (el.dataset.rf === 'roles') r.roles = el.value.split(/[,，]/).map(x => x.trim()).filter(Boolean); else r.name = el.value;
    // 과부하 표시만 고침 (입력 칸은 그대로)
    const over = roleLoad(ev.docs.roles);
    box.querySelectorAll('#evRoles tr[data-role]').forEach(tr => { const x = ev.docs.roles[+tr.dataset.role]; tr.classList.toggle('ev-over', !!x && over.includes(x.name)); });
  } else return;
  if (el.dataset.docf || el.dataset.rf || el.id === 'evRain') unconfirm();
  persistSoon();
});
document.addEventListener('change', e => {
  if (!box || !box.contains(e.target) || curTab !== 'event') return;
  const el = e.target;
  if (el.id === 'evDate') {
    ev.date = el.value; if (isDate(el.value)) el.classList.remove('bad');
    unconfirm();
    persist();
    const b = box.querySelector('#evDateBox'); if (b) b.innerHTML = dateWarnHTML();
  } else if (el.id === 'evCsv') {
    const f = el.files[0]; el.value = '';
    if (f) addCsv(f);
  } else if (el.dataset.refkind) {
    const r = ev.refs.find(x => x.id === el.dataset.refkind);
    if (r) { r.kind = el.value; unconfirm(); persist(); }
  } else if (el.id === 'evRefFile') {
    const files = [...el.files]; el.value = '';
    const id = ev.id;
    if (!saved) persist();
    (async () => {
      for (const f of files) {
        try { addRef(id, { kind: guessKind(f.name), name: f.name, text: await readText(f) }); }
        catch (err) { toast(fileMessage(err && err.code), 5000); }
      }
    })();
  } else if (el.id === 'evFile') {
    const files = [...el.files]; el.value = '';
    // 넣기 시작한 행사(id)에 넣음 — 읽는 동안 다른 행사로 가도 섞이지 않게
    const id = ev.id;
    if (!saved) persist();
    (async () => {
      for (const f of files) {
        try {
          const t = await readText(f);
          const add = x => { x.lastSurvey = cap((x.lastSurvey.trim() ? x.lastSurvey.trim() + '\n\n' : '') + `(파일 「${f.name}」)\n${t}`); };
          if (ev.id === id) { add(ev); persist(); } else apply(id, add);
        } catch (err) { toast(fileMessage(err && err.code), 5000); }
      }
      if (visible() && ev.id === id && ev.step === 1) renderMain();
    })();
  }
});
document.addEventListener('click', e => {
  if (!box || !box.contains(e.target) || curTab !== 'event') return;
  flushSave();
  if (onRvClick(e, box, {
    use: sec => {
      const r = (ev.rv || []).find(x => x.section === sec && !x.done);
      if (!r) return;
      ev.docs = { ...ev.docs, [sec]: r.fix, ...(sec === 'letter' ? { done: false } : {}) }; ev.rv = markDone(ev.rv, sec, 'review'); unconfirm();
      persist(); renderMain();
    },
    keep: sec => { ev.rv = markDone(ev.rv, sec, 'main'); persist(); renderMain(); }
  })) return;
  const item = e.target.closest('[data-ev]');
  if (item) { const x = getEvent(item.dataset.ev); if (x) { ev = x; saved = true; setCurrentEvent(x.id); render(); } return; }
  const st = e.target.closest('[data-step]');
  if (st) { const n = +st.dataset.step; if (n <= ev.maxStep) goStep(n); return; }
  const k = e.target.closest('[data-kind]');
  if (k) { ev.kind = k.dataset.kind; unconfirm(); persist(); box.querySelectorAll('[data-kind]').forEach(b => { const on = b === k; b.setAttribute('aria-pressed', on); b.setAttribute('aria-checked', on); }); return; }
  const od = e.target.closest('[data-outdoor]');
  if (od) { ev.outdoor = od.dataset.outdoor === '1'; unconfirm(); persist(); box.querySelectorAll('[data-outdoor]').forEach(b => { const on = b === od; b.setAttribute('aria-pressed', on); b.setAttribute('aria-checked', on); }); return; }
  const sg = e.target.closest('[data-suggest]');
  if (sg) { ev.date = sg.dataset.suggest; unconfirm(); persist(); const d = box.querySelector('#evDate'); if (d) d.value = ev.date; const b = box.querySelector('#evDateBox'); if (b) b.innerHTML = dateWarnHTML(); return; }
  const sd = e.target.closest('[data-staffdel]');
  if (sd) { ev.staff.splice(+sd.dataset.staffdel, 1); persist(); renderMain(); return; }
  const tg = e.target.closest('[data-target]');
  if (tg) { survey().target = tg.dataset.target; persist(); renderMain(); return; }
  const rp = e.target.closest('[data-refplan]');
  if (rp) {
    const p = listPlans().find(x => x.id === rp.dataset.refplan);
    if (p) { showPlans = false; const title = `${p.year}학년도 ${p.name || '연간계획'}`; addRef(ev.id, { kind: 'upper', name: title, text: planText(p) }); }
    return;
  }
  const mm = e.target.closest('[data-memo]');
  if (mm) {
    const x = getEvent(mm.dataset.memo);
    if (x && x.survey) { ev.lastSurvey = cap((ev.lastSurvey.trim() ? ev.lastSurvey.trim() + '\n\n' : '') + `(지난 행사 「${x.name}」 내년 개선 메모)\n${x.survey.nextMemo}`); showMemos = false; persist(); renderMain(); }
    return;
  }
  const dt = e.target.closest('[data-doc]');
  if (dt) { curDoc = dt.dataset.doc; renderMain(); return; }
  const rd = e.target.closest('[data-roledel]');
  if (rd) { ev.docs.roles.splice(+rd.dataset.roledel, 1); persist(); renderMain(); return; }
  const pk = e.target.closest('[data-pick]');
  if (pk) { ev.picked = +pk.dataset.pick; persist(); renderMain(); return; }
  const td = e.target.closest('[data-ttdel]');
  if (td && picked()) { picked().timetable.splice(+td.dataset.ttdel, 1); persist(); renderMain(); return; }
  const b = e.target.closest('[data-e]');
  if (!b) return;
  const a = b.dataset.e;
  if (a === 'new') { ev = newEvent(); saved = false; showMemos = false; render(); box.querySelector('#evName').focus(); }
  else if (a === 'next') next();
  else if (a === 'prev') goStep(Math.max(1, ev.step - 1));
  else if (a === 'options') { if (ev.options) apply(ev.id, x => { x.options = null; x.picked = null; }); runOptions(); }
  else if (a === 'staffAdd') { ev.staff.push({ name: '', duty: '' }); persist(); renderMain(); const r = box.querySelector(`[data-staff="${ev.staff.length - 1}"][data-f="name"]`); if (r) r.focus(); }
  else if (a === 'ttAdd' && picked()) { picked().timetable.push({ time: '', activity: '', place: '' }); persist(); renderMain(); }
  else if (a === 'lastFile') box.querySelector('#evFile').click();
  else if (a === 'refFile') box.querySelector('#evRefFile').click();
  else if (a === 'refPaste') refSheet(null);
  else if (a === 'refPlan') { showPlans = !showPlans; renderMain(); }
  else if (a === 'refView') { const r = ev.refs.find(x => x.id === b.dataset.id); if (r) refSheet(r); }
  else if (a === 'refDel') { ev.refs = ev.refs.filter(x => x.id !== b.dataset.id); refsChanged(ev); unconfirm(); persist(); renderMain(); }
  else if (a === 'docs') runDocs();
  else if (a === 'roleAdd') { ev.docs.roles.push({ name: '', roles: [] }); persist(); renderMain(); }
  else if (a === 'letterDone') { if (!letterMissing(ev.docs.letter).length) { ev.docs.done = true; persist(); const lb = box.querySelector('#evLetterBox'); if (lb) lb.innerHTML = letterBoxHTML([]); toast('가정통신문을 완성했어요'); } }
  else if (a === 'copyDoc') {
    const text = curDoc === 'roles' ? ['이름\t맡은 역할', ...ev.docs.roles.map(r => `${r.name}\t${r.roles.join(', ')}`)].join('\n') : (ev.docs[curDoc] || '');
    copyText(text).then(ok => toast(ok ? '복사했어요' : '복사하지 못했어요'));
  }
  else if (a === 'hwpx') downloadDoc();
  else if (a === 'purchase') toPurchase();
  else if (a === 'final') confirmEvent();
  else if (a === 'items') runItems();
  else if (a === 'formCopy') copyText(formText(survey().items)).then(ok => toast(ok ? '문항을 복사했어요. 구글 폼에 붙여넣으세요' : '복사하지 못했어요'));
  else if (a === 'qrDown') { const u = qrCache[survey().formUrl.trim()]; if (u && u !== 'error') fetch(u).then(r => r.blob()).then(async b => saveFile(`${ev.name || '행사'} 설문 QR.png`, new Uint8Array(await b.arrayBuffer()), 'image/png')).then(() => toast('QR 그림을 저장했어요')); }
  else if (a === 'qrLetter') {
    const url = survey().formUrl.trim(), line = `설문 참여: ${url} (QR)`;
    if (url && !ev.docs.letter.includes(line)) { ev.docs.letter = ev.docs.letter.trimEnd() + `\n\n${line}`; ev.docs.done = false; persist(); }
    toast('가정통신문 끝에 설문 링크 자리를 넣었어요. QR 그림은 내려받아 붙여 주세요', 6000);
  }
  else if (a === 'csv') box.querySelector('#evCsv').click();
  else if (a === 'reportCopy') copyText(survey().report).then(ok => toast(ok ? '복사했어요' : '복사하지 못했어요'));
  else if (a === 'reportHwpx') downloadReport();
  else if (a === 'importMemo') { showMemos = !showMemos; renderMain(); }
  else if (a === 'delete') askDelete();
});

onEnter('plan', (tab, section) => {
  if (!box || !section.contains(box)) { box = document.createElement('div'); box.className = 'ev-box'; section.append(box); }
  curTab = tab;
  box.hidden = tab !== 'event';
  flushSave();
  if (tab === 'event') { const x = getEvent(ev.id); if (x) ev = x; render(); }
});

/* 떠 있는 버튼: 작년 행사 계획 → 새 행사(행사명은 제목에서, 대상·날짜·장소는 입력 칸) + 참고 자료 → 구성안까지(설정에 따라 자료로만) */
const eventTitle = t => {
  const l = String(t || '').split('\n').map(x => x.trim()).find(Boolean) || '';
  const m = /^(?:\d{4}\s*(?:학년도)?\s*)?(.+?)\s*(?:운영|추진|시행|세부)?\s*계획/.exec(l);
  return m ? m[1].trim().slice(0, 40) : '';
};
const kindOf = name => (/운동회|체육/.test(name) ? 'sports' : /학예회|발표회|축제/.test(name) ? 'arts' : /체험|현장|수련/.test(name) ? 'field' : 'other');
async function refsFrom(id, files, texts) {
  for (const f of files) {
    let text = texts && texts.get(f);
    if (text == null) { try { text = await readText(f); } catch (e) { toast(fileMessage(e && e.code), 5000); continue; } }
    addRef(id, { kind: guessKind(f.name), name: f.name, text });
  }
}
registerInbox('event-plan', {
  act: () => '새 행사계획을 만들어 참고 자료로 넣기',
  fields: (files, ctx) => [
    { key: 'name', label: '행사명', type: 'text', required: true, value: eventTitle(ctx.texts.get(files[0])) },
    { key: 'grades', label: '대상', type: 'text', required: true },
    { key: 'date', label: '날짜', type: 'date', required: true },
    { key: 'place', label: '장소', type: 'text', required: true }],
  async run(files, v, opts) {
    goMenu('plan', 'event');
    flushSave();
    ev = newEvent(); saved = false; showMemos = false; showPlans = false;
    Object.assign(ev, { name: String(v.name || '').trim(), grades: String(v.grades || '').trim(), date: v.date || '', place: String(v.place || '').trim() });
    ev.kind = kindOf(ev.name);
    persist(); render();
    await refsFrom(ev.id, files, opts.texts);
    if (opts.plan !== 'draft' || !isDate(ev.date)) return '새 행사계획에 참고 자료로 넣었어요.';
    if (!ai.ready()) return '새 행사계획에 참고 자료로 넣었어요. AI를 정하면 구성안을 만들어요(왼쪽 아래 AI).';
    ev.step = 2; ev.maxStep = Math.max(ev.maxStep, 2); persist(); renderMain();
    await runOptions();
    return '';
  }
});
/* 떠 있는 버튼: 설문 응답 CSV → 행사 고르기(확정한 행사가 먼저) → 결과 보고서 */
registerInbox('survey', {
  act: files => (files.length > 1 ? `행사 만족도 설문 결과로 넣고 결과 보고서 쓰기 (한 행사에 하나씩: 「${files[0].name}」만)` : '행사 만족도 설문 결과로 넣고 결과 보고서 쓰기'),
  fields: () => {
    const l = listEventPlans();
    if (!l.length) return [];
    const first = l.find(e => e.id === currentEventId()) || l.find(e => e.status === 'final') || l[0];
    return [{ key: 'event', label: '어느 행사의 설문인가요', type: 'select', options: l.map(e => [e.id, `${e.name || '이름 없는 행사'}${e.date ? ` (${e.date})` : ''}`]), value: first.id, required: true, ask: l.length > 1 }];
  },
  async run(files, v) {
    const e = v.event && getEvent(v.event);
    if (!e) return '설문을 넣을 행사가 없어요. 행사계획을 먼저 만들어 주세요.';
    goMenu('plan', 'event');
    flushSave();
    ev = e; saved = true; setCurrentEvent(e.id);
    ev.step = 4; ev.maxStep = Math.max(ev.maxStep, 4); persist(); render();
    await addCsv(files[0]);
    // 한 행사의 설문 결과는 하나라 여러 파일을 차례로 넣으면 앞 결과를 덮음
    return files.length > 1 ? `설문 CSV는 행사마다 하나씩 넣어요. 「${files[0].name}」만 넣었어요. 나머지는 다시 넣어 행사를 골라 주세요.` : '';
  }
});
/* 떠 있는 버튼 › 지침: 지금 행사의 참고 자료로 */
export const eventGuide = {
  key: 'event', label: '행사계획',
  current: () => { const e = getEvent(currentEventId()) || listEventPlans()[0]; return e ? { id: e.id, title: e.name || '이름 없는 행사' } : null; },
  async add(id, files, opts) {
    goMenu('plan', 'event');
    flushSave();
    const e = getEvent(id);
    if (!e) return '그 행사를 찾지 못했어요.';
    ev = e; saved = true; setCurrentEvent(e.id);
    ev.step = 1; render();
    await refsFrom(id, files, opts.texts);
    return '행사계획의 참고 자료로 넣었어요.';
  }
};
