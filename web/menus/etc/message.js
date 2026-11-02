/* 기타 › 쪽지 작성 (스펙 2026-11-02 4장): 공문·연수 계획·행사 계획 파일이나 글 → 선생님들께 보낼 안내 쪽지.
   AI는 칸만 뽑고(message-ai.js), 쪽지 글은 앱이 맞춤. 넣은 파일은 이 화면에만 두고(붙임 후보) 이름만 저장.
   AI로 보내기 전 명단 줄·전화번호 줄·주민번호 줄은 빼고 「이름: ○○○」은 이름을 지움. 보내는 사람은 AI로 보내지 않음 */
import { onEnter, go } from '../../core/shell.js';
import * as ai from '../../core/ai.js';
import { toast, copyText } from '../../core/ui.js';
import { readText } from '../../core/files.js';
import { aiRowHTML } from '../../core/ai-roles.js';
import { cleanSheet } from '../evaluate/activity/activity-read.js';
import { KINDS, messagePrompt, normMessage, composeMessage } from './message-ai.js';
import { getSender, setSender, getDraft, saveDraft, clearDraft, listMessages, pushMessage, newMessageId } from './message-model.js';

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SS = () => window.SSAM || {};
const IMAGE = /\.(png|jpe?g|webp|gif|bmp)$/i;
const baseName = n => String(n || '').replace(/\.[^.]+$/, '').trim() || '붙임';
const LENS = [['short', '짧게'], ['base', '기본'], ['long', '자세히']];
/* 화면 상태: files(넣은 파일, 붙임 후보 — 저장 안 함, attach와 같은 차례), busy, msg */
export const M = { files: [], busy: false, msg: '' };
let box = null, d = null;

const blankDraft = () => ({ id: newMessageId(), m: normMessage(null), len: 'base', attach: [], edited: false, body: '', title: '', again: false });
const cur = () => (d || (d = getDraft() || blankDraft()));
const hasContent = x => !!(x.m.title || (x.m.when || []).length || x.m.place || x.m.target);
/* 칸·길이·붙임·보내는 사람이 바뀌면 다시 맞춤(본문을 손으로 고쳤으면 그대로 두고 [다시 맞추기]) */
function compose(force = false) {
  const x = cur();
  if (x.edited && !force) return;
  const r = composeMessage(x.m, { len: x.len, attach: x.attach.filter(a => a.on).map(a => a.name), sender: getSender(), again: !!x.again });
  x.title = r.title; x.body = r.body; x.edited = false;
}
function persist() {
  const x = cur();
  saveDraft(x);
  if (hasContent(x)) pushMessage({ id: x.id, title: x.title, kind: x.again ? 'again' : x.m.kind, m: x.m, len: x.len, attachNames: x.attach.map(a => a.name) });
}

/* ---------- 붙임 파일 (Windows 앱): 다운로드 폴더에 모아 클립보드 파일 복사·폴더 열기 (스펙 4.5) ---------- */
const T = () => (globalThis.window && window.__TAURI__ && window.__TAURI__.core ? window.__TAURI__.core : null);
const filesHTML = () => `<div class="row" id="msgFiles">${T()
  ? '<button class="btn" type="button" data-msg="copyFiles">붙임 파일 복사</button><button class="btn text" type="button" data-msg="openDir">폴더 열기</button>'
  : '<span class="muted">Windows 앱에서는 붙임 파일 복사(쪽지 창에 Ctrl+V)·폴더 열기가 돼요. 웹판에서는 파일을 쪽지 창에 직접 넣어 주세요.</span>'}</div>`;
