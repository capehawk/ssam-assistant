/* 계획 › 학급운영계획: 1 자료 넣기 → 2 목차 → 3 초안 → 4 첨부·내보내기 (스펙 2026-10-29-class-plan).
   작년 계획서 목차 그대로 올해 초안을 쓰고, 첨부한 진도표·평가계획을 읽어 표로 넣음.
   AI 답은 시작할 때의 계획 id에 저장해서, 그사이 다른 계획·메뉴로 가도 섞이지 않음 */
import { onFlush, get } from '../../core/store.js';
import { onEnter, go as goMenu } from '../../core/shell.js';
import { registerInbox } from '../../core/inbox.js';
import * as ai from '../../core/ai.js';
import { aiRowHTML } from '../../core/ai-roles.js';
import { readText, fileMessage } from '../../core/files.js';
import { toast } from '../../core/ui.js';
import { exportButton, exportDoc } from '../../core/doc-export.js';
import { stepsHTML } from '../../core/steps.js';
import { stripNames } from '../../core/privacy.js';
import {
  STANDARD, MAX_SRC, KIND_NAME, parseOutline, withRoles, leaves, sectionBodies, attachKind, newId, newPlan, listPlans, getPlan, savePlan, deletePlan, currentId, setCurrent,
  normSections, normMonthly, normEvalRows, normGuide, guideStatus, insertSentence, draftText, hoursRows, planTitle, planDoc, planText
} from './classplan-model.js';
import { overlap } from './year-model.js';
import { guidePrompt, draftPrompt, evalPrompt } from './classplan-ai.js';
import { parseJindo } from '../class/class-import.js';
import { listSubjects, importSubjects, today } from '../class/class-model.js';
import { sampleSources } from './classplan-sample.js';

const STEPS = ['자료 넣기', '목차', '초안', '첨부·내보내기'];
const SRC = [
  ['lastPlan', '작년 학급운영계획', '작년 학급운영계획(학급 교육과정 운영 계획) 한글·PDF 파일을 넣거나 붙여넣어 주세요. 목차를 그대로 따라 써요. (선택)'],
  ['guide', '올해 지침', '학교 교육과정·교육청 지침에서 학급운영에 해당하는 부분을 넣거나 붙여넣어 주세요. (선택)']
];
const ROLE = { hours: '시수표', eval: '평가 표', monthly: '월별 표' };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cap = t => String(t).slice(0, MAX_SRC);
const S = () => window.SSAM || {};

let box = null, curTab = '';
let plan = getPlan(currentId()) || newPlan();
let saved = !!getPlan(plan.id);
const busy = {}, errs = {}, notes = {}, reading = {}, readingAtt = {};
/* 첨부 id → { text: 이름 줄 뺀 글, jindo: 진도표 읽은 것 } — 차시 목록은 저장하지 않으므로(크기) 넣은 그 자리에서만 학급 메뉴로 보냄 */
const attMem = {};
let warnedFull = false, showPrev = false;
const visible = () => curTab === 'class' && box && box.isConnected && !box.closest('[hidden]');

/* 글을 칠 때는 잠깐 멈춘 뒤 한 번만 저장. 다른 일을 하기 전에는 flushSave */
let saveT = 0;
function persistSoon() { clearTimeout(saveT); saveT = setTimeout(persist, 400); }
function flushSave() { if (saveT) persist(); }
onFlush(flushSave);
document.addEventListener('menu:go', flushSave);
function persist() {
  clearTimeout(saveT); saveT = 0;
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
  flushSave();
  const p = plan.id === id ? plan : getPlan(id);
  if (!p) return;
  fn(p);
  const s = savePlan(p);
  if (!s) { toast('저장 공간이 모자라 저장하지 못했어요.', 6000); return; }
  if (plan.id === id) plan = s;
  saved = saved || plan.id === id;
  renderList();
}

/* 확정한 계획을 고치면 다시 「작성 중」 */
const unfinal = p => { if (p.status === 'final') p.status = 'draft'; };

/* ---------- 그리기 ---------- */
function render() {
  if (!box) return;
  box.innerHTML = `<div class="m-page yp-page">
    <div class="m-head"><h2>학급운영계획</h2><p class="muted">작년 학급운영계획을 바탕으로 올해 계획서 초안을 만들어요. 진도표·평가계획을 붙이면 읽어서 표로 넣어요.</p></div>
    <div class="yp-grid">
      <aside class="yp-side" aria-labelledby="cpListH">
        <div class="yp-side-h"><b id="cpListH">지난 학급운영계획</b><button class="btn text" type="button" data-c="new">+ 새 계획</button></div>
        <ul class="yp-list" id="cpList"></ul>
        <button class="btn text" type="button" data-c="sample">예시로 채우기</button>
      </aside>
      <section class="yp-main" id="cpMain"></section>
    </div>
    <input type="file" id="cpFile" accept=".hwp,.hwpx,.pdf,.csv,.xlsx,.txt" multiple hidden>
  </div>`;
  renderList();
  renderMain();
}
const listShown = new WeakMap();
function renderList() {
  const ul = box && box.querySelector('#cpList');
  if (!ul) return;
  const list = listPlans();
  const html = list.length ? list.map(p => `<li><button type="button" class="yp-item" data-cp="${esc(p.id)}" ${p.id === plan.id ? 'aria-current="true"' : ''}>
      <b>${esc(p.grade && p.room ? `${p.grade}학년 ${p.room}반` : '학급 미정')}</b><span class="muted">${p.year}학년도 · ${p.status === 'final' ? '확정' : '작성 중'}</span></button></li>`).join('')
    : '<li class="muted yp-none">아직 없어요.</li>';
  if (listShown.get(ul) !== html) { ul.innerHTML = html; listShown.set(ul, html); }
}
function renderMain() {
  const main = box && box.querySelector('#cpMain');
  if (!main) return;
  const step = plan.step;
  const body = step === 1 ? step1() : step === 2 ? step2() : step === 3 ? step3() : step4();
  main.innerHTML = stepsHTML(STEPS, step, plan.maxStep)
    + (step === 3 || step === 4 ? aiRowHTML('plan') : '')
    + (errs[plan.id] ? `<div class="banner err" role="alert"><span class="grow">${esc(errs[plan.id])}</span></div>` : '')
    + (notes[plan.id] && step === 3 ? `<div class="banner warn" role="status"><span class="grow">${esc(notes[plan.id])}</span></div>` : '')
    + body
    + `<div class="row yp-nav">${step > 1 ? '<button class="btn" type="button" data-c="prev">이전</button>' : ''}<span class="grow"></span>${step < 4 ? '<button class="btn primary" type="button" data-c="next">다음</button>' : ''}</div>`
    + (saved ? `<div class="row yp-del"><button class="btn text yp-danger" type="button" data-c="delete">이 계획 지우기</button></div>` : '');
}

