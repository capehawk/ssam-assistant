/* 계획 › 연간계획: 1 자료 넣기 → 2 작년 평가 → 3 지침 점검 → 4 초안 → 5 일정 (PRD 5.3).
   AI 답은 시작할 때의 계획 id에 저장해서, 그사이 다른 계획·메뉴로 가도 섞이지 않음 */
import { onFlush } from '../../core/store.js';
import { onEnter, go as goMenu } from '../../core/shell.js';
import { registerInbox } from '../../core/inbox.js';
import * as ai from '../../core/ai.js';
import { aiRowHTML } from '../../core/ai-roles.js';
import { readText, fileMessage } from '../../core/files.js';
import { getSchool } from '../../core/settings.js';
import { toast, copyText } from '../../core/ui.js';
import { exportButton, exportDoc } from '../../core/doc-export.js';
import { listEvents, setEvents, removeEvents, dayIssues, suggestDates, weekday } from '../../core/calendar.js';
import { stepsHTML } from '../../core/steps.js';
import { rvBoxHTML, runPlanReview, onRvClick, markDone, dropOpen, hasOpen, clearState } from './plan-review.js';
import { SECTIONS, TEXT_SECTIONS, newPlan, listPlans, getPlan, savePlan, deletePlan, currentId, setCurrent, normReview, normGuide, normDraft, overlap, guideStatus, insertSentence, planDoc, planText } from './year-model.js';

const STEPS = ['자료 넣기', '작년 평가', '지침 점검', '초안', '일정'];
const SRC = [
  ['lastPlan', '작년 계획서', '.hwp·.hwpx·PDF 파일을 넣거나 붙여넣어 주세요. (선택)'],
  ['lastResult', '작년 결과', '만족도 설문, 실적, 반성 메모 — 파일(.hwp·.hwpx·PDF·CSV·엑셀)이나 붙여넣기 (선택)'],
  ['guide', '올해 지침·공문', '교육청 지침·공문을 넣거나 붙여넣어 주세요. (선택)']
];
const won = n => Number(n || 0).toLocaleString('ko-KR');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let box = null, curTab = 'year';
let plan = getPlan(currentId()) || newPlan();
let saved = !!getPlan(plan.id);
const busy = {};   // 계획 id → 하는 일 ('review' 등)
const errs = {};   // 계획 id → 오류 문구
const reading = {}; // 계획 id → 파일 읽는 중 안내
const MAX_SRC = 60000; // 자료 칸 하나에 저장하는 글자 수 (AI에는 그 앞부분만 감)
const STEP_OF = { review: 2, guide: 3, draft: 4 }; // AI 일 → 결과를 보이는 단계
let warnedFull = false;
let showPrev = false; // 1단계 「지난 계획에서 불러오기」 목록

/* 이름을 넣었거나 이미 저장된 계획이면 저장하고 목록을 고침 */
/* 글을 칠 때는 잠깐 멈춘 뒤 한 번만 저장 (치는 글자마다 목록 전체를 다시 쓰지 않게). 다른 일을 하기 전에는 flushSave */
let saveT = 0;
function persistSoon() { clearTimeout(saveT); saveT = setTimeout(persist, 400); }
function flushSave() { if (saveT) persist(); }
onFlush(flushSave);
document.addEventListener('menu:go', flushSave); // 다른 메뉴로 갈 때
function persist() {
  clearTimeout(saveT); saveT = 0;
  if (!saved && !plan.name.trim()) return;
  // 화면에서 고치는 값(빈 예산 줄 등)은 그대로 두고 저장 시각만 받음
  const s = savePlan(plan);
  if (!s) { if (!warnedFull) { warnedFull = true; toast('저장 공간이 모자라 저장하지 못했어요. 쓰지 않는 계획을 지우거나 긴 자료를 줄여 주세요.', 8000); } return; }
  warnedFull = false;
  plan.updatedAt = s.updatedAt;
  saved = true;
  setCurrent(plan.id);
  renderList();
}
/* AI 답 등을 그 계획(id)에 반영. 보고 있는 계획이면 화면 값도 바꿈 */
function apply(id, fn) {
  flushSave(); // 친 글을 먼저 저장해야 아래에서 다시 읽어도 남음
  const p = getPlan(id);
  if (!p) return;
  fn(p);
  const s = savePlan(p);
  if (!s) { toast('저장 공간이 모자라 저장하지 못했어요.', 6000); return; }
  if (plan.id === id) plan = s;
  renderList();
}
/* AI 일이 끝나면: 그 결과를 보이는 단계를 보고 있을 때만 다시 그림 (다른 단계에서 치는 글이 끊기지 않게) */
function finish(id, kind) {
  delete busy[id];
  if (!visible() || plan.id !== id) return;
  if (plan.step === STEP_OF[kind]) renderMain();
  else if (errs[id]) toast(errs[id], 6000);
}
const cap = t => String(t).slice(0, MAX_SRC);
const visible = () => curTab === 'year' && box && box.isConnected && !box.closest('[hidden]');

/* ---------- 그리기 ---------- */
function render() {
  if (!box) return;
  box.innerHTML = `<div class="m-page yp-page">
    <div class="m-head"><h2>연간계획</h2><p class="muted">작년 자료와 올해 지침으로 올해 계획서 초안과 월별 일정을 만들어요.</p></div>
    <div class="yp-grid">
      <aside class="yp-side" aria-labelledby="ypListH">
        <div class="yp-side-h"><b id="ypListH">지난 계획</b><button class="btn text" type="button" data-y="new">+ 새 계획</button></div>
        <ul class="yp-list" id="ypList"></ul>
      </aside>
      <section class="yp-main" id="ypMain"></section>
    </div>
    <input type="file" id="ypFile" accept=".hwp,.hwpx,.pdf,.csv,.xlsx,.txt" multiple hidden>
  </div>`;
  renderList();
  renderMain();
}

