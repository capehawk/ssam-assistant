/* 평가 › 단원평가 (스펙 2): 평가 목록 · 결과 모아 보기, 평가마다 4단계.
   이 파일은 탭 진입·목록·단계 틀·1단계(정답지·평가지). 2·3단계는 unit-grading.js, 4단계는 unit-feedback.js,
   결과 모아 보기는 unit-results.js가 registerStep·registerResults로 붙임 */
import { onEnter, go } from '../../../core/shell.js';
import { registerInbox } from '../../../core/inbox.js';
import { toast } from '../../../core/ui.js';
import * as ai from '../../../core/ai.js';
import { readText, fileMessage } from '../../../core/files.js';
import { stepsHTML } from '../../../core/steps.js';
import { parseKey, parsePaper, keyTotal, splitCombined } from './unit-key.js';
import { ITEM_TYPES, rescoreItem } from './unit-grade.js';
import { listTests, getTest, saveTest, removeTest, newTest, makeTitle, graded, maskOf } from './unit-model.js';
import { keyPrompt, normKeyAI } from './unit-ai.js';
import { sampleTests } from './unit-sample.js';
import { readBundle, openBundleCard, needsCard, bundleBoxHTML, onBundle } from '../../../core/bundle.js';
import { linkHTML, openLinkSheet } from '../../../core/eval-link.js';

export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const SS = () => window.SSAM || {};
export const AI_KEY = '설정 › AI에서 키를 넣어 주세요';
const STEPS = ['정답지·평가지', '답안 올리기', '채점·확인', '피드백'];
const SUBJECTS = ['국어', '수학', '사회', '과학', '영어', '도덕', '음악', '미술', '체육', '실과'];

/* 화면 상태: view 'list' | 'results' | 'test'. 저장 전의 새 평가는 draft에 둠(정답표가 생기면 저장) */
export const U = { view: 'list', id: null, draft: null, step: 1, msg: { id: null, key: '', paper: '' } };
const stepViews = {};
let resultsView = null, box = null, curTab = null;
export const registerStep = (n, v) => { stepViews[n] = v; };
export const registerResults = v => { resultsView = v; };
export const visible = () => curTab === 'unit' && !!box && box.isConnected && !box.hidden && !box.closest('[hidden]');
export const inStep = n => visible() && U.view === 'test' && U.step === n;
export const cur = () => (U.id ? getTest(U.id) : U.draft);
export const curId = () => (U.id || (U.draft && U.draft.id) || null);
export const getBox = () => box;

export function saveOrWarn(t) {
  const ok = saveTest(t);
  if (!ok) toast('저장 공간이 모자라 저장하지 못했어요', 6000);
  return ok;
}
/* 고친 평가 저장: 정답표가 생기기 전의 새 평가는 저장하지 않고 draft에 둠 */
export function commit(t) {
  if (!getTest(t.id) && !t.key.items.length) { U.draft = t; return true; }
  const ok = saveOrWarn(t);
  if (ok && curId() === t.id) { U.id = t.id; U.draft = null; }
  return ok;
}
/* 같은 평가를 보고 있으면 다시 그림 (AI가 끝났을 때 등). 선생님이 칸에 쓰는 중이면 칸을 떠날 때까지 미룸 */
let pendingRefresh = false;
const editing = () => {
  const a = document.activeElement;
  return !!(a && box && box.contains(a) && (a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || (a.tagName === 'INPUT' && !/^(file|checkbox|radio|button)$/.test(a.type))));
};
export function refresh(id) {
  if (!visible() || (id && curId() !== id)) return;
  if (editing()) { pendingRefresh = true; return; }
  pendingRefresh = false; render();
}