/* ---------- 1단계: 자료 넣기 ---------- */
/* 설정 › 학급 명단의 학생 수 (예외 번호 뺌) */
function rosterCount() { const c = get('class', null); return c && c.count ? c.count - (Array.isArray(c.except) ? c.except.length : 0) : 0; }
function step1() {
  const n = rosterCount();
  const num = (id, k, label, min, max) => `<label class="yp-f"><span class="lab">${label}</span><input class="field num" type="number" id="${id}" data-pk="${k}" min="${min}" max="${max}" value="${plan[k] == null ? '' : plan[k]}"></label>`;
  return `<div class="yp-card">
      <h3>우리 반</h3>
      <div class="cp-class">
        ${num('cpYear', 'year', '학년도', 2020, 2100)}
        <label class="yp-f"><span class="lab">학년</span><select class="field" id="cpGrade" data-pk="grade"><option value="">고르기</option>${[1, 2, 3, 4, 5, 6].map(g => `<option value="${g}"${plan.grade === g ? ' selected' : ''}>${g}학년</option>`).join('')}</select></label>
        ${num('cpRoom', 'room', '반', 1, 30)}
        ${num('cpBoys', 'boys', '남학생 수', 0, 60)}
        ${num('cpGirls', 'girls', '여학생 수', 0, 60)}
        <label class="yp-f wide"><span class="lab">급훈·학급 슬로건 (선택)</span><input class="field" id="cpMotto" data-pk="motto" value="${esc(plan.motto)}" placeholder="예) 배려하고 소통하는 우리 반" autocomplete="off"></label>
      </div>
      <p class="muted">학생 이름은 넣지 않아요. 학생 수는 숫자만 써요.${n ? ` (설정 › 학급 명단: ${n}명)` : ''}</p>
    </div>
    <div class="yp-card">
      <h3>자료</h3>
      ${reading[plan.id] ? `<p class="muted"><span class="spin"></span> ${esc(reading[plan.id])}</p>` : ''}
      ${SRC.map(([k, label, hint]) => `<div class="yp-src">
        <div class="yp-src-h"><span class="lab">${label}</span><span class="row">${k === 'lastPlan' ? '<button class="btn text" type="button" data-c="importPrev">지난 학급운영계획에서 불러오기</button>' : ''}<button class="btn" type="button" data-file="${k}">파일 넣기</button></span></div>
        ${k === 'lastPlan' && showPrev ? prevHTML() : ''}
        <p class="muted">${hint}</p>
        <div class="yp-files muted">${plan.sourceNames[k].length ? '넣은 파일: ' + plan.sourceNames[k].map(esc).join(', ') : ''}</div>
        <textarea class="field" data-src="${k}" rows="4" placeholder="여기에 붙여넣어도 돼요" aria-label="${label}">${esc(plan.sources[k])}</textarea>
      </div>`).join('')}
    </div>${attachHTML()}`;
}
/* 첨부파일 (1단계·4단계에 같이 보임) */
const jindoSubjects = r => (r ? r.subjects.filter(s => s.pick).map(s => ({ name: s.name, hours: s.total != null ? s.total : s.lessons.length })) : []);
function attInfo(a) {
  if (a.kind === 'jindo') {
    const s = a.summary.subjects;
    if (s.length) return `교과 ${s.length}개 · ${s.reduce((n, x) => n + x.hours, 0)}시간`;
    return attMem[a.id] && attMem[a.id].jindo ? '창체 영역별 표만 있어 시수표에 넣을 교과가 없어요. 학급 메뉴로는 넣을 수 있어요.' : '연간지도계획 표를 찾지 못했어요. 시수표 없이 붙임 목록에만 들어가요.';
  }
  if (a.kind === 'eval') return a.text ? '4단계에서 AI로 평가 표를 읽어요.' : '글을 읽지 못해 붙임 목록에만 들어가요.';
  return '붙임 목록에만 들어가요.';
}
function attachHTML() {
  return `<div class="yp-card">
      <div class="yp-src-h"><h3>첨부파일</h3><button class="btn" type="button" data-file="attach">첨부파일 넣기</button></div>
      <p class="muted">스쿨마스터 등에서 받은 진도표·평가계획을 넣으면 읽어서 시수표·평가 표로 넣고, 계획서 끝 붙임 목록에 적어요. 여러 개 넣을 수 있어요.</p>
      ${readingAtt[plan.id] ? `<p class="muted"><span class="spin"></span> ${esc(readingAtt[plan.id])}</p>` : ''}
      <ul class="cp-attach" id="cpAttach">${plan.attach.map(a => `<li data-att="${esc(a.id)}">
        <span class="grow"><b>${esc(a.name)}</b> <span class="muted">${esc(attInfo(a))}</span></span>
        <select class="field" data-akind="${esc(a.id)}" aria-label="「${esc(a.name)}」 종류">${Object.entries(KIND_NAME).map(([k, n]) => `<option value="${k}"${a.kind === k ? ' selected' : ''}>${k === 'other' ? '기타' : n}</option>`).join('')}</select>
        <button class="icon-btn" type="button" data-adel="${esc(a.id)}" aria-label="「${esc(a.name)}」 빼기">×</button></li>`).join('')}</ul>
    </div>`;
}
/* 첨부 읽기: 종류 짐작, 진도표는 교과별 시수, 평가계획은 이름 줄 뺀 글을 지님 → { att, privacy(평가계획만) } */
function attachFrom(name, raw) {
  const r = stripNames(raw), kind = attachKind(name, raw), id = newId();
  const j = parseJindo(raw, { today: today() });
  attMem[id] = { text: r.text, jindo: j.subjects.length ? j : null };
  return { att: { id, name, kind, text: kind === 'eval' ? r.text : '', summary: { subjects: kind === 'jindo' ? jindoSubjects(attMem[id].jindo) : [] } }, privacy: kind === 'eval' ? r : null };
}
const privacyMsg = r => `${[r.dropped ? `이름·전화번호가 적힌 줄 ${r.dropped}개는 빼고` : '', r.masked ? `이름 ${r.masked}개는 ○○○로 가려` : ''].filter(Boolean).join(', ')} 넣었어요(학생 이름은 저장하지도 AI로 보내지도 않아요).`;
async function addAttach(files) {
  const id = plan.id;
  if (!saved) persist();
  const here = () => visible() && plan.id === id && (plan.step === 1 || plan.step === 4);
  for (const f of files) {
    readingAtt[id] = `「${f.name}」 읽는 중…`;
    if (here()) renderMain();
    try {
      const { att, privacy } = attachFrom(f.name, await readText(f));
      apply(id, p => { p.attach = [...p.attach, att]; unfinal(p); });
      if (privacy && (privacy.dropped || privacy.masked)) toast(privacyMsg(privacy), 7000);
    } catch (e) { toast(fileMessage(e && e.code), 5000); }
  }
  delete readingAtt[id];
  if (here()) renderMain();
}
function setKind(aid, kind) {
  const a = plan.attach.find(x => x.id === aid), m = attMem[aid];
  if (!a || !KIND_NAME[kind]) return;
  a.kind = kind;
  if (kind === 'eval' && !a.text && m) a.text = m.text;
  if (kind === 'jindo' && m) a.summary = { subjects: jindoSubjects(m.jindo) };
  unfinal(plan); persist(); renderMain();
}
function prevHTML() {
  const list = listPlans().filter(p => p.status === 'final' && p.id !== plan.id);
  return `<div class="yp-prev" id="cpPrev">${list.length ? list.map(p => `<button class="btn" type="button" data-prev="${esc(p.id)}">${p.year}학년도 ${esc(p.grade && p.room ? `${p.grade}학년 ${p.room}반` : '학급')}</button>`).join('')
    : '<span class="muted">확정한 지난 학급운영계획이 없어요.</span>'}</div>`;
}
/* 파일은 넣기 시작한 계획(id)에 넣음. 이름·전화번호 줄은 빼고 넣고 알림 */
async function addFiles(target, files) {
  const id = plan.id;
  if (!saved) persist();
  const here = () => visible() && plan.id === id && plan.step === 1;
  for (const f of files) {
    reading[id] = `「${f.name}」 읽는 중…`;
    if (here()) renderMain();
    try {
      const r = stripNames(await readText(f));
      apply(id, p => {
        const prev = p.sources[target].trim();
        p.sources[target] = cap((prev ? prev + '\n\n' : '') + r.text);
        p.sourceNames[target] = [...p.sourceNames[target], f.name];
        if (target === 'guide') p.guide = null; // 지침이 늘면 지침 항목을 다시 뽑음
      });
      if (r.dropped || r.masked) toast(privacyMsg(r), 7000);
    } catch (e) { toast(fileMessage(e && e.code), 5000); }
  }
  delete reading[id];
  if (here()) renderMain();
}

