/* 품의 메뉴 › 새 품의: 왼쪽 「메모」(입력) → 오른쪽 「에듀파인에 붙여넣을 초안」.
   AI는 제목과 사유 첫 문장만 쓰고, 가~라 줄·금액·합계는 앱이 만든다 (PRD 5.2) */
import { onEnter, go } from '../../core/shell.js';
import { get, set } from '../../core/store.js';
import * as ai from '../../core/ai.js';
import { copyText, toast } from '../../core/ui.js';
import { getPurchaseLimit, getMeetCap, getPurchaseFlow } from '../../core/settings.js';
import { exportButton, exportDoc } from '../../core/doc-export.js';
import { TYPES, emptyForm, emptyItem, itemAmount, cleanItems, sumItems, checkPurchase, itemsTSV, composeReason, reasonTail, purchaseDoc, toNumber, findPersonal,
  defaultUnit, quoteNote, withholding, INCOME, meetingItem, budgetHints, ATTACH, basisLine, draftMemo } from './rules.js';
import { aiRowHTML, pick } from '../../core/ai-roles.js';
import { reviewJSON, purchaseReviewPrompt, normPurchaseReview, opinionHTML, REVIEW_FAIL } from '../../core/ai-review.js';
import { readIntake, fillEmpty, mergeItems, vendorsOf, splitByVendor, parseLines } from './intake.js';
import { oneshotPrompt, normOneshot, confirmChips, askNeeds, GUESS_KEYS } from './oneshot.js';
import { pushRecent, newId, listRecent, deleteRecent, listTemplates, saveTemplate, renameTemplate, deleteTemplate, templateForm } from './library.js';
import { fileMessage, isFileCode } from '../../core/files.js';
import { registerInbox } from '../../core/inbox.js';

const CUR_KEY = 'purchase:current';
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const won = n => Number(n).toLocaleString('ko-KR');
const SS = () => window.SSAM;
const typeOf = id => TYPES.find(t => t.id === id) || TYPES[0];
const LABEL = { project: '사업명', purpose: '목적', date: '일시', target: '대상', place: '장소', budget: '예산 과목', memo: '메모', items: '품목', attach: '붙임' };
const VERB = { goods: '구입', lecturer: '지급', event: '운영', meeting: '운영' };

/* 저장된 값이 망가져 있어도 쓸 수 있는 모양으로 */
function normForm(v) {
  const base = emptyForm(v && TYPES.some(t => t.id === v.type) ? v.type : 'goods');
  const f = { ...base };
  if (v && typeof v === 'object') for (const k of Object.keys(base)) {
    if (k === 'items' || v[k] == null) continue;
    if (k === 'budgetUnknown' || k === 'vat') f[k] = !!v[k];
    else if (k === 'attach' || k === 'attachMore') f[k] = Array.isArray(v[k]) ? v[k].map(String) : base[k];
    else f[k] = String(v[k]);
  }
  const items = v && Array.isArray(v.items) ? v.items.filter(i => i && typeof i === 'object').map(i => ({ ...emptyItem(), ...Object.fromEntries(Object.keys(emptyItem()).map(k => [k, i[k] == null ? '' : String(i[k])])) })) : [];
  f.items = items.length ? items : [emptyItem()];
  // typeSet: 선생님이 종류를 골랐음(AI가 종류를 바꾸지 않음), guessed: AI가 채운 칸(「AI가 짐작함」)
  f.typeSet = !!(v && v.typeSet);
  f.guessed = v && Array.isArray(v.guessed) ? v.guessed.filter(k => GUESS_KEYS.includes(k)) : [];
  return f;
}
/* 초안: 제목, AI가 쓴 첫 문장(intro), 사유 전체, 선생님이 사유를 손으로 고쳤는지(edited), 검토 의견(rv) */
const firstPara = r => String(r || '').split(/\n\s*\n/)[0].trim();
const normRv = v => (Array.isArray(v) ? v.filter(x => x && (x.field === 'title' || x.field === 'intro') && typeof x.fix === 'string' && x.fix.trim())
  .map(x => ({ field: x.field, problem: String(x.problem || ''), fix: x.fix, ...(x.done === 'review' || x.done === 'main' ? { done: x.done } : {}) })) : []);
/* tail: 사유를 앱이 마지막으로 맞췄을 때의 가~붙임(예전 초안은 연 때의 것) — 그 뒤 품목·붙임이 바뀌었는지 보려고 */
function normDraft(d, form) {
  if (!(d && typeof d === 'object' && typeof d.title === 'string')) return null;
  const reason = String(d.reason == null ? '' : d.reason);
  return { title: d.title, reason, intro: typeof d.intro === 'string' ? d.intro : firstPara(reason), edited: d.intro == null ? true : !!d.edited,
    tail: typeof d.tail === 'string' ? d.tail : reasonTail(form || emptyForm('goods')), ...(normRv(d.rv).length ? { rv: normRv(d.rv) } : {}) };
}
function load() {
  const v = get(CUR_KEY, null), form = normForm(v && v.form);
  return { id: v && typeof v.id === 'string' ? v.id : newId(), form, draft: normDraft(v && v.draft, form),
    ...(v && Array.isArray(v.vendorsOk) ? { vendorsOk: v.vendorsOk.map(String) } : {}) };
}

let st = load();
let box = null, curTab = 'new', busy = false, msg = '', tried = false;
let rvBusy = null, rvFail = null; // 지금 검토 중인·검토하지 못한 초안
const save = () => set(CUR_KEY, st);
/* [자세히 고치기] 열림(학년도와 상관없이 기억) */
const VIEW_KEY = 'purchase:view';
const viewFull = () => get(VIEW_KEY, 'simple') === 'full';
const checks = () => checkPurchase(st.form, { limit: getPurchaseLimit(), meetCap: getMeetCap() });

/* 다른 화면(견적서·템플릿·최근 작성·행사계획)이 쓰는 입구 */
export const getForm = () => JSON.parse(JSON.stringify(st.form));
export const getDraft = () => (st.draft ? { ...st.draft } : null);
export function setForm(form) { st.form = normForm(form); save(); if (curTab === 'new' && box && box.isConnected) render(); }
/* 행사계획에서 [품의로 이어 가기] (P-10): 종류 「행사 운영」으로 칸을 채우고 품의 › 새 품의로 감 */
export function openPurchase(prefill) {
  keepRecent();
  st = { id: newId(), form: normForm({ ...emptyForm('event'), ...(prefill || {}), type: 'event', typeSet: true }), draft: null }; msg = ''; tried = false;
  save();
  go('purchase', 'new');
}
export function setDraft(draft) { st.draft = normDraft(draft, st.form); save(); if (curTab === 'new' && box && box.isConnected) renderDraft(); }