/* 목록이 그대로면 다시 그리지 않음 (저장할 때마다 단추를 바꾸면 누르는 중인 단추가 사라짐) */
const listShown = new WeakMap();
function renderList() {
  const ul = box && box.querySelector('#ypList');
  if (!ul) return;
  const list = listPlans();
  const html = list.length ? list.map(p => `<li><button type="button" class="yp-item" data-yp="${esc(p.id)}" ${p.id === plan.id ? 'aria-current="true"' : ''}>
      <b>${esc(p.name || '이름 없는 계획')}</b><span class="muted">${p.year}학년도 · ${p.status === 'final' ? '확정' : '작성 중'}</span></button></li>`).join('')
    : '<li class="muted yp-none">아직 없어요.</li>';
  if (listShown.get(ul) !== html) { ul.innerHTML = html; listShown.set(ul, html); }
}

function renderMain() {
  const main = box && box.querySelector('#ypMain');
  if (!main) return;
  const step = plan.step;
  const body = step === 1 ? step1() : step === 2 ? step2() : step === 3 ? step3() : step === 4 ? step4() : step5();
  main.innerHTML = stepsHTML(STEPS, step, plan.maxStep)
    + (step >= 2 && step <= 4 ? aiRowHTML('plan') : '')
    + (errs[plan.id] ? `<div class="banner err" role="alert"><span class="grow">${esc(errs[plan.id])}</span></div>` : '')
    + body
    + `<div class="row yp-nav">${step > 1 ? '<button class="btn" type="button" data-y="prev">이전</button>' : ''}<span class="grow"></span>${step < 5 ? '<button class="btn primary" type="button" data-y="next">다음</button>' : ''}</div>`
    + (saved ? `<div class="row yp-del"><button class="btn text yp-danger" type="button" data-y="delete">이 계획 지우기</button></div>` : '');
}

function step1() {
  const s = getSchool();
  const f = (k, label, { req, ph, area, type } = {}) => `<label class="yp-f${area ? ' wide' : ''}"><span class="lab">${label}${req ? ' <b class="req" aria-hidden="true">*</b>' : ''}</span>`
    + (area ? `<textarea class="field" id="yp${k[0].toUpperCase() + k.slice(1)}" data-pk="${k}" rows="2" placeholder="${esc(ph || '')}">${esc(plan[k])}</textarea>`
      : `<input class="field" id="yp${k[0].toUpperCase() + k.slice(1)}" data-pk="${k}" ${type ? `type="${type}"` : ''} value="${esc(plan[k])}" placeholder="${esc(ph || '')}" autocomplete="off">`) + '</label>';
  return `<div class="yp-card">
      <h3>업무</h3>
      <div class="yp-fields">
        ${f('name', '업무명', { req: true, ph: '예) 독서교육' })}
        ${f('year', '학년도', { type: 'number' })}
        ${f('goal', '올해 목표', { req: true, ph: '한두 문장. 예) 스스로 책을 고르고 즐기는 독서 습관을 기른다.', area: true })}
        ${f('owner', '담당자', { ph: '예) 독서교육부 ○○○' })}
        ${f('budget', '예산', { ph: '예) 120만 원 (도서 구입비 포함)' })}
      </div>
      <p class="muted yp-school">학교 현황: ${esc(s.name || '학교명 없음')} · 학급 ${s.classes || '-'}개 · 학생 ${s.students || '-'}명
        <button class="btn text" type="button" data-y="school">설정 › 학교 정보에서 바꾸기</button></p>
    </div>
    <div class="yp-card">
      <h3>자료</h3>
      ${reading[plan.id] ? `<p class="muted"><span class="spin"></span> ${esc(reading[plan.id])}</p>` : ''}
      ${SRC.map(([k, label, hint]) => `<div class="yp-src">
        <div class="yp-src-h"><span class="lab">${label}</span><span class="row">${k === 'lastPlan' ? '<button class="btn text" type="button" data-y="importPrev">지난 계획에서 불러오기</button>' : ''}<button class="btn" type="button" data-file="${k}">파일 넣기</button></span></div>
        ${k === 'lastPlan' && showPrev ? prevHTML() : ''}
        <p class="muted">${hint}</p>
        <div class="yp-files muted" data-for="${k}">${plan.sourceNames[k].length ? '넣은 파일: ' + plan.sourceNames[k].map(esc).join(', ') : ''}</div>
        <textarea class="field" data-src="${k}" rows="4" placeholder="여기에 붙여넣어도 돼요" aria-label="${label}">${esc(plan.sources[k])}</textarea>
        <p class="muted yp-cap" data-cap="${k}" ${plan.sources[k].length >= MAX_SRC ? '' : 'hidden'}>앞 6만 자만 저장해요. AI에는 그중 앞부분만 보내요.</p>
      </div>`).join('')}
    </div>`;
}

function prevHTML() {
  const list = listPlans().filter(p => p.status === 'final' && p.id !== plan.id);
  return `<div class="yp-prev" id="ypPrev">${list.length ? list.map(p => `<button class="btn" type="button" data-prev="${esc(p.id)}">${p.year}학년도 ${esc(p.name)}</button>`).join('')
    : '<span class="muted">확정한 지난 계획이 없어요.</span>'}</div>`;
}

