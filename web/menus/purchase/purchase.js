/* 품의 메뉴 › 새 품의: 왼쪽 「메모」(입력) → 오른쪽 「에듀파인에 붙여넣을 초안」.
   AI는 제목과 사유 첫 문장만 쓰고, 가~라 줄·금액·합계는 앱이 만든다 (PRD 5.2) */
import { onEnter, go } from '../../core/shell.js';
import { get, set } from '../../core/store.js';
import * as ai from '../../core/ai.js';
import { makeHwpx } from '../../core/hwpx.js';
import { copyText, saveFile, toast } from '../../core/ui.js';
import { getPurchaseLimit } from '../../core/settings.js';
import { TYPES, emptyForm, emptyItem, itemAmount, cleanItems, sumItems, checkPurchase, itemsTSV, composeReason, purchaseDoc, toNumber, findPersonal } from './rules.js';
import { readQuote } from './quote.js';
import { fileMessage, isFileCode } from '../../core/files.js';
import { registerInbox } from '../../core/inbox.js';

const CUR_KEY = 'purchase:current';
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const won = n => Number(n).toLocaleString('ko-KR');
const typeOf = id => TYPES.find(t => t.id === id) || TYPES[0];
const LABEL = { project: '사업명', purpose: '목적', date: '일시', target: '대상', place: '장소', budget: '예산 과목', memo: '메모', items: '품목' };
const VERB = { goods: '구입', lecturer: '지급', event: '운영', meeting: '운영' };

/* 저장된 값이 망가져 있어도 쓸 수 있는 모양으로 */
function normForm(v) {
  const base = emptyForm(v && TYPES.some(t => t.id === v.type) ? v.type : 'goods');
  const f = { ...base };
  if (v && typeof v === 'object') for (const k of Object.keys(base)) if (k !== 'items' && v[k] != null) f[k] = k === 'budgetUnknown' ? !!v[k] : String(v[k]);
  const items = v && Array.isArray(v.items) ? v.items.filter(i => i && typeof i === 'object').map(i => ({ ...emptyItem(), ...Object.fromEntries(Object.keys(emptyItem()).map(k => [k, i[k] == null ? '' : String(i[k])])) })) : [];
  f.items = items.length ? items : [emptyItem()];
  return f;
}
function normDraft(d) {
  return d && typeof d === 'object' && typeof d.title === 'string' ? { title: d.title, reason: String(d.reason == null ? '' : d.reason) } : null;
}
function load() {
  const v = get(CUR_KEY, null);
  return { form: normForm(v && v.form), draft: normDraft(v && v.draft) };
}

let st = load();
let box = null, curTab = 'new', busy = false, msg = '', tried = false;
const save = () => set(CUR_KEY, st);

/* 다른 화면(견적서·템플릿·최근 작성·행사계획)이 쓰는 입구 */
export const getForm = () => JSON.parse(JSON.stringify(st.form));
export const getDraft = () => (st.draft ? { ...st.draft } : null);
export function setForm(form) { st.form = normForm(form); save(); if (curTab === 'new' && box && box.isConnected) render(); }
/* 행사계획에서 [품의로 이어 가기] (P-10): 종류 「행사 운영」으로 칸을 채우고 품의 › 새 품의로 감 */
export function openPurchase(prefill) {
  st.form = normForm({ ...emptyForm('event'), ...(prefill || {}), type: 'event' });
  st.draft = null; msg = ''; tried = false;
  save();
  go('purchase', 'new');
}
export function setDraft(draft) { st.draft = normDraft(draft); save(); if (curTab === 'new' && box && box.isConnected) renderDraft(); }