/* ---------- 2단계: 목차 ---------- */
let outlineNote = '';
/* 표준 목차를 보기만 하고 고치지 않았는지 (초안도 없음) */
const untouchedStd = () => !plan.draft && plan.outline.length === STANDARD.length
  && plan.outline.every((x, i) => x.id === STANDARD[i].id && x.title === STANDARD[i].title && x.level === STANDARD[i].level);
function ensureOutline() {
  const last = plan.sources.lastPlan.trim();
  // 표준 목차를 본 뒤 작년 계획서를 넣었으면 작년 목차로 바꿈 (고친 목차·초안이 있으면 그대로)
  if (plan.outline.length && !(last && untouchedStd())) return;
  const o = last ? parseOutline(plan.sources.lastPlan) : [];
  if (o.length) { plan.outline = o; outlineNote = `작년 계획서 목차 그대로예요(${o.length}칸). 이름을 고치거나 빼고 더할 수 있어요.`; }
  else if (plan.outline.length) return;
  else {
    plan.outline = STANDARD.map(x => ({ ...x }));
    outlineNote = plan.sources.lastPlan.trim() ? '작년 계획서에서 목차를 찾지 못해 표준 목차로 시작해요.' : '작년 계획서가 없어 표준 목차로 시작해요. 여러 학교의 학급운영계획과 학급 교육과정 운영 평가 항목을 모아 만든 목차예요.';
  }
  persist();
}
function step2() {
  const o = plan.outline;
  return `<div class="yp-card">
      <h3>목차</h3>
      <p class="banner info" id="cpOutlineNote"><span class="grow">${esc(outlineNote || '목차를 고치면 초안 칸도 따라 바뀌어요.')}</span></p>
      <ol class="cp-outline" id="cpOutline">${o.map((x, i) => `<li class="l${x.level}" data-oi="${i}">
        <input class="field" data-ot="${esc(x.id)}" value="${esc(x.title)}" aria-label="${i + 1}번째 칸 이름">
        ${x.role ? `<span class="cp-role">${ROLE[x.role]}</span>` : ''}
        <button class="btn text tiny" type="button" data-olv="${i}" title="큰 제목·작은 제목 바꾸기">${x.level === 1 ? '작게' : '크게'}</button>
        <button class="icon-btn" type="button" data-oup="${i}" aria-label="위로"${i ? '' : ' disabled'}>↑</button>
        <button class="icon-btn" type="button" data-odown="${i}" aria-label="아래로"${i < o.length - 1 ? '' : ' disabled'}>↓</button>
        <button class="icon-btn" type="button" data-odel="${i}" aria-label="이 칸 빼기">×</button></li>`).join('')}</ol>
      <div class="row"><button class="btn text" type="button" data-c="oAdd">+ 칸 더하기</button><span class="grow"></span>
        ${plan.sources.lastPlan.trim() ? '<button class="btn text" type="button" data-c="oLast">작년 목차로 다시</button>' : ''}<button class="btn text" type="button" data-c="oStd">표준 목차로 바꾸기</button></div>
      <p class="muted">시수표·평가 표·월별 표는 4단계에서 첨부한 진도표·평가계획을 읽어 그 칸 뒤에 넣어요.</p>
    </div>`;
}
/* 이름만 바꾸면 다시 그리지 않고 역할 표시만 고침 (다음 누르기·Tab이 끊기지 않게) */
function refreshRoles() {
  box.querySelectorAll('#cpOutline li').forEach((li, i) => {
    const r = plan.outline[i] && plan.outline[i].role;
    let tag = li.querySelector('.cp-role');
    if (!r) { if (tag) tag.remove(); return; }
    if (!tag) { tag = document.createElement('span'); tag.className = 'cp-role'; li.querySelector('input[data-ot]').after(tag); }
    tag.textContent = ROLE[r];
  });
}
/* 칸 역할(시수표 등)은 이름·순서가 바뀔 때마다 다시 정함. 빠진 칸의 초안 글도 빼고, 지침 항목은 남은 칸으로 */
function setOutline(o, note) {
  plan.outline = withRoles(o);
  if (plan.guide) plan.guide = normGuide(plan.guide, plan.outline);
  if (plan.draft) plan.draft = Object.fromEntries(Object.entries(plan.draft).filter(([k]) => plan.outline.some(x => x.id === k)));
  outlineNote = note || '';
  unfinal(plan); persist(); renderMain();
}

