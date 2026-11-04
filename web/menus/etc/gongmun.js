/* 기타 › 공문 처리 (스펙 2026-11-04 5장): 공문(파일·글)을 넣으면 AI가 제출 기한·할 일을 뽑고, 기한 차례 목록에서 할 일을 체크.
   [쪽지][가정통신문][품의][결과 보고]로 그 공문을 들고 넘어감. 기한은 학사일정(달력)·오늘 수업 띠에도.
   원본 파일은 저장하지 않음(명단·전화번호 줄을 뺀 글만, gongmun-model.js) */
import { onEnter } from '../../core/shell.js';
import * as ai from '../../core/ai.js';
import { toast } from '../../core/ui.js';
import { readText, fileMessage } from '../../core/files.js';
import { aiRowHTML } from '../../core/ai-roles.js';
import { getSchool } from '../../core/settings.js';
import { registerInbox } from '../../core/inbox.js';
import { cleanSheet } from '../evaluate/activity/activity-read.js';
import { KINDS, gongmunPrompt, normGongmun, dday, ddayText, validDue } from './gongmun-ai.js';
import { listDocs, putDoc, removeDoc, getDoc, newDocId } from './gongmun-model.js';
import { putMessageFiles } from './message.js';
import { putLetterSources } from './letter.js';
import { putReportSources } from '../plan/report.js';
import { putPurchaseText } from '../purchase/purchase.js';

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; };
const baseName = n => String(n || '').replace(/\.[^.]+$/, '').trim() || '공문';
const dot = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '')); return m ? `${+m[1]}. ${+m[2]}. ${+m[3]}.` : ''; };
/* 화면에만: reading(AI로 읽는 문서 id), adding, showDone */
const S = { reading: new Set(), adding: 0, showDone: false, files: new Map() }; // files: 이번에 넣은 원본 파일(쪽지 붙임용, 저장 안 함)
let box = null;

/* ---------- 넣기 → AI ---------- */
async function readDoc(id) {
  const d0 = getDoc(id);
  if (!d0 || !d0.text.trim()) return;
  if (!ai.ready()) { toast('AI 키가 없어 제목·글만 넣었어요. 기한·할 일은 직접 적어 주세요(설정 › AI).', 6000); return; }
  S.reading.add(id); render();
  try {
    const v = await ai.generateJSON(gongmunPrompt({ name: d0.name, text: d0.text, today: today(), year: getSchool().year }),
      { task: 'gongmun', valid: o => !!o && typeof o === 'object' && !Array.isArray(o) });
    const n = normGongmun(v, { year: getSchool().year, today: today() }), d = getDoc(id);
    if (d) putDoc({ ...d, ...n, title: n.title || d.title, due: n.due || d.due, tasks: n.tasks.length ? n.tasks : d.tasks, read: true });
  } catch (e) {
    toast(e && e.code === 'bad_json' ? 'AI 답을 읽지 못했어요. [다시 읽기]를 눌러 주세요.' : ai.errorMessage(e && e.code, e), 6000);
  }
  S.reading.delete(id); render();
}
function addText(name, text) {
  const cl = cleanSheet(text);
  const d = { id: newDocId(), name, title: baseName(name), text: cl.text, tasks: [], kinds: [], at: Date.now() };
  putDoc(d);
  return { id: d.id, cut: cl.cut || 0 };
}
export async function addFiles(files) {
  S.adding++; render();
  const ids = [], fails = [];
  let cut = 0;
  for (const f of files) {
    try { const r = addText(f.name, await readText(f)); ids.push(r.id); cut += r.cut; S.files.set(r.id, f); }
    catch (e) { fails.push(`${f.name}(${fileMessage(e && e.code)})`); }
  }
  S.adding--; render();
  if (fails.length) toast(`읽지 못한 파일: ${fails.join(', ')}`, 7000);
  else if (cut) toast(`명단·전화번호가 적힌 줄 ${cut}곳은 빼고 넣었어요(AI로 보내지 않아요)`, 5000);
  for (const id of ids) await readDoc(id);
}
/* 떠 있는 버튼: 안내·공문 파일 → 기타 › 공문 처리 */
export async function putGongmunFiles(files) {
  const { go } = await import('../../core/shell.js');
  go('etc', 'gongmun');
  await addFiles(files || []);
}

/* ---------- 넘기기 ---------- */
const docTitle = d => d.title || d.name || '공문';
function handOff(d, k) {
  const text = d.text;
  if (!text.trim()) { toast('공문 글이 없어요.'); return; }
  if (k === 'message') { const f = S.files.get(d.id); if (f) putMessageFiles([f]); else putMessageFiles([], { text }); } // 원본 파일이 있으면 붙임으로
  else if (k === 'letter') putLetterSources({ sources: [{ name: docTitle(d), text }] });
  else if (k === 'report') putReportSources({ sources: [{ kind: 'official', name: docTitle(d), text }] });
  else if (k === 'purchase') putPurchaseText([docTitle(d), d.summary, '', text.slice(0, 3000)].filter((x, i) => x || i === 2).join('\n'));
}

