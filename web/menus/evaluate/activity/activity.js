/* 평가 › 활동지 (스펙 4장): 목록과 1단계(활동지 넣기)·2단계(기준 확인). 3·4단계는 activity-grading.js, 5단계·모아 보기는 activity-results.js가
   registerStep·registerView로 붙임. 학생 이름은 저장·전송하지 않음(번호만) */
import { onEnter } from '../../../core/shell.js';
import { stepsHTML } from '../../../core/steps.js';
import * as ai from '../../../core/ai.js';
import { toast } from '../../../core/ui.js';
import { getSchool } from '../../../core/settings.js';
import { stripNames } from '../../../core/privacy.js';
import { aiRowHTML } from '../../../core/ai-roles.js';
import { readBundle, openBundleCard, needsCard, bundleBoxHTML, onBundle, bundleMsg } from '../../../core/bundle.js';
import { newActivity, listActivities, getActivity, saveActivity, removeActivity } from './activity-model.js';
import { readMeta, termOf, SUBJECTS } from './activity-read.js';
import { TYPES, criteriaPrompt, normCriteria, applyKey } from './activity-ai.js';
import { sampleActivity } from './activity-sample.js';

export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const SS = () => window.SSAM || {};
const STEPS = ['활동지 넣기', '기준 확인', '학생 활동지', '채점·확인', '결과'];
const SRC = { teacher: '교사용에서', answer: '정답에서', ai: 'AI가 만듦', edit: '선생님이 고침' };
/* 화면 상태. critPages: 기준을 만들 빈 활동지·교사용 쪽 그림(이 화면에만), pending: 1단계에 같이 넣은 학생 쪽(3단계가 받음) */
export const A = { view: 'list', id: null, draft: null, step: 1, msg: '', busy: '', critFor: null, critPages: [], pending: null };
let box = null, curTab = '';
const stepViews = {}, views = {};
export const registerStep = (n, v) => { stepViews[n] = v; };
export const registerView = (name, v) => { views[name] = v; };
export const getBox = () => box;
export const visible = () => curTab === 'activity' && !!box && box.isConnected && !box.hidden && !box.closest('[hidden]');
export const curAct = () => (A.id ? getActivity(A.id) : A.draft);
const hasContent = a => !!(a.sheet.student || a.sheet.teacher || a.items.length || (A.critFor === a.id && A.critPages.length));
export function commitAct(a) {
  if (!getActivity(a.id) && !hasContent(a)) { A.draft = a; return true; }
  const ok = saveActivity(a);
  if (!ok) toast('저장 공간이 모자라 저장하지 못했어요. 설정 › 학년도에서 백업하고 지난 자료를 정리해 주세요.', 7000);
  if (ok && curAct() && curAct().id === a.id) { A.id = a.id; A.draft = null; }
  return ok;
}
export const reach = a => (!a ? 1 : !hasContent(a) ? 1 : !a.confirmed ? 2 : !a.students.length && !(A.pending && A.pending.id === a.id) ? 3 : !a.students.some(s => s.status === 'done') ? 4 : 5);
export function openActivity(id, step) {
  const a = getActivity(id);
  if (!a) return;
  A.view = 'act'; A.id = id; A.draft = null; A.msg = '';
  A.step = step || (a.done ? 5 : reach(a));
  render();
}
export const goStep = n => { A.step = n; render(); };
export function startNew(meta = {}) {
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const a = newActivity({ date: today, term: termOf(today, getSchool().breaks), ...meta });
  A.view = 'act'; A.id = null; A.draft = a; A.step = 1; A.msg = ''; A.critFor = a.id; A.critPages = []; A.pending = null;
  render();
  return a;
}