/* ---------- 그리기 ---------- */
function field(key, label, { req, ph, wide, area } = {}) {
  const id = 'pc' + key[0].toUpperCase() + key.slice(1);
  const attrs = `class="field" id="${id}" data-k="${key}" placeholder="${esc(ph || '')}" autocomplete="off"`;
  return `<label class="pc-f${wide ? ' wide' : ''}"><span class="lab">${label}${req ? ' <b class="req" aria-hidden="true">*</b>' : ''}</span>`
    + (area ? `<textarea ${attrs} rows="2">${esc(st.form[key])}</textarea>` : `<input ${attrs} value="${esc(st.form[key])}">`) + '</label>';
}
function itemRow(it, i) {
  const inp = (f, ph, mode) => `<input class="field" data-item="${i}" data-f="${f}" value="${esc(it[f])}" placeholder="${ph}" aria-label="${i + 1}번째 품목 ${ph}" autocomplete="off"${mode ? ` inputmode="${mode}"` : ''}>`;
  const amt = cleanItems([it]).length ? won(itemAmount(cleanItems([it])[0])) : '';
  return `<div class="pc-irow" data-row="${i}">${inp('name', '품명')}${inp('spec', '규격')}${inp('qty', '수량', 'decimal')}${inp('price', '단가', 'numeric')}`
    + `<span class="pc-amt num" data-amt="${i}">${amt}</span>`
    + `<button class="icon-btn pc-del" type="button" data-pc="delItem" data-i="${i}" aria-label="${i + 1}번째 품목 빼기" title="빼기">×</button></div>`;
}
const itemsHTML = () => '<div class="pc-irow pc-ihead" aria-hidden="true"><span>품명</span><span>규격</span><span>수량</span><span>단가(원)</span><span>금액</span><span></span></div>'
  + st.form.items.map(itemRow).join('');

function render() {
  if (!box) return;
  const t = typeOf(st.form.type), ex = t.example;
  box.innerHTML = `<div class="m-page pc-page">
    <div class="m-head"><h2>새 품의</h2><p class="muted">메모를 채우고 [초안 만들기]를 누르면 에듀파인에 붙여넣을 제목·품의 사유·산출 내역을 써요.</p></div>
    <div class="seg pc-types" role="radiogroup" aria-label="품의 종류">${TYPES.map(x => `<button type="button" role="radio" data-pctype="${x.id}" aria-pressed="${x.id === t.id}" aria-checked="${x.id === t.id}">${x.label}</button>`).join('')}</div>
    <p class="muted pc-hint" id="pcHint">${esc(t.hint)}</p>
    <div class="pc-grid">
      <section class="pc-card" aria-labelledby="pcMemoH">
        <h3 id="pcMemoH">메모</h3>
        <div class="pc-fields">
          ${field('project', '사업명', { ph: '예) ' + ex.project, wide: true })}
          ${field('purpose', '목적', { req: true, ph: '예) ' + ex.purpose, wide: true })}
          ${field('date', '일시', { req: true, ph: '예) ' + ex.date })}
          ${field('target', '대상', { req: true, ph: '예) ' + ex.target })}
          ${field('place', '장소', { ph: '예) ' + ex.place })}
          ${field('total', '총액 (선택)', { ph: '맞춰 볼 금액이 있으면' })}
          <div class="pc-f wide"><label class="lab" for="pcBudget">예산 과목</label>
            <div class="pc-budget"><input class="field" id="pcBudget" data-k="budget" value="${esc(st.form.budget)}" placeholder="예) 교육과정 운영 > 교과 운영비" autocomplete="off">
            <label class="switch pc-unknown"><input type="checkbox" id="pcBudgetUnknown" data-k="budgetUnknown" ${st.form.budgetUnknown ? 'checked' : ''}>모르겠어요 · 행정실 확인</label></div></div>
        </div>
        <div class="pc-sub"><span class="lab">품목 <b class="req" aria-hidden="true">*</b></span></div>
        <div class="pc-items" id="pcItems">${itemsHTML()}</div>
        <div class="row pc-iact"><button class="btn text" type="button" data-pc="addItem">+ 품목 더하기</button><span class="pc-quote-slot"><button class="btn text" type="button" data-pc="quote">견적서 넣기</button><input type="file" id="pcQuoteFile" accept=".xlsx,.csv,.hwp,.hwpx,.txt,.pdf,.png,.jpg,.jpeg,.webp" hidden></span><span class="grow"></span><b class="pc-sum num" id="pcSum">합계 ${won(sumItems(st.form.items))}원</b></div>
        ${field('memo', '메모 (선택)', { ph: '그 밖에 초안에 넣을 내용', wide: true, area: true })}
        <div class="row pc-go"><button class="btn primary" type="button" data-pc="draft" ${busy ? 'disabled' : ''}>${busy ? '<span class="spin"></span>쓰는 중…' : '초안 만들기'}</button></div>
      </section>
      <section class="pc-card pc-draft" id="pcDraftCard" aria-labelledby="pcDraftH"></section>
    </div>
  </div>`;
  renderDraft();
  if (tried) markBad(checkPurchase(st.form, { limit: getPurchaseLimit() }));
}