/* ---------- 3단계: 초안·지침 점검 ---------- */
const ROMAN = 'ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ';
function overlapHTML() {
  const r = plan.draft ? overlap(plan.sources.lastPlan, draftText(plan.draft)) : null;
  if (!r) return '';
  const hi = r.percent >= 60;
  return `<div class="banner ${hi ? 'warn' : 'info'}" id="cpOverlap"><span class="grow"><b>작년 계획과 ${r.percent}% 같아요.</b>${hi ? ' 아래 문장을 올해 우리 반에 맞게 새로 써 주세요.' : ''}
    ${hi ? `<ul class="yp-same-list">${r.same.slice(0, 12).map(x => `<li class="yp-same">${esc(x)}</li>`).join('')}</ul>` : ''}</span></div>`;
}
function guideHTML() {
  if (plan.guide && !plan.guide.length && plan.sources.guide.trim()) return '<div class="yp-card"><h3>올해 지침 점검</h3><p class="muted cp-guide-none">올해 지침에서 계획서에 따로 넣을 항목을 찾지 못했어요.</p></div>';
  if (!plan.guide || !plan.guide.length) return '';
  const name = Object.fromEntries(plan.outline.map(x => [x.id, x.title]));
  const st = guideStatus(plan.guide, plan.draft);
  return `<div class="yp-card"><h3>올해 지침 점검</h3><p class="muted">빠진 항목은 [넣기]로 그 칸에 더할 수 있어요.</p>
    <ul class="yp-guide" id="cpGuide">${st.map((g, i) => `<li data-g="${i}" class="${g.included ? 'in' : 'out'}">
      <div class="yp-guide-h"><b>${esc(g.item)}</b><span class="yp-tag ${g.included ? 'ok' : 'no'}">${g.included ? '반영됨' : '빠짐'}</span></div>
      ${!g.included && g.sentence ? `<div class="yp-guide-s"><span class="muted cp-guide-sec">「${esc(name[g.section] || '')}」에 넣을 문장: </span>${esc(g.sentence)}
        <button class="btn tonal" type="button" data-insert="${i}">넣기</button></div>` : ''}</li>`).join('')}</ul></div>`;
}
/* 월별 표는 늘 3월~다음 해 2월 12줄 (AI가 빠뜨리거나 비운 달도 다시 쓸 수 있게) */
const MONTHS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2];
const monthRows = () => MONTHS.map(month => ({ month, text: (plan.monthly.find(x => x.month === month) || {}).text || '' }));
function monthlyHTML() {
  return `<div class="yp-tbl-wrap"><table class="yp-tbl" id="cpMonthly"><thead><tr><th>월</th><th>주요 활동</th></tr></thead><tbody>${monthRows().map(x => `<tr>
    <td class="num">${x.month}월</td><td><input class="field" data-mon="${x.month}" value="${esc(x.text)}" aria-label="${x.month}월 주요 활동"></td></tr>`).join('')}</tbody></table></div>`;
}
const HINT = { hours: '첨부한 진도표의 교과별 시수표가 이 칸 뒤에 붙어요(4단계에서 확인).', eval: '첨부한 평가계획에서 읽은 평가 표가 이 칸 뒤에 붙어요(4단계에서 확인).', monthly: '' };
function step3() {
  const b = busy[plan.id];
  if (b === 'guide' || b === 'draft') return `<div class="yp-card"><p class="muted"><span class="spin"></span> ${b === 'guide' ? '올해 지침에서 꼭 넣을 항목을 찾고 있어요…' : '칸마다 올해 초안을 쓰고 있어요. 다른 메뉴로 가도 계속 써요…'}</p></div>`;
  const d = plan.draft;
  if (!d) return `<div class="yp-card"><h3>초안</h3><p class="muted">목차 칸마다 작년 글의 짜임과 문체를 따라 올해 우리 반에 맞게 써요.${plan.sources.guide.trim() ? ' 올해 지침에서 꼭 넣을 항목을 먼저 찾아 함께 넣어요.' : ''} 학생 이름은 보내지 않아요.</p>
    <div class="row"><button class="btn primary" type="button" data-c="draft">AI로 초안 쓰기</button><button class="btn" type="button" data-c="blank">직접 쓰기</button></div></div>`;
  const leafIds = new Set(leaves(plan.outline).map(x => x.id));
  let a = 0, n = 0;
  const secs = plan.outline.map(x => {
    if (x.level === 1) { a++; n = 0; }
    else n++;
    const head = x.level === 1 ? `${ROMAN[a - 1] || a}. ${x.title}` : `${n}. ${x.title}`;
    // 한글 파일에 들어가는 글은 모두 보이고 고칠 수 있게: 글 쓰는 칸, 글이 남은 상위 칸
    const ta = `<textarea class="field" data-sec="${esc(x.id)}" rows="4" aria-label="${esc(x.title)}">${esc(d[x.id] || '')}</textarea>`;
    if (!leafIds.has(x.id)) return `<h3 class="cp-sec-l1">${esc(head)}</h3>${String(d[x.id] || '').trim() ? ta : ''}`;
    return `<section class="yp-sec cp-sec"><h4>${esc(head)}</h4>${ta}
      ${x.role === 'monthly' ? monthlyHTML() : ''}
      ${HINT[x.role] ? `<p class="muted">${HINT[x.role]}</p>` : ''}</section>`;
  }).join('');
  return `<div id="cpOverlapBox">${overlapHTML()}</div>${guideHTML()}
    <div class="yp-card" id="cpDraft">${secs}
      <div class="row"><button class="btn text" type="button" data-c="draft">AI로 다시 쓰기 (고친 내용은 사라져요)</button></div></div>`;
}
/* AI 일이 끝나면: 그 계획의 그 단계(초안 3, 평가 표 4)를 보고 있을 때만 다시 그림 */
function finish(id, step) {
  delete busy[id];
  if (!visible() || plan.id !== id) return;
  if (plan.step === step) renderMain();
  else if (errs[id]) toast(errs[id], 6000);
}
const BUSY_MSG = 'AI가 이 계획의 다른 일을 하고 있어요. 끝나면 다시 눌러 주세요.';
const SAVE_FAIL = '저장 공간이 모자라 이 계획을 저장하지 못해 초안을 쓰지 않았어요. 쓰지 않는 계획을 지우거나 긴 자료를 줄여 주세요.';
async function runDraft() {
  const id = plan.id;
  if (busy[id]) { toast(BUSY_MSG); return; }
  if (!ai.ready()) { errs[id] = '초안을 쓸 AI를 먼저 정해 주세요. 왼쪽 아래 AI에서 정할 수 있어요.'; renderMain(); return; }
  if (!saved) persist();
  delete errs[id]; delete notes[id];
  if (!getPlan(id)) { errs[id] = SAVE_FAIL; renderMain(); return; }
  try {
    // 지침 항목을 찾지 못하거나 지침 읽기가 실패해도 초안은 씀 (실패면 다음에 다시 찾음)
    if (plan.sources.guide.trim() && !plan.guide) {
      busy[id] = 'guide'; renderMain();
      try {
        const v = await ai.generateJSON(guidePrompt(plan), { task: 'plan', valid: x => Array.isArray(x) });
        apply(id, p => { p.guide = normGuide(v, p.outline); });
      } catch (e) { notes[id] = `올해 지침에서 항목을 찾지 못해 지침 점검 없이 초안을 썼어요(${ai.errorMessage(e && e.code, e)}). [AI로 다시 쓰기]를 누르면 지침부터 다시 찾아요.`; }
    }
    const target = getPlan(id);
    if (!target) { errs[id] = SAVE_FAIL; finish(id, 3); return; }
    busy[id] = 'draft'; if (visible() && plan.id === id) renderMain();
    const prompt = draftPrompt(target, { bodies: sectionBodies(target.sources.lastPlan, target.outline), hours: hoursRows(target.attach), evalCount: target.evalRows.length });
    const v = await ai.generateJSON(prompt, { task: 'plan', valid: x => Object.keys(normSections(x, target.outline)).length > 0 });
    apply(id, p => {
      p.draft = normSections(v, p.outline);
      const m = normMonthly(v);
      if (m.length) p.monthly = m;
      if (p.status === 'final') p.status = 'draft';
    });
  } catch (e) { errs[id] = ai.errorMessage(e && e.code, e); }
  finish(id, 3);
}
let ovT = null;
function refreshOverlap() {
  clearTimeout(ovT);
  ovT = setTimeout(() => { const b = box && box.querySelector('#cpOverlapBox'); if (b) b.innerHTML = overlapHTML(); }, 250);
}

