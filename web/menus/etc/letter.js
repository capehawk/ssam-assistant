/* 기타 › 가정통신문 (스펙 2026-11-03 가정통신문): 학교 양식 + 상위기관 공문·계획 + 넣을 내용 → AI 한 번 →
   학교 양식에 맞춘 가정통신문(.hwpx 양식은 모양 그대로, .hwp·기본 양식은 글 짜임만), 알림 앱용 짧은 글, 발송 기안.
   양식은 IndexedDB(form-store.js), 글은 학년도 자료(letter-model.js). 원본 공문 파일은 저장하지 않음(글만) */
import { onEnter, go } from '../../core/shell.js';
import { parseTableLines } from '../../core/body-table.js';
import * as ai from '../../core/ai.js';
import { toast, copyText, saveFile } from '../../core/ui.js';
import { readText, fileMessage } from '../../core/files.js';
import { aiRowHTML } from '../../core/ai-roles.js';
import { exportButton, exportDoc } from '../../core/doc-export.js';
import { getSchool } from '../../core/settings.js';
import { canQueue, openQueue } from '../../core/queue-paste.js';
import { readForm, findRoles, fillForm, rolesValid, isSign } from '../../core/hwpx-form.js';
import { forms, newFormId, MAX_FORM } from '../../core/form-store.js';
import { cleanSheet } from '../evaluate/activity/activity-read.js';
import { letterQueueItems } from '../plan/report-ai.js';
import { plainFromText, defaultPlain, plainLetterDoc, letterPrompt, normLetter, composeBody, composeSend, formSample, cleanSample } from './letter-ai.js';
import { rosterAllowed } from '../../core/student-no.js';
import { replyOptions, replyPrompt, normReply, flagRows, tally, missingNos, collectTSV, collectDoc } from './reply-collect.js';
import { getCurrent, saveCurrent, clearCurrent, listLetters, pushLetter, newLetterId, getFormId, setFormId } from './letter-model.js';

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; };
const baseName = n => String(n || '').replace(/\.[^.]+$/, '').trim() || '양식';
const ROLE_NAMES = [['title', '제목'], ['bodyStart', '본문 시작'], ['bodyEnd', '본문 끝'], ['date', '날짜'], ['reply', '회신서 시작']];
/* 화면에만: list(양식 목록), form(고른 양식 { rec, parsed }), busy, adding, mapOpen, mapSel */
export const F = { list: [], form: null, busy: false, adding: 0, mapOpen: false, mapSel: -1, store: null };
let box = null, cur = null;
const blank = () => ({ id: newLetterId(), sources: [], memo: '', related: [], target: '', out: null, send: { title: '', body: '' }, sendEdited: false, collect: { mask: [], rows: [] } });
const SS = () => window.SSAM || {};
/* 회신서 스캔(화면에만): pages, busy, tok(읽는 중 다른 가정통신문·새 스캔이면 버림) */
const RC = { pages: [], busy: false, tok: 0, adding: false };
const c = () => (cur || (cur = getCurrent() || blank()));
function save(x = c(), { push = false } = {}) { if (x === c()) saveCurrent(x); if (push && x.out) pushLetter(x); }
function resend(force = false, x = c()) {
  if (!x.out || (x.sendEdited && !force)) return;
  x.send = composeSend({ title: x.out.title, related: x.related, target: x.target, date: x.out.date }); x.sendEdited = false;
}