/* ---------- 그리기 ---------- */
let pendingRefresh = false;
const editing = () => { const e = document.activeElement; return !!(e && box && box.contains(e) && (e.tagName === 'TEXTAREA' || e.tagName === 'SELECT' || (e.tagName === 'INPUT' && !/^(file|checkbox|radio|button)$/.test(e.type)))); };
export function refresh(id) {
  if (!visible() || (id && (!curAct() || curAct().id !== id))) return;
  if (editing()) { pendingRefresh = true; return; }
  pendingRefresh = false; render();
}
const termName = t => (t === 1 ? '1학기' : t === 2 ? '2학기' : '');
function listHTML() {
  const list = listActivities();
  const cards = list.map(s => `<li class="yp-card act-card" data-ac-open="${esc(s.id)}">
    <b class="act-c-t">${esc(s.title || '이름 없는 활동지')}</b>
    <span class="muted">${esc([s.subject, s.date, termName(s.term)].filter(Boolean).join(' · '))} · 학생 ${s.n}명</span>
    <span class="chip${s.done ? ' ok' : ''}">${s.done ? '확정' : s.n ? '채점 중' : '준비 중'}</span>
    <span class="grow"></span><button class="btn text" type="button" data-ac="del" data-id="${esc(s.id)}">지우기</button></li>`).join('');
  return `<div class="m-head"><h2>활동지</h2><p class="muted">수업 중·수업 후 활동지를 넣으면 문항마다 ○·△·×·안 함으로 보고, 학생마다 잘한 점·더 해 볼 점과 수준(잘함·보통·노력)을 써요. 정답이 없는 활동지는 AI가 기준을 먼저 만들어요.</p></div>
    <div class="row"><button class="btn primary" type="button" data-ac="new">새 활동지</button><button class="btn" type="button" data-ac="sample">예시로 채우기</button>${views.records ? '<button class="btn" type="button" data-ac="records">학생별 모아 보기</button>' : ''}</div>
    ${list.length ? `<ul class="act-list">${cards}</ul>` : '<div class="yp-card"><p class="muted" style="margin:0">아직 활동지가 없어요. [새 활동지]로 활동지 파일을 넣어 주세요. 바로 보려면 [예시로 채우기].</p></div>'}`;
}
function metaHTML(m) {
  const f = (id, label, v, attrs = '') => `<label class="yp-f"><span class="lab">${label}</span><input class="field" id="${id}" data-meta="${id.slice(3).toLowerCase()}" value="${esc(v == null ? '' : v)}" ${attrs} autocomplete="off"></label>`;
  return `<div class="act-meta">
    <label class="yp-f"><span class="lab">교과</span><select class="field" id="actSubject" data-meta="subject"><option value="">고르기</option>${SUBJECTS.map(s => `<option${s === m.subject ? ' selected' : ''}>${s}</option>`).join('')}</select></label>
    ${f('actUnit', '단원', m.unit)}${f('actLesson', '차시', m.lesson)}${f('actTitle', '활동 이름', m.title)}${f('actPages', '교과서 쪽', m.pages)}${f('actDate', '날짜', m.date, 'type="date"')}
    <label class="yp-f"><span class="lab">학기</span><select class="field" id="actTerm" data-meta="term"><option value="1"${m.term === 1 ? ' selected' : ''}>1학기</option><option value="2"${m.term === 2 ? ' selected' : ''}>2학기</option></select></label>
  </div>`;
}
const lines = s => (String(s || '').trim() ? String(s).trim().split('\n').length : 0);
function step1HTML(a) {
  const crit = A.critFor === a.id ? A.critPages.length : 0, pend = A.pending && A.pending.id === a.id ? A.pending.pages.length : 0;
  const have = [a.sheet.student && `학생용 글 ${lines(a.sheet.student)}줄`, a.sheet.teacher && `교사용·예시·정답 글 ${lines(a.sheet.teacher)}줄`, crit && `활동지 그림 ${crit}장`, pend && `학생 쪽 ${pend}장(3단계로)`].filter(Boolean);
  return `<div class="yp-card"><h3>활동지</h3>
      ${bundleBoxHTML('act', '활동지 한글·PDF·사진, 교사용·(예시)·[정답]이 붙은 파일, 학생 스캔까지 한꺼번에 넣으면 알아서 나눠요')}
      <p class="muted" id="actHave">${have.length ? esc(have.join(' · ')) : '아직 넣은 것이 없어요.'}</p>
      ${a.sheet.student || a.sheet.teacher ? `<details class="act-text"><summary>읽은 글 보기</summary><pre>${esc(a.sheet.student)}${a.sheet.teacher ? `\n\n— 교사용·예시·정답 —\n${esc(a.sheet.teacher)}` : ''}</pre></details>` : ''}
    </div>
    <div class="yp-card"><h3>활동지 정보</h3>${metaHTML(a.meta)}</div>
    <div class="row act-next"><button class="btn primary" type="button" data-ac="next"${hasContent(a) ? '' : ' disabled'}>다음: 기준 확인</button></div>`;
}
function itemsHTML(a) {
  const typeSel = it => `<select class="field" data-it="${it.no}" data-f="type" aria-label="${it.no}번 종류">${TYPES.map(([k, l]) => `<option value="${k}"${k === it.type ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
  const inp = (it, f, ph) => `<textarea class="field" rows="2" data-it="${it.no}" data-f="${f}" aria-label="${it.no}번 ${ph}" placeholder="${ph}">${esc(it[f])}</textarea>`;
  const rows = a.items.map(it => `<tr><td class="no">${it.no}</td><td>${typeSel(it)}</td><td>${inp(it, 'ask', '묻는 말')}</td><td>${inp(it, 'answer', ['choice', 'match', 'short'].includes(it.type) ? '정답' : '예시 답안')}</td>
    <td>${inp(it, 'ok', '○ 기준')}</td><td>${inp(it, 'part', '△ 기준')}</td><td><span class="chip src-${it.src}">${SRC[it.src] || ''}</span></td>
    <td><button class="icon-btn" type="button" data-ac="delItem" data-no="${it.no}" aria-label="${it.no}번 빼기">✕</button></td></tr>`).join('');
  return a.items.length ? `<div class="act-items-wrap"><table class="act-items" id="actItems"><thead><tr><th>번호</th><th>종류</th><th>묻는 말</th><th>정답·예시 답안</th><th>○ 기준</th><th>△ 기준</th><th>출처</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : '';
}
function step2HTML(a) {
  const busy = A.busy === 'criteria:' + a.id;
  return `<div class="yp-card"><h3>채점 기준</h3>${aiRowHTML('grade')}
      <p class="muted" style="margin:0">${a.sheet.teacher ? '교사용·예시·정답에서 가져오고 모자란 기준만 AI가 만들어요.' : '정답·예시 답안이 없어서 AI가 빈 활동지를 읽고 기준을 만들어요. 고친 뒤 [기준 확정]을 누르면 모든 학생에게 같은 기준을 써요.'}</p>
      ${busy ? '<p class="muted"><span class="spin"></span> AI가 기준을 만들고 있어요…</p>' : ''}
      ${A.msg ? `<div class="banner err" role="alert"><span class="grow">${esc(A.msg)}</span></div>` : ''}
      ${itemsHTML(a)}
      <div class="row"><button class="btn" type="button" data-ac="criteria"${busy ? ' disabled' : ''}>${a.items.length ? 'AI로 기준 다시 만들기' : 'AI로 기준 만들기'}</button><button class="btn text" type="button" data-ac="addItem">+ 문항</button>
        <span class="grow"></span>${a.confirmed ? '<span class="chip ok">확정함</span>' : ''}</div>
      ${a.students.some(s => s.stale) ? '<p class="act-warn">기준이 바뀌었어요 · 채점한 학생은 4단계에서 다시 채점해 주세요.</p>' : ''}
    </div>
    <div class="row act-next"><button class="btn primary" type="button" data-ac="confirm"${a.items.length && !busy ? '' : ' disabled'}>${a.confirmed ? '다음: 학생 활동지' : '기준 확정'}</button></div>`;
}
function actHTML(a) {
  const body = A.step === 1 ? step1HTML(a) : A.step === 2 ? step2HTML(a) : stepViews[A.step] ? stepViews[A.step].html(a) : '<div class="yp-card"><p class="muted" style="margin:0">준비 중이에요.</p></div>';
  return `<div class="un-top"><button class="btn text" type="button" data-ac="back">‹ 목록</button><b class="un-title">${esc(a.meta.title || '새 활동지')}</b>${a.meta.subject ? `<span class="muted">${esc(a.meta.subject)}</span>` : ''}</div>
    ${stepsHTML(STEPS, A.step, reach(a))}<div class="un-body">${body}</div>`;
}
let rendering = false, again = false;
export function render() {
  if (!box) return;
  if (rendering) { again = true; return; }
  rendering = true;
  try {
    const a = A.view === 'act' ? curAct() : null;
    if (A.view === 'act' && !a) A.view = 'list';
    const inner = A.view === 'act' ? actHTML(a) : A.view !== 'list' && views[A.view] ? views[A.view].html() : listHTML();
    box.innerHTML = `<div class="m-page act-page">${inner}</div>`;
    if (A.view === 'act' && stepViews[A.step] && stepViews[A.step].bind) stepViews[A.step].bind(box, a);
    if (A.view === 'act' && A.step === 2) autoCriteria(a);
  } finally { rendering = false; }
  if (again) { again = false; render(); }
}

/* ---------- 1단계: 넣기 ---------- */
const RRN = /\d{6}\s*-\s*[1-4]\d{6}/;
/* 이름·전화번호가 적힌 줄(privacy.js)과 주민번호 모양 줄은 빼고 넣음 */
function clean(text) {
  const kept = String(text || '').split('\n').filter(l => !RRN.test(l));
  const r = stripNames(kept.join('\n'));
  return { text: r.text.trim(), cut: r.dropped + r.masked + (String(text || '').split('\n').length - kept.length) };
}
function freePages(pages) { if (pages && pages.length && SS().files) SS().files.freePages(pages); }
/* 넣은 쪽 나누기: 정답·교사용·빈 쪽은 기준 그림, 학생 쪽은 3단계로. 문서 없이 1~2쪽만 넣으면 그 쪽이 활동지(빈 활동지) */
export function sortPages(b) {
  const docless = !b.doc.student && !b.doc.teacher && b.pages.length <= 2 && b.roles.every(r => r === 'student');
  const crit = [], stu = [];
  b.pages.forEach((p, i) => ((docless || b.roles[i] !== 'student') ? crit : stu).push(p));
  return { crit, stu };
}
async function putFiles(files) {
  const a0 = curAct();
  if (!a0) return;
  const id = a0.id;
  bundleMsg('act', '읽는 중…');
  let b;
  try { b = await readBundle(files, { say: m => bundleMsg('act', m) }); }
  catch (e) { bundleMsg('act', ''); toast(e && e.message === 'PDFJS' ? 'PDF를 읽는 도구를 불러오지 못했어요. 인터넷 연결을 확인하거나 사진으로 넣어 주세요.' : '파일을 읽지 못했어요.', 6000); return; }
  bundleMsg('act', '');
  if (!b.doc.student && !b.doc.teacher && !b.pages.length) { toast(b.skipped.length ? `읽지 못한 파일: ${b.skipped.join(', ')}` : '넣을 것이 없어요.', 6000); return; }
  if (needsCard(b)) { const r = await openBundleCard(b, { what: '활동지' }); if (!r) { freePages(b.pages); return; } b = r; }
  const a = (curAct() && curAct().id === id) ? curAct() : getActivity(id) || a0;
  const s = clean(b.doc.student), t = clean(b.doc.teacher);
  if (s.text) a.sheet.student = s.text;
  if (t.text) a.sheet.teacher = t.text;
  const m = readMeta(s.text || t.text);
  for (const k of ['subject', 'unit', 'lesson', 'pages', 'title']) if (!a.meta[k] && m[k]) a.meta[k] = m[k];
  const { crit, stu } = sortPages(b);
  if (A.critFor !== id) { freePages(A.critPages); A.critPages = []; }
  A.critFor = id; A.critPages = [...A.critPages, ...crit];
  if (stu.length) { if (A.pending && A.pending.id !== id) freePages(A.pending.pages); A.pending = { id, pages: [...((A.pending && A.pending.id === id && A.pending.pages) || []), ...stu] }; }
  if ((s.text || t.text) && a.items.length) { a.items = []; a.confirmed = false; }
  commitAct(a);
  const cut = s.cut + t.cut;
  toast([`넣었어요${b.skipped.length ? ` · 읽지 못한 파일 ${b.skipped.length}개` : ''}`, cut ? `이름·전화번호·주민번호가 적힌 줄 ${cut}곳은 빼고 넣었어요` : ''].filter(Boolean).join(' · '), 6000);
  if (visible() && curAct() && curAct().id === id) render();
}
onBundle('act', files => { if (A.view === 'act' && A.step === 1) putFiles(files); else if (views.bundle) views.bundle(files); });

/* ---------- 2단계: 기준 ---------- */
let autoFor = null;
function autoCriteria(a) {
  if (a.items.length || A.busy || autoFor === a.id || !ai.ready() || !hasContent(a)) return;
  autoFor = a.id;
  makeCriteria(a.id);
}
async function critImages(id) {
  const out = [];
  if (A.critFor === id) for (const p of A.critPages.slice(0, 4)) out.push(await SS().files.pageImage(p, null));
  return out;
}
async function makeCriteria(id) {
  const a0 = curAct();
  if (!a0 || a0.id !== id || A.busy) return;
  if (!ai.ready()) { toast('설정 › AI에서 키를 넣어 주세요', 5000); return; }
  A.busy = 'criteria:' + id; A.msg = ''; render();
  try {
    const images = await critImages(id);
    const v = await ai.generateJSON(criteriaPrompt({ meta: a0.meta, student: a0.sheet.student, teacher: a0.sheet.teacher, nImages: images.length }), { images, task: 'grade', valid: x => normCriteria(x).length > 0 });
    const a = (curAct() && curAct().id === id) ? curAct() : getActivity(id);
    if (a) {
      a.items = a.sheet.teacher ? applyKey(normCriteria(v), a.sheet.teacher) : normCriteria(v);
      a.confirmed = false;
      a.students.forEach(s => { if (s.status === 'done') s.stale = true; });
      commitAct(a);
    }
  } catch (e) { A.msg = e && e.code === 'bad_json' ? 'AI 답을 읽지 못했어요. 다시 눌러 주세요.' : ai.errorMessage(e && e.code, e); }
  A.busy = '';
  refresh(id);
}
/* 기준을 고치면 확정이 풀리고, 채점한 학생은 「다시 채점」 */
function editItem(a, el) {
  const it = a.items.find(x => x.no === +el.dataset.it);
  if (!it) return;
  it[el.dataset.f] = el.value;
  it.src = 'edit';
  if (a.confirmed) a.confirmed = false;
  a.students.forEach(s => { if (s.status === 'done') s.stale = true; });
  commitAct(a);
  const chip = el.closest('tr') && el.closest('tr').querySelector('.chip');
  if (chip) { chip.textContent = SRC.edit; chip.className = 'chip src-edit'; }
}

/* ---------- 누르기·입력 ---------- */
document.addEventListener('click', e => {
  if (!box || !box.contains(e.target) || !visible()) return;
  const open = e.target.closest('[data-ac-open]');
  if (open && !e.target.closest('[data-ac]')) { openActivity(open.dataset.acOpen); return; }
  const st = e.target.closest('[data-step]');
  if (st && A.view === 'act') { goStep(+st.dataset.step); return; }
  const b = e.target.closest('[data-ac]');
  if (!b) return;
  const act = b.dataset.ac, a = curAct();
  if (act === 'new') startNew();
  else if (act === 'back') { A.view = 'list'; A.draft = null; render(); }
  else if (act === 'sample') { const s = sampleActivity(); if (saveActivity(s)) { render(); toast('예시 활동지를 넣었어요'); } }
  else if (act === 'records' && views.records) { A.view = 'records'; render(); }
  else if (act === 'del') {
    const id = b.dataset.id, s = listActivities().find(x => x.id === id);
    SS().openSheet(`<h3>「${esc((s && s.title) || '활동지')}」를 지울까요?</h3><p class="muted" style="margin:0">채점 결과와 학생별 기록도 함께 지워져요.</p>
      <div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-close>취소</button><button class="btn primary" type="button" id="actDelOk">지우기</button></div>`,
    sh => sh.querySelector('#actDelOk').addEventListener('click', () => { removeActivity(id); SS().closeSheet(); render(); }));
  } else if (!a) return;
  else if (act === 'next') goStep(2);
  else if (act === 'criteria') makeCriteria(a.id);
  else if (act === 'addItem') { a.items.push({ no: a.items.length + 1, type: 'write', ask: '', answer: '', ok: '', part: '', src: 'edit' }); a.confirmed = false; commitAct(a); render(); }
  else if (act === 'delItem') { a.items = a.items.filter(x => x.no !== +b.dataset.no).map((x, i) => ({ ...x, no: i + 1 })); a.confirmed = false; commitAct(a); render(); }
  else if (act === 'confirm') {
    if (!a.confirmed) { a.items = a.items.filter(x => String(x.ask || '').trim() || String(x.answer || '').trim()).map((x, i) => ({ ...x, no: i + 1 })); a.confirmed = a.items.length > 0; commitAct(a); }
    if (a.confirmed) goStep(3); else render();
  }
});
document.addEventListener('input', e => {
  if (!box || !box.contains(e.target) || !visible()) return;
  const a = curAct(), el = e.target;
  if (!a) return;
  if (el.dataset.it && el.dataset.f && el.dataset.f !== 'type') editItem(a, el);
  else if (el.dataset.meta && el.tagName === 'INPUT') { a.meta[el.dataset.meta] = el.value; commitAct(a); }
});
document.addEventListener('change', e => {
  if (!box || !box.contains(e.target) || !visible()) return;
  const a = curAct(), el = e.target;
  if (!a) return;
  if (el.dataset.it && el.dataset.f === 'type') { editItem(a, el); render(); }
  else if (el.dataset.meta === 'subject') { a.meta.subject = el.value; commitAct(a); }
  else if (el.dataset.meta === 'term') { a.meta.term = Number(el.value) || null; commitAct(a); }
  else if (el.dataset.meta === 'date') { a.meta.date = el.value; a.meta.term = termOf(el.value, getSchool().breaks); commitAct(a); render(); }
});
document.addEventListener('focusout', () => setTimeout(() => { if (pendingRefresh && !editing() && visible()) { pendingRefresh = false; render(); } }, 0));

onEnter('evaluate', (tab, section) => {
  if (!box || !section.contains(box)) { box = document.createElement('div'); box.className = 'act-box'; section.append(box); }
  curTab = tab;
  box.hidden = tab !== 'activity';
  if (tab === 'activity') render();
});