/* ---------- 4단계: 첨부·시수표·평가 표·내보내기 ---------- */
const EVAL_COLS = [['subject', '교과'], ['unit', '단원(영역)'], ['standard', '성취기준'], ['method', '평가 방법'], ['when', '시기']];
const noSec = role => !plan.outline.some(x => x.role === role);
function step4() {
  const hours = hoursRows(plan.attach);
  const jin = plan.attach.filter(a => a.kind === 'jindo');
  const live = jin.filter(a => attMem[a.id] && attMem[a.id].jindo);
  return attachHTML()
    + `<div class="yp-card"><h3>교과별 시수표</h3>
      ${hours.length ? `<div class="yp-tbl-wrap"><table class="yp-tbl cp-hours" id="cpHours"><thead><tr><th>교과</th><th>시수</th></tr></thead><tbody>${hours.map(r => `<tr><td>${esc(r[0])}</td><td class="num">${esc(r[1])}</td></tr>`).join('')}</tbody></table></div>`
        : '<p class="muted">연간지도계획 표가 있는 진도표를 첨부하면 교과별 시수를 읽어 표로 넣어요.</p>'}
      ${hours.length && noSec('hours') ? '<p class="muted">목차에 「시간 배당」·「시수」 칸이 없어 한글 파일에는 들어가지 않아요. 2단계에서 칸을 더해 주세요.</p>' : ''}
      ${live.length ? `<div class="row">${live.map(a => `<button class="btn tonal" type="button" data-toclass="${esc(a.id)}">학급 › 진도표·시수에도 넣기${live.length > 1 ? ` (${esc(a.name)})` : ''}</button>`).join('')}</div>` : ''}
      ${jin.some(a => a.summary.subjects.length && !live.includes(a)) ? '<p class="muted">학급 메뉴로 넣으려면 진도표를 다시 넣어 주세요(차시 목록은 저장하지 않아요).</p>' : ''}
    </div>`
    + evalHTML() + exportHTML();
}
function evalHTML() {
  const b = busy[plan.id] === 'eval', rows = plan.evalRows;
  const has = plan.attach.some(a => a.kind === 'eval' && a.text);
  return `<div class="yp-card"><h3>평가 표</h3>
      <p class="muted">${has ? '첨부한 평가계획을 AI로 읽어 교과·단원·성취기준·평가 방법·시기 표로 넣어요. 학생 이름은 보내지 않아요.' : '평가계획을 첨부하면 AI로 읽어 평가 표를 만들어요. 줄을 더해 직접 써도 돼요.'}</p>
      ${b ? '<p class="muted"><span class="spin"></span> 평가계획에서 평가 표를 읽고 있어요…</p>' : ''}
      ${rows.length ? `<div class="yp-tbl-wrap"><table class="yp-tbl cp-eval" id="cpEval"><thead><tr>${EVAL_COLS.map(c => `<th>${c[1]}</th>`).join('')}<th></th></tr></thead><tbody>${rows.map((r, i) => `<tr>
        ${EVAL_COLS.map(([k, n]) => `<td><input class="field" data-ev="${i}" data-ek="${k}" value="${esc(r[k])}" aria-label="${i + 1}번째 줄 ${n}"></td>`).join('')}
        <td><button class="icon-btn" type="button" data-evdel="${i}" aria-label="${i + 1}번째 줄 빼기">×</button></td></tr>`).join('')}</tbody></table></div>` : ''}
      ${rows.length && noSec('eval') ? '<p class="muted">목차에 「평가 계획」 칸이 없어 한글 파일에는 들어가지 않아요. 2단계에서 칸을 더해 주세요.</p>' : ''}
      <div class="row">${has && !b ? `<button class="btn tonal" type="button" data-c="evalRead">${rows.length ? 'AI로 다시 읽기 (고친 내용은 사라져요)' : 'AI로 평가 표 읽기'}</button>` : ''}<button class="btn text" type="button" data-c="evalAdd">+ 줄 더하기</button></div>
    </div>`;
}
function exportHTML() {
  const fin = plan.status === 'final', d = !!plan.draft;
  return `<div class="yp-card"><h3>내보내기와 확정</h3>
      <p class="muted">한글 파일은 목차 그대로 제목과 칸 글을 쓰고, 시수표·평가 표·월별 표는 그 칸 뒤에, 첨부파일은 끝 「붙임」에 적어요. 확정한 계획은 다음 해 「지난 학급운영계획에서 불러오기」로 쓸 수 있어요.</p>
      ${plan.attach.length ? `<div class="cp-buim"><b>붙임</b><ol id="cpBuim">${plan.attach.map(a => `<li>${esc(KIND_NAME[a.kind] || '첨부')}(${esc(a.name)}) 1부.</li>`).join('')}</ol></div>` : ''}
      ${plan.monthly.length && noSec('monthly') ? '<p class="muted">목차에 「월별」 칸이 없어 월별 활동 표는 한글 파일에 들어가지 않아요. 2단계에서 칸을 더해 주세요.</p>' : ''}
      ${!d ? '<p class="banner warn"><span class="grow">3단계에서 초안을 먼저 써 주세요.</span></p>' : fin ? '<p class="banner ok"><span class="grow">확정한 계획이에요. 고치면 다시 「작성 중」이 돼요.</span></p>' : ''}
      <div class="row yp-out">${exportButton('data-c="hwpx"', { disabled: !d })}<span class="grow"></span>
        <button class="btn primary" type="button" data-c="final"${d ? '' : ' disabled'}>${fin ? '다시 확정' : '확정'}</button></div>
    </div>`;
}
async function runEval() {
  const id = plan.id;
  if (busy[id]) { toast(BUSY_MSG); return; }
  if (!ai.ready()) { errs[id] = '평가계획을 읽을 AI를 먼저 정해 주세요. 왼쪽 아래 AI에서 정할 수 있어요.'; renderMain(); return; }
  const text = plan.attach.filter(a => a.kind === 'eval' && a.text).map(a => a.text).join('\n\n');
  if (!text.trim()) return;
  if (!saved) persist();
  delete errs[id];
  busy[id] = 'eval'; renderMain();
  try {
    const v = await ai.generateJSON(evalPrompt(text), { task: 'plan', valid: x => normEvalRows(x).length > 0 });
    apply(id, p => { p.evalRows = normEvalRows(v); if (p.status === 'final') p.status = 'draft'; });
  } catch (e) { errs[id] = ai.errorMessage(e && e.code, e); }
  finish(id, 4);
}
/* 진도표 교과를 학급 메뉴(진도표·시수)에 넣기: 고르기 창 */
function toClass(aid) {
  const a = plan.attach.find(x => x.id === aid), r = attMem[aid] && attMem[aid].jindo;
  if (!a || !r || !S().openSheet) return;
  const have = listSubjects();
  S().openSheet(`<h3>학급 › 진도표·시수에 넣을 교과</h3>
    <p class="muted" style="margin:0">「${esc(a.name)}」에서 읽은 교과예요. 이미 있는 교과는 차시 목록만 바꾸고 체크 기록은 그대로 둬요. 창체는 영역별 표 대신 합계 표를 골라 두었어요.</p>
    <ul class="cls-pick">${r.subjects.map((s, i) => `<li><label><input type="checkbox" data-cpj="${i}"${s.pick ? ' checked' : ''}> <b>${esc(s.name)}</b>
      <span class="muted">${s.lessons.length}차시</span></label>${have.some(h => h.name === s.name) ? '<span class="cls-tag">이미 있어요 — 바꿔요</span>' : ''}</li>`).join('')}</ul>
    <div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-close>취소</button><button class="btn primary" type="button" data-cpok>넣기</button></div>`,
  sh => sh.querySelector('[data-cpok]').addEventListener('click', () => {
    const picked = [...sh.querySelectorAll('[data-cpj]')].filter(c => c.checked).map(c => r.subjects[+c.dataset.cpj]);
    if (!picked.length) { toast('교과를 하나 이상 골라 주세요'); return; }
    const ok = importSubjects(picked);
    S().closeSheet();
    toast(ok ? `학급 › 진도표·시수에 교과 ${picked.length}개를 넣었어요. 학급 메뉴에서 「다음 차시」를 확인해 주세요.` : '저장 공간이 모자라 교과를 다 넣지 못했어요.', 6000);
  }));
}
async function downloadHwpx() {
  if (!plan.draft) return;
  try { toast(await exportDoc(planDoc(plan), planTitle(plan)), 6000); }
  catch (e) { toast('파일을 저장하지 못했어요'); }
}
function confirmPlan() {
  if (!plan.draft) return;
  plan.status = 'final';
  persist(); renderMain();
  toast('확정했어요. 다음 해 「지난 학급운영계획에서 불러오기」로 쓸 수 있어요.');
}