function step2() {
  if (!plan.sources.lastResult.trim()) return `<div class="yp-card"><p class="banner info" id="ypNote"><span class="grow">작년 결과 없이 목표와 지침으로 만들어요.</span></p></div>`;
  if (busy[plan.id] === 'review') return `<div class="yp-card" id="ypReview"><p class="muted"><span class="spin"></span> 작년 결과를 살펴보고 있어요…</p></div>`;
  const r = plan.review;
  if (!r) return `<div class="yp-card" id="ypReview"><p class="muted">작년 결과를 아직 평가하지 않았어요.</p><div class="row"><button class="btn primary" type="button" data-y="review">작년 결과 평가하기</button></div></div>`;
  const list = (items, empty) => items.length ? `<ul class="yp-ul">${items.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : `<p class="muted">${empty}</p>`;
  return `<div class="yp-card" id="ypReview">
      <div class="yp-review">
        <section><h3>잘된 점</h3>${list(r.good, '없어요.')}</section>
        <section><h3>아쉬운 점</h3>${r.bad.length ? r.bad.map(b => `<div class="yp-weak"><p class="yp-weak-t">${esc(b.text)}</p>
          <p class="muted">올해 개선 방향 — 반영할 것을 고르세요</p>
          ${b.ideas.map(i => `<label class="yp-idea"><input type="checkbox" data-idea="${esc(i)}" ${r.picked.includes(i) ? 'checked' : ''}>${esc(i)}</label>`).join('')}</div>`).join('') : '<p class="muted">없어요.</p>'}</section>
        <section><h3>수치 변화</h3>${list(r.numbers, '결과에 수치가 없어요.')}</section>
      </div>
      <div class="row"><button class="btn text" type="button" data-y="review">다시 평가</button></div>
    </div>`;
}

function step3() {
  if (!plan.sources.guide.trim()) return `<div class="yp-card"><p class="banner info" id="ypGuideNone"><span class="grow">올해 지침 자료가 없어요. 이 단계는 건너뛰어도 돼요. 1단계에서 지침·공문을 넣으면 꼭 들어가야 할 항목을 점검해 줘요.</span></p></div>`;
  if (busy[plan.id] === 'guide') return `<div class="yp-card"><p class="muted"><span class="spin"></span> 지침에서 꼭 들어가야 할 항목을 찾고 있어요…</p></div>`;
  if (!plan.guide) return `<div class="yp-card"><p class="muted">지침을 아직 살펴보지 않았어요.</p><div class="row"><button class="btn primary" type="button" data-y="guide">지침 항목 뽑기</button></div></div>`;
  const st = guideStatus(plan.guide, plan.draft);
  const label = Object.fromEntries(SECTIONS);
  return `<div class="yp-card">
      <h3>지침 점검표</h3>
      ${plan.draft ? `<p class="muted">빠진 항목은 [넣기]로 초안에 더할 수 있어요.</p>` : '<p class="banner info"><span class="grow">초안을 만든 뒤 반영 여부를 보여 줘요. 이 항목들은 초안을 쓸 때 함께 넣어요.</span></p>'}
      <ul class="yp-guide" id="ypGuide">${st.map((g, i) => `<li data-g="${i}" class="${!plan.draft ? '' : g.included ? 'in' : 'out'}">
        <div class="yp-guide-h"><b>${esc(g.item)}</b>${plan.draft ? `<span class="yp-tag ${g.included ? 'ok' : 'no'}">${g.included ? '반영됨' : '빠짐'}</span>` : ''}</div>
        ${plan.draft && !g.included && g.sentence ? `<div class="yp-guide-s"><span class="muted">${esc(label[g.section])}에 넣을 문장: </span>${esc(g.sentence)}
          <button class="btn tonal" type="button" data-insert="${i}">넣기</button></div>` : ''}</li>`).join('')}</ul>
      <div class="row"><button class="btn text" type="button" data-y="guide">다시 뽑기</button></div>
    </div>`;
}

function overlapHTML() {
  const r = plan.draft ? overlap(plan.sources.lastPlan, plan.draft) : null;
  if (!r) return '';
  const hi = r.percent >= 60;
  return `<div class="banner ${hi ? 'warn' : 'info'}" id="ypOverlap"><span class="grow"><b>작년 계획과 ${r.percent}% 같아요.</b>${hi ? ' 아래 문장을 올해 목표·지침에 맞게 새로 써 주세요.' : ''}
    ${hi ? `<ul class="yp-same-list">${r.same.map(x => `<li class="yp-same">${esc(x)}</li>`).join('')}</ul>` : ''}</span></div>`;
}

function step4() {
  if (busy[plan.id] === 'draft') return `<div class="yp-card"><p class="muted"><span class="spin"></span> 초안을 쓰고 있어요. 다른 메뉴로 가도 계속 써요…</p></div>`;
  const d = plan.draft;
  if (!d) return `<div class="yp-card"><h3>초안</h3><p class="muted">목적 → 방침 → 세부 추진 계획 → 월별 추진 일정 → 예산 → 평가 계획 순서로 써요. 작년 문장은 그대로 옮기지 않고 올해 목표·지침 표현으로 새로 써요(법령·근거 문장은 그대로).</p>
    <div class="row"><button class="btn primary" type="button" data-y="draft">초안 만들기</button></div></div>`;
  const copy = k => `<button class="btn text" type="button" data-copy="${k}">복사</button>`;
  const sum = d.budget.reduce((s, b) => s + b.amount, 0);
  const sec = ([k, label], i) => {
    const h = `<div class="yp-sec-h"><h3>${i + 1}. ${label}</h3>${copy(k)}</div>`;
    if (k === 'schedule') return `<section class="yp-sec">${h}<div class="yp-tbl-wrap"><table class="yp-tbl" id="ypSched"><thead><tr><th>날짜</th><th>내용</th></tr></thead><tbody>${d.schedule.map(x => `<tr><td class="num">${esc(x.date || (x.month ? x.month + '월' : '날짜 미정'))}</td><td>${esc(x.title)}</td></tr>`).join('') || '<tr><td colspan="2" class="muted">없어요</td></tr>'}</tbody></table></div><p class="muted">날짜는 5단계 「일정」에서 정하고 겹치는 날을 확인해요.</p></section>`;
    if (k === 'budget') return `<section class="yp-sec">${h}<div class="yp-tbl-wrap"><table class="yp-tbl" id="ypBudget"><thead><tr><th>항목</th><th>금액(원)</th><th>비고</th><th></th></tr></thead><tbody>${d.budget.map((b, j) => `<tr>
        <td><input class="field" data-bud="${j}" data-f="name" value="${esc(b.name)}" aria-label="항목"></td>
        <td><input class="field num" data-bud="${j}" data-f="amount" value="${b.amount}" inputmode="numeric" aria-label="금액"></td>
        <td><input class="field" data-bud="${j}" data-f="note" value="${esc(b.note)}" aria-label="비고"></td>
        <td><button class="icon-btn" type="button" data-budel="${j}" aria-label="이 항목 빼기">×</button></td></tr>`).join('')}</tbody>
        <tfoot><tr><td>합계</td><td class="num" id="ypBudSum">${won(sum)}</td><td colspan="2"></td></tr></tfoot></table></div>
        <div class="row"><button class="btn text" type="button" data-y="budAdd">+ 항목 더하기</button></div></section>`;
    return `<section class="yp-sec">${h}<textarea class="field${hasOpen(plan, k) ? ' rv-mark' : ''}" data-sec="${k}" rows="${k === 'details' ? 8 : 4}" aria-label="${label}">${esc(d[k])}</textarea></section>`;
  };
  return `<div id="ypOverlapBox">${overlapHTML()}</div><div id="ypRvBox">${rvBox()}</div>
    <div class="yp-card" id="ypDraft">${SECTIONS.map(sec).join('')}
      <div class="row"><button class="btn text" type="button" data-y="draft">다시 만들기 (고친 내용은 사라져요)</button></div></div>`;
}

const fmtDay = d => `${+d.slice(5, 7)}월 ${+d.slice(8, 10)}일(${'일월화수목금토'[weekday(d)]})`;
function step5() {
  const d = plan.draft;
  if (!d) return `<div class="yp-card"><p class="muted">초안을 먼저 만들어 주세요.</p><div class="row"><button class="btn primary" type="button" data-step="4">4단계 초안으로</button></div></div>`;
  const ctx = { breaks: getSchool().breaks, events: listEvents(), source: 'year:' + plan.id };
  const bad = d.schedule.filter(x => x.date && dayIssues(x.date, ctx).length).length;
  const rows = d.schedule.map((x, i) => {
    const c = dayCheck(x, i, ctx);
    return `<tr data-i="${i}" class="${c.bad ? 'yp-bad' : ''}">
      <td><input class="field" type="date" data-date="${i}" value="${esc(x.date)}" aria-label="${i + 1}번째 일정 날짜"></td>
      <td><input class="field" data-title="${i}" value="${esc(x.title)}" aria-label="${i + 1}번째 일정 내용"></td>
      <td class="yp-check">${c.html}</td>
      <td><button class="icon-btn" type="button" data-schdel="${i}" aria-label="이 일정 빼기">×</button></td></tr>`;
  }).join('');
  const fin = plan.status === 'final';
  return `<div class="yp-card">
      <h3>월별 추진 일정</h3>
      <p class="muted">주말·공휴일·설정의 방학·재량휴업일·다른 계획 일정과 겹치면 빨갛게 보이고, 가까운 가능한 날짜 2개를 추천해요.</p>
      <div id="ypDaysSum">${daysSumHTML(bad, d.schedule.length)}</div>
      <div class="yp-tbl-wrap"><table class="yp-tbl yp-days" id="ypDays"><thead><tr><th>날짜</th><th>내용</th><th>확인</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="4" class="muted">일정이 없어요.</td></tr>'}</tbody></table></div>
      <div class="row"><button class="btn text" type="button" data-y="schedAdd">+ 일정 더하기</button></div>
    </div>
    <div class="yp-card">
      <h3>내보내기와 확정</h3>
      <p class="muted">확정하면 계획서와 일정을 저장하고, 일정은 이 컴퓨터의 학사일정에 넣어요. 확정한 계획은 다음 해 「작년 계획서」로 불러올 수 있어요.</p>
      ${fin ? '<p class="banner ok"><span class="grow">확정한 계획이에요. 고치면 다시 「작성 중」이 돼요.</span></p>' : ''}
      <div class="row yp-out">${exportButton('data-y="hwpx"')}<button class="btn" type="button" data-copy="schedule">일정 복사</button><span class="grow"></span>
        <button class="btn primary" type="button" data-y="final">${fin ? '다시 확정' : '확정'}</button></div>
    </div>`;
}

function dayCheck(x, i, ctx) {
  const issues = x.date ? dayIssues(x.date, ctx) : [];
  const sug = issues.length ? suggestDates(x.date, ctx) : [];
  return { bad: issues.length > 0, html: `<span class="yp-why">${x.date ? esc(issues.join(' · ')) : '<span class="muted">날짜를 정해 주세요</span>'}</span>`
    + (sug.length ? `<div class="yp-sug">${sug.map(s => `<button class="btn tonal" type="button" data-suggest="${s}" data-i="${i}">${fmtDay(s)}</button>`).join('')}</div>` : '') };
}
const daysSumHTML = (bad, n) => (n ? `<p class="banner ${bad ? 'warn' : 'ok'}"><span class="grow">${bad ? `겹치는 일정이 ${bad}개 있어요.` : '겹치는 일정이 없어요.'}</span></p>` : '');
/* 날짜를 바꾸면 그 줄의 확인 칸과 위 요약만 고침 (날짜 칸은 다시 그리지 않음 — 키보드로 치는 중이어도 끊기지 않게) */
function refreshDays(i) {
  const d = plan.draft, tr = box && box.querySelector(`#ypDays tr[data-i="${i}"]`);
  if (!d || !tr || !d.schedule[i]) return;
  const ctx = { breaks: getSchool().breaks, events: listEvents(), source: 'year:' + plan.id };
  const c = dayCheck(d.schedule[i], i, ctx);
  tr.classList.toggle('yp-bad', c.bad);
  tr.querySelector('.yp-check').innerHTML = c.html;
  const sum = box.querySelector('#ypDaysSum');
  if (sum) sum.innerHTML = daysSumHTML(d.schedule.filter(x => x.date && dayIssues(x.date, ctx).length).length, d.schedule.length);
}