const reach = t => (!t || !t.key.items.length ? 1 : !t.students.length ? 2 : graded(t).length ? 4 : 3);
export function openTest(id, step) {
  const t = getTest(id);
  if (!t) return;
  U.view = 'test'; U.id = id; U.draft = null;
  U.step = step || (t.done ? 4 : Math.min(3, reach(t)));
  if (U.msg.id !== id) U.msg = { id, key: '', paper: '' };
  render();
}
export const goStep = n => { U.step = n; render(); };

/* ---------- 그리기 ---------- */
function listHTML() {
  const list = listTests();
  const cards = list.map(s => `<li class="yp-card un-card" data-un-open="${esc(s.id)}">
    <b class="un-c-t">${esc(s.title)}</b>
    <span class="muted">${esc(s.date)} · 학생 ${s.n}명${s.avg != null ? ` · 반 평균 ${s.avg}점` : ''}</span>
    <span class="chip${s.done ? ' ok' : ''}">${s.done ? '마침' : '채점 중'}</span>
    <span class="grow"></span><button class="btn text" type="button" data-un="del" data-id="${esc(s.id)}">지우기</button></li>`).join('');
  return `<div class="row"><button class="btn primary" type="button" id="unNew">새 단원평가</button><button class="btn" type="button" data-un="sample">예시로 채우기</button>${list.some(s => s.sample) ? '<button class="btn text" type="button" data-un="sampleDel">예시 지우기</button>' : ''}</div>
    ${list.length ? `<ul class="un-list">${cards}</ul>` : '<div class="yp-card"><p class="muted" style="margin:0">아직 단원평가가 없어요. [새 단원평가]로 정답지부터 넣어 주세요. 바로 보려면 [예시로 채우기].</p></div>'}`;
}
function metaHTML(m) {
  const f = (id, label, v, attrs = '') => `<label class="yp-f"><span class="lab">${label}</span><input class="field" id="${id}" value="${esc(v == null ? '' : v)}" ${attrs}></label>`;
  return `<div class="un-meta">
    ${f('unSubject', '교과', m.subject, 'list="unSubjects"')}<datalist id="unSubjects">${SUBJECTS.map(s => `<option value="${s}">`).join('')}</datalist>
    ${f('unGrade', '학년', m.grade, 'type="number" min="1" max="6"')}
    ${f('unUnitNo', '단원 번호', m.unitNo, 'type="number" min="1" max="20"')}
    ${f('unUnitName', '단원 이름', m.unitName)}
    ${f('unRound', '회차', m.round, 'type="number" min="1" max="9"')}
    ${f('unDate', '날짜', m.date, 'type="date"')}
  </div>`;
}
function keyTableHTML(t) {
  const items = t.key.items, total = keyTotal(items), zero = items.filter(i => !i.points).map(i => i.no);
  const typeSel = it => `<select class="field" data-k="${it.no}-type" aria-label="${it.no}번 유형">${ITEM_TYPES.map(([k, l]) => `<option value="${k}"${k === it.type ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
  const inp = (it, f, attrs = '') => `<input class="field" data-k="${it.no}-${f}" value="${esc(it[f])}" aria-label="${it.no}번 ${f}" ${attrs}>`;
  const rows = items.map(it => `<tr><td class="no">${it.no}</td><td>${inp(it, 'content')}</td><td>${inp(it, 'domain')}</td><td>${typeSel(it)}</td>
    <td>${inp(it, 'answer')}</td><td>${inp(it, 'points', 'type="number" min="0" max="100"')}</td><td>${inp(it, 'criteria')}</td><td>${inp(it, 'pages')}</td>
    <td><button class="icon-btn" type="button" data-un="delItem" data-no="${it.no}" aria-label="${it.no}번 빼기">✕</button></td></tr>`).join('');
  return `<div class="yp-card">
    <div class="un-sum">${items.length}문항 · ${total}점${items.length && total !== 100 ? ' <span class="un-warn">배점 합이 100점이 아니에요</span>' : ''}${zero.length ? ` <span class="un-warn">배점이 빈 문항: ${zero.join(', ')}번</span>` : ''}</div>
    ${items.length ? `<div class="un-key-wrap"><table class="un-key"><thead><tr><th>번호</th><th>평가 내용</th><th>영역</th><th>유형</th><th>정답</th><th>배점</th><th>채점 기준</th><th>교과서 쪽</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="muted">정답지를 넣으면 문항이 여기에 나와요. 직접 더해도 돼요.</p>'}
    <div class="row"><button class="btn" type="button" data-un="addItem">문항 더하기</button></div>
  </div>`;
}
function keyHTML(t) {
  const m = U.msg.id === t.id ? U.msg : { key: '', paper: '' };
  return `<div class="yp-card">
      <h3>정답지·평가지</h3>
      <p class="muted cls-note">「문항 이원 분류 및 모범 답안」 한글 파일은 AI 없이 바로 읽어요. 사진이나 스캔 PDF는 AI가 읽어요.</p>
      ${bundleBoxHTML('unit', '정답지·문제지·학생 답안 스캔을 한꺼번에 넣으면 알아서 나눠요(답안은 2단계로)')}
      <div class="row"><button class="btn primary" type="button" data-un="keyFile">정답지 넣기</button><span class="muted" id="unKeyMsg">${esc(m.key)}</span></div>
      <div class="row"><button class="btn" type="button" data-un="paperFile">평가지 넣기 (선택)</button><span class="muted" id="unPaperMsg">${esc(m.paper)}</span></div>
      <input type="file" id="unKeyFile" accept=".hwp,.hwpx,.pdf,.txt,.png,.jpg,.jpeg,.webp" hidden>
      <input type="file" id="unPaperFile" accept=".hwp,.hwpx,.pdf,.txt" hidden>
    </div>
    <div class="yp-card"><h3>평가 정보</h3>${metaHTML(t.meta)}${linkHTML(t.link || null, t.meta.subject, 'data-un')}</div>
    ${keyTableHTML(t)}
    <div class="row un-next"><button class="btn primary" type="button" data-un="next"${t.key.items.length ? '' : ' disabled'}>다음: 답안 올리기</button></div>`;
}
function testHTML(t) {
  const body = U.step === 1 ? keyHTML(t) : stepViews[U.step] ? stepViews[U.step].html(t) : '<div class="yp-card"><p class="muted" style="margin:0">준비 중이에요.</p></div>';
  return `<div class="un-top"><button class="btn text" type="button" data-un="back">‹ 목록</button><b class="un-title">${esc(makeTitle(t.meta))}</b></div>
    ${stepsHTML(STEPS, U.step, reach(t))}<div class="un-body">${body}</div>`;
}
/* 그리는 중에 지워지는 입력 칸의 blur→change가 다시 그리기를 부르면, 끝난 뒤 한 번 더 그림 */
let rendering = false, again = false;
export function render() {
  if (!box) return;
  if (rendering) { again = true; return; }
  rendering = true;
  try { draw(); } finally { rendering = false; }
  if (again) { again = false; render(); }
}
function draw() {
  const t = U.view === 'test' ? cur() : null;
  if (U.view === 'test' && !t) U.view = 'list';
  const head = `<div class="m-head"><h2>단원평가</h2><p class="muted">정답지와 학생 답안 스캔을 올리면 문항마다 채점하고, 학생에게 줄 피드백을 만들어요. 결과는 쌓아 두고 모아 봐요.</p></div>`;
  const seg = `<div class="seg un-seg" role="group" aria-label="단원평가 보기"><button type="button" data-unv="list" aria-pressed="${U.view !== 'results'}">평가 목록</button><button type="button" data-unv="results" aria-pressed="${U.view === 'results'}">결과 모아 보기</button></div>`;
  let inner;
  if (U.view === 'test') inner = testHTML(t);
  else if (U.view === 'results') inner = head + seg + (resultsView ? resultsView.html() : '');
  else inner = head + seg + listHTML();
  box.innerHTML = `<div class="m-page un-page">${inner}</div>`;
  if (U.view === 'test' && stepViews[U.step] && stepViews[U.step].bind) stepViews[U.step].bind(box, t);
  if (U.view === 'results' && resultsView && resultsView.bind) resultsView.bind(box);
}

/* ---------- 1단계: 정답지·평가지 ---------- */
const setMsg = (id, k, text) => { if (U.msg.id !== id) U.msg = { id, key: '', paper: '' }; U.msg[k] = text; const el = box && box.querySelector(k === 'key' ? '#unKeyMsg' : '#unPaperMsg'); if (el && curId() === id) el.textContent = text; };
/* 파일을 읽는 동안 다른 평가로 가도, 결과는 시작한 평가에 넣음 */
const testOf = (id, t0) => (curId() === id ? cur() : getTest(id) || null) || (U.draft === t0 ? t0 : null);
const fill = (meta, from, keys) => { for (const k of keys) if ((meta[k] == null || meta[k] === '') && from[k] != null && from[k] !== '') meta[k] = from[k]; };
const isImage = f => /^image\//.test(f.type || '') || /\.(png|jpe?g|webp|bmp|gif)$/i.test(f.name || '');
/* 정답지 한글 파일은 합친 칸을 풀어 읽음(칸 자리를 지킴). 안 되면 보통 글 읽기(오류 안내도 그쪽에서) */
async function readKeyText(file) {
  if (/\.hwpx?$/i.test(file.name || '') && SS().files && SS().files.readHwpGridText) {
    try { return String(await SS().files.readHwpGridText(new Uint8Array(await file.arrayBuffer()))).replace(/\r\n?/g, '\n').trim(); } catch (e) { /* 아래로 */ }
  }
  return readText(file, { columns: true });
}

async function loadKey(file) {
  const t0 = cur(), id = t0.id;
  setMsg(id, 'key', `「${file.name}」 읽는 중…`);
  let k = null, text = '';
  if (!isImage(file)) {
    try { text = await readKeyText(file); }
    catch (e) { if (!(e && e.code === 'PDF_NO_TEXT')) { setMsg(id, 'key', fileMessage(e && e.code)); return; } }
    if (text) k = parseKey(text);
  }
  if (!k) {
    if (!ai.ready()) { setMsg(id, 'key', `이 정답지는 AI가 읽어야 해요. ${AI_KEY}`); return; }
    setMsg(id, 'key', 'AI가 정답지를 읽는 중…');
    try {
      const images = text ? undefined : await SS().files.toImages(file);
      k = normKeyAI(await ai.generateJSON(keyPrompt(text), { images, valid: v => !!normKeyAI(v) }));
    } catch (e) {
      setMsg(id, 'key', e && e.code === 'bad_json' ? 'AI가 정답지를 읽지 못했어요. 다시 해 보거나 문항을 직접 넣어 주세요.' : ai.errorMessage(e && e.code, e));
      return;
    }
  }
  useKey(id, t0, k, text, file.name);
}
/* 읽은 정답지를 평가에 넣음(정답지 넣기·한꺼번에 넣기) */
function useKey(id, t0, k, text, name) {
  const t = testOf(id, t0);
  if (!t) return;
  t.key = { domains: k.domains, items: k.items };
  // 이미 채점한 평가에 정답지를 다시 넣으면 읽은 답으로 다시 맞춤
  for (const it of t.key.items) rescoreItem(t, it.no, 'answer');
  fill(t.meta, k.meta, ['subject', 'grade', 'term', 'unitNo', 'round']);
  // 문제지와 정답이 한 파일이면 평가지도 (정답 앞까지만 — 정답이 채점 AI에 가지 않게)
  const sp = text ? splitCombined(text) : { paper: '' };
  const withPaper = !!(sp.paper && !(t.paper && t.paper.text));
  if (withPaper) { t.paper = { text: sp.paper.slice(0, 12000) }; fill(t.meta, parsePaper(sp.paper).meta, ['subject', 'grade', 'term', 'unitNo', 'unitName', 'round']); }
  U.msg = { ...U.msg, id, key: `「${name}」에서 ${k.items.length}문항을 읽었어요${withPaper ? '. 평가지도 함께 넣었어요' : ''}${k.pointsGuessed ? '. 배점이 없어 100점을 문항 수로 나눠 넣었어요(고칠 수 있어요)' : ''}` };
  if (withPaper) U.msg.paper = `「${name}」 · ${Object.keys(parsePaper(sp.paper).questions).length}문항`;
  commit(t);
  refresh(id);
}
async function loadPaper(file) {
  const t0 = cur(), id = t0.id;
  setMsg(id, 'paper', `「${file.name}」 읽는 중…`);
  let text;
  try { text = await readText(file, { columns: true }); } catch (e) { setMsg(id, 'paper', fileMessage(e && e.code)); return; }
  text = splitCombined(text).paper || text; // 정답이 붙은 문제지면 정답 앞까지만
  usePaper(id, t0, text, file.name);
}
function usePaper(id, t0, text, name) {
  const p = parsePaper(text), t = testOf(id, t0);
  if (!t) return;
  t.paper = { text: text.slice(0, 12000) };
  fill(t.meta, p.meta, ['subject', 'grade', 'term', 'unitNo', 'unitName', 'round']);
  U.msg = { ...U.msg, id, paper: `「${name}」 · ${Object.keys(p.questions).length}문항` };
  commit(t);
  refresh(id);
}

/* ---------- 한꺼번에 넣기 (정답지·문제지·답안 스캔) ---------- */
async function putBundle(files) {
  const t0 = cur(), id = t0.id;
  setMsg(id, 'key', '읽는 중…');
  let b;
  try { b = await readBundle(files, { say: m => setMsg(id, 'key', m), mask: (maskOf(t0) || {}).mask || [] }); }
  catch (e) { setMsg(id, 'key', e && e.message === 'PDFJS' ? 'PDF를 읽는 도구를 불러오지 못했어요. 인터넷 연결을 확인하거나 사진으로 넣어 주세요.' : '파일을 읽지 못했어요.'); return; }
  setMsg(id, 'key', '');
  if (needsCard(b)) { const r = await openBundleCard(b, { what: '단원평가' }); if (!r) { SS().files.freePages(b.pages); return; } b = r; }
  const name = (b.doc.names && b.doc.names[0]) || '한꺼번에 넣은 파일';
  let keyText = b.doc.teacher, paperText = b.doc.student;
  if (!keyText && paperText && parseKey(paperText)) { keyText = paperText; paperText = ''; } // 정답지만 넣음
  const crit = b.pages.filter((p, i) => b.roles[i] !== 'student'), stu = b.pages.filter((p, i) => b.roles[i] === 'student');
  if (keyText || crit.length) {
    let k = keyText ? parseKey(keyText) : null;
    if (!k && ai.ready()) {
      setMsg(id, 'key', 'AI가 정답지를 읽는 중…');
      try {
        const images = keyText ? undefined : await Promise.all(crit.slice(0, 4).map(p => SS().files.pageImage(p, null)));
        k = normKeyAI(await ai.generateJSON(keyPrompt(keyText || ''), { images, valid: v => !!normKeyAI(v) }));
      } catch (e) { k = null; }
    }
    if (k) useKey(id, t0, k, '', name); else setMsg(id, 'key', '정답지를 읽지 못했어요. [정답지 넣기]로 다시 넣거나 문항을 직접 넣어 주세요.');
  }
  if (crit.length) SS().files.freePages(crit);
  if (paperText) usePaper(id, t0, paperText, name);
  if (stu.length) {
    const t = testOf(id, t0);
    U.pending = { id: t ? t.id : id, pages: stu };
    if (t && t.key.items.length) goStep(2);
    else setMsg(id, 'paper', `답안 ${stu.length}쪽은 정답지를 넣으면 2단계에서 바로 나눠요`);
  }
}
onBundle('unit', files => { if (visible() && U.view === 'test' && U.step === 1) putBundle(files); });
const META_IDS = { unSubject: ['subject', 's'], unGrade: ['grade', 'n'], unUnitNo: ['unitNo', 'n'], unUnitName: ['unitName', 's'], unRound: ['round', 'n'], unDate: ['date', 's'] };
function editMeta(el) {
  const [k, kind] = META_IDS[el.id], t = cur();
  const v = el.value.trim();
  t.meta[k] = kind === 'n' ? (v === '' ? null : Number(v)) : v;
  commit(t); render();
}
function editItem(el) {
  const [no, f] = el.dataset.k.split('-'), t = cur();
  const it = t.key.items.find(i => i.no === Number(no));
  if (!it) return;
  it[f] = f === 'points' ? Math.max(0, Number(el.value) || 0) : el.value.trim();
  // 정답·유형·배점·채점 기준을 고치면 채점한 칸을 다시 맞춤 (선생님이 고친 칸은 배점 안으로만)
  if (['answer', 'type', 'points', 'criteria'].includes(f)) rescoreItem(t, it.no, f);
  commit(t); render();
}

/* ---------- 손잡이 ---------- */
function askDelete(id) {
  const s = listTests().find(x => x.id === id);
  if (!s || !SS().openSheet) return;
  SS().openSheet(`<h3>「${esc(s.title)}」 지우기</h3><p class="muted" style="margin:0">채점 결과와 피드백이 모두 지워져요. 되돌릴 수 없어요.</p>
    <div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-close>취소</button><button class="btn primary" type="button" id="unDelOk">지우기</button></div>`,
  sh => sh.querySelector('#unDelOk').addEventListener('click', () => { removeTest(id); SS().closeSheet(); toast('지웠어요'); render(); }));
}
function fillSample() {
  let ok = true;
  for (const t of sampleTests()) ok = saveOrWarn(t) && ok;
  if (ok) toast('예시 평가 2개를 넣었어요');
  render();
}
document.addEventListener('click', e => {
  if (!visible() || !box.contains(e.target)) return;
  const v = e.target.closest('[data-unv]');
  if (v) { U.view = v.dataset.unv; render(); return; }
  if (e.target.closest('#unNew')) { const t = newTest(); U.view = 'test'; U.id = null; U.draft = t; U.step = 1; U.msg = { id: t.id, key: '', paper: '' }; render(); return; }
  const st = e.target.closest('[data-step]');
  if (st && U.view === 'test') { goStep(Number(st.dataset.step)); return; }
  const b = e.target.closest('[data-un]');
  const a = b && b.dataset.un;
  if (a === 'del') { askDelete(b.dataset.id); return; }
  if (a === 'sample') { fillSample(); return; }
  if (a === 'sampleDel') { listTests().filter(s => s.sample).forEach(s => removeTest(s.id)); toast('예시 평가를 지웠어요'); render(); return; }
  if (a === 'back') { U.view = 'list'; U.id = null; U.draft = null; render(); return; }
  if (!a) { const o = e.target.closest('[data-un-open]'); if (o) openTest(o.dataset.unOpen); return; }
  if (!inStep(1)) return;
  const t = cur();
  if (a === 'keyFile') box.querySelector('#unKeyFile').click();
  else if (a === 'paperFile') box.querySelector('#unPaperFile').click();
  else if (a === 'addItem') {
    const no = Math.max(0, ...t.key.items.map(i => i.no)) + 1;
    t.key.items.push({ no, content: '', domain: '', type: 'short', answer: '', points: 0, criteria: '', pages: '' });
    commit(t); render();
  } else if (a === 'delItem') {
    // 그 문항의 채점 칸도 지움 (같은 번호로 다시 더하면 지난 점수가 새 배점을 넘지 않게)
    const no = Number(b.dataset.no);
    t.key.items = t.key.items.filter(i => i.no !== no);
    for (const st of t.students) if (st.items) delete st.items[no];
    commit(t); render();
  } else if (a === 'next') goStep(2);
  else if (a === 'linkEdit') openLinkSheet({ subject: t.meta.subject, link: t.link, save: l => { const t2 = cur(); t2.link = l; commit(t2); render(); } });
});
document.addEventListener('change', e => {
  if (!inStep(1) || !box.contains(e.target)) return;
  const el = e.target;
  if (el.id === 'unKeyFile' && el.files[0]) { const f = el.files[0]; el.value = ''; loadKey(f); }
  else if (el.id === 'unPaperFile' && el.files[0]) { const f = el.files[0]; el.value = ''; loadPaper(f); }
  else if (el.dataset.un === 'link') {
    const t = cur();
    if (!el.checked) { t.link = null; commit(t); render(); }
    else openLinkSheet({ subject: t.meta.subject, link: t.link, save: l => { const t2 = cur(); t2.link = l; commit(t2); render(); }, cancel: () => render() });
  }
  else if (META_IDS[el.id]) editMeta(el);
  else if (el.dataset.k) editItem(el);
});

/* 떠 있는 버튼: 정답지(합본 포함)는 새 단원평가로, 문제지는 정답지는 있고 평가지가 없는 최근 단원평가에(없으면 새로) */
/* 문제지와 교과(·단원)가 같은 것. 문제지의 교과를 모를 때만 최근 것 — 다른 교과 평가에 붙이지 않음(그 평가지 글이 채점 AI로 감) */
function paperless(text) {
  const m = parsePaper(splitCombined(text || '').paper || text || '').meta;
  const list = listTests().map(s => getTest(s.id)).filter(t => t && t.key.items.length && !(t.paper && t.paper.text));
  if (!m.subject) return list[0] || null;
  return list.find(t => t.meta.subject === m.subject && (!m.unitNo || !t.meta.unitNo || t.meta.unitNo === m.unitNo)) || null;
}
function openNew() {
  const t = newTest();
  U.view = 'test'; U.id = null; U.draft = t; U.step = 1; U.msg = { id: t.id, key: '', paper: '' };
  render();
}
registerInbox('unit-key', {
  act: files => (files.length > 1 ? `새 단원평가 ${files.length}개를 만들어 정답지로 넣기` : '새 단원평가를 만들어 정답지로 넣기'),
  async run(files) {
    go('evaluate', 'unit');
    for (const f of files) { openNew(); await loadKey(f); }
  }
});
registerInbox('unit-paper', {
  one: true,
  act: (files, ctx) => {
    if (files.length > 1) return `평가지 ${files.length}개를 하나씩 교과·단원이 맞는 단원평가(없으면 새 단원평가)에 넣기`;
    const t = paperless(ctx.texts.get(files[0])); return t ? `「${makeTitle(t.meta)}」의 평가지로 넣기` : '새 단원평가를 만들어 평가지로 넣기';
  },
  async run(files, v, opts) {
    go('evaluate', 'unit');
    const t = paperless(opts.texts.get(files[0]));
    if (t) openTest(t.id, 1); else openNew();
    await loadPaper(files[0]);
  }
});

onEnter('evaluate', (tab, section) => {
  if (!box || !section.contains(box)) {
    box = document.createElement('div'); box.className = 'unit-box'; section.append(box);
    box.addEventListener('focusout', () => setTimeout(() => { if (pendingRefresh && !editing()) { pendingRefresh = false; if (visible()) render(); } }, 0));
  }
  curTab = tab;
  box.hidden = tab !== 'unit';
  if (tab === 'unit') render();
});