const today = () => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; };
const extOf = n => (/(\.[^.]+)$/.exec(String(n || '')) || ['', ''])[1];
/* 체크한 붙임 중 파일이 있는 것을 「날짜 제목」 폴더에 저장 → { dir, paths } | null */
async function saveAttachments() {
  const x = cur(), core = T();
  const picked = x.attach.map((a, i) => ({ a, f: M.files[i] })).filter(p => p.a.on && p.f);
  if (!picked.length) { toast(x.attach.some(a => a.on) ? '붙임 파일이 이 화면에 없어요. 파일을 다시 넣어 주세요(최근 쪽지는 이름만 남아요).' : '체크한 붙임이 없어요.', 6000); return null; }
  const files = [];
  for (const { a, f } of picked) files.push({ name: `${a.name}${extOf(f.name)}`, bytes: Array.from(new Uint8Array(await f.arrayBuffer())) });
  const folder = `${today()} ${String(x.m.title || '쪽지').trim()}`.slice(0, 80);
  try { return await core.invoke('note_save_attachments', { folder, files }); }
  catch (e) { toast(String(e || '붙임 파일을 저장하지 못했어요'), 6000); return null; }
}
async function copyFiles() {
  const saved = await saveAttachments();
  if (!saved) return;
  try { await T().invoke('note_copy_files', { paths: saved.paths }); toast(`붙임 파일 ${saved.paths.length}개를 복사했어요. 이음 쪽지 창의 첨부 칸에서 Ctrl+V 해 보세요. 안 되면 [폴더 열기]로 끌어 놓으세요.`, 8000); }
  catch (e) { toast(String(e || '파일을 클립보드에 넣지 못했어요. [폴더 열기]로 끌어 놓아 주세요.'), 7000); }
}
async function openDir() {
  const saved = await saveAttachments();
  if (!saved) return;
  try { await T().invoke('note_open_dir', { dir: saved.dir }); } catch (e) { toast(String(e || '폴더를 열지 못했어요'), 6000); }
}

/* ---------- 그리기 ---------- */
const field = (k, label, v, type = 'text', ph = '') => `<label class="yp-f"><span class="lab">${label}</span><input class="field" data-mf="${k}" type="${type}" value="${esc(v)}" placeholder="${esc(ph)}" autocomplete="off"></label>`;
function fieldsHTML(m) {
  const w = (m.when || [])[0] || { date: '', time: '' }, ap = m.apply || {};
  return `<div class="msg-fields" id="msgFields">
    ${field('title', '제목', m.title, 'text', '예) 2026 AI 활용 수업 연수')}
    <div class="row msg-two">${field('date', '날짜', w.date, 'date')}${field('time', '시간', w.time, 'text', '예) 15:00~16:30')}</div>
    ${(m.when || []).length > 1 ? `<p class="muted" style="margin:0">일시 ${m.when.length}개 중 첫째만 여기서 고쳐요. 나머지는 본문에서 고쳐 주세요.</p>` : ''}
    ${field('place', '장소', m.place)}${field('target', '대상', m.target)}
    <div class="row msg-two">${field('due', '신청 기한', ap.due, 'date')}${field('how', '신청 방법', ap.how, 'text', '예) 이음 쪽지로 회신')}</div>
    ${field('bring', '준비물', m.bring)}${field('notes', '유의 사항', m.notes)}</div>`;
}
const attachHTML = x => (x.attach.length ? `<ul class="msg-attach" id="msgAttach">${x.attach.map((a, i) => `<li><label class="switch"><input type="checkbox" data-att="${i}"${a.on ? ' checked' : ''}></label>
    <input class="field" data-att-name="${i}" value="${esc(a.name)}" aria-label="${i + 1}번째 붙임 이름" autocomplete="off">${M.files[i] ? '' : '<span class="muted">파일 없음(이름만)</span>'}</li>`).join('')}</ul>` : '<p class="muted" id="msgAttach" style="margin:0">넣은 파일이 붙임 목록이 돼요.</p>');