/* ---------- 그리기 ---------- */
function field(key, label, { req, ph, wide, area } = {}) {
  const id = 'pc' + key[0].toUpperCase() + key.slice(1);
  const attrs = `class="field" id="${id}" data-k="${key}" placeholder="${esc(ph || '')}" autocomplete="off"`;
  return `<label class="pc-f${wide ? ' wide' : ''}"><span class="lab">${label}${req ? ' <b class="req" aria-hidden="true">*</b>' : ''}</span>`
    + (area ? `<textarea ${attrs} rows="2">${esc(st.form[key])}</textarea>` : `<input ${attrs} value="${esc(st.form[key])}">`) + '</label>';
}
const LEC = () => st.form.type === 'lecturer';
const COLS = () => (LEC() ? { name: '강사(역할)', unit: '단위', qty: '시간', price: '시간당 단가' } : { name: '품명', unit: '단위', qty: '수량', price: '단가(원)' });
function itemRow(it, i) {
  const c = COLS();
  const inp = (f, ph, mode) => `<input class="field" data-item="${i}" data-f="${f}" value="${esc(it[f])}" placeholder="${ph}" aria-label="${i + 1}번째 품목 ${ph}" autocomplete="off"${mode ? ` inputmode="${mode}"` : ''}>`;
  const amt = cleanItems([it]).length ? won(itemAmount(cleanItems([it])[0])) : '';
  return `<div class="pc-irow${fresh.has(it) ? ' new' : ''}" data-row="${i}">${inp('name', LEC() ? '강사(역할) 예) 외부 강사 1' : '품명')}${inp('spec', '규격')}${inp('unit', defaultUnit(st.form.type))}${inp('qty', c.qty, 'decimal')}${inp('price', c.price, 'numeric')}`
    + (showVendor() ? inp('vendor', '구입처') : '')
    + `<span class="pc-amt num" data-amt="${i}">${amt}</span>`
    + `<button class="icon-btn pc-del" type="button" data-pc="delItem" data-i="${i}" aria-label="${i + 1}번째 품목 빼기" title="빼기">×</button></div>`;
}
const showVendor = () => st.form.items.some(it => String(it.vendor || '').trim());
const itemsHTML = () => `<div class="pc-irow pc-ihead" aria-hidden="true"><span data-h="name">${COLS().name}</span><span data-h="spec">규격</span><span data-h="unit">단위</span><span data-h="qty">${COLS().qty}</span><span data-h="price">${COLS().price}</span>${showVendor() ? '<span data-h="vendor">구입처</span>' : ''}<span data-h="amt">금액</span></div>`
  + st.form.items.map(itemRow).join('');
let fresh = new Set(); // 방금 넣은 품목 줄 (잠깐 노랗게)