function setSchedule(i, patch) {
  const x = plan.draft && plan.draft.schedule[i];
  if (!x) return;
  Object.assign(x, patch);
  if (patch.date !== undefined) x.month = x.date ? +x.date.slice(5, 7) : x.month;
  if (plan.status === 'final') plan.status = 'draft';
  persist();
}

function confirmPlan() {
  if (!plan.draft) return;
  plan.status = 'final';
  persist();
  const items = plan.draft.schedule.filter(x => x.date).map(x => ({ date: x.date, title: `${plan.name}: ${x.title}` }));
  setEvents('year:' + plan.id, items);
  renderList(); renderMain();
  toast(`확정했어요. 학사일정에 ${items.length}개를 넣었어요`);
}

function askDelete() {
  const id = plan.id, S = window.SSAM;
  if (!S || !S.openSheet) return;
  S.openSheet(`<h3>「${esc(plan.name || '이름 없는 계획')}」 지우기</h3>
    <p class="muted" style="margin:0">계획서·일정·넣은 자료가 모두 지워지고, 확정해서 학사일정에 넣은 일정도 빠져요. 되돌릴 수 없어요.</p>
    <div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-close>그만두기</button><button class="btn primary" type="button" data-y="deleteYes">지우기</button></div>`,
  sh => sh.querySelector('[data-y="deleteYes"]').addEventListener('click', () => {
    deletePlan(id); removeEvents('year:' + id);
    S.closeSheet();
    plan = listPlans()[0] || newPlan(); saved = !!getPlan(plan.id);
    if (saved) setCurrent(plan.id);
    render(); toast('지웠어요');
  }));
}