const recentHTML = () => {
  const l = listMessages();
  return l.length ? `<ul class="pc-lib-list" id="msgRecent">${l.map(r => `<li class="pc-lib-row"><div class="grow"><b>${esc(r.title || '제목 없는 쪽지')}</b><span class="muted">${new Date(r.at).toLocaleDateString('ko-KR')} · 붙임 ${r.attachNames.length}개</span></div>
    <span class="row"><button class="btn text" type="button" data-msg-open="${esc(r.id)}">열기</button><button class="btn text" type="button" data-msg-again="${esc(r.id)}">다시 안내</button></span></li>`).join('')}</ul>`
    : '<p class="muted" id="msgRecent" style="margin:0">쓴 쪽지가 최근 20개까지 남아요.</p>';
};
export function render() {
  if (!box) return;
  const x = cur();
  box.innerHTML = `<div class="m-page msg-page">
    <div class="m-head"><div><h2>쪽지 작성</h2><p class="muted">공문·연수 계획·행사 계획을 넣으면 선생님들께 보낼 안내 쪽지를 써요. 이음 쪽지 창에 붙여 넣으세요.</p></div>
      <div class="row"><button class="btn text" type="button" data-msg="new">새 쪽지</button></div></div>
    ${aiRowHTML('message')}
    <div class="msg-grid">
      <section class="pc-card"><h3>넣기</h3>
        <div class="msg-drop" data-msg-drop>
          <textarea class="field" id="msgPaste" rows="4" placeholder="공문·계획 글을 붙여 넣거나, 파일(한글·PDF·사진)을 여기에 끌어 놓으세요"></textarea>
          <div class="row"><button class="btn primary" type="button" data-msg="read"${M.busy ? ' disabled' : ''}>${M.busy ? '<span class="spin"></span>읽는 중…' : '쪽지 쓰기'}</button>
            <button class="btn text" type="button" data-msg="pick">파일 고르기</button>
            <input type="file" id="msgFile" multiple hidden accept=".hwp,.hwpx,.pdf,.txt,.png,.jpg,.jpeg,.webp"><span class="muted" id="msgState" role="status">${esc(M.msg)}</span></div>
          <p class="muted" style="margin:0">명단·전화번호가 적힌 줄은 빼고 AI로 보내요.</p></div>
        <h3>붙임</h3>${attachHTML(x)}${filesHTML()}
        <h3>칸</h3>${fieldsHTML(x.m)}
      </section>
      <section class="pc-card"><h3>쪽지</h3>
        <div class="seg" role="radiogroup" aria-label="쪽지 길이">${LENS.map(([k, l]) => `<button type="button" data-len="${k}" aria-pressed="${x.len === k}">${l}</button>`).join('')}</div>
        <div class="pc-out"><div class="pc-out-h"><label class="lab" for="msgTitle">제목</label><button class="btn text pc-copy" type="button" data-msg="copyTitle">복사</button></div>
          <input class="field" id="msgTitle" value="${esc(x.title)}" autocomplete="off"></div>
        <div class="pc-out"><div class="pc-out-h"><label class="lab" for="msgBody">본문</label><button class="btn text pc-copy" type="button" data-msg="copyBody">복사</button></div>
          <textarea class="field" id="msgBody" rows="18">${esc(x.body)}</textarea></div>
        <div id="msgResync">${x.edited ? '<p class="muted pc-resync">본문을 고쳤어요 <button class="btn text tiny" type="button" data-msg="resync">칸으로 다시 맞추기</button></p>' : ''}</div>
        <div class="row"><button class="btn primary" type="button" data-msg="copyAll">모두 복사</button></div>
        <label class="yp-f"><span class="lab">보내는 사람(문의)</span><input class="field" id="msgSender" value="${esc(getSender())}" placeholder="예) 교무부 ○○○(내선 123)" autocomplete="off"></label>
        <p class="muted" style="margin:0">보내는 사람은 한 번 적어 두면 늘 끝에 붙어요. AI로 보내지 않아요.</p>
      </section>
    </div>
    <section class="pc-card"><h3>최근 쪽지</h3>${recentHTML()}</section></div>`;
  document.dispatchEvent(new CustomEvent('ssam:message-render', { detail: { box } }));
}
/* 본문·제목만 다시 넣기(입력 칸에 초점이 있어도 그 칸은 덮지 않음) */
function refreshOut() {
  if (!box) return;
  const x = cur(), t = box.querySelector('#msgTitle'), b = box.querySelector('#msgBody'), rs = box.querySelector('#msgResync'), at = box.querySelector('#msgAttach');
  if (t && document.activeElement !== t) t.value = x.title;
  if (b && document.activeElement !== b) b.value = x.body;
  if (rs) rs.innerHTML = x.edited ? '<p class="muted pc-resync">본문을 고쳤어요 <button class="btn text tiny" type="button" data-msg="resync">칸으로 다시 맞추기</button></p>' : '';
  if (at && !at.contains(document.activeElement)) at.outerHTML = attachHTML(x);
}