/* 종류별 계산 도우미 (스펙 4.2) */
function whHTML() {
  return cleanItems(st.form.items).map((it, i) => {
    const w = withholding(itemAmount(it), st.form.income);
    return `<li data-wh="${i}">${esc(it.name)} ${won(itemAmount(it))}원 → ${w.tax == null ? esc(w.note) : `원천징수(참고) ${won(w.tax)}원 · 실지급 ${won(w.net)}원 <span class="muted">(${esc(w.note)})</span>`}</li>`;
  }).join('');
}
function helperHTML() {
  const t = st.form.type;
  if (t === 'lecturer') return `<div class="pc-helper"><label class="pc-f"><span class="lab">소득 구분</span><select class="field" id="pcIncome" data-k="income">${INCOME.map(([v, l]) => `<option value="${v}"${st.form.income === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
      <ul class="pc-wh" id="pcWh">${whHTML()}</ul>
      <p class="muted" style="margin:0">원천징수는 참고용이에요(행정실 확인). 강의 확인서·지급 내역서는 강의 뒤 지출 때 붙여요. 주민번호·계좌는 행정실에 따로 내요.</p></div>`;
  if (t === 'meeting') return `<div class="pc-helper"><div class="row pc-meet"><label class="cls-inline">인원 <input class="field num" id="pcMeetPeople" type="number" min="1" inputmode="numeric"></label>×
      <label class="cls-inline">1인 단가 <input class="field num" id="pcMeetPrice" type="number" min="0" inputmode="numeric"></label>×
      <label class="cls-inline">횟수 <input class="field num" id="pcMeetTimes" type="number" min="1" value="1" inputmode="numeric"></label>
      <button class="btn text" type="button" data-pc="meetAdd">품목에 넣기</button></div>
      <p class="muted" style="margin:0">1인 상한 ${won(getMeetCap())}원(설정 › 품의 기준) · 교육청·학교마다 달라요. 행정실 확인</p></div>`;
  return `<div class="pc-helper"><label class="switch"><input type="checkbox" id="pcVat" data-k="vat"${st.form.vat ? ' checked' : ''}>단가는 부가세 포함이에요</label>
      <p class="muted pc-qnote" id="pcQuoteNote">${esc(quoteNote(sumItems(st.form.items), st.form.vat).text)}</p></div>`;
}
const hintsHTML = () => `<span class="muted">추천</span>${budgetHints(st.form).map(h => `<button class="chip pc-hint-chip" type="button" data-budget-hint="${esc(h)}">${esc(h)}</button>`).join('')}<span class="muted">참고용 · 행정실 확인</span>`;
/* 붙임 체크리스트: 지출품의서 1부는 늘 1번 */
function attachHTML() {
  const list = ATTACH[st.form.type] || ATTACH.goods;
  return `<div class="pc-attach" id="pcAttach"><span class="lab">붙임</span>
    <label class="pc-chk"><input type="checkbox" checked disabled> 지출품의서 1부 <span class="muted">(늘 1번)</span></label>
    ${list.map(a => `<label class="pc-chk"><input type="checkbox" data-attach="${a.id}"${st.form.attach.includes(a.id) ? ' checked' : ''}> ${esc(a.label)}</label>`).join('')}
    ${st.form.attachMore.map((x, i) => `<span class="pc-chk">${esc(x)} <button class="icon-btn tiny" type="button" data-attach-del="${i}" aria-label="${esc(x)} 빼기">×</button></span>`).join('')}
    <div class="row pc-attach-add"><input class="field" id="pcAttachMore" placeholder="다른 붙임 서류 (예: 참고 자료)" autocomplete="off"><button class="btn text" type="button" data-pc="attachAdd">+ 붙임 더하기</button></div></div>`;
}

function render() {
  if (!box) return;
  const t = typeOf(st.form.type), ex = t.example;
  box.innerHTML = `<div class="m-page pc-page">
    <div class="m-head pc-head"><div><h2>새 품의</h2><p class="muted">사려는 것·견적서를 넣고 [초안 만들기]를 누르면 에듀파인에 붙여넣을 제목·품의 사유·산출 내역을 써요.</p></div>
      <div class="row pc-head-act"><button class="btn" type="button" data-pc="saveTpl">템플릿으로 저장</button><button class="btn text" type="button" data-pc="fresh">새로 쓰기</button></div></div>
    <div class="seg pc-types" role="radiogroup" aria-label="품의 종류">${TYPES.map(x => `<button type="button" role="radio" data-pctype="${x.id}" aria-pressed="${x.id === t.id}" aria-checked="${x.id === t.id}">${x.label}</button>`).join('')}</div>
    <p class="muted pc-hint" id="pcHint">${esc(t.hint)}</p>
    <div class="pc-grid">
      <section class="pc-card" aria-labelledby="pcMemoH">
        <h3 id="pcMemoH">메모</h3>
        <div class="pc-intake" id="pcIntakeBox">
          <label class="lab" for="pcIntake">사려는 것·견적서를 넣으세요</label>
          <textarea class="field" id="pcIntake" rows="4" placeholder="예) 3학년 과학 실험 알코올램프 10개 5,000원, 다음 주 화요일 과학실&#10;엑셀·견적서 파일, 장바구니 캡처도 붙여넣거나 끌어 놓으면 돼요"></textarea>
          <div class="row"><button class="btn primary" type="button" data-pc="go" ${busy ? 'disabled' : ''}>${busy ? '<span class="spin"></span>쓰는 중…' : '초안 만들기'}</button>
            <button class="btn text" type="button" data-pc="intake">칸에만 넣기</button><button class="btn text" type="button" data-pc="intakeFile">파일 고르기</button>
            <input type="file" id="pcIntakeFile" accept=".xlsx,.csv,.hwp,.hwpx,.txt,.pdf,.png,.jpg,.jpeg,.webp" hidden><span class="muted" id="pcIntakeMsg" role="status"></span></div>
          <p class="muted pc-intake-note">${st.form.type === 'lecturer' ? '강사 수당은 강사 이름이 AI로 가지 않게 앱이 글만 읽어요(캡처·사진은 읽지 않아요).' : '[초안 만들기]를 누르면 넣은 것을 읽어 칸을 채우고 바로 초안을 써요. 목적·일시·장소도 글에 있으면 채워요.'} 이미 쓴 칸은 덮지 않아요.</p>
        </div>
        <details class="pc-more" id="pcMore"${viewFull() ? ' open' : ''}><summary>자세히 고치기 <span class="muted">사업명·목적·일시·대상·장소·예산 과목·품목·붙임</span></summary>
        <div class="pc-fields">
          ${field('project', '사업명', { ph: '예) ' + ex.project, wide: true })}
          ${field('purpose', '목적', { req: true, ph: '예) ' + ex.purpose, wide: true })}
          ${field('date', '일시', { ph: '예) ' + ex.date })}
          ${field('target', '대상', { ph: '예) ' + ex.target })}
          ${field('place', '장소', { ph: '예) ' + ex.place })}
          ${field('total', '총액 (선택)', { ph: '맞춰 볼 금액이 있으면' })}
          <div class="pc-f wide"><label class="lab" for="pcBudget">예산 과목</label>
            <div class="pc-budget"><input class="field" id="pcBudget" data-k="budget" value="${esc(st.form.budget)}" placeholder="예) 교육과정 운영 > 교과 운영비" autocomplete="off">
            <label class="switch pc-unknown"><input type="checkbox" id="pcBudgetUnknown" data-k="budgetUnknown" ${st.form.budgetUnknown ? 'checked' : ''}>모르겠어요 · 행정실 확인</label></div>
            <div class="pc-hints" id="pcBudgetHints">${hintsHTML()}</div></div>
        </div>
        <div class="pc-sub"><span class="lab">품목 <b class="req" aria-hidden="true">*</b></span></div>
        ${helperHTML()}
        <div class="pc-items${showVendor() ? ' has-vendor' : ''}" id="pcItems">${itemsHTML()}</div>
        <div class="row pc-iact"><button class="btn text" type="button" data-pc="addItem">+ 품목 더하기</button><span class="grow"></span><b class="pc-sum num" id="pcSum">합계 ${won(sumItems(st.form.items))}원</b></div>
        ${attachHTML()}
        ${field('memo', '메모 (선택)', { ph: '그 밖에 초안에 넣을 내용', wide: true, area: true })}
        <div class="row pc-go"><button class="btn primary" type="button" data-pc="draft" ${busy ? 'disabled' : ''}>${busy ? '<span class="spin"></span>쓰는 중…' : '초안 만들기'}</button></div>
        </details>
      </section>
      <section class="pc-card pc-draft" id="pcDraftCard" aria-labelledby="pcDraftH"></section>
    </div>
  </div>`;
  renderDraft();
  syncReason();
  if (tried) markBad(checks());
}

function calcHTML() {
  const items = cleanItems(st.form.items);
  const unit = it => String(it.unit || '').trim() || defaultUnit(st.form.type), v = showVendor();
  return `<table class="pc-calc" id="pcCalc"><thead><tr><th>품명</th><th>규격</th><th>단위</th><th>수량</th><th>단가</th><th>금액</th>${v ? '<th>구입처</th>' : ''}</tr></thead><tbody>`
    + items.map(it => `<tr><td>${esc(it.name)}</td><td>${esc(it.spec)}</td><td>${esc(unit(it))}</td><td class="n">${won(toNumber(it.qty))}</td><td class="n">${won(toNumber(it.price))}</td><td class="n">${won(itemAmount(it))}</td>${v ? `<td>${esc(it.vendor)}</td>` : ''}</tr>`).join('')
    + `</tbody><tfoot><tr><td colspan="5">합계</td><td class="n">${won(sumItems(st.form.items))}</td>${v ? '<td></td>' : ''}</tr></tfoot></table>`
    + `<p class="muted pc-basis">산출 근거: ${items.map(it => esc(basisLine(it, st.form.type))).join(' / ')}</p>`;
}

function checksHTML() {
  if (!tried && !st.draft) return '';
  const r = checks();
  const li = (cls, text) => `<li class="${cls}">${esc(text)}</li>`;
  const out = [];
  if (r.missing.length) out.push(li('err', `빨간색 칸을 채워 주세요: ${r.missing.map(k => LABEL[k]).join('·')}`));
  if (r.personal.length) out.push(li('err', `개인정보는 넣지 말아 주세요 (${r.personal.map(k => LABEL[k]).join('·')})`));
  r.warnings.forEach(w => out.push(li('warn', w)));
  r.oks.forEach(o => out.push(li('ok', o)));
  return `<h4 class="pc-checks-h">확인 목록</h4><ul class="pc-checks" id="pcChecks">${out.join('')}</ul>`;
}

/* 초안 위 「확인할 것」: 누르면 [자세히 고치기]의 그 칸으로 */
const chipsHTML = () => confirmChips(st.form, checks(), st.form.guessed)
  .map(c => `<button type="button" class="chip pc-chip ${c.level}" data-chip="${c.key}">${esc(c.text)}</button>`).join('');
function openMore() {
  const d = box && box.querySelector('#pcMore');
  if (d && !d.open) d.open = true;
  set(VIEW_KEY, 'full');
}
function goChip(key) {
  openMore();
  let el = null;
  if (key === 'items') {
    const i = st.form.items.findIndex(it => String(it.name || '').trim() && !(toNumber(it.qty) > 0 && toNumber(it.price) > 0));
    el = box.querySelector(`[data-item="${Math.max(0, i)}"][data-f="${i >= 0 && !(toNumber(st.form.items[i].qty) > 0) ? 'qty' : 'price'}"]`);
  } else if (key) el = box.querySelector(`[data-k="${key}"]`);
  if (el) { el.scrollIntoView({ block: 'center' }); el.focus(); }
}
function renderDraft() {
  const card = box && box.querySelector('#pcDraftCard');
  if (!card) return;
  const d = st.draft;
  const copyBtn = (k, label) => `<button class="btn text pc-copy" type="button" data-copy="${k}">${label}</button>`;
  const mark = f => (openRv(f) ? ' rv-mark' : '');
  card.innerHTML = `<h3 id="pcDraftH">에듀파인에 붙여넣을 초안</h3>
    ${aiRowHTML('purchase')}
    ${msg ? `<div class="banner err" id="pcMsg" role="alert"><span class="grow">${esc(msg)}</span></div>` : ''}
    ${d ? `<div class="pc-chips" id="pcChips">${chipsHTML()}</div><div id="pcRvState">${rvStateHTML()}</div>
      <div class="pc-out"><div class="pc-out-h"><label class="lab" for="pcTitle">제목</label>${copyBtn('title', '복사')}</div>
        <input class="field${mark('title')}" id="pcTitle" data-d="title" value="${esc(d.title)}" autocomplete="off">
        <div id="pcRvTitle">${rvHTML('title')}</div></div>
      <div class="pc-out"><div class="pc-out-h"><label class="lab" for="pcReason">품의 사유</label>${copyBtn('reason', '복사')}</div>
        <textarea class="field${mark('intro')}" id="pcReason" data-d="reason" rows="12">${esc(d.reason)}</textarea>
        <div id="pcRvIntro">${rvHTML('intro')}</div>
        <div id="pcResyncBox">${resyncHTML()}</div></div>
      <div class="pc-out"><div class="pc-out-h"><span class="lab">산출 내역</span>${copyBtn('calc', '표 복사')}</div>
        <div class="pc-calc-wrap" id="pcCalcWrap">${calcHTML()}</div></div>
      <div class="row">${exportButton('data-pc="export"')}</div>`
    : `<p class="muted pc-empty">${busy ? '<span class="spin"></span> AI가 제목과 품의 사유를 쓰고 있어요…' : '사려는 것·견적서를 넣고 [초안 만들기]를 누르면 제목·품의 사유·산출 내역을 써요. 금액과 합계는 앱이 계산해요.'}</p>`}
    <div id="pcChecksBox">${checksHTML()}</div>`;
}

/* ---------- 검토 AI (업무별 AI › 품의에서 켰을 때) ---------- */
const RV_LABEL = { title: '제목', intro: '품의 사유 첫 문장' };
const openRv = f => (st.draft && st.draft.rv ? st.draft.rv.find(x => x.field === f && !x.done) : null);
function rvHTML(f) {
  const r = openRv(f);
  if (!r) return '';
  return opinionHTML({ title: RV_LABEL[f], main: f === 'title' ? st.draft.title : firstPara(st.draft.reason), alt: r.fix, why: r.problem, use: f, keep: f });
}
const rvStateHTML = () => (st.draft && rvBusy === st.draft ? '<p class="muted rv-busy"><span class="spin"></span> 검토 AI가 제목과 첫 문장을 살펴보고 있어요. 초안은 그대로 고칠 수 있어요…</p>' : '')
  + (st.draft && rvFail === st.draft ? `<p class="rv-fail" role="status">${REVIEW_FAIL} 초안은 그대로 쓸 수 있어요.</p>` : '');
function updateRv() {
  if (!box) return;
  const s = box.querySelector('#pcRvState');
  if (s) s.innerHTML = rvStateHTML();
  for (const [f, at, inp] of [['title', '#pcRvTitle', '#pcTitle'], ['intro', '#pcRvIntro', '#pcReason']]) {
    const el = box.querySelector(at); if (el) el.innerHTML = rvHTML(f);
    const i = box.querySelector(inp); if (i) i.classList.toggle('rv-mark', !!openRv(f));
  }
}
/* 손으로 고친 칸의 아직 고르지 않은 의견은 지움 */
function dropRv(f) {
  if (!openRv(f)) return;
  st.draft.rv = st.draft.rv.filter(x => x.field !== f || x.done);
  updateRv();
}
/* 초안 뒤 한 번: 메인에 보낸 메모와 제목·첫 문장을 검토 AI가 봄. 검토 중에 고친 칸·바뀐 초안의 의견은 버림 */
async function runReview(memo) {
  const d = st.draft;
  if (!d || !pick('purchase', 'review')) return;
  const sent = { title: d.title, intro: d.intro };
  rvBusy = d; rvFail = null; updateRv();
  const v = await reviewJSON('purchase', purchaseReviewPrompt(memo, sent), { valid: x => Array.isArray(x) || !!(x && Array.isArray(x.items)) });
  if (rvBusy === d) rvBusy = null;
  if (v && v.error) rvFail = d;
  else if (v && st.draft === d) {
    const now = { title: d.title, intro: firstPara(d.reason) };
    d.rv = normPurchaseReview(v).filter(x => now[x.field] === sent[x.field] && x.fix !== sent[x.field]);
    save();
  }
  if (curTab === 'new' && box && box.isConnected) updateRv();
}
/* 사유의 첫 문단만 바꿈 (가~붙임은 그대로) */
const replaceFirst = (reason, s) => { const m = /\n\s*\n/.exec(reason); return m ? s + reason.slice(m.index) : s; };

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
  const qn = box.querySelector('#pcQuoteNote');
  if (qn) qn.textContent = quoteNote(sumItems(st.form.items), st.form.vat).text;
  const wh = box.querySelector('#pcWh');
  if (wh) wh.innerHTML = whHTML();
  const bh = box.querySelector('#pcBudgetHints');
  if (bh) bh.innerHTML = hintsHTML();
  const ch = box.querySelector('#pcChips');
  if (ch) ch.innerHTML = chipsHTML();
  syncReason();
  if (tried) markBad(checks());
}
/* 초안 뒤 입력이 바뀌면: 손대지 않은 사유는 가~붙임을 다시 맞추고, 손으로 고친 사유는 [사유 다시 맞추기]만 보임 */
const tailOk = () => !st.draft || st.draft.reason.endsWith(reasonTail(st.form));
const resyncHTML = () => (st.draft && st.draft.edited && st.draft.tail !== reasonTail(st.form) ? '<p class="muted pc-resync">품목·붙임이 바뀌었어요 <button class="btn text tiny" type="button" data-pc="resync">사유 다시 맞추기</button></p>' : '');
function syncReason() {
  if (!st.draft || !box) return;
  if (!st.draft.edited && !tailOk()) {
    st.draft.reason = composeReason({ intro: st.draft.intro, form: st.form }); st.draft.tail = reasonTail(st.form);
    save();
    const ta = box.querySelector('#pcReason');
    if (ta && document.activeElement !== ta) ta.value = st.draft.reason;
  }
  const rb = box.querySelector('#pcResyncBox');
  if (rb) rb.innerHTML = resyncHTML();
}

function markBad(r) {
  box.querySelectorAll('.field.bad').forEach(el => el.classList.remove('bad'));
  for (const k of [...r.missing, ...r.personal]) {
    if (k === 'items') {
      // 개인정보가 든 칸만(품명·규격·단위·구입처), 품목이 없으면 첫 줄 품명
      const bad = r.personal.includes('items') ? st.form.items.flatMap((it, i) => ['name', 'spec', 'unit', 'vendor'].filter(f => findPersonal(it[f])).map(f => [i, f])) : [];
      (bad.length ? bad : [[0, 'name']]).forEach(([i, f]) => { const el = box.querySelector(`[data-item="${i}"][data-f="${f}"]`); if (el) el.classList.add('bad'); });
    } else {
      const el = box.querySelector(`[data-k="${k}"]`);
      if (el) el.classList.add('bad');
    }
  }
}

function rerenderAttach() { const el = box && box.querySelector('#pcAttach'); if (el) el.outerHTML = attachHTML(); live(); }
function renderItems(focusRow) {
  const el = box.querySelector('#pcItems');
  if (el) { el.innerHTML = itemsHTML(); el.classList.toggle('has-vendor', showVendor()); }
  live();
  if (focusRow != null) { const f = box.querySelector(`[data-item="${focusRow}"][data-f="name"]`); if (f) f.focus(); }
}

/* ---------- 초안 만들기 (한 칸 → 바로 초안, 스펙 2026-11-02 3.2) ---------- */
/* text: 넣기 칸에 넣은 글(빈 칸·목적 짐작에 씀, 강사 수당은 보내지 않음) */
async function makeDraft({ text = '' } = {}) {
  if (busy) return;
  tried = true;
  const can = ai.ready();
  // 목적은 비어도 AI가 짐작해 씀(AI가 될 때)
  const r = checkPurchase(st.form, { limit: getPurchaseLimit(), meetCap: getMeetCap(), guessPurpose: can });
  markBad(r);
  msg = '';
  if (!r.canDraft) {
    renderDraft();
    if (r.missing.length || r.personal.length) openMore();
    const first = box.querySelector('.field.bad');
    if (first) first.focus();
    return;
  }
  if (!can) { renderDraft(); toast('초안을 쓸 AI를 먼저 정해 주세요'); if (window.SSAM && window.SSAM.ai) window.SSAM.ai.openSettings(); return; }
  busy = true;
  setBusyUI();
  const mine = st; // 쓰는 중에 [새로 쓰기]·불러오기로 바뀌면 초안은 쓰던 품의에 붙여 최근 작성으로
  try {
    const form = getForm();
    const askType = !form.typeSet && form.type !== 'lecturer';
    const v = await ai.generateJSON(oneshotPrompt(form, text, { askType }), {
      task: 'purchase',
      valid: x => x && typeof x.title === 'string' && x.title.trim() && typeof x.intro === 'string' && x.intro.trim()
    });
    const n = normOneshot(v, mine.form);
    // 빈 칸만 채우고 AI가 채운 칸은 표시, 선생님이 종류를 고르지 않았으면 AI가 본 종류로
    for (const [k, val] of Object.entries(n.fields)) if (!String(mine.form[k] || '').trim()) { mine.form[k] = val; if (!mine.form.guessed.includes(k)) mine.form.guessed.push(k); }
    if (askType && n.type && n.type !== mine.form.type && cleanItems(mine.form.items).length) { mine.form.type = n.type; mine.form.attach = (ATTACH[n.type] || []).filter(a => a.on).map(a => a.id); }
    mine.draft = { title: n.title, intro: n.intro, reason: composeReason({ intro: n.intro, form: mine.form }), edited: false, tail: reasonTail(mine.form) };
    if (st === mine) {
      save();
      keepRecent();
      document.dispatchEvent(new CustomEvent('ssam:purchase-draft', { detail: { form: getForm(), draft: getDraft() } }));
      runReview(draftMemo(mine.form));
      if (!String(mine.form.purpose || '').trim()) { msg = '무엇에 쓰는지 목적을 적어 주세요(자세히 고치기 › 목적).'; }
    } else {
      pushRecent({ id: mine.id, at: Date.now(), form: JSON.parse(JSON.stringify(mine.form)), draft: { ...mine.draft } });
      toast('쓰던 품의의 초안은 「최근 작성」에 넣었어요', 5000);
    }
  } catch (e) {
    if (st === mine) msg = ai.errorMessage(e && e.code, e);
  }
  busy = false;
  if (curTab === 'new' && box && box.isConnected) {
    render();
    if (msg && !String(st.form.purpose || '').trim()) goChip('purpose');
  }
}
/* [초안 만들기](넣기 칸 옆): 넣기 칸 글을 먼저 넣고 바로 초안 */
async function oneshot() {
  if (busy || intakeBusy) return;
  const ta = box && box.querySelector('#pcIntake'), text = ta ? ta.value : '';
  if (text.trim()) {
    const n = await runIntake({ text });
    if (n < 0) return; // 더하기·바꾸기를 그만둠
  } else if (!cleanItems(st.form.items).length && getPurchaseFlow() !== 'ask') {
    toast('넣기 칸에 사려는 것·견적서를 넣어 주세요. 예) 알코올램프 10개 5,000원', 6000);
    if (ta) ta.focus();
    return;
  }
  // 「빠진 것만 물어보기」: 목적·품목이 비면 그것만 물어보고, 창을 닫으면 초안을 쓰지 않음
  if (getPurchaseFlow() === 'ask') { const need = askNeeds(st.form); if (need.length && !(await askMissing(need))) return; }
  await makeDraft({ text });
}
function askMissing(need) {
  return new Promise(res => {
    let ok = false;
    SS().openSheet(`<div id="pcAsk"><h3>초안 전에 이것만 알려 주세요</h3>
      ${need.includes('purpose') ? '<label class="yp-f"><span class="lab">무엇에 쓰나요?</span><input class="field" id="pcAskPurpose" placeholder="예) 3학년 미술 수업" autocomplete="off"></label>' : ''}
      ${need.includes('items') ? '<label class="yp-f"><span class="lab">무엇을 얼마나 사나요?</span><textarea class="field" id="pcAskItems" rows="3" placeholder="예) 색종이 10묶음 3,000원"></textarea></label>' : ''}
      <div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-close>그만두기</button><button class="btn primary" type="button" id="pcAskOk">초안 만들기</button></div></div>`, sh => {
      sh.querySelector('#pcAskOk').addEventListener('click', () => {
        const pu = sh.querySelector('#pcAskPurpose'), itx = sh.querySelector('#pcAskItems');
        if (pu && pu.value.trim()) { st.form.purpose = pu.value.trim(); st.form.guessed = st.form.guessed.filter(k => k !== 'purpose'); }
        if (itx && itx.value.trim()) {
          const r = parseLines(itx.value);
          if (!r.items.length) { toast('「품명 수량 금액」처럼 써 주세요. 예) 색종이 10묶음 3,000원', 5000); return; }
          st.form.items = mergeItems(st.form.items, r.items, 'add');
        }
        ok = true; save(); SS().closeSheet(); render();
      });
    });
    const root = document.getElementById('sheetRoot');
    const obs = new MutationObserver(() => { if (!root.querySelector('#pcAsk')) { obs.disconnect(); res(ok); } });
    obs.observe(root, { childList: true, subtree: true });
  });
}
function setBusyUI() {
  for (const b of (box ? box.querySelectorAll('[data-pc="draft"],[data-pc="go"]') : [])) { b.disabled = busy; b.innerHTML = busy ? '<span class="spin"></span>쓰는 중…' : '초안 만들기'; }
  if (busy) renderDraft();
}

async function downloadDoc() {
  if (!st.draft) return;
  const name = (st.draft.title || '품의').trim().slice(0, 60) || '품의';
  try { toast(await exportDoc(purchaseDoc(st.form, st.draft), name), 6000); }
  catch (e) { toast('파일을 저장하지 못했어요'); }
}

/* ---------- 입력·누르기 ---------- */
document.addEventListener('input', e => {
  if (!box || !box.contains(e.target) || curTab !== 'new') return;
  const el = e.target;
  if (el.dataset.k) { st.form[el.dataset.k] = el.type === 'checkbox' ? el.checked : el.value; st.form.guessed = st.form.guessed.filter(k => k !== el.dataset.k); }
  else if (el.dataset.item != null && el.dataset.f) { const it = st.form.items[+el.dataset.item]; if (it) it[el.dataset.f] = el.value; }
  else if (el.dataset.d && st.draft) {
    st.draft[el.dataset.d] = el.value;
    if (el.dataset.d === 'reason') {
      // 첫 문장만 고쳤으면(가~붙임은 앱이 만든 그대로) 계속 맞춤, 그 밖을 고쳤으면 손으로 고친 사유
      const intro = firstPara(el.value);
      if (intro && el.value.trim() === composeReason({ intro, form: st.form }).trim()) { st.draft.intro = intro; st.draft.edited = false; st.draft.tail = reasonTail(st.form); }
      else st.draft.edited = true;
      const rb = box.querySelector('#pcResyncBox'); if (rb) rb.innerHTML = resyncHTML();
    }
    dropRv(el.dataset.d === 'title' ? 'title' : 'intro');
    save(); return;
  }
  else if (el.dataset.attach) {
    const set = new Set(st.form.attach);
    if (el.checked) set.add(el.dataset.attach); else set.delete(el.dataset.attach);
    st.form.attach = (ATTACH[st.form.type] || ATTACH.goods).map(a => a.id).filter(id => set.has(id));
  }
  else return;
  save();
  live();
});
document.addEventListener('click', e => {
  if (!box || !box.contains(e.target) || curTab !== 'new') return;
  const ty = e.target.closest('[data-pctype]');
  if (ty) {
    if (st.form.type !== ty.dataset.pctype) { st.form.type = ty.dataset.pctype; st.form.attach = (ATTACH[st.form.type] || []).filter(a => a.on).map(a => a.id); }
    st.form.typeSet = true;
    save(); render(); return;
  }
  const chip = e.target.closest('[data-chip]');
  if (chip) { goChip(chip.dataset.chip); return; }
  const bh = e.target.closest('[data-budget-hint]');
  if (bh) { st.form.budget = bh.dataset.budgetHint; st.form.budgetUnknown = false; save(); const el = box.querySelector('#pcBudget'); if (el) el.value = st.form.budget; const u = box.querySelector('#pcBudgetUnknown'); if (u) u.checked = false; live(); return; }
  const ad = e.target.closest('[data-attach-del]');
  if (ad) { st.form.attachMore.splice(+ad.dataset.attachDel, 1); save(); rerenderAttach(); return; }
  const ru = e.target.closest('[data-rv-use]'), rk = e.target.closest('[data-rv-keep]');
  if ((ru || rk) && st.draft) {
    const f = ru ? ru.dataset.rvUse : rk.dataset.rvKeep, r = openRv(f);
    if (!r) return;
    if (ru && f === 'title') st.draft.title = r.fix;
    else if (ru) { st.draft.intro = r.fix; if (st.draft.edited) st.draft.reason = replaceFirst(st.draft.reason, r.fix); else { st.draft.reason = composeReason({ intro: r.fix, form: st.form }); st.draft.tail = reasonTail(st.form); } }
    st.draft.rv = st.draft.rv.map(x => (x === r ? { ...x, done: ru ? 'review' : 'main' } : x));
    save(); renderDraft(); return;
  }
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
  else if (a === 'go') oneshot();
  else if (a === 'saveTpl') askSaveTemplate();
  else if (a === 'fresh') swapTo({ id: newId(), form: normForm(emptyForm(st.form.type)), draft: null }, { onlyIfLost: true, done: had => toast(had ? '새 품의를 시작해요. 쓰던 품의는 최근 작성에 남아요' : '새 품의를 시작해요') });
  else if (a === 'export') downloadDoc();
  else if (a === 'attachAdd') {
    const inp = box.querySelector('#pcAttachMore'), v = inp.value.trim();
    if (!v) return;
    if (findPersonal(v)) { toast('개인정보는 넣지 말아 주세요'); return; }
    st.form.attachMore.push(v.slice(0, 60)); save(); rerenderAttach();
  } else if (a === 'meetAdd') {
    const people = toNumber(box.querySelector('#pcMeetPeople').value), price = toNumber(box.querySelector('#pcMeetPrice').value), times = toNumber(box.querySelector('#pcMeetTimes').value) || 1;
    if (!(people > 0) || !(price > 0)) { toast('인원과 1인 단가를 넣어 주세요'); return; }
    st.form.items = mergeItems(st.form.items, [meetingItem({ people, price, times })], 'add');
    save(); renderItems();
  } else if (a === 'resync' && st.draft) {
    st.draft.intro = firstPara(st.draft.reason) || st.draft.intro;
    st.draft.reason = composeReason({ intro: st.draft.intro, form: st.form }); st.draft.edited = false; st.draft.tail = reasonTail(st.form);
    save(); renderDraft();
  }
  else if (a === 'intake') { const t = box.querySelector('#pcIntake').value; if (!t.trim()) { toast('넣을 글을 쓰거나 붙여넣어 주세요. 파일·캡처는 끌어 놓거나 붙여넣으면 바로 읽어요.'); return; } runIntake({ text: t }); }
  else if (a === 'intakeFile') box.querySelector('#pcIntakeFile').click();
});
document.addEventListener('change', e => {
  if (!box || e.target.id !== 'pcIntakeFile' || !box.contains(e.target)) return;
  const fs = [...e.target.files]; e.target.value = '';
  intakeFiles(fs);
});
document.addEventListener('toggle', e => {
  if (!box || e.target.id !== 'pcMore' || !box.contains(e.target)) return;
  set(VIEW_KEY, e.target.open ? 'full' : 'simple');
}, true);
/* 넣기 칸: 그림·파일을 붙여넣거나 끌어 놓으면 바로 읽음 (글 붙여넣기는 칸에 들어가고 [넣기]로) */
document.addEventListener('paste', e => {
  if (!box || curTab !== 'new' || !e.target.closest || !e.target.closest('#pcIntakeBox')) return;
  const files = [...((e.clipboardData && e.clipboardData.files) || [])];
  if (!files.length) return;
  e.preventDefault();
  // 엑셀에서 칸을 복사하면 그림도 같이 와요: 탭으로 나뉜 글이 있으면 글로 읽음
  const text = e.clipboardData.getData('text/plain') || '';
  if (text.includes('\t')) { runIntake({ text, keepBox: true }); return; }
  intakeFiles(files);
});
document.addEventListener('dragover', e => { if (box && curTab === 'new' && e.target.closest && e.target.closest('#pcIntakeBox')) { e.preventDefault(); e.target.closest('#pcIntakeBox').classList.add('over'); } });
document.addEventListener('dragleave', e => { const b = e.target.closest && e.target.closest('#pcIntakeBox'); if (b) b.classList.remove('over'); });
document.addEventListener('drop', e => {
  const b = box && curTab === 'new' && e.target.closest && e.target.closest('#pcIntakeBox');
  if (!b) return;
  e.preventDefault(); b.classList.remove('over');
  const files = [...((e.dataTransfer && e.dataTransfer.files) || [])];
  if (files.length) intakeFiles(files);
  else { const t = e.dataTransfer && e.dataTransfer.getData('text/plain'); if (t) runIntake({ text: t }); }
});

/* 견적서를 못 읽은 까닭: 키 없음 · 파일(형식·암호·손상) · PDF 도구 · 그 밖은 AI 오류(키·한도·연결) */
function quoteError(e) {
  const code = e && e.code;
  if (code === 'NO_AI_LECTURER') return '강사 수당 품의는 넣기 칸의 캡처·사진을 AI로 보내지 않아요(강사 이름이 들어 있을 수 있어요). 「강사 2시간 10만원」처럼 글로 쓰거나 직접 입력해 주세요.';
  if (code === 'NO_AI') return '캡처·사진·PDF 견적서는 AI가 읽어요. 설정 › AI에서 키를 넣어 주세요. 글로 쓰면 AI 없이도 읽어요.';
  if (isFileCode(code)) return `${fileMessage(code)} 엑셀·CSV로 저장해 넣거나 직접 입력해도 돼요.`;
  if (e && e.message === 'PDFJS') return 'PDF를 읽는 도구를 불러오지 못했어요. 인터넷 연결을 확인하거나 사진·엑셀로 넣어 주세요.';
  return code ? ai.errorMessage(code, e) : '견적서를 읽지 못했어요. 엑셀·CSV로 저장해 넣거나 직접 입력해 주세요.';
}
/* ---------- 아무거나 넣기 (스펙 4.0) ---------- */
let intakeBusy = false;
const hasItems = () => st.form.items.some(it => String(it.name || '').trim());
const setIntakeMsg = m => { const el = box && box.querySelector('#pcIntakeMsg'); if (el) el.innerHTML = m; };
/* 품목이 있으면 더할지 바꿀지 물어봄 → 'add' | 'replace' | null */
function askMerge(n) {
  return new Promise(res => {
    SS().openSheet(`<h3>품목 ${n}개가 있어요</h3><p class="muted" style="margin:0">읽은 품목을 지금 품목 아래에 더할까요, 지금 품목을 바꿀까요?</p>
      <div class="row" style="justify-content:flex-end"><button class="btn" type="button" id="pcMergeCancel">그만두기</button><button class="btn" type="button" id="pcMergeReplace">바꾸기</button><button class="btn primary" type="button" id="pcMergeAdd">더하기</button></div>`, sh => {
      const done = v => { SS().closeSheet(); res(v); };
      sh.querySelector('#pcMergeAdd').addEventListener('click', () => done('add'));
      sh.querySelector('#pcMergeReplace').addEventListener('click', () => done('replace'));
      sh.querySelector('#pcMergeCancel').addEventListener('click', () => done(null));
    });
  });
}
/* 구입처가 둘 이상이면 나눌지 물어봄. 나누면 첫 구입처만 남기고 나머지는 최근 작성에 새 품의로 */
function askVendors(vs) {
  SS().openSheet(`<h3>구입처가 ${vs.length}곳이에요</h3><p class="muted" style="margin:0">${vs.map(esc).join('·')} · 구입처별로 품의를 나눌까요? 나누면 지금 품의에는 「${esc(vs[0])}」 품목만 남고, 나머지는 「최근 작성」에 새 품의로 들어가요.</p>
    <div class="row" style="justify-content:flex-end"><button class="btn" type="button" id="pcVendorOne">한 품의로</button><button class="btn primary" type="button" id="pcVendorSplit">구입처별로 나누기</button></div>`, sh => {
    sh.querySelector('#pcVendorOne').addEventListener('click', () => { SS().closeSheet(); st.vendorsOk = vs.slice(); save(); toast('한 품의로 두었어요. 품목마다 구입처를 적어 두었어요.'); });
    sh.querySelector('#pcVendorSplit').addEventListener('click', () => {
      SS().closeSheet();
      const parts = splitByVendor(st.form);
      parts.slice(1).forEach((p, i) => pushRecent({ id: newId(), at: Date.now() + i, form: { ...p, project: `${String(p.project || '물품 구입').trim()} (${vs[i + 1]})` }, draft: null }));
      st.form = normForm(parts[0]); save(); render(); // 초안은 남기고 사유는 render에서 다시 맞춤
      toast(`나머지 ${parts.length - 1}곳은 「최근 작성」에 새 품의로 넣었어요`, 6000);
    });
  });
}
async function runIntake(input) {
  if (intakeBusy) return 0;
  intakeBusy = true; setIntakeMsg('<span class="spin"></span> 읽는 중…');
  let r;
  // 강사 수당 품의는 넣기 칸 글·그림을 AI로 보내지 않음(앱 규칙으로만)
  try { r = await readIntake({ ...input, noAI: st.form.type === 'lecturer' }); }
  catch (e) { intakeBusy = false; setIntakeMsg(''); toast(quoteError(e), 6000); return 0; }
  intakeBusy = false; setIntakeMsg('');
  const note = (r.personal ? ` · 개인정보가 있는 줄 ${r.personal}개는 읽지 않았어요` : '') + (r.dropped ? ` · 전화번호·이메일 ${r.dropped}곳은 넣지 않았어요` : '');
  if (!r.items.length && !Object.keys(r.fields).length) {
    toast((r.missed && r.missed.length ? `품목을 읽지 못했어요(못 읽은 줄 ${r.missed.length}개). 「품명 수량 금액」처럼 써 주세요. 예) A4 용지 5박스 2만원` : '품목을 찾지 못했어요. 직접 입력해 주세요.') + note, 6000);
    return 0;
  }
  let how = 'add';
  if (r.items.length && hasItems()) { how = await askMerge(cleanItems(st.form.items).length); if (!how) return -1; }
  st.form = fillEmpty(st.form, r.fields);
  st.form.items = mergeItems(st.form.items, r.items, how);
  fresh = new Set(r.items);
  if (input.text != null && !input.keepBox) { const ta = box && box.querySelector('#pcIntake'); if (ta) ta.value = ''; }
  save();
  if (curTab === 'new' && box && box.isConnected) render();
  setTimeout(() => { fresh = new Set(); if (box) box.querySelectorAll('.pc-irow.new').forEach(el => el.classList.remove('new')); }, 3000);
  const ship = r.items.filter(it => it.name === '배송비').length;
  toast(`품목 ${r.items.length}개${ship ? '(배송비 포함)' : ''}를 넣었어요${r.missed && r.missed.length ? ` · 못 읽은 줄 ${r.missed.length}개` : ''}${r.by === 'ai' ? ' · AI가 읽었어요. 금액을 확인해 주세요' : ''}${note}`, 6000);
  const vs = vendorsOf(st.form.items);
  // [한 품의로] 고른 구입처만 있으면 다시 묻지 않음
  if (vs.length >= 2 && vs.some(v => !(st.vendorsOk || []).includes(v))) askVendors(vs);
  return r.items.length;
}
async function intakeFiles(files) { for (const f of files) await runIntake({ file: f }); }
/* 떠 있는 버튼으로 넣은 견적서·캡처: 같은 넣기(품목은 더함, 묻지 않음) */
export async function addQuote(file) {
  let r;
  try { r = await readIntake({ file, noAI: st.form.type === 'lecturer' }); }
  catch (e) { toast(quoteError(e), 6000); return 0; }
  if (!r.items.length) { toast('견적서에서 품목을 찾지 못했어요. 직접 입력해 주세요.', 6000); return 0; }
  st.form = fillEmpty(st.form, r.fields);
  st.form.items = mergeItems(st.form.items, r.items, 'add');
  save();
  if (curTab === 'new' && box && box.isConnected) render();
  toast(`견적서에서 품목 ${r.items.length}개를 넣었어요${r.by === 'ai' ? '(AI가 읽었어요. 금액을 확인해 주세요)' : ''}.`, 6000);
  return r.items.length;
}

/* 떠 있는 버튼: 견적서 → 품의 › 새 품의 품목. 쓰던 품의가 있으면 더할지 새로 할지 고름 */
const FORM_TEXT = ['project', 'purpose', 'date', 'target', 'place', 'budget', 'total', 'memo'];
const busyForm = () => FORM_TEXT.some(k => String(st.form[k] || '').trim())
  || st.form.items.some(i => ['name', 'spec', 'qty', 'price'].some(k => String(i[k] || '').trim())) || st.form.attachMore.length > 0;
registerInbox('quote', {
  act: () => '품의 › 새 품의의 품목으로 넣기',
  fields: () => (busyForm() ? [{ key: 'where', label: '어디에 넣을까요', type: 'select', options: [['add', '지금 쓰는 품의에 더하기'], ['new', '새 품의로 (지금 쓰던 품의는 지워져요)']], value: 'add', required: true }] : []),
  async run(files, v) {
    if (v.where === 'new' || !busyForm()) { keepRecent(); st = { id: newId(), form: normForm(emptyForm('goods')), draft: null }; msg = ''; tried = false; save(); }
    go('purchase', 'new');
    let n = 0;
    for (const f of files) n += await addQuote(f);
    // AI가 되면 초안까지(빈 칸은 AI가 채움)
    if (n > 0 && ai.ready()) await makeDraft();
    return '';
  }
});

/* ---------- 저장한 템플릿 · 최근 작성 (스펙 5장) ---------- */
/* 초안이 있는 품의는 최근 작성에 남김(같은 품의는 그 자리) */
function keepRecent() { if (st.draft) pushRecent({ id: st.id, at: Date.now(), form: getForm(), draft: getDraft() }); }
const sumOf = f => won(sumItems((f && f.items) || []));
const dayOf = t => { const d = new Date(t); return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}.`; };
function askSaveTemplate() {
  SS().openSheet(`<h3>템플릿으로 저장</h3><p class="muted" style="margin:0">종류·사업명·목적·대상·장소·예산 과목·품목(수량 포함)·붙임을 저장해요. 불러오면 일시만 비어 있어요.</p>
    <label class="yp-f"><span class="lab">이름</span><input class="field" id="pcTplName" value="${esc(st.form.project || '')}" autocomplete="off"></label>
    <div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-close>취소</button><button class="btn primary" type="button" id="pcTplOk">저장</button></div>`, sh => {
    const ok = () => {
      const name = sh.querySelector('#pcTplName').value.trim();
      if (findPersonal(name)) { toast('개인정보는 넣지 말아 주세요'); return; }
      const t = saveTemplate(name, getForm());
      SS().closeSheet();
      toast(t ? `「${t.name}」 템플릿을 저장했어요` : '저장 공간이 모자라 저장하지 못했어요', 5000);
    };
    sh.querySelector('#pcTplOk').addEventListener('click', ok);
    sh.querySelector('#pcTplName').addEventListener('keydown', e => { if (e.key === 'Enter') ok(); });
  });
}
/* 쓰던 품의가 있으면 먼저 물어보고 바꿈. onlyIfLost: 초안이 있어 최근 작성에 남으면 묻지 않음([새로 쓰기]) */
function swapTo(next, { onlyIfLost = false, done } = {}) {
  const doIt = () => { const had = !!st.draft; keepRecent(); st = next; msg = ''; tried = false; save(); go('purchase', 'new'); if (curTab === 'new' && box && box.isConnected) render(); if (done) done(had); };
  if (!busyForm() || next.id === st.id || (onlyIfLost && st.draft)) { doIt(); return; }
  SS().openSheet(`<h3>지금 쓰던 품의를 바꿀까요?</h3><p class="muted" style="margin:0">${st.draft ? '쓰던 품의는 초안이 있어서 「최근 작성」에 남아요.' : '쓰던 품의는 초안이 없어서 남지 않아요. 필요하면 [템플릿으로 저장]을 먼저 눌러 주세요.'}</p>
    <div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-close>취소</button><button class="btn primary" type="button" id="pcSwapOk">바꾸기</button></div>`,
  sh => sh.querySelector('#pcSwapOk').addEventListener('click', () => { SS().closeSheet(); doIt(); }));
}
function renderOther(tab) {
  const tpl = tab === 'templates';
  const typeName = f => typeOf(f && f.type).label;
  const rows = tpl
    ? listTemplates().map(t => `<li class="pc-lib-row"><div class="grow"><b>${esc(t.name)}</b><span class="muted">${esc(typeName(t.form))} · 품목 ${cleanItems(t.form.items || []).length}개 · ${sumOf(t.form)}원 · 저장 ${dayOf(t.savedAt)}</span></div>
        <span class="row"><button class="btn primary" type="button" data-tpl-load="${esc(t.id)}">불러오기</button><button class="btn text" type="button" data-tpl-rename="${esc(t.id)}">이름 바꾸기</button><button class="btn text" type="button" data-tpl-del="${esc(t.id)}">지우기</button></span></li>`)
    : listRecent().map(r => `<li class="pc-lib-row"><div class="grow"><b>${esc((r.draft && r.draft.title) || r.form.project || '제목 없는 품의')}</b><span class="muted">${esc(typeName(r.form))} · ${sumOf(r.form)}원 · ${r.draft ? '초안 있음' : '초안 없음'} · ${dayOf(r.at)}</span></div>
        <span class="row"><button class="btn primary" type="button" data-recent-open="${esc(r.id)}">열기</button><button class="btn text" type="button" data-recent-del="${esc(r.id)}">지우기</button></span></li>`);
  box.innerHTML = `<div class="m-page pc-lib"><div class="m-head"><h2>${tpl ? '저장한 템플릿' : '최근 작성'}</h2>
      <p class="muted">${tpl ? '자주 쓰는 품의를 저장해 두고 불러와요. 불러오면 일시만 고치면 돼요. 새 학년도에도 가져가요.' : '초안을 만든 품의가 최근 20개까지 남아요. 구입처별로 나눈 품의도 여기에 있어요.'}</p></div>
    ${rows.length ? `<ul class="pc-lib-list">${rows.join('')}</ul>` : `<div class="empty"><h3>아직 없어요</h3><p>${tpl ? '새 품의에서 [템플릿으로 저장]을 누르면 여기에 남아요.' : '새 품의에서 [초안 만들기]를 누르면 여기에 남아요.'}</p></div>`}</div>`;
}
document.addEventListener('click', e => {
  if (!box || !box.contains(e.target) || curTab === 'new') return;
  const b = e.target.closest('[data-tpl-load],[data-tpl-rename],[data-tpl-del],[data-recent-open],[data-recent-del]');
  if (!b) return;
  const d = b.dataset;
  if (d.tplLoad) { const t = listTemplates().find(x => x.id === d.tplLoad); if (t) swapTo({ id: newId(), form: normForm({ ...templateForm(t), typeSet: true }), draft: null }); }
  else if (d.tplRename) {
    const t = listTemplates().find(x => x.id === d.tplRename); if (!t) return;
    SS().openSheet(`<h3>이름 바꾸기</h3><label class="yp-f"><span class="lab">이름</span><input class="field" id="pcTplRename" value="${esc(t.name)}" autocomplete="off"></label>
      <div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-close>취소</button><button class="btn primary" type="button" id="pcTplRenameOk">바꾸기</button></div>`,
    sh => sh.querySelector('#pcTplRenameOk').addEventListener('click', () => {
      const v = sh.querySelector('#pcTplRename').value;
      if (findPersonal(v)) { toast('개인정보는 넣지 말아 주세요'); return; }
      if (!renameTemplate(t.id, v)) { toast('이름을 넣어 주세요'); return; }
      SS().closeSheet(); renderOther(curTab);
    }));
  } else if (d.tplDel) {
    const t = listTemplates().find(x => x.id === d.tplDel); if (!t) return;
    SS().openSheet(`<h3>「${esc(t.name)}」 템플릿을 지울까요?</h3><div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-close>취소</button><button class="btn primary" type="button" id="pcTplDelOk">지우기</button></div>`,
      sh => sh.querySelector('#pcTplDelOk').addEventListener('click', () => { deleteTemplate(t.id); SS().closeSheet(); renderOther(curTab); toast('템플릿을 지웠어요'); }));
  } else if (d.recentOpen) { const r = listRecent().find(x => x.id === d.recentOpen); if (!r) return;
    // 지금 쓰고 있는 품의면 고치던 것 그대로 새 품의 탭으로(저장해 둔 옛 모습으로 바꾸지 않음)
    if (r.id === st.id) { go('purchase', 'new'); toast('지금 쓰고 있는 품의예요'); return; }
    const f = normForm({ ...r.form, typeSet: true }); swapTo({ id: r.id, form: f, draft: normDraft(r.draft, f) }); }
  else if (d.recentDel) { deleteRecent(d.recentDel); renderOther(curTab); toast('최근 작성에서 지웠어요'); }
});

onEnter('purchase', (tab, section) => {
  if (!box || !section.contains(box)) { box = document.createElement('div'); box.className = 'pc-box'; section.prepend(box); }
  curTab = tab;
  if (tab === 'new') render(); else renderOther(tab);
});