/* ---------- 양식 ---------- */
const QUOTA = '양식을 저장하지 못했어요(저장 공간이 꽉 찼을 수 있어요).';
async function loadForms() {
  F.store = await forms();
  try { F.list = await F.store.list(); } catch (e) { F.list = []; }
  // 이번에만 쓰는 양식(저장하지 못한 것)을 고른 채면 그대로 둠
  if (F.form && F.form.temp) return;
  const id = getFormId();
  if (id && (!F.form || F.form.rec.id !== id)) await selectForm(id, { quiet: true });
}
let selTok = 0;
async function selectForm(id, { quiet = false } = {}) {
  const tok = ++selTok; // 양식을 빨리 바꿔 고르면 마지막 것만
  setFormId(id);
  F.form = null; F.mapOpen = false; F.mapSel = -1;
  if (!id) { render(); return; }
  let rec = null;
  try { rec = await F.store.get(id); } catch (e) { rec = null; }
  if (tok !== selTok) return;
  if (!rec) { setFormId(''); if (!quiet) toast('양식을 찾지 못했어요. 기본 양식으로 써요.'); render(); return; }
  let parsed = null;
  if (rec.kind === 'hwpx') { try { parsed = await readForm(rec.bytes); } catch (e) { toast('양식 파일을 읽지 못했어요. 다시 넣어 주세요.', 5000); } }
  if (tok !== selTok) return;
  F.form = { rec, parsed };
  render();
}
/* 저장하지 못한(크거나 저장소가 꽉 찬) 양식은 이번에만 */
async function useTemp(rec, msg) {
  ++selTok;
  F.form = { rec, parsed: rec.kind === 'hwpx' ? await readForm(rec.bytes) : null, temp: true };
  F.mapOpen = false; F.mapSel = -1;
  toast(msg, 7000);
}
const rolesOk = r => rolesValid(r);
/* 양식 넣기: .hwpx는 모양 그대로 채울 양식, .hwp는 글 짜임만 */
async function addForm(file) {
  F.adding++; render();
  try {
    if (!F.store) F.store = await forms(); // 탭을 연 바로 그때 넣어도
    const u8 = new Uint8Array(await file.arrayBuffer());
    const isZip = u8[0] === 0x50 && u8[1] === 0x4B;
    let rec;
    if (/\.hwpx$/i.test(file.name) || isZip) {
      const parsed = await readForm(u8);
      rec = { id: newFormId(), name: baseName(file.name), kind: 'hwpx', bytes: u8, roles: findRoles(parsed.lines), savedAt: Date.now() };
    } else {
      rec = { id: newFormId(), name: baseName(file.name), kind: 'plain', plain: plainFromText(await readText(file)), savedAt: Date.now() };
    }
    if (rec.bytes && rec.bytes.length > MAX_FORM) { await useTemp(rec, '양식 파일이 5MB보다 커서 저장하지 않고 이번에만 써요.'); F.adding--; render(); return; }
    try { await F.store.put(rec); F.list = await F.store.list(); }
    catch (e) { await useTemp(rec, `${QUOTA} 이번에만 써요.`); F.adding--; render(); return; }
    F.adding--;
    await selectForm(rec.id, { quiet: true });
    if (rec.kind === 'plain') toast('.hwp 양식은 글 짜임만 따라 만들어요(로고·표 모양은 빠져요). 한글에서 .hwpx로 저장해 넣으면 모양까지 살아요.', 8000);
    else if (!rolesOk(rec.roles)) { F.mapOpen = true; render(); toast('제목·본문·날짜 자리를 다 찾지 못했어요. 줄을 눌러 정해 주세요.', 6000); }
    else toast(`「${rec.name}」 양식을 저장했어요. 자리가 맞는지 [양식 맞추기]에서 볼 수 있어요.`, 5000);
    if (!F.store.persistent) toast('이 브라우저는 양식을 저장할 수 없어 이번에만 써요.', 6000);
  } catch (e) {
    F.adding = Math.max(0, F.adding - 1); render();
    toast(e && e.code ? fileMessage(e.code) : '양식 파일을 읽지 못했어요. 한글(.hwpx·.hwp) 파일을 넣어 주세요.', 6000);
  }
}
/* 양식 맞추기: 줄마다 자리 */
function roleOf(r, i) {
  if (!r) return '';
  if (i === r.date) return '날짜';
  if (i === r.sign) return '학교장';
  if (i === r.title) return '제목';
  if (r.bodyStart >= 0 && i >= r.bodyStart && i <= r.bodyEnd) return '본문';
  if (r.reply >= 0 && i >= r.reply) return '회신서';
  if (r.title >= 0 && i < r.title) return '머리';
  return '';
}
function mapHTML() {
  const f = F.form;
  if (!F.mapOpen || !f || !f.parsed) return '';
  const r = f.rec.roles, lines = f.parsed.lines.slice(0, 200);
  return `<div class="lf-map" id="lfMap"><div class="row"><b class="grow">양식 맞추기${rolesOk(r) ? '' : ' <span class="muted warn">· 제목 → 본문 → 날짜 → 학교장 → 회신서 차례로 정해 주세요</span>'}</b><button class="btn primary" type="button" data-lf="mapSave">저장</button><button class="btn text" type="button" data-lf="mapClose">닫기</button></div>
    <p class="muted" style="margin:0">줄을 누르고 자리를 고르세요. 머리·학교장 줄은 그대로 두고, 제목·본문·날짜만 바꿔 넣어요. 양식에 {제목}·{본문}·{날짜}를 적어 두어도 돼요.</p>
    <ol class="lf-lines">${lines.map((l, i) => { const ro = roleOf(r, i); return `<li class="lf-r-${{ 제목: 'title', 본문: 'body', 날짜: 'date', 학교장: 'sign', 회신서: 'reply', 머리: 'head' }[ro] || 'none'}${F.mapSel === i ? ' sel' : ''}">
      <button type="button" data-lf-line="${i}"><span class="lf-badge">${ro || '·'}</span><span class="lf-text">${esc(l.text.trim() ? l.text : l.obj ? '(그림·개체)' : '(빈 줄)')}</span></button>
      ${F.mapSel === i ? `<span class="row lf-pick">${ROLE_NAMES.map(([k, n]) => `<button class="btn tiny" type="button" data-lf-role="${k}">${n}</button>`).join('')}<button class="btn text tiny" type="button" data-lf-role="noreply">회신서 없음</button></span>` : ''}</li>`; }).join('')}</ol></div>`;
}