/* ---------- 그리기 ---------- */
const badge = n => (n == null ? '<span class="gm-dd none">기한 없음</span>' : `<span class="gm-dd ${n < 0 ? 'over' : n <= 1 ? 'hot' : n <= 3 ? 'warm' : ''}">${ddayText(n)}</span>`);
function docHTML(d, t) {
  const reading = S.reading.has(d.id), n = dday(d.due, t);
  const meta = [d.from, d.no, d.date ? dot(d.date) : ''].filter(Boolean).map(esc).join(' · ');
  return `<li class="gm-doc${d.done ? ' done' : ''}" data-gm-id="${esc(d.id)}">
    <div class="gm-top">${d.done ? '<span class="gm-dd none">다 했어요</span>' : badge(n)}<b class="gm-title">${esc(docTitle(d))}</b>
      ${reading ? '<span class="muted"><span class="spin"></span>AI가 읽는 중…</span>' : ''}</div>
    ${meta ? `<p class="muted gm-meta">${meta}</p>` : ''}
    ${d.summary ? `<p class="gm-sum">${esc(d.summary)}</p>` : ''}
    <div class="row gm-due"><label class="yp-f"><span class="lab">제출 기한${d.dueNote ? ` <span class="muted">(${esc(d.dueNote)})</span>` : ''}</span><input class="field" type="date" data-gm-due value="${esc(d.due)}"></label></div>
    <ul class="gm-tasks">${d.tasks.map((x, i) => `<li class="${x.done ? 'done' : ''}"><label><input type="checkbox" data-gm-task="${i}"${x.done ? ' checked' : ''}><span>${esc(x.text)}</span></label>
      ${x.due ? `<span class="muted">${esc(ddayText(dday(x.due, t)))}</span>` : ''}<button class="icon-btn tiny" type="button" data-gm-tdel="${i}" aria-label="할 일 빼기">✕</button></li>`).join('')}</ul>
    <div class="row gm-add"><input class="field" data-gm-tadd placeholder="할 일 더하기(Enter)" autocomplete="off"></div>
    <div class="row gm-go">${KINDS.map(([k, l]) => `<button class="btn${d.kinds.includes(k) ? ' primary' : ''}" type="button" data-gm-go="${k}">${l}</button>`).join('')}
      <span class="grow"></span>${d.read || reading ? '' : '<button class="btn text" type="button" data-gm-read>AI로 읽기</button>'}
      <button class="btn text" type="button" data-gm-done>${d.done ? '다시 열기' : '다 했어요'}</button><button class="btn text" type="button" data-gm-del>지우기</button></div></li>`;
}
export function render() {
  if (!box || box.hidden) return;
  const all = listDocs(), open = all.filter(d => !d.done), done = all.filter(d => d.done), t = today();
  box.innerHTML = `<div class="m-page gm-page">
    <div class="m-head m-head-row"><div><h2>공문 처리</h2><p class="muted">공문을 넣으면 제출 기한과 할 일을 뽑아 기한 차례로 보여 줘요. 쪽지·가정통신문·품의·결과 보고로 바로 이어 써요.</p></div>
      <div class="m-head-act">${aiRowHTML('gongmun')}</div></div>
    <section class="pc-card"><div class="msg-drop" data-gm-drop><p class="muted" style="margin:0">공문 파일(한글·PDF·워드·글)을 여기에 끌어 놓거나 고르세요. 파일마다 하나씩 넣어요.</p>
        <div class="row"><button class="btn text" type="button" data-gm="pick">${S.adding ? '<span class="spin"></span>읽는 중…' : '파일 고르기'}</button><input type="file" id="gmFile" multiple hidden accept=".hwp,.hwpx,.pdf,.docx,.txt"></div></div>
      <label class="yp-f"><span class="lab">또는 공문 글 붙여 넣기</span><textarea class="field" id="gmPaste" rows="3" placeholder="공문 본문을 붙여 넣고 [넣기]"></textarea></label>
      <div class="row"><button class="btn primary" type="button" data-gm="paste">넣기</button></div></section>
    <section class="pc-card"><h3>할 공문 <span class="muted">${open.length}개</span></h3>
      ${open.length ? `<ul class="gm-list">${open.map(d => docHTML(d, t)).join('')}</ul>` : '<p class="muted" style="margin:0">넣은 공문이 없어요.</p>'}
      ${done.length ? `<details class="gm-done-box"${S.showDone ? ' open' : ''}><summary>다 한 공문 ${done.length}개</summary><ul class="gm-list">${done.map(d => docHTML(d, t)).join('')}</ul></details>` : ''}</section></div>`;
}