/* ---------- 단계 옮기기 ---------- */
function goStep(n) {
  plan.step = n;
  plan.maxStep = Math.max(plan.maxStep, n);
  if (n >= 2) ensureOutline();
  persist();
  renderMain();
}

/* [예시로 채우기]: 새 계획에 지어낸 작년 계획서·올해 지침·첨부(파일에서 읽은 것과 같은 길을 거침) */
function fillSample() {
  const s = sampleSources(today()), p = newPlan(), last = stripNames(s.lastPlan.text);
  Object.assign(p, { grade: p.grade || 3, room: p.room || 2, boys: 12, girls: 13, motto: '서로 돕고 함께 웃는 우리 반' });
  p.sources = { lastPlan: cap(last.text), guide: s.guide.text };
  p.sourceNames = { lastPlan: [s.lastPlan.name], guide: [s.guide.name] };
  p.attach = s.attach.map(f => attachFrom(f.name, f.text).att);
  plan = p; saved = false; showPrev = false; outlineNote = '';
  persist(); render();
  toast(`예시를 채웠어요. ${privacyMsg(last)}`, 7000);
}

function askDelete() {
  const id = plan.id;
  if (!S().openSheet) return;
  S().openSheet(`<h3>「${esc(planTitle(plan))}」 지우기</h3>
    <p class="muted" style="margin:0">계획서·목차·넣은 자료·첨부 요약이 모두 지워져요. 되돌릴 수 없어요.</p>
    <div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-close>그만두기</button><button class="btn primary" type="button" data-c="deleteYes">지우기</button></div>`,
  sh => sh.querySelector('[data-c="deleteYes"]').addEventListener('click', () => {
    deletePlan(id);
    S().closeSheet();
    plan = listPlans()[0] || newPlan(); saved = !!getPlan(plan.id);
    if (saved) setCurrent(plan.id);
    render(); toast('지웠어요');
  }));
}