function calcHTML() {
  const items = cleanItems(st.form.items);
  return `<table class="pc-calc" id="pcCalc"><thead><tr><th>품명</th><th>규격</th><th>수량</th><th>단가</th><th>금액</th></tr></thead><tbody>`
    + items.map(it => `<tr><td>${esc(it.name)}</td><td>${esc(it.spec)}</td><td class="n">${won(toNumber(it.qty))}</td><td class="n">${won(toNumber(it.price))}</td><td class="n">${won(itemAmount(it))}</td></tr>`).join('')
    + `</tbody><tfoot><tr><td colspan="4">합계</td><td class="n">${won(sumItems(st.form.items))}</td></tr></tfoot></table>`;
}

function checksHTML() {
  if (!tried && !st.draft) return '';
  const r = checkPurchase(st.form, { limit: getPurchaseLimit() });
  const li = (cls, text) => `<li class="${cls}">${esc(text)}</li>`;
  const out = [];
  if (r.missing.length) out.push(li('err', `빨간색 칸을 채워 주세요: ${r.missing.map(k => LABEL[k]).join('·')}`));
  if (r.personal.length) out.push(li('err', `개인정보는 넣지 말아 주세요 (${r.personal.map(k => LABEL[k]).join('·')})`));
  r.warnings.forEach(w => out.push(li('warn', w)));
  r.oks.forEach(o => out.push(li('ok', o)));
  return `<h4 class="pc-checks-h">확인 목록</h4><ul class="pc-checks" id="pcChecks">${out.join('')}</ul>`;
}

function renderDraft() {
  const card = box && box.querySelector('#pcDraftCard');
  if (!card) return;
  const d = st.draft;
  const copyBtn = (k, label) => `<button class="btn text pc-copy" type="button" data-copy="${k}">${label}</button>`;
  card.innerHTML = `<h3 id="pcDraftH">에듀파인에 붙여넣을 초안</h3>
    ${msg ? `<div class="banner err" id="pcMsg" role="alert"><span class="grow">${esc(msg)}</span></div>` : ''}
    ${d ? `<div class="pc-out"><div class="pc-out-h"><label class="lab" for="pcTitle">제목</label>${copyBtn('title', '복사')}</div>
        <input class="field" id="pcTitle" data-d="title" value="${esc(d.title)}" autocomplete="off"></div>
      <div class="pc-out"><div class="pc-out-h"><label class="lab" for="pcReason">품의 사유</label>${copyBtn('reason', '복사')}</div>
        <textarea class="field" id="pcReason" data-d="reason" rows="9">${esc(d.reason)}</textarea></div>
      <div class="pc-out"><div class="pc-out-h"><span class="lab">산출 내역</span>${copyBtn('calc', '표 복사')}</div>
        <div class="pc-calc-wrap" id="pcCalcWrap">${calcHTML()}</div></div>
      <div class="row"><button class="btn" type="button" data-pc="hwpx">한글 파일로 내려받기</button></div>`
    : `<p class="muted pc-empty">${busy ? '<span class="spin"></span> AI가 제목과 품의 사유를 쓰고 있어요…' : '왼쪽 메모를 채우고 [초안 만들기]를 누르면 제목·품의 사유·산출 내역을 써요. 금액과 합계는 앱이 계산해요.'}</p>`}
    <div id="pcChecksBox">${checksHTML()}</div>`;
}