async function downloadHwpx() {
  if (!plan.draft) return;
  try { toast(await exportDoc(planDoc(plan), `${plan.year}학년도 ${plan.name || '업무'} 운영 계획`), 6000); }
  catch (e) { toast('파일을 저장하지 못했어요'); }
}

/* ---------- AI: 작년 평가 ---------- */
function reviewPrompt(p) {
  return `[작년 평가]\n학교 업무 연간계획을 돕는 도우미예요. 아래 작년 운영 결과(설문·실적·반성)를 보고 평가해 주세요.\n`
    + `업무: ${p.name}\n올해 목표: ${p.goal}\n\n작년 결과:\n"""\n${p.sources.lastResult.slice(0, 20000)}\n"""\n\n`
    + '규칙:\n- good: 잘된 점 2~4개(짧은 문장)\n- bad: 아쉬운 점 1~4개, 각각 ideas에 올해 개선 방향 2~3개(실행할 수 있는 짧은 문장)\n'
    + '- numbers: 결과에 나온 수치 변화(없으면 빈 배열). 결과에 없는 숫자는 지어내지 않음\n\n'
    + '답은 JSON 하나만: {"good":["…"],"bad":[{"text":"…","ideas":["…","…"]}],"numbers":["…"]}';
}
async function runReview() {
  const id = plan.id;
  if (busy[id] || !plan.sources.lastResult.trim()) return;
  if (!ai.ready()) { errs[id] = '작년 결과를 살펴볼 AI를 먼저 정해 주세요. 왼쪽 아래 AI에서 정할 수 있어요.'; renderMain(); return; }
  busy[id] = 'review'; delete errs[id];
  renderMain();
  try {
    const v = await ai.generateJSON(reviewPrompt(plan), { task: 'plan', valid: x => x && !Array.isArray(x) && (Array.isArray(x.good) || Array.isArray(x.bad)) });
    const r = normReview(v);
    apply(id, p => { p.review = { ...r, picked: [] }; });
  } catch (e) {
    errs[id] = ai.errorMessage(e && e.code, e);
  }
  finish(id, 'review');
}

/* ---------- AI: 지침 점검 ---------- */
function guidePrompt(p) {
  return `[지침 점검]\n학교 업무 연간계획을 돕는 도우미예요. 아래 올해 지침·공문에서 「${p.name}」 계획서에 꼭 들어가야 할 항목을 3~8개 뽑아 주세요.\n\n`
    + `지침:\n"""\n${p.sources.guide.slice(0, 15000)}\n"""\n\n`
    + '규칙:\n- item: 항목 이름(짧게)\n- keywords: 계획서에 그대로 나올 만한 핵심어 2~3개\n- sentence: 계획서에 넣을 한 문장\n'
    + '- section: purpose(목적)·policy(방침)·details(세부 추진 계획)·evaluation(평가 계획) 중 그 문장이 들어갈 곳\n'
    + '- 지침에 없는 항목은 지어내지 않음\n\n답은 JSON 배열 하나만: [{"item":"…","keywords":["…","…"],"sentence":"…","section":"details"}]';
}
async function runGuide() {
  const id = plan.id;
  if (busy[id] || !plan.sources.guide.trim()) return;
  if (!ai.ready()) { errs[id] = '지침을 살펴볼 AI를 먼저 정해 주세요. 왼쪽 아래 AI에서 정할 수 있어요.'; renderMain(); return; }
  busy[id] = 'guide'; delete errs[id];
  renderMain();
  try {
    const v = await ai.generateJSON(guidePrompt(plan), { task: 'plan', valid: x => Array.isArray(x) && normGuide(x).length > 0 });
    apply(id, p => { p.guide = normGuide(v); });
  } catch (e) { errs[id] = ai.errorMessage(e && e.code, e); }
  finish(id, 'guide');
}