/* ---------- 입력·누르기 ---------- */
const NUMS = { year: [2020, 2100], grade: [1, 6], room: [1, 30], boys: [0, 60], girls: [0, 60] };
document.addEventListener('input', e => {
  if (!box || !box.contains(e.target) || !visible()) return;
  const el = e.target;
  if (el.dataset.pk) {
    const k = el.dataset.pk;
    if (NUMS[k]) { const v = Math.round(Number(el.value)); plan[k] = el.value !== '' && v >= NUMS[k][0] && v <= NUMS[k][1] ? v : k === 'year' ? plan.year : null; }
    else plan[k] = el.value;
  } else if (el.dataset.src) {
    if (el.value.length > MAX_SRC) { el.value = cap(el.value); toast('앞 6만 자만 저장해요', 4000); }
    plan.sources[el.dataset.src] = el.value;
    // 지침을 고치면 지침 항목을 다시 뽑음
    if (el.dataset.src === 'guide') plan.guide = null;
  } else if (el.dataset.sec && plan.draft) { plan.draft = { ...plan.draft, [el.dataset.sec]: el.value }; refreshOverlap(); }
  else if (el.dataset.mon != null) {
    const m = monthRows(), x = m.find(r => r.month === +el.dataset.mon);
    if (!x) return;
    x.text = el.value; plan.monthly = m;
  } else if (el.dataset.ev != null) {
    const r = plan.evalRows[+el.dataset.ev];
    if (!r || !EVAL_COLS.some(c => c[0] === el.dataset.ek)) return;
    r[el.dataset.ek] = el.value;
  } else return;
  if (el.dataset.pk || el.dataset.sec || el.dataset.mon != null || el.dataset.ev != null) unfinal(plan);
  persistSoon();
});
document.addEventListener('change', e => {
  if (!box || !box.contains(e.target) || !visible()) return;
  const el = e.target;
  if (el.id === 'cpFile') {
    const t = el.dataset.target, files = [...el.files];
    el.value = '';
    if (files.length) { if (t === 'attach') addAttach(files); else if (t) addFiles(t, files); }
    return;
  }
  if (el.id === 'cpGrade') { plan.grade = el.value ? +el.value : null; unfinal(plan); persist(); return; }
  if (el.dataset.akind) { setKind(el.dataset.akind, el.value); return; }
  // 붙여넣은 작년 계획서·지침: 칸을 벗어나면 명단 줄·전화번호는 빼고 이름 칸은 가림 (저장은 모델이 늘 거침)
  if (el.dataset.src) {
    const r = stripNames(el.value);
    if (r.dropped || r.masked) { el.value = r.text; plan.sources[el.dataset.src] = r.text; persist(); toast(privacyMsg(r), 7000); }
    return;
  }
  if (el.dataset.ot != null) {
    const x = plan.outline.find(o => o.id === el.dataset.ot);
    if (!x) return;
    if (!el.value.trim()) { el.value = x.title; return; }
    x.title = el.value.trim().slice(0, 60);
    plan.outline = withRoles(plan.outline);
    unfinal(plan); persist();
    refreshRoles();
  }
});
const move = (a, i, j) => { if (j < 0 || j >= a.length) return a; const b = a.slice(); [b[i], b[j]] = [b[j], b[i]]; return b; };
document.addEventListener('click', e => {
  if (!box || !box.contains(e.target) || !visible()) return;
  flushSave();
  const item = e.target.closest('[data-cp]');
  if (item) { const p = getPlan(item.dataset.cp); if (p) { plan = p; saved = true; outlineNote = ''; setCurrent(p.id); render(); } return; }
  const st = e.target.closest('[data-step]');
  if (st) { const n = +st.dataset.step; if (n <= plan.maxStep) goStep(n); return; }
  const fb = e.target.closest('[data-file]');
  if (fb) { const inp = box.querySelector('#cpFile'); inp.dataset.target = fb.dataset.file; inp.click(); return; }
  const pv = e.target.closest('[data-prev]');
  if (pv) {
    const p = getPlan(pv.dataset.prev);
    if (p) {
      const prev = plan.sources.lastPlan.trim();
      plan.sources.lastPlan = cap((prev ? prev + '\n\n' : '') + planText(p));
      plan.sourceNames.lastPlan = [...plan.sourceNames.lastPlan, `지난 계획: ${planTitle(p)}`];
      showPrev = false; persist(); renderMain();
    }
    return;
  }
  const ins = e.target.closest('[data-insert]');
  if (ins && plan.guide && plan.draft) {
    const g = plan.guide[+ins.dataset.insert];
    if (g) { plan.draft = insertSentence(plan.draft, g.section, g.sentence); if (plan.status === 'final') plan.status = 'draft'; persist(); renderMain(); toast('초안에 넣었어요'); }
    return;
  }
  const ad = e.target.closest('[data-adel]');
  if (ad) { plan.attach = plan.attach.filter(x => x.id !== ad.dataset.adel); delete attMem[ad.dataset.adel]; unfinal(plan); persist(); renderMain(); return; }
  const tc = e.target.closest('[data-toclass]');
  if (tc) { toClass(tc.dataset.toclass); return; }
  const ed = e.target.closest('[data-evdel]');
  if (ed) { plan.evalRows.splice(+ed.dataset.evdel, 1); if (plan.status === 'final') plan.status = 'draft'; persist(); renderMain(); return; }
  const o = plan.outline, idx = k => +e.target.closest(`[${k}]`).getAttribute(k);
  if (e.target.closest('[data-oup]')) { const i = idx('data-oup'); setOutline(move(o, i, i - 1)); return; }
  if (e.target.closest('[data-odown]')) { const i = idx('data-odown'); setOutline(move(o, i, i + 1)); return; }
  if (e.target.closest('[data-odel]')) { const i = idx('data-odel'); setOutline(o.filter((_, j) => j !== i)); return; }
  if (e.target.closest('[data-olv]')) { const i = idx('data-olv'); setOutline(o.map((x, j) => (j === i ? { ...x, level: x.level === 1 ? 2 : 1 } : x))); return; }
  const b = e.target.closest('[data-c]');
  if (!b) return;
  const a = b.dataset.c;
  if (a === 'new') { plan = newPlan(); saved = false; showPrev = false; outlineNote = ''; render(); }
  else if (a === 'sample') fillSample();
  else if (a === 'next') goStep(Math.min(4, plan.step + 1));
  else if (a === 'prev') goStep(Math.max(1, plan.step - 1));
  else if (a === 'importPrev') { showPrev = !showPrev; renderMain(); }
  else if (a === 'draft') runDraft();
  else if (a === 'evalRead') runEval();
  else if (a === 'evalAdd') { plan.evalRows = [...plan.evalRows, { subject: '', unit: '', standard: '', method: '', when: '' }]; renderMain(); const f = box.querySelector(`#cpEval input[data-ev="${plan.evalRows.length - 1}"]`); if (f) f.focus(); }
  else if (a === 'hwpx') downloadHwpx();
  else if (a === 'final') confirmPlan();
  else if (a === 'blank') { plan.draft = {}; persist(); renderMain(); }
  else if (a === 'oAdd') { setOutline([...o, { id: newId(), title: '새 칸', level: 2 }]); const ins = box.querySelectorAll('#cpOutline input[data-ot]'); if (ins.length) { ins[ins.length - 1].focus(); ins[ins.length - 1].select(); } }
  else if (a === 'oLast') { const p = parseOutline(plan.sources.lastPlan); if (p.length) setOutline(p, `작년 계획서 목차 그대로예요(${p.length}칸).`); else toast('작년 계획서에서 목차를 찾지 못했어요'); }
  else if (a === 'oStd') setOutline(STANDARD.map(x => ({ ...x })), '표준 목차로 바꿨어요.');
  else if (a === 'delete') askDelete();
});