/* 입력이 바뀌면 금액·합계·확인 목록·산출 내역만 고쳐 그림 (입력 칸은 다시 그리지 않음 — 한글 입력이 끊기지 않게) */
function live() {
  if (!box) return;
  const sum = box.querySelector('#pcSum');
  if (sum) sum.textContent = `합계 ${won(sumItems(st.form.items))}원`;
  st.form.items.forEach((it, i) => {
    const el = box.querySelector(`[data-amt="${i}"]`);
    if (el) el.textContent = cleanItems([it]).length ? won(itemAmount(cleanItems([it])[0])) : '';
  });
  const cw = box.querySelector('#pcCalcWrap');
  if (cw) cw.innerHTML = calcHTML();
  const cb = box.querySelector('#pcChecksBox');
  if (cb) cb.innerHTML = checksHTML();
  if (tried) markBad(checkPurchase(st.form, { limit: getPurchaseLimit() }));
}

function markBad(r) {
  box.querySelectorAll('.field.bad').forEach(el => el.classList.remove('bad'));
  for (const k of [...r.missing, ...r.personal]) {
    if (k === 'items') {
      const idx = r.personal.includes('items') ? st.form.items.map((it, i) => (findPersonal(it.name) || findPersonal(it.spec) ? i : -1)).filter(i => i >= 0) : [];
      (idx.length ? idx : [0]).forEach(i => { const el = box.querySelector(`[data-item="${i}"][data-f="name"]`); if (el) el.classList.add('bad'); });
    } else {
      const el = box.querySelector(`[data-k="${k}"]`);
      if (el) el.classList.add('bad');
    }
  }
}

function renderItems(focusRow) {
  const el = box.querySelector('#pcItems');
  if (el) el.innerHTML = itemsHTML();
  live();
  if (focusRow != null) { const f = box.querySelector(`[data-item="${focusRow}"][data-f="name"]`); if (f) f.focus(); }
}

/* ---------- 초안 만들기 ---------- */
function draftPrompt(f, total) {
  const t = typeOf(f.type);
  const items = cleanItems(f.items).map(it => `${it.name}${it.spec ? `(${it.spec})` : ''} ${won(toNumber(it.qty))}개 × ${won(toNumber(it.price))}원`).join(', ');
  const line = (k, v) => (String(v || '').trim() ? `- ${k}: ${String(v).trim()}\n` : '');
  return '학교 행정 문서(에듀파인 품의)를 돕는 도우미예요. 아래 메모로 품의의 제목과 품의 사유 첫 문장을 써 주세요.\n\n'
    + line('종류', t.label) + line('사업명', f.project) + line('목적', f.purpose) + line('일시', f.date) + line('대상', f.target) + line('장소', f.place)
    + line('품목', items) + `- 합계: ${won(total)}원\n` + line('그 밖의 메모', f.memo)
    + '\n규칙:\n'
    + '- title: 한 줄, 30자 안쪽. 무엇을 왜 하는지 드러나게 씁니다. 예) 5학년 과학 실험 재료(용해와 용액) 구입\n'
    + `- intro: 한 문장. 「…을(를) 다음과 같이 ${VERB[t.id]}하고자 합니다.」 꼴로 씁니다. 금액·날짜는 쓰지 않습니다.\n`
    + '- 메모에 없는 사실은 지어내지 않습니다.\n'
    + '\n답은 JSON 하나만: {"title": "…", "intro": "…"}';
}