/* ---------- 넣기·읽기 ---------- */
const setState = m => { M.msg = m; const el = box && box.querySelector('#msgState'); if (el) el.textContent = m; };
function addFiles(files) {
  const x = cur();
  for (const f of files) { M.files.push(f); x.attach.push({ name: baseName(f.name), on: true }); }
}
/* 넣은 파일·붙여 넣은 글을 읽어 AI 한 번 → 칸 → 쪽지 */
export async function readAll() {
  if (M.busy) return;
  const x = cur(), paste = box && box.querySelector('#msgPaste') ? box.querySelector('#msgPaste').value : '';
  if (!M.files.length && !paste.trim()) { toast('공문·계획 파일을 넣거나 글을 붙여 넣어 주세요.', 5000); return; }
  if (!ai.ready()) { toast('설정 › AI에서 키를 넣어 주세요', 5000); return; }
  M.busy = true; render(); setState('읽는 중…');
  try {
    const texts = paste.trim() ? [paste] : [], images = [];
    for (const f of M.files) {
      let t = '';
      if (!IMAGE.test(f.name || '')) { try { t = await readText(f); } catch (e) { t = ''; } }
      if (String(t).trim()) texts.push(t);
      else if (images.length < 4 && SS().files && SS().files.toImages) { try { images.push(...(await SS().files.toImages(f)).slice(0, 4 - images.length)); } catch (e) {} }
    }
    const c = cleanSheet(texts.join('\n\n'));
    if (!c.text && !images.length) throw { code: 'empty' };
    setState('AI가 쪽지 칸을 찾는 중…');
    const v = await ai.generateJSON(messagePrompt(c.text, { nImages: images.length }), { images, task: 'message', valid: o => !!o && typeof o === 'object' && !Array.isArray(o) });
    x.m = normMessage(v, { year: new Date().getFullYear() });
    x.again = false;
    compose(true); persist();
    M.busy = false; setState('');
    if (c.cut) toast(`쪽지를 썼어요 · 명단·전화번호가 적힌 줄 ${c.cut}곳은 뺐어요(AI로 보내지 않았어요)`, 6000);
    else toast('쪽지를 썼어요. 칸과 본문을 확인해 주세요', 4000);
  } catch (e) {
    M.busy = false; setState('');
    toast(e && e.code === 'empty' ? '글을 읽지 못했어요. 글을 붙여 넣어 주세요.' : e && e.code === 'bad_json' ? 'AI 답을 읽지 못했어요. 다시 눌러 주세요.' : ai.errorMessage(e && e.code, e), 6000);
  }
  render();
}
/* 떠 있는 버튼 등: 기타 › 쪽지 작성으로 가서 새 쪽지로 넣고 바로 읽기 */
export async function putMessageFiles(files, { text = '' } = {}) {
  go('etc', 'message');
  d = blankDraft(); M.files = []; saveDraft(d);
  addFiles(files || []);
  render();
  const p = box && box.querySelector('#msgPaste'); if (p && text) p.value = text;
  await readAll();
}