onEnter('plan', (tab, section) => {
  if (!box || !section.contains(box)) { box = document.createElement('div'); box.className = 'cp-box'; section.append(box); }
  curTab = tab;
  box.hidden = tab !== 'class';
  flushSave();
  if (tab === 'class') { const p = getPlan(plan.id); if (p) plan = p; render(); }
});

/* 떠 있는 버튼: 작년 학급운영계획 → 새 계획(학년·반은 학급 정보, 없으면 입력 칸) → 초안까지(설정에 따라 자료로만) */
const NO_AI = ' AI를 정하면 초안을 써요(왼쪽 아래 AI).';
registerInbox('class-plan', {
  act: () => '새 학급운영계획을 만들어 작년 계획서로 넣기',
  fields: () => {
    const p = newPlan();
    return p.grade && p.room ? [] : [
      { key: 'grade', label: '학년', type: 'select', options: [['', '고르기'], ...[1, 2, 3, 4, 5, 6].map(g => [String(g), `${g}학년`])], value: p.grade ? String(p.grade) : '', required: true },
      { key: 'room', label: '반', type: 'number', value: p.room || '', required: true }];
  },
  async run(files, v, opts) {
    goMenu('plan', 'class');
    flushSave();
    plan = newPlan(); saved = false; showPrev = false; outlineNote = '';
    if (v.grade) plan.grade = +v.grade;
    if (v.room) plan.room = +v.room;
    persist(); render();
    await addFiles('lastPlan', files);
    if (opts.plan !== 'draft') return '새 학급운영계획에 작년 계획서를 넣었어요.';
    if (!ai.ready()) return '새 학급운영계획에 작년 계획서를 넣었어요.' + NO_AI;
    goStep(2); goStep(3);
    await runDraft();
    return '';
  }
});
/* 떠 있는 버튼 › 지침: 지금 학급운영계획의 「올해 지침」으로 */
export const classGuide = {
  key: 'class', label: '학급운영계획',
  current: () => { const p = getPlan(currentId()) || listPlans()[0]; return p ? { id: p.id, title: planTitle(p) } : null; },
  async add(id, files) {
    goMenu('plan', 'class');
    flushSave();
    const p = getPlan(id);
    if (!p) return '그 학급운영계획을 찾지 못했어요.';
    plan = p; saved = true; outlineNote = ''; setCurrent(p.id);
    plan.step = 1; render();
    await addFiles('guide', files);
    return '학급운영계획의 올해 지침으로 넣었어요. 초안을 쓸 때 지침 항목을 점검해요.';
  }
};