/* ---------- 누르기·입력 ---------- */
const mine = e => box && !box.hidden && box.contains(e.target);
const docOf = el => { const li = el.closest('[data-gm-id]'); return li ? getDoc(li.dataset.gmId) : null; };
document.addEventListener('click', e => {
  if (!mine(e)) return;
  const d = docOf(e.target);
  const g = e.target.closest('[data-gm-go]');
  if (g && d) { handOff(d, g.dataset.gmGo); return; }
  if (e.target.closest('[data-gm-read]') && d) { readDoc(d.id); return; }
  if (e.target.closest('[data-gm-done]') && d) { putDoc({ ...d, done: !d.done }); render(); return; }
  if (e.target.closest('[data-gm-del]') && d) { if (confirm(`「${docTitle(d)}」을 목록에서 지울까요?`)) { removeDoc(d.id); S.files.delete(d.id); render(); } return; }
  const td = e.target.closest('[data-gm-tdel]');
  if (td && d) { d.tasks.splice(+td.dataset.gmTdel, 1); putDoc(d); render(); return; }
  const b = e.target.closest('[data-gm]');
  if (!b) return;
  if (b.dataset.gm === 'pick') box.querySelector('#gmFile').click();
  else if (b.dataset.gm === 'paste') {
    const ta = box.querySelector('#gmPaste'), t = ta.value;
    if (!t.trim()) { toast('공문 글을 붙여 넣어 주세요.'); return; }
    const first = t.split('\n').map(s => s.trim()).find(Boolean) || '붙여 넣은 공문';
    const r = addText(first.slice(0, 60), t); ta.value = '';
    if (r.cut) toast(`명단·전화번호가 적힌 줄 ${r.cut}곳은 빼고 넣었어요(AI로 보내지 않아요)`, 5000);
    render(); readDoc(r.id);
  }
});
document.addEventListener('change', e => {
  if (!mine(e)) return;
  const el = e.target, d = docOf(el);
  if (el.id === 'gmFile') { const fs = [...el.files]; el.value = ''; if (fs.length) addFiles(fs); return; }
  if (el.dataset.gmTask != null && d) { const x = d.tasks[+el.dataset.gmTask]; if (x) { x.done = el.checked; putDoc(d); el.closest('li').classList.toggle('done', el.checked); } return; }
  // 기한: 맞는 날(2000~2100년)이거나 비웠을 때만 저장. 키보드로 고치는 중에는 다시 그리지 않고 칸을 떠날 때 차례를 맞춤
  if (el.dataset.gmDue != null && d) {
    if (el.value && !validDue(el.value)) return;
    putDoc({ ...d, due: el.value });
    if (document.activeElement === el) S.dueDirty = true; else render();
  }
});
document.addEventListener('focusout', e => { if (mine(e) && e.target.dataset && e.target.dataset.gmDue != null && S.dueDirty) { S.dueDirty = false; setTimeout(render, 0); } });
document.addEventListener('keydown', e => {
  if (!mine(e) || e.key !== 'Enter' || e.isComposing) return;
  const el = e.target, d = docOf(el);
  if (el.dataset.gmTadd == null || !d || !el.value.trim()) return;
  e.preventDefault();
  d.tasks.push({ text: el.value.trim().slice(0, 120), due: '', done: false }); putDoc(d); render();
});
document.addEventListener('toggle', e => { if (box && e.target.classList && e.target.classList.contains('gm-done-box')) S.showDone = e.target.open; }, true);
document.addEventListener('dragover', e => { const z = box && e.target.closest && e.target.closest('[data-gm-drop]'); if (z && box.contains(z)) { e.preventDefault(); z.classList.add('over'); } });
document.addEventListener('dragleave', e => { const z = e.target.closest && e.target.closest('[data-gm-drop]'); if (z) z.classList.remove('over'); });
document.addEventListener('drop', e => {
  const z = box && e.target.closest && e.target.closest('[data-gm-drop]');
  if (!z || !box.contains(z)) return;
  e.preventDefault(); z.classList.remove('over');
  const fs = [...((e.dataTransfer && e.dataTransfer.files) || [])];
  if (fs.length) addFiles(fs);
});

/* 떠 있는 버튼: 연수·회의·행사 안내 공문·계획 → 기타 › 공문 처리(쪽지 등은 그 뒤 버튼으로) */
registerInbox('notice', {
  act: files => `기타 › 공문 처리에 넣고 기한·할 일 뽑기${files.length > 1 ? `(파일 ${files.length}개)` : ''}`,
  async run(files) { await putGongmunFiles(files); return ''; }
});

onEnter('etc', (tab, section) => {
  if (!box || !section.contains(box)) { box = document.createElement('div'); box.className = 'gm-box'; section.append(box); }
  box.hidden = tab !== 'gongmun';
  if (!box.hidden) render();
});