/* ---------- 누르기·입력 ---------- */
const mine = e => box && box.contains(e.target) && !box.closest('[hidden]');
document.addEventListener('click', e => {
  if (!mine(e)) return;
  const x = cur();
  const ln = e.target.closest('[data-len]');
  if (ln) { x.len = ln.dataset.len; compose(true); persist(); render(); return; }
  const op = e.target.closest('[data-msg-open],[data-msg-again]');
  if (op) {
    const id = op.dataset.msgOpen || op.dataset.msgAgain, r = listMessages().find(y => y.id === id);
    if (!r) return;
    const again = !!op.dataset.msgAgain;
    M.files = [];
    d = { id: again ? newMessageId() : r.id, m: r.m, len: r.len, attach: r.attachNames.map(name => ({ name, on: true })), edited: false, body: '', title: '', again };
    compose(true); persist(); render(); return;
  }
  const b = e.target.closest('[data-msg]');
  if (!b) return;
  const a = b.dataset.msg;
  if (a === 'pick') box.querySelector('#msgFile').click();
  else if (a === 'read') readAll();
  else if (a === 'new') { d = blankDraft(); M.files = []; clearDraft(); render(); }
  else if (a === 'resync') { compose(true); persist(); render(); }
  else if (a === 'copyFiles' && T()) copyFiles();
  else if (a === 'openDir' && T()) openDir();
  else if (a === 'copyTitle' || a === 'copyBody' || a === 'copyAll') {
    const text = a === 'copyTitle' ? x.title : a === 'copyBody' ? x.body : `${x.title}\n\n${x.body}`;
    copyText(text).then(ok => toast(ok ? '복사했어요. 이음 쪽지 창에 붙여 넣으세요' : '복사하지 못했어요'));
  }
});
document.addEventListener('change', e => {
  if (!mine(e)) return;
  const el = e.target, x = cur();
  if (el.id === 'msgFile') { const fs = [...el.files]; el.value = ''; if (fs.length) { addFiles(fs); render(); readAll(); } return; }
  if (el.dataset.att != null) { const at = x.attach[+el.dataset.att]; if (at) { at.on = el.checked; compose(); persist(); refreshOut(); } }
});
document.addEventListener('input', e => {
  if (!mine(e)) return;
  const el = e.target, x = cur();
  if (el.dataset.mf) {
    const k = el.dataset.mf, v = el.value, m = x.m;
    if (k === 'date' || k === 'time') { m.when = m.when && m.when.length ? m.when : [{ date: '', time: '', note: '' }]; m.when[0] = { ...m.when[0], [k]: v }; }
    else if (k === 'due' || k === 'how') m.apply = { ...(m.apply || {}), [k]: v };
    else m[k] = v;
    compose(); persist(); refreshOut(); return;
  }
  if (el.dataset.attName != null) { const at = x.attach[+el.dataset.attName]; if (at) { at.name = el.value; compose(); persist(); refreshOut(); } return; }
  if (el.id === 'msgSender') { setSender(el.value); compose(); persist(); refreshOut(); return; }
  if (el.id === 'msgTitle' || el.id === 'msgBody') { x[el.id === 'msgTitle' ? 'title' : 'body'] = el.value; x.edited = true; saveDraft(x); refreshOut(); }
});
document.addEventListener('dragover', e => { const z = box && e.target.closest && e.target.closest('[data-msg-drop]'); if (z && box.contains(z)) { e.preventDefault(); z.classList.add('over'); } });
document.addEventListener('dragleave', e => { const z = e.target.closest && e.target.closest('[data-msg-drop]'); if (z) z.classList.remove('over'); });
document.addEventListener('drop', e => {
  const z = box && e.target.closest && e.target.closest('[data-msg-drop]');
  if (!z || !box.contains(z)) return;
  e.preventDefault(); z.classList.remove('over');
  const fs = [...((e.dataTransfer && e.dataTransfer.files) || [])];
  if (fs.length) { addFiles(fs); render(); readAll(); }
  else { const t = e.dataTransfer && e.dataTransfer.getData('text/plain'); if (t) { const p = box.querySelector('#msgPaste'); if (p) p.value = t; } }
});

onEnter('etc', (tab, section) => {
  if (!box || !section.contains(box)) { box = document.createElement('div'); box.className = 'msg-box'; section.prepend(box); }
  render();
});
export const kindLabel = k => KINDS[k] || KINDS.etc;