/* ---------- AI: 초안 ---------- */
function draftPrompt(p) {
  const s = getSchool();
  const picked = p.review ? p.review.picked : [];
  const lines = [
    `업무: ${p.name}`, `학년도: ${p.year}학년도 (${p.year}-03-01 ~ ${p.year + 1}-02-28)`, `올해 목표: ${p.goal}`,
    `학교 현황: ${s.name || '(학교명 없음)'}, 학급 ${s.classes || '-'}개, 학생 ${s.students || '-'}명`,
    p.owner.trim() && `담당자: ${p.owner}`, p.budget.trim() && `예산: ${p.budget}`,
    p.review && p.review.good.length && `작년에 잘된 점: ${p.review.good.join(' / ')}`,
    p.review && p.review.bad.length && `작년에 아쉬운 점: ${p.review.bad.map(b => b.text).join(' / ')}`,
    picked.length && `올해 반영할 개선 방향: ${picked.join(' / ')}`,
    p.guide && p.guide.length && `지침에서 꼭 넣을 항목:\n${p.guide.map(g => `- ${g.item}: ${g.sentence}`).join('\n')}`
  ].filter(Boolean).join('\n');
  return `[연간계획 초안]\n학교 업무 연간계획서 초안을 써 주세요.\n\n${lines}\n\n`
    + (p.sources.lastPlan.trim() ? `작년 계획서(참고만):\n"""\n${p.sources.lastPlan.slice(0, 12000)}\n"""\n\n` : '')
    + '규칙:\n- purpose(목적)·policy(방침)·details(세부 추진 계획)·evaluation(평가 계획)은 학교 계획서 문체(「~한다」, 「가.」「1)」 목록)로 씀\n'
    + '- 작년 계획서 문장을 그대로 옮기지 말고 올해 목표·지침 표현으로 새로 씀. 단, 법령·근거 문장(「~법 제○조」 등)은 그대로 둠\n'
    + `- schedule: 6~12개, 각 일정의 date는 ${p.year}-03-01 ~ ${p.year + 1}-02-28 사이 평일 'YYYY-MM-DD'\n`
    + '- budget: 항목·금액(원, 숫자)·비고. 예산이 주어지면 합계를 그 안으로\n- 메모에 없는 숫자·사실은 지어내지 않음\n\n'
    + '답은 JSON 하나만: {"purpose":"…","policy":"…","details":"…","schedule":[{"title":"…","date":"YYYY-MM-DD"}],"budget":[{"name":"…","amount":0,"note":"…"}],"evaluation":"…"}';
}
async function runDraft() {
  const id = plan.id;
  if (busy[id]) return;
  if (!ai.ready()) { errs[id] = '초안을 쓸 AI를 먼저 정해 주세요. 왼쪽 아래 AI에서 정할 수 있어요.'; renderMain(); return; }
  busy[id] = 'draft'; delete errs[id];
  renderMain();
  try {
    // 섹션이 몇 개 빠져도 받음 (빠진 섹션은 빈 글)
    const ok = x => { const d = normDraft(x); return !!d && (TEXT_SECTIONS.some(k => d[k].trim()) || d.schedule.length > 0); };
    const v = await ai.generateJSON(draftPrompt(plan), { task: 'plan', valid: ok });
    apply(id, p => { p.draft = normDraft(v); p.rv = []; if (p.status === 'final') p.status = 'draft'; });
    clearState(id);
    finish(id, 'draft');
    reviewDraft(id);
    return;
  } catch (e) { errs[id] = ai.errorMessage(e && e.code, e); }
  finish(id, 'draft');
}
/* 검토 AI: 초안 칸(목적·방침·세부 추진 계획·평가 계획)을 한 번 봄 */
const SEC_LABEL = Object.fromEntries(SECTIONS);
function reviewDraft(id) {
  const p = getPlan(id);
  if (!p || !p.draft) return;
  runPlanReview(id, {
    title: `${p.year}학년도 ${p.name || '업무'} 연간계획`,
    sections: TEXT_SECTIONS.map(k => ({ key: k, label: SEC_LABEL[k], text: p.draft[k] })),
    guide: (p.guide || []).map(g => `- ${g.item}: ${g.sentence}`).join('\n'),
    current: () => { flushSave(); const q = getPlan(id); return q && q.draft; },
    save: items => apply(id, q => { q.rv = items; }),
    update: () => updateRv(id)
  });
}
const rvBox = () => rvBoxHTML(plan, { text: k => (plan.draft && plan.draft[k]) || '', label: k => SEC_LABEL[k] || k });
function updateRv(id) {
  if (!visible() || plan.id !== id || plan.step !== 4) return;
  const b = box.querySelector('#ypRvBox');
  if (b) b.innerHTML = rvBox();
  box.querySelectorAll('textarea[data-sec]').forEach(t => t.classList.toggle('rv-mark', hasOpen(plan, t.dataset.sec)));
}

/* 초안을 고칠 때 작년 비교만 다시 그림 */
let ovT = null;
function refreshOverlap() {
  clearTimeout(ovT);
  ovT = setTimeout(() => { const b = box && box.querySelector('#ypOverlapBox'); if (b) b.innerHTML = overlapHTML(); }, 250);
}
function sectionText(k) {
  const d = plan.draft;
  if (!d) return '';
  if (k === 'schedule') return d.schedule.map(x => `${x.date || (x.month ? x.month + '월' : '')}\t${x.title}`).join('\n');
  if (k === 'budget') return ['항목\t금액\t비고', ...d.budget.map(b => `${b.name}\t${b.amount}\t${b.note}`), `합계\t${d.budget.reduce((a, b) => a + b.amount, 0)}\t`].join('\n');
  return d[k] || '';
}