async function makeDraft() {
  if (busy) return;
  tried = true;
  const r = checkPurchase(st.form, { limit: getPurchaseLimit() });
  markBad(r);
  msg = '';
  if (!r.canDraft) {
    renderDraft();
    const first = box.querySelector('.field.bad');
    if (first) first.focus();
    return;
  }
  if (!ai.ready()) { renderDraft(); toast('초안을 쓸 AI를 먼저 정해 주세요'); if (window.SSAM && window.SSAM.ai) window.SSAM.ai.openSettings(); return; }
  busy = true;
  setBusyUI();
  try {
    const form = getForm();
    const v = await ai.generateJSON(draftPrompt(form, r.total), {
      valid: x => x && typeof x.title === 'string' && x.title.trim() && typeof x.intro === 'string' && x.intro.trim()
    });
    st.draft = { title: v.title.trim(), intro: v.intro.trim(), reason: composeReason({ intro: v.intro.trim(), form: st.form }), edited: false };
    save();
    document.dispatchEvent(new CustomEvent('ssam:purchase-draft', { detail: { form: getForm(), draft: getDraft() } }));
  } catch (e) {
    msg = ai.errorMessage(e && e.code, e);
  }
  busy = false;
  if (curTab === 'new' && box && box.isConnected) { setBusyUI(); renderDraft(); }
}
function setBusyUI() {
  const b = box && box.querySelector('[data-pc="draft"]');
  if (b) { b.disabled = busy; b.innerHTML = busy ? '<span class="spin"></span>쓰는 중…' : '초안 만들기'; }
  if (busy) renderDraft();
}

async function downloadHwpx() {
  if (!st.draft) return;
  const name = `${(st.draft.title || '품의').replace(/[\\/:*?"<>|]/g, '_').trim().slice(0, 60) || '품의'}.hwpx`;
  try {
    const where = await saveFile(name, makeHwpx(purchaseDoc(st.form, st.draft)), 'application/hwp+zip');
    toast(window.__TAURI__ ? `다운로드 폴더에 저장했어요: ${String(where).split(/[\\/]/).pop()}` : '한글 파일을 내려받았어요');
  } catch (e) { toast('한글 파일을 저장하지 못했어요'); }
}

/* ---------- 입력·누르기 ---------- */
document.addEventListener('input', e => {
  if (!box || !box.contains(e.target) || curTab !== 'new') return;
  const el = e.target;
  if (el.dataset.k) st.form[el.dataset.k] = el.type === 'checkbox' ? el.checked : el.value;
  else if (el.dataset.item != null && el.dataset.f) { const it = st.form.items[+el.dataset.item]; if (it) it[el.dataset.f] = el.value; }
  else if (el.dataset.d && st.draft) { st.draft[el.dataset.d] = el.value; save(); return; }
  else return;
  save();
  live();
});
document.addEventListener('click', e => {
  if (!box || !box.contains(e.target) || curTab !== 'new') return;
  const ty = e.target.closest('[data-pctype]');
  if (ty) { st.form.type = ty.dataset.pctype; save(); render(); return; }
  const cp = e.target.closest('[data-copy]');
  if (cp && st.draft) {
    const k = cp.dataset.copy;
    const text = k === 'calc' ? itemsTSV(st.form.items, st.form.type) : st.draft[k] || '';
    copyText(text).then(ok => toast(ok ? (k === 'calc' ? '표를 복사했어요. 에듀파인·엑셀에 붙여넣으세요' : '복사했어요') : '복사하지 못했어요'));
    return;
  }
  const b = e.target.closest('[data-pc]');
  if (!b) return;
  const a = b.dataset.pc;
  if (a === 'addItem') { st.form.items.push(emptyItem()); save(); renderItems(st.form.items.length - 1); }
  else if (a === 'delItem') {
    st.form.items.splice(+b.dataset.i, 1);
    if (!st.form.items.length) st.form.items.push(emptyItem());
    save(); renderItems();
  } else if (a === 'draft') makeDraft();
  else if (a === 'hwpx') downloadHwpx();
  else if (a === 'quote') box.querySelector('#pcQuoteFile').click();
});
document.addEventListener('change', e => {
  if (!box || e.target.id !== 'pcQuoteFile' || !box.contains(e.target)) return;
  const f = e.target.files[0]; e.target.value = '';
  if (f) addQuote(f);
});