/* ---------- 넣기 ---------- */
async function addSources(files) {
  const x = c(), fails = [];
  let cut = 0;
  for (const f of files) {
    try { const cl = cleanSheet(await readText(f)); cut += cl.cut || 0; x.sources.push({ name: f.name, text: cl.text }); }
    catch (e) { fails.push(`${f.name}(${fileMessage(e && e.code)})`); }
  }
  save(); render();
  if (fails.length) toast(`읽지 못한 파일: ${fails.join(', ')}`, 7000);
  else if (cut) toast(`명단·전화번호가 적힌 줄 ${cut}곳은 빼고 넣었어요(AI로 보내지 않아요)`, 5000);
}
/* 문체 참고: 양식의 옛 제목·본문(머리·학교장·회신서는 빼고) */
function sampleOf() {
  const f = F.form;
  if (!f) return '';
  if (f.rec.kind === 'plain') return cleanSample(f.rec.plain.sample || '');
  return f.parsed ? formSample(f.parsed.lines, f.rec.roles) : '';
}
export async function write() {
  if (F.busy) return;
  const x = c();
  if (!x.memo.trim() && !x.sources.some(s => s.text.trim())) { toast('넣을 내용을 적거나 공문·계획 파일을 넣어 주세요.', 5000); return; }
  if (!ai.ready()) { toast('설정 › AI에서 키를 넣어 주세요', 5000); return; }
  F.busy = true; render();
  try {
    const v = await ai.generateJSON(letterPrompt({ sources: x.sources, memo: cleanSheet(x.memo).text, sample: sampleOf(), today: today(), year: getSchool().year }),
      { task: 'letter', valid: o => !!o && typeof o === 'object' && !Array.isArray(o) });
    const n = normLetter(v, { year: getSchool().year });
    x.related = n.related; x.target = n.target;
    x.out = { title: n.title, date: (x.out && x.out.date) || today(), body: composeBody(n), replyOn: n.reply.need,
      reply: { title: n.reply.title || '회신서', fields: n.reply.fields, due: n.reply.due }, short: n.short };
    // 기다리는 동안 다른 가정통신문을 열었으면 그 글은 건드리지 않고, 쓴 글은 최근에 넣음
    resend(true, x);
    save(x, { push: true });
    toast(c() === x ? '가정통신문을 썼어요. 날짜·장소·금액은 꼭 확인해 주세요.' : `「${x.out.title}」을 다 써서 최근 가정통신문에 넣었어요.`, 5000);
  } catch (e) {
    toast(e && e.code === 'bad_json' ? 'AI 답을 읽지 못했어요. 다시 눌러 주세요.' : ai.errorMessage(e && e.code, e), 6000);
  }
  F.busy = false;
  render();
}
const letterOf = x => ({ title: x.out.title, date: x.out.date || today(), body: x.out.body, reply: x.out.replyOn ? x.out.reply : null });
async function download() {
  const x = c();
  if (!x.out) return;
  const name = (x.out.title || '가정통신문').replace(/[\\/:*?"<>|]/g, '_');
  const f = F.form;
  if (f && f.rec.kind === 'hwpx' && f.parsed) {
    const r = f.rec.roles;
    if (!rolesOk(r)) { F.mapOpen = true; render(); toast('양식의 제목·본문·날짜 자리를 먼저 정해 주세요.', 5000); return; }
    let bytes, warn, where;
    try {
      ({ bytes, warn } = await fillForm(f.parsed, r, letterOf(x)));
      where = await saveFile(`${name}.hwpx`, bytes, 'application/hwp+zip');
    } catch (e) { toast(`한글 파일을 만들지 못했어요: ${String((e && e.message) || e || '').slice(0, 80)}`, 7000); return; }
    const m = window.__TAURI__ ? `다운로드 폴더에 저장했어요: ${String(where).split(/[\\/]/).pop()}` : '한글 파일을 내려받았어요';
    toast(m + (warn.includes('reply-in-box') ? ' · 양식의 회신서가 본문과 같은 표 안에 있어 회신서는 바꾸지 않았어요' : '')
      + (warn.includes('overlap') ? ' · 겹치는 자리가 있어 일부를 바꾸지 못했어요. [양식 맞추기]를 확인해 주세요' : '')
      + (warn.includes('no-border') ? ' · 이 양식에는 표 테두리를 더할 수 없어 회신서를 넣지 못했어요' : ''), 8000);
    return;
  }
  const plain = f && f.rec.kind === 'plain' ? f.rec.plain : defaultPlain(getSchool().name);
  toast(await exportDoc(plainLetterDoc(plain, letterOf(x)), name), 6000);
}

/* ---------- 그리기 ---------- */
const formsHTML = () => {
  const id = F.form ? F.form.rec.id : '';
  return `<div class="row lf-forms"><label class="yp-f grow"><span class="lab">학교 양식</span><select class="field" id="lfForm">
      <option value="">기본 양식(쌤비서 · ${esc(getSchool().name || '학교 이름은 설정 › 학교 정보')})</option>
      ${F.list.map(f => `<option value="${esc(f.id)}"${f.id === id ? ' selected' : ''}>${esc(f.name)}${f.kind === 'plain' ? ' (.hwp · 짜임만)' : ''}</option>`).join('')}
      ${F.form && !F.list.some(f => f.id === id) ? `<option value="${esc(id)}" selected>${esc(F.form.rec.name)} (이번에만)</option>` : ''}</select></label>
    <span class="row"><button class="btn" type="button" data-lf="pickForm">${F.adding ? '<span class="spin"></span>읽는 중…' : '양식 넣기'}</button>
      ${F.form && F.form.rec.kind === 'hwpx' ? '<button class="btn text" type="button" data-lf="map">양식 맞추기</button>' : ''}
      ${F.form ? '<button class="btn text" type="button" data-lf="delForm">양식 지우기</button>' : ''}
      <input type="file" id="lfFormFile" hidden accept=".hwpx,.hwp"></span></div>
    <p class="muted" style="margin:0">${F.form && F.form.rec.kind === 'hwpx' ? '이 양식의 머리·로고·학교장 줄은 그대로 두고 제목·본문·날짜만 바꿔 넣어요.' : F.form ? '.hwp 양식은 글 짜임만 따라요. 한글에서 .hwpx로 저장해 넣으면 모양까지 살아요.' : '학교 가정통신문 양식(.hwpx·.hwp)을 한 번 넣으면 저장해 두고 다음부터 바로 써요.'}</p>`;
};
const srcHTML = x => (x.sources.length ? `<ul class="rp-src" id="lfSrc">${x.sources.map((s, i) => `<li><span class="rp-name" title="${esc(s.name)}">${esc(s.name)}</span><span class="muted">${s.text.length.toLocaleString('ko-KR')}자</span>
    <button class="icon-btn tiny" type="button" data-lf-del="${i}" aria-label="${esc(s.name)} 빼기" title="빼기">✕</button></li>`).join('')}</ul>` : '<p class="muted" id="lfSrc" style="margin:0">상위기관 공문·계획 파일을 넣으면 그 내용을 따라 써요(선택).</p>');
/* 본문 표 미리보기(「|」 줄이 있을 때만) */
function tablesHTML(body) {
  const ts = parseTableLines(body).filter(p => p.type === 'table');
  return ts.length ? `<p class="muted" style="margin:0">표 미리보기</p>${ts.map(t => `<table class="yp-tbl lf-tbl"><tbody>${t.rows.map((r, ri) => `<tr>${r.map(c => ri ? `<td>${esc(c)}</td>` : `<th>${esc(c)}</th>`).join('')}</tr>`).join('')}</tbody></table>`).join('')}` : '';
}
function outHTML(x) {
  const o = x.out;
  if (!o) return '<p class="muted">[가정통신문 쓰기]를 누르면 제목·인사·본문·회신서를 학교 양식에 맞춰 써요.</p>';
  const hwpx = F.form && F.form.rec.kind === 'hwpx';
  return `<label class="yp-f"><span class="lab">제목</span><input class="field" data-lo="title" value="${esc(o.title)}" autocomplete="off"></label>
    <label class="yp-f"><span class="lab">발행일</span><input class="field" type="date" data-lo="date" value="${esc(o.date)}"></label>
    <label class="yp-f"><span class="lab">본문 <span class="muted">(한 줄에 한 문단 · 「1.」「  가.」「    1)」로 단계 · 「| 시간 | 내용 |」 줄은 표)</span></span><textarea class="field" data-lo="body" rows="14">${esc(o.body.join('\n'))}</textarea></label>
    <div id="lfTbl">${tablesHTML(o.body)}</div>
    <label class="switch"><input type="checkbox" id="lfReplyOn"${o.replyOn ? ' checked' : ''}>회신서(자르는 선 아래) 붙이기</label>
    ${o.replyOn ? `<div class="lf-reply"><label class="yp-f"><span class="lab">회신서 제목</span><input class="field" data-lr="title" value="${esc(o.reply.title)}" autocomplete="off"></label>
      <label class="yp-f"><span class="lab">칸 <span class="muted">(한 줄에 하나 · 「이름: 내용」, 학년 반 번호·학생 이름 칸은 늘 있어요)</span></span><textarea class="field" data-lr="fields" rows="3">${esc(o.reply.fields.join('\n'))}</textarea></label>
      <label class="yp-f"><span class="lab">제출 안내</span><input class="field" data-lr="due" value="${esc(o.reply.due)}" autocomplete="off"></label></div>` : ''}
    <div class="row">${hwpx ? '<button class="btn primary" type="button" data-lf="download">한글로 내려받기</button>' : exportButton('data-lf="download"', { cls: 'primary' })}</div>`;
}
/* ---------- 회신서 모으기 (스펙 2026-11-04 6장) ---------- */
const rcOpts = x => (x.out && x.out.replyOn ? replyOptions(x.out.reply.fields) : []);
function collectHTML(x) {
  const opts = rcOpts(x);
  if (!opts.length) return '';
  const col = x.collect, rows = flagRows(col.rows), allowed = rosterAllowed(), t = tally(col.rows, opts), miss = missingNos(col.rows, allowed);
  const order = rows.map((r, i) => ({ r, i })).sort((a, b) => (a.r.no == null) - (b.r.no == null) || (a.r.no || 0) - (b.r.no || 0));
  return `<section class="pc-card" id="lfCollect"><h3>회신서 모으기</h3>
    <p class="muted" style="margin:0">걷은 회신서를 스캔(PDF·사진)해 넣고 이름 칸을 한 번 가리면, AI가 가린 그림에서 번호와 ☑만 읽어요(이름은 읽지도 저장하지도 않아요).</p>
    <p style="margin:0">읽을 칸: ${opts.map(o => `<b>${esc(o.name)}</b>(${o.options.map(esc).join(' / ')})`).join(', ')}</p>
    <div class="row"><button class="btn" type="button" data-lf="rcPick">${RC.adding ? '<span class="spin"></span>읽는 중…' : '스캔 넣기'}</button><input type="file" id="lfRcFile" multiple hidden accept=".pdf,.png,.jpg,.jpeg,.webp">
      <span class="muted">${RC.pages.length}장</span>
      <button class="btn text" type="button" data-lf="rcMask"${RC.pages.length ? '' : ' disabled'}>이름 칸 가리기${col.mask.length ? ' (가림)' : ''}</button>
      <button class="btn primary" type="button" data-lf="rcRead"${RC.pages.length && !RC.busy ? '' : ' disabled'}>${RC.busy ? '<span class="spin"></span>읽는 중…' : '읽기'}</button></div>
    ${rows.length ? `<div class="yp-tbl-wrap"><table class="yp-tbl lf-rc"><thead><tr><th>번호</th>${opts.map(o => `<th>${esc(o.name)}</th>`).join('')}<th></th></tr></thead><tbody>
      ${order.map(({ r, i }) => `<tr data-rc-row="${i}" class="${r.warn ? 'warn' : ''}"><td><input class="field" type="number" min="1" max="99" data-rc-no="${i}" value="${r.no == null ? '' : r.no}" aria-label="번호" title="${r.warn === 'dup' ? '같은 번호가 또 있어요' : r.warn === 'none' ? '번호를 못 읽었어요' : ''}"></td>
        ${opts.map(o => `<td><select class="field${r.unsure.includes(o.name) ? ' unsure' : ''}" data-rc-a="${i}" data-rc-f="${esc(o.name)}" aria-label="${esc(o.name)}"><option value="">(표시 없음)</option>${o.options.map(v => `<option${r.answers[o.name] === v ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select></td>`).join('')}
        <td><button class="icon-btn tiny" type="button" data-rc-del="${i}" aria-label="이 줄 빼기">✕</button></td></tr>`).join('')}</tbody></table></div>
      <p style="margin:0">${t.map(z => `<b>${esc(z.name)}</b> ${z.counts.map(([o, n]) => `${esc(o)} ${n}명`).join(' · ')}${z.blank ? ` · 표시 없음 ${z.blank}명` : ''}`).join('<br>')}</p>
      <p style="margin:0">${miss.length ? `미제출: ${miss.join(', ')}번` : '모두 냈어요'} <span class="muted">(낸 회신서 ${rows.length}장${allowed ? '' : ' · 설정 › 학급 명단에 학생 수를 넣으면 미제출이 정확해요'})</span></p>
      <div class="row"><button class="btn" type="button" data-lf="rcCopy">표 복사</button>${exportButton('data-lf="rcExport"')}<button class="btn text" type="button" data-lf="rcClear">표 비우기</button></div>` : ''}
  </section>`;
}
function rcReset() { if (SS().files && SS().files.freePages) SS().files.freePages(RC.pages); RC.pages = []; RC.tok++; RC.busy = false; }
async function rcAdd(files) {
  if (!SS().files || !SS().files.readPages) { toast('스캔을 읽는 도구를 아직 불러오지 못했어요. 잠시 뒤 다시 넣어 주세요.'); return; }
  RC.adding = true; render();
  try {
    const r = await SS().files.readPages(files), pages = Array.isArray(r) ? r : (r && r.pages) || [];
    if (SS().files.freePages) SS().files.freePages(RC.pages);
    RC.pages = pages; RC.tok++; RC.busy = false;
    if (r && r.skipped && r.skipped.length) toast(`읽지 못한 파일: ${r.skipped.map(s => s.name || s).join(', ')}`, 6000);
  } catch (e) { toast(e && e.code ? fileMessage(e.code) : '스캔을 읽지 못했어요. PDF·사진을 넣어 주세요.', 6000); }
  RC.adding = false; render();
}
function rcMask(then) {
  const x = c();
  if (!RC.pages.length || !SS().openMaskEditor) return;
  SS().openMaskEditor({ shots: RC.pages.slice(0, 6).map((p, i) => ({ url: p.url, label: `${i + 1}장` })), mask: x.collect.mask, all: true, what: '회신서',
    save: mask => { const y = c(); if (y !== x) return; y.collect.mask = mask || []; save(y); render(); if (then && y.collect.mask.length) then(); } });
}
async function rcRead() {
  const x = c(), opts = rcOpts(x);
  if (!RC.pages.length || !opts.length || RC.busy) return;
  if (!x.collect.mask.length) { toast('먼저 학생 이름 칸을 가려 주세요(가린 그림만 AI로 보내요).', 5000); rcMask(rcRead); return; }
  if (!ai.ready()) { toast('설정 › AI에서 키를 넣어 주세요', 5000); return; }
  const tok = ++RC.tok, pages = RC.pages, mask = x.collect.mask, shared = replyPrompt(opts), out = new Array(pages.length);
  RC.busy = true; render();
  let next = 0, fails = 0;
  const one = async i => {
    try {
      const img = await SS().files.pageImage(pages[i], mask);
      const v = await ai.generateJSON(`${i + 1}번째 회신서 그림입니다. 위 꼴의 JSON 하나로만 답하세요.`, { shared: { text: shared }, images: [img], task: 'reply', valid: o => !!o && typeof o === 'object' && !Array.isArray(o) });
      out[i] = normReply(v, opts);
    } catch (e) { fails++; out[i] = normReply(null, opts); if (e && (e.code === 'auth' || e.code === 'quota')) throw e; }
  };
  try {
    await Promise.all(Array.from({ length: Math.min(3, pages.length) }, async () => { while (next < pages.length && tok === RC.tok) await one(next++); }));
  } catch (e) { toast(ai.errorMessage(e && e.code, e), 6000); }
  if (tok !== RC.tok) return; // 그새 스캔을 바꾸거나 다른 가정통신문을 열었으면 버림
  RC.busy = false;
  if (c() !== x) { render(); return; }
  x.collect.rows = out.filter(Boolean).map(r => ({ no: r.no, answers: r.answers, unsure: r.unsure }));
  save(x, { push: true }); render();
  toast(fails ? `${fails}장은 읽지 못했어요. 노란 칸을 확인해 주세요.` : '회신서를 읽었어요. 노란 칸은 꼭 확인해 주세요.', 5000);
}
function sideHTML(x) {
  if (!x.out) return '';
  return `<section class="pc-card"><h3>알림 앱용 짧은 글</h3>
      <textarea class="field" id="lfShort" rows="5">${esc(x.out.short)}</textarea>
      <div class="row"><button class="btn" type="button" data-lf="copyShort">복사</button></div>
      <p class="muted" style="margin:0">e알리미 같은 학부모 알림 앱에 붙여 넣고, 내려받은 가정통신문을 붙임으로 올려 주세요.</p></section>
    <section class="pc-card"><h3>발송 기안</h3>
      <div class="pc-out"><div class="pc-out-h"><label class="lab" for="lfSendTitle">제목</label><button class="btn text pc-copy" type="button" data-lf="copySendTitle">복사</button></div>
        <input class="field" id="lfSendTitle" value="${esc(x.send.title)}" autocomplete="off"></div>
      <div class="pc-out"><div class="pc-out-h"><label class="lab" for="lfSendBody">본문</label><button class="btn text pc-copy" type="button" data-lf="copySendBody">복사</button></div>
        <textarea class="field" id="lfSendBody" rows="9">${esc(x.send.body)}</textarea></div>
      <div id="lfResync">${x.sendEdited ? '<p class="muted pc-resync">기안을 고쳤어요 <button class="btn text tiny" type="button" data-lf="resync">칸으로 다시 맞추기</button></p>' : ''}</div>
      <div class="row"><button class="btn" type="button" data-lf="copySend">모두 복사</button>${canQueue() ? '<button class="btn primary" type="button" data-lf="queue">에듀파인 기안에 차례로 붙여넣기</button>' : ''}</div></section>`;
}
const recentHTML = () => {
  const l = listLetters();
  return l.length ? `<ul class="pc-lib-list" id="lfRecent">${l.map(r => `<li class="pc-lib-row"><div class="grow"><b>${esc(r.out.title || '가정통신문')}</b><span class="muted">${new Date(r.at).toLocaleDateString('ko-KR')}</span></div>
    <button class="btn text" type="button" data-lf-open="${esc(r.id)}">열기</button></li>`).join('')}</ul>` : '<p class="muted" id="lfRecent" style="margin:0">쓴 가정통신문이 최근 20개까지 남아요.</p>';
};
// 다시 그리는 중에 지워지는 칸의 blur→change가 또 그리기를 부르면 건너뜀(이미 같은 값을 그리는 중)
let drawing = false;
export function render() {
  if (!box || box.hidden || drawing) return;
  drawing = true;
  try { draw(); } finally { drawing = false; }
}
function draw() {
  const x = c();
  box.innerHTML = `<div class="m-page lf-page">
    <div class="m-head"><div><h2>가정통신문</h2><p class="muted">학교 양식을 넣어 두고, 공문·계획과 넣을 내용을 주면 학교 양식에 맞춘 가정통신문을 써요.</p></div>
      <div class="row"><button class="btn text" type="button" data-lf="new">새 가정통신문</button></div></div>
    ${aiRowHTML('letter')}
    <div class="msg-grid">
      <section class="pc-card"><h3>양식</h3>${formsHTML()}${mapHTML()}
        <h3>넣기</h3>
        <div class="msg-drop" data-lf-drop><p class="muted" style="margin:0">상위기관 공문·계획(한글·PDF·워드·글)을 여기에 끌어 놓거나 고르세요.</p>
          <div class="row"><button class="btn text" type="button" data-lf="pick">파일 고르기</button><input type="file" id="lfFile" multiple hidden accept=".hwp,.hwpx,.pdf,.docx,.txt"></div></div>
        ${srcHTML(x)}
        <label class="yp-f"><span class="lab">넣을 내용</span><textarea class="field" id="lfMemo" rows="7" placeholder="예) 11월 12일(목) 3학년 국립중앙과학관 현장체험학습. 9시 출발 15시 도착. 도시락·물·편한 옷. 참가 동의서 11월 7일까지.">${esc(x.memo)}</textarea></label>
        <div class="row"><button class="btn primary" type="button" data-lf="write"${F.busy ? ' disabled' : ''}>${F.busy ? '<span class="spin"></span>쓰는 중…' : x.out ? '가정통신문 다시 쓰기' : '가정통신문 쓰기'}</button></div>
      </section>
      <section class="pc-card"><h3>가정통신문</h3>${outHTML(x)}</section>
    </div>
    <div class="msg-grid">${sideHTML(x)}</div>
    ${collectHTML(x)}
    <section class="pc-card"><h3>최근 가정통신문</h3>${recentHTML()}</section></div>`;
}
function refreshSend() {
  const x = c(), t = box && box.querySelector('#lfSendTitle'), b = box && box.querySelector('#lfSendBody'), rs = box && box.querySelector('#lfResync');
  if (t && document.activeElement !== t) t.value = x.send.title;
  if (b && document.activeElement !== b) b.value = x.send.body;
  if (rs) rs.innerHTML = x.sendEdited ? '<p class="muted pc-resync">기안을 고쳤어요 <button class="btn text tiny" type="button" data-lf="resync">칸으로 다시 맞추기</button></p>' : '';
}

/* ---------- 다른 메뉴에서 넣기 ---------- */
/* 행사계획 등: 이미 쓴 가정통신문 글을 학교 양식에 바로(AI 안 부름). 발행일 오늘, 회신서 끔 */
export function putLetterDraft({ title = '', body = [], memo = '' } = {}) {
  go('etc', 'letter');
  const lines = (Array.isArray(body) ? body : String(body || '').split('\n')).map(l => String(l).replace(/\s+$/, ''));
  while (lines.length && !lines[lines.length - 1]) lines.pop();
  cur = { ...blank(), memo: String(memo || ''), out: { title: String(title || ''), date: today(), body: lines, replyOn: false, reply: { title: '회신서', fields: [], due: '' }, short: '' } };
  resend(true); save(cur, { push: true }); render();
}
/* 공문 처리 등: 넣기 칸에 공문을 넣은 새 가정통신문(쓰기는 선생님이 누름) */
export function putLetterSources({ sources = [], memo = '' } = {}) {
  go('etc', 'letter');
  cur = { ...blank(), memo: String(memo || ''), sources: sources.filter(s => s && String(s.text || '').trim()).slice(0, 10).map(s => ({ name: String(s.name || '공문'), text: cleanSheet(s.text).text })) };
  save(); render();
}

/* ---------- 누르기·입력 ---------- */
const mine = e => box && !box.hidden && box.contains(e.target);
document.addEventListener('click', async e => {
  if (!mine(e)) return;
  const x = c();
  const ln = e.target.closest('[data-lf-line]');
  if (ln) { F.mapSel = F.mapSel === +ln.dataset.lfLine ? -1 : +ln.dataset.lfLine; render(); return; }
  const ro = e.target.closest('[data-lf-role]');
  if (ro && F.form && F.mapSel >= 0) {
    const L = F.form.parsed.lines, r = { ...F.form.rec.roles }, i = F.mapSel, k = ro.dataset.lfRole;
    const filled = j => !!(L[j] && (L[j].text.trim() || L[j].obj));
    const replyAfter = () => { r.reply = -1; for (let j = Math.max(r.date, r.sign) + 1; j < L.length; j++) if (filled(j)) { r.reply = j; break; } };
    F.mapSel = -1;
    if (k === 'noreply') r.reply = -1;
    else if (k === 'reply' && i <= Math.max(r.date, r.sign)) { toast('회신서는 날짜·학교장 줄 아래에서 골라 주세요.', 4000); render(); return; }
    else {
      r[k] = i;
      if (k === 'bodyStart' && r.bodyEnd < i) r.bodyEnd = i;
      if (k === 'bodyEnd' && (r.bodyStart < 0 || r.bodyStart > i)) r.bodyStart = i;
      if (k === 'date') {
        // 본문 끝은 날짜 위의 글 있는 줄까지, 학교장은 날짜 줄부터 처음 나오는 학교장 줄, 회신서는 그 아래
        if (r.bodyEnd >= i) { let e = i - 1; while (e > r.bodyStart && !filled(e)) e--; r.bodyEnd = e; }
        r.sign = L.findIndex((l, j) => j >= i && isSign(l.text));
        if (r.reply >= 0 && r.reply <= Math.max(r.date, r.sign)) replyAfter();
      }
    }
    F.form.rec.roles = r; render(); return;
  }
  const rd = e.target.closest('[data-rc-del]');
  if (rd) { x.collect.rows.splice(+rd.dataset.rcDel, 1); save(x, { push: true }); render(); return; }
  const del = e.target.closest('[data-lf-del]');
  if (del) { x.sources.splice(+del.dataset.lfDel, 1); save(); render(); return; }
  const op = e.target.closest('[data-lf-open]');
  if (op) { const r = listLetters().find(y => y.id === op.dataset.lfOpen); if (r) { cur = { ...r }; delete cur.at; saveCurrent(cur); rcReset(); render(); } return; }
  const b = e.target.closest('[data-lf]');
  if (!b) return;
  const a = b.dataset.lf;
  if (a === 'pickForm') box.querySelector('#lfFormFile').click();
  else if (a === 'pick') box.querySelector('#lfFile').click();
  else if (a === 'map') { F.mapOpen = !F.mapOpen; F.mapSel = -1; render(); }
  else if (a === 'mapClose') { F.mapOpen = false; render(); }
  else if (a === 'mapSave' && F.form) {
    if (F.list.some(f => f.id === F.form.rec.id)) { try { await F.store.put(F.form.rec); } catch (e) { toast(QUOTA, 6000); return; } }
    F.mapOpen = false; render(); toast(rolesOk(F.form.rec.roles) ? '양식 자리를 저장했어요.' : '제목·본문·날짜 자리가 아직 비어 있어요.', 4000);
  } else if (a === 'delForm' && F.form) {
    try { await F.store.del(F.form.rec.id); F.list = await F.store.list(); } catch (e) { toast('양식을 지우지 못했어요. 다시 눌러 주세요.', 5000); return; }
    await selectForm('');
    toast('양식을 지웠어요.');
  } else if (a === 'write') write();
  else if (a === 'new') { cur = blank(); clearCurrent(); rcReset(); render(); }
  else if (a === 'download') download();
  else if (a === 'resync') { resend(true); save(); refreshSend(); }
  else if (a === 'copyShort') copyText(x.out ? x.out.short : '').then(ok => toast(ok ? '복사했어요. 알림 앱에 붙여 넣으세요' : '복사하지 못했어요'));
  else if (a === 'copySendTitle' || a === 'copySendBody' || a === 'copySend') {
    const t = a === 'copySendTitle' ? x.send.title : a === 'copySendBody' ? x.send.body : `${x.send.title}\n\n${x.send.body}`;
    copyText(t).then(ok => toast(ok ? '복사했어요. 에듀파인 기안에 붙여 넣으세요' : '복사하지 못했어요'));
  } else if (a === 'queue') openQueue({ title: x.send.title, items: letterQueueItems(x.send) });
  else if (a === 'rcPick') box.querySelector('#lfRcFile').click();
  else if (a === 'rcMask') rcMask();
  else if (a === 'rcRead') rcRead();
  else if (a === 'rcCopy') copyText(collectTSV(x.collect.rows, rcOpts(x))).then(ok => toast(ok ? '표를 복사했어요. 엑셀·한글 표에 붙여 넣으세요' : '복사하지 못했어요'));
  else if (a === 'rcExport') exportDoc(collectDoc(x.collect.rows, rcOpts(x), { title: x.out.reply.title || x.out.title, allowed: rosterAllowed() }), `${x.out.reply.title || '회신서'} 회신 결과`).then(m => toast(m, 6000));
  else if (a === 'rcClear') { if (confirm('읽은 회신서 표를 비울까요?')) { x.collect.rows = []; save(x, { push: true }); render(); } }
});
document.addEventListener('change', e => {
  if (!mine(e)) return;
  const el = e.target, x = c();
  if (el.id === 'lfFormFile') { const f = el.files[0]; el.value = ''; if (f) addForm(f); return; }
  if (el.id === 'lfFile') { const fs = [...el.files]; el.value = ''; if (fs.length) addSources(fs); return; }
  if (el.id === 'lfForm') { selectForm(el.value); return; }
  if (el.id === 'lfReplyOn' && x.out) { x.out.replyOn = el.checked; save(x, { push: true }); render(); return; }
  if (el.id === 'lfRcFile') { const fs = [...el.files]; el.value = ''; if (fs.length) rcAdd(fs); return; }
  if (el.dataset.rcA != null) { const r = x.collect.rows[+el.dataset.rcA], f = el.dataset.rcF; if (r) { r.answers[f] = el.value; r.unsure = r.unsure.filter(u => u !== f); save(x, { push: true }); render(); } return; }
  if (el.dataset.rcNo != null) { const r = x.collect.rows[+el.dataset.rcNo], n = +el.value; if (r) { r.no = Number.isInteger(n) && n >= 1 && n <= 99 ? n : null; save(x, { push: true }); render(); } return; }
});
document.addEventListener('input', e => {
  if (!mine(e)) return;
  const el = e.target, x = c();
  if (el.id === 'lfMemo') { x.memo = el.value; save(x, { push: !!x.out }); return; }
  if (!x.out) return;
  if (el.dataset.lo) {
    const k = el.dataset.lo;
    x.out[k] = k === 'body' ? el.value.split('\n') : el.value;
    if (k === 'body') { const tb = box.querySelector('#lfTbl'); if (tb) tb.innerHTML = tablesHTML(x.out.body); }
    if (k === 'title' || k === 'date') { resend(); refreshSend(); }
    save(x, { push: true }); return;
  }
  if (el.dataset.lr) { const k = el.dataset.lr; x.out.reply[k] = k === 'fields' ? el.value.split('\n').map(s => s.trim()).filter(Boolean) : el.value; save(x, { push: true }); return; }
  if (el.id === 'lfShort') { x.out.short = el.value; save(x, { push: true }); return; }
  if (el.id === 'lfSendTitle' || el.id === 'lfSendBody') { x.send = { ...x.send, [el.id === 'lfSendTitle' ? 'title' : 'body']: el.value }; x.sendEdited = true; save(x, { push: true }); refreshSend(); }
});
document.addEventListener('dragover', e => { const z = box && e.target.closest && e.target.closest('[data-lf-drop]'); if (z && box.contains(z)) { e.preventDefault(); z.classList.add('over'); } });
document.addEventListener('dragleave', e => { const z = e.target.closest && e.target.closest('[data-lf-drop]'); if (z) z.classList.remove('over'); });
document.addEventListener('drop', e => {
  const z = box && e.target.closest && e.target.closest('[data-lf-drop]');
  if (!z || !box.contains(z)) return;
  e.preventDefault(); z.classList.remove('over');
  const fs = [...((e.dataTransfer && e.dataTransfer.files) || [])];
  if (fs.length) addSources(fs);
});

onEnter('etc', (tab, section) => {
  if (!box || !section.contains(box)) { box = document.createElement('div'); box.className = 'lf-box'; section.append(box); }
  box.hidden = tab !== 'letter';
  if (!box.hidden) { render(); loadForms().then(render).catch(() => {}); }
});