/* ---------- 단계 이동 ---------- */
function goStep(n) {
  plan.step = n;
  plan.maxStep = Math.max(plan.maxStep, n);
  persist();
  renderMain();
  if (n === 2 && plan.sources.lastResult.trim() && !plan.review) runReview();
  if (n === 3 && plan.sources.guide.trim() && !plan.guide) runGuide();
}
function next() {
  if (plan.step === 1) {
    const bad = ['name', 'goal'].filter(k => !String(plan[k]).trim());
    box.querySelectorAll('.field.bad').forEach(el => el.classList.remove('bad'));
    bad.forEach(k => { const el = box.querySelector(`[data-pk="${k}"]`); if (el) el.classList.add('bad'); });
    if (bad.length) { box.querySelector('.field.bad').focus(); return; }
  }
  goStep(Math.min(5, plan.step + 1));
}

/* 파일은 넣기 시작한 계획(id)에 넣음 — 읽는 동안 다른 계획으로 가도 섞이지 않게 */
async function addFiles(target, files) {
  const id = plan.id;
  if (!saved) persist();
  const here = () => visible() && plan.id === id && plan.step === 1;
  for (const f of files) {
    reading[id] = `「${f.name}」 읽는 중…`;
    if (here()) renderMain();
    try {
      const text = await readText(f);
      const add = p => {
        const prev = p.sources[target].trim();
        p.sources[target] = cap((prev ? prev + '\n\n' : '') + `(파일 「${f.name}」)\n${text}`);
        p.sourceNames[target] = [...p.sourceNames[target], f.name];
      };
      if (plan.id === id) { add(plan); persist(); } else apply(id, add);
    } catch (e) { toast(fileMessage(e && e.code), 5000); }
  }
  delete reading[id];
  if (here()) renderMain();
}

/* ---------- 입력·누르기 ---------- */
document.addEventListener('input', e => {
  if (!box || !box.contains(e.target) || curTab !== 'year') return;
  const el = e.target;
  if (el.dataset.pk) {
    plan[el.dataset.pk] = el.dataset.pk === 'year' ? (parseInt(el.value, 10) || plan.year) : el.value;
    if (String(el.value).trim()) el.classList.remove('bad');
  } else if (el.dataset.src) {
    if (el.value.length > MAX_SRC) { el.value = cap(el.value); toast('앞 6만 자만 저장해요', 4000); }
    plan.sources[el.dataset.src] = el.value;
    const n = box.querySelector(`[data-cap="${el.dataset.src}"]`); if (n) n.hidden = el.value.length < MAX_SRC;
  }
  else if (el.dataset.sec && plan.draft) {
    plan.draft = { ...plan.draft, [el.dataset.sec]: el.value }; refreshOverlap();
    // 손으로 고친 칸의 검토 의견은 사라짐
    if (hasOpen(plan, el.dataset.sec)) { plan.rv = dropOpen(plan.rv, el.dataset.sec); updateRv(plan.id); }
  }
  else if (el.dataset.title != null) { setSchedule(+el.dataset.title, { title: el.value }); return; }
  else if (el.dataset.bud != null && plan.draft) {
    const b = plan.draft.budget[+el.dataset.bud];
    if (!b) return;
    if (el.dataset.f === 'amount') b.amount = Math.round(Number(String(el.value).replace(/[,\s원]/g, '')) || 0); else b[el.dataset.f] = el.value;
    const sum = box.querySelector('#ypBudSum');
    if (sum) sum.textContent = won(plan.draft.budget.reduce((s, x) => s + x.amount, 0));
  } else return;
  if (plan.status === 'final' && (el.dataset.sec || el.dataset.bud != null)) plan.status = 'draft';
  persistSoon();
});
document.addEventListener('change', e => {
  if (!box || !box.contains(e.target) || curTab !== 'year') return;
  const el = e.target;
  if (el.dataset.date != null) { setSchedule(+el.dataset.date, { date: el.value }); refreshDays(+el.dataset.date); return; }
  if (el.id === 'ypFile') { const t = el.dataset.target; const files = [...el.files]; el.value = ''; if (t && files.length) addFiles(t, files); return; }
  if (el.dataset.idea != null && plan.review) {
    const set = new Set(plan.review.picked);
    if (el.checked) set.add(el.dataset.idea); else set.delete(el.dataset.idea);
    plan.review = { ...plan.review, picked: [...set] };
    persist();
  }
});
document.addEventListener('click', e => {
  if (!box || !box.contains(e.target) || curTab !== 'year') return;
  flushSave();
  if (onRvClick(e, box, {
    use: sec => {
      const r = (plan.rv || []).find(x => x.section === sec && !x.done);
      if (!r || !plan.draft) return;
      plan.draft = { ...plan.draft, [sec]: r.fix }; plan.rv = markDone(plan.rv, sec, 'review');
      if (plan.status === 'final') plan.status = 'draft';
      persist(); renderMain();
    },
    keep: sec => { plan.rv = markDone(plan.rv, sec, 'main'); persist(); renderMain(); }
  })) return;
  const item = e.target.closest('[data-yp]');
  if (item) { const p = getPlan(item.dataset.yp); if (p) { plan = p; saved = true; setCurrent(p.id); render(); } return; }
  const st = e.target.closest('[data-step]');
  if (st) { const n = +st.dataset.step; if (n <= plan.maxStep) goStep(n); return; }
  const ins = e.target.closest('[data-insert]');
  if (ins && plan.guide && plan.draft) {
    const g = plan.guide[+ins.dataset.insert];
    if (g) { plan.draft = insertSentence(plan.draft, g.section, g.sentence); if (plan.status === 'final') plan.status = 'draft'; persist(); renderMain(); toast('초안에 넣었어요'); }
    return;
  }
  const cp = e.target.closest('[data-copy]');
  if (cp) { copyText(sectionText(cp.dataset.copy)).then(ok => toast(ok ? '복사했어요' : '복사하지 못했어요')); return; }
  const sg = e.target.closest('[data-suggest]');
  if (sg) { setSchedule(+sg.dataset.i, { date: sg.dataset.suggest }); renderMain(); return; }
  const sd = e.target.closest('[data-schdel]');
  if (sd && plan.draft) { plan.draft.schedule.splice(+sd.dataset.schdel, 1); if (plan.status === 'final') plan.status = 'draft'; persist(); renderMain(); return; }
  const pv = e.target.closest('[data-prev]');
  if (pv) {
    const p = getPlan(pv.dataset.prev);
    if (p) {
      const prev = plan.sources.lastPlan.trim();
      plan.sources.lastPlan = (prev ? prev + '\n\n' : '') + planText(p);
      plan.sourceNames.lastPlan = [...plan.sourceNames.lastPlan, `지난 계획: ${p.year}학년도 ${p.name}`];
      showPrev = false; persist(); renderMain();
    }
    return;
  }
  const bd = e.target.closest('[data-budel]');
  if (bd && plan.draft) { plan.draft.budget.splice(+bd.dataset.budel, 1); persist(); renderMain(); return; }
  const fb = e.target.closest('[data-file]');
  if (fb) { const inp = box.querySelector('#ypFile'); inp.dataset.target = fb.dataset.file; inp.click(); return; }
  const b = e.target.closest('[data-y]');
  if (!b) return;
  const a = b.dataset.y;
  if (a === 'new') { plan = newPlan(); saved = false; showPrev = false; render(); box.querySelector('#ypName').focus(); }
  else if (a === 'next') next();
  else if (a === 'prev') goStep(Math.max(1, plan.step - 1));
  else if (a === 'review') { if (plan.review) apply(plan.id, p => { p.review = null; }); runReview(); }
  else if (a === 'guide') { if (plan.guide) apply(plan.id, p => { p.guide = null; }); runGuide(); }
  else if (a === 'draft') runDraft();
  else if (a === 'budAdd' && plan.draft) { plan.draft.budget.push({ name: '', amount: 0, note: '' }); persist(); renderMain(); }
  else if (a === 'schedAdd' && plan.draft) { plan.draft.schedule.push({ title: '', date: '', month: null }); persist(); renderMain(); }
  else if (a === 'importPrev') { showPrev = !showPrev; renderMain(); }
  else if (a === 'hwpx') downloadHwpx();
  else if (a === 'final') confirmPlan();
  else if (a === 'delete') askDelete();
  else if (a === 'school') goMenu('settings', 'school');
});