/* 견적서를 못 읽은 까닭: 키 없음 · 파일(형식·암호·손상) · PDF 도구 · 그 밖은 AI 오류(키·한도·연결) */
function quoteError(e) {
  const code = e && e.code;
  if (code === 'NO_AI') return '사진·PDF 견적서는 AI가 읽어요. 설정 › AI에서 키를 넣어 주세요.';
  if (isFileCode(code)) return `${fileMessage(code)} 엑셀·CSV로 저장해 넣거나 직접 입력해도 돼요.`;
  if (e && e.message === 'PDFJS') return 'PDF를 읽는 도구를 불러오지 못했어요. 인터넷 연결을 확인하거나 사진·엑셀로 넣어 주세요.';
  return code ? ai.errorMessage(code, e) : '견적서를 읽지 못했어요. 엑셀·CSV로 저장해 넣거나 직접 입력해 주세요.';
}
/* 견적서의 품목을 품목 표에 넣음: 빈 줄을 먼저 채우고 모자라면 더함. 초안은 만들지 않음 */
export async function addQuote(file) {
  let r;
  try { r = await readQuote(file); }
  catch (e) {
    toast(quoteError(e), 6000);
    return 0;
  }
  if (!r.items.length) { toast('견적서에서 품목을 찾지 못했어요. 직접 입력해 주세요.', 6000); return 0; }
  const rows = r.items.map(it => ({ name: it.name, spec: it.spec, qty: String(it.qty), price: String(it.price) }));
  const items = st.form.items.slice();
  for (const it of rows) { const i = items.findIndex(x => !x.name && !x.spec && !x.qty && !x.price); if (i >= 0) items[i] = it; else items.push(it); }
  st.form.items = items;
  save();
  if (curTab === 'new' && box && box.isConnected) render();
  toast(`견적서에서 품목 ${rows.length}개를 넣었어요${r.by === 'ai' ? '(AI가 읽었어요. 금액을 확인해 주세요)' : ''}.`, 6000);
  return rows.length;
}

/* 떠 있는 버튼: 견적서 → 품의 › 새 품의 품목. 쓰던 품의가 있으면 더할지 새로 할지 고름 */
const busyForm = () => !!(st.form.project.trim() || st.form.items.some(i => i.name.trim()));
registerInbox('quote', {
  act: () => '품의 › 새 품의의 품목으로 넣기',
  fields: () => (busyForm() ? [{ key: 'where', label: '어디에 넣을까요', type: 'select', options: [['add', '지금 쓰는 품의에 더하기'], ['new', '새 품의로 (지금 쓰던 품의는 지워져요)']], value: 'add', required: true }] : []),
  async run(files, v) {
    if (v.where === 'new' || !busyForm()) { st.form = normForm(emptyForm('goods')); st.draft = null; msg = ''; tried = false; save(); }
    go('purchase', 'new');
    for (const f of files) await addQuote(f);
    return '';
  }
});

function renderOther(tab) {
  box.innerHTML = `<div class="m-page"><div class="m-head"><h2>${tab === 'templates' ? '저장한 템플릿' : '최근 작성'}</h2><p class="muted">곧 만들어요.</p></div></div>`;
}

onEnter('purchase', (tab, section) => {
  if (!box || !section.contains(box)) { box = document.createElement('div'); box.className = 'pc-box'; section.prepend(box); }
  curTab = tab;
  if (tab === 'new') render(); else renderOther(tab);
});