onEnter('plan', (tab, section) => {
  if (!box || !section.contains(box)) { box = document.createElement('div'); box.className = 'yp-box'; section.prepend(box); }
  curTab = tab;
  // 행사계획 탭은 event.js가 그림
  box.hidden = tab !== 'year';
  flushSave();
  if (tab === 'year') { const p = getPlan(plan.id); if (p) plan = p; render(); }
});

/* 떠 있는 버튼: 작년 업무 계획 → 새 연간계획(업무명은 제목에서, 목표는 입력 칸) → 4단계 초안까지(설정에 따라 자료로만) */
const titleName = t => {
  const l = String(t || '').split('\n').map(x => x.trim()).find(Boolean) || '';
  const m = /^(?:\d{4}\s*(?:학년도)?\s*)?(.+?)\s*(?:운영|추진|연간|사업|세부)?\s*계획/.exec(l);
  return m ? m[1].trim().slice(0, 40) : '';
};
registerInbox('year-plan', {
  act: () => '새 연간계획을 만들어 작년 계획서로 넣기',
  fields: (files, ctx) => [
    { key: 'name', label: '업무명', type: 'text', required: true, value: titleName(ctx.texts.get(files[0])) },
    { key: 'goal', label: '올해 목표', type: 'text', required: true }],
  async run(files, v, opts) {
    goMenu('plan', 'year');
    flushSave();
    plan = newPlan(); saved = false; showPrev = false;
    plan.name = String(v.name || '').trim(); plan.goal = String(v.goal || '').trim();
    persist(); render();
    await addFiles('lastPlan', files);
    if (opts.plan !== 'draft') return '새 연간계획에 작년 계획서를 넣었어요.';
    if (!ai.ready()) return '새 연간계획에 작년 계획서를 넣었어요. AI를 정하면 초안을 써요(왼쪽 아래 AI).';
    goStep(4);
    await runDraft();
    return '';
  }
});
/* 떠 있는 버튼 › 지침: 지금 연간계획의 「올해 지침·공문」으로 (초안까지면 지침 점검까지) */
export const yearGuide = {
  key: 'year', label: '연간계획',
  current: () => { const p = getPlan(currentId()) || listPlans()[0]; return p ? { id: p.id, title: p.name || '이름 없는 계획' } : null; },
  async add(id, files, opts) {
    goMenu('plan', 'year');
    flushSave();
    const p = getPlan(id);
    if (!p) return '그 연간계획을 찾지 못했어요.';
    plan = p; saved = true; setCurrent(p.id);
    plan.step = 1; render();
    await addFiles('guide', files);
    if (opts.plan === 'draft' && ai.ready()) { apply(id, x => { x.guide = null; }); goStep(3); }
    return '연간계획의 올해 지침·공문으로 넣었어요.';
  }
};
