/* 계획 › 결과 보고 (스펙 2026-11-03 5장): 계획서·관련 공문·작년 보고서(파일·글), 한 일 메모, 사진 → AI 한 번 →
   결과 보고 공문(에듀파인 기안 꼴)과 결과 보고서(개요 표·소제목·사진 자료, 한글·워드·PDF).
   원본 파일·사진은 이 화면에만 둠(저장 안 함). 글은 명단·전화번호 줄을 빼고 저장·AI로 보냄. 사진은 AI가 봄(선생님 동의) */
import { onEnter, go } from '../../core/shell.js';
import * as ai from '../../core/ai.js';
import { toast, copyText, saveFile } from '../../core/ui.js';
import { onFlush, get, set } from '../../core/store.js';
import { forms } from '../../core/form-store.js';
import { readForm, fillForm, rolesValid } from '../../core/hwpx-form.js';
import { docToLetter } from '../../core/body-table.js';
import { getSchool } from '../../core/settings.js';
import { readText, fileMessage } from '../../core/files.js';
import { aiRowHTML } from '../../core/ai-roles.js';
import { exportButton, exportDoc } from '../../core/doc-export.js';
import { canQueue, openQueue } from '../../core/queue-paste.js';
import { cleanSheet } from '../evaluate/activity/activity-read.js';
import { SOURCE_KINDS, kindLabel, guessSourceKind, reportPrompt, normReport, composeReportLetter, reportDoc, reportTitle, letterQueueItems } from './report-ai.js';
import { getCurrent, saveCurrent, clearCurrent, listReports, pushReport, newReportId } from './report-model.js';

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SS = () => window.SSAM || {};
const IMAGE = /\.(png|jpe?g|webp|gif|bmp|heic|heif)$/i;
const MAX_PHOTOS = 12;
/* 화면에만: photos [{ name, bytes(JPEG), w, h, url, ai: { mime, b64 } }], scans [{ src(그 문서), imgs }](글로 못 읽은 문서 쪽 그림 — AI에만,
   문서를 빼면 같이 빠짐, 문서마다 3쪽), busy, msg */
export const R = { photos: [], scans: [], busy: false, msg: '', adding: 0 };
let box = null, cur = null, curTab = '';

const blank = () => ({ id: newReportId(), sources: [], memo: '', r: null, letter: { title: '', body: '' }, letterEdited: false, captions: [] });
const c = () => (cur || (cur = getCurrent() || blank()));
const year = () => +getSchool().year || new Date().getFullYear(); // 학년도
/* 최근 결과 보고에 넣기는 칸·메모를 고칠 때마다 하지 않고 잠깐 뒤에 한 번(다른 보고로 옮기거나 앱을 닫을 때는 바로) */
let pushT = null, pushX = null;
function flushPush() {
  clearTimeout(pushT); pushT = null;
  const x = pushX; pushX = null;
  if (x && x.r) pushReport({ ...x, title: reportTitle(x.r) });
}
onFlush(flushPush);
/* x: 저장할 결과 보고(기본은 지금 것). 지금 화면의 것만 「지금 결과 보고」로 저장 */
function save(x = c(), { now = false } = {}) {
  if (x === c()) saveCurrent(x);
  if (pushX && pushX !== x) flushPush();
  pushX = x;
  if (now) flushPush();
  else { clearTimeout(pushT); pushT = setTimeout(flushPush, 400); }
}
/* 다른 결과 보고로 옮기기 전: 미뤄 둔 저장을 마치고 화면의 사진·쪽 그림을 비움 */
function leave() {
  flushPush();
  R.photos.forEach(p => URL.revokeObjectURL(p.url)); R.photos = []; R.scans = [];
}
/* 칸이 바뀌면 공문을 다시 맞춤(공문을 손으로 고쳤으면 그대로 두고 [칸으로 다시 맞추기]) */
function recompose(force = false, x = c()) {
  if (!x.r || (x.letterEdited && !force)) return;
  x.letter = composeReportLetter(x.r); x.letterEdited = false;
}

/* ---------- 사진: 문서용(긴 변 1600px)·AI용(1024px) JPEG ---------- */
const toB64 = async blob => { const u8 = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
async function loadPhoto(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const enc = async (max, q) => {
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height)), w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(bmp, 0, 0, w, h);
    return { blob: await new Promise(r => cv.toBlob(r, 'image/jpeg', q)), w, h };
  };
  const d = await enc(1600, 0.85), a = await enc(1024, 0.8);
  if (bmp.close) bmp.close();
  return { name: file.name, bytes: new Uint8Array(await d.blob.arrayBuffer()), w: d.w, h: d.h, url: URL.createObjectURL(d.blob), ai: { mime: 'image/jpeg', b64: await toB64(a.blob) } };
}

/* ---------- 넣기: 사진은 사진 칸, 문서는 글을 읽어 종류 칩과 함께 ---------- */
export async function addFiles(files) {
  const x = c(), fails = [];
  let cut = 0;
  // 다시 연 결과 보고(사진은 저장하지 않음)에 사진을 처음 넣으면 옛 사진의 설명은 버림 — 새 사진에 붙지 않게
  if (!R.photos.length && files.some(f => IMAGE.test(f.name || '') || /^image\//.test(f.type || ''))) { x.captions = []; if (x.r) x.r.photos = []; }
  R.adding++; render();
  const here = () => c() === x; // 읽는 동안 다른 결과 보고로 옮기면 사진·쪽 그림은 버리고 글만 그 결과 보고에
  for (const f of files) {
    if (IMAGE.test(f.name || '') || /^image\//.test(f.type || '')) {
      if (R.photos.length >= MAX_PHOTOS) { fails.push(`${f.name}(사진은 ${MAX_PHOTOS}장까지)`); continue; }
      try {
        const p = await loadPhoto(f);
        if (here()) { R.photos.push(p); x.captions.push(''); } else URL.revokeObjectURL(p.url);
      } catch (e) { fails.push(`${f.name}(이 사진 형식은 읽지 못했어요)`); }
      continue;
    }
    let text = '';
    try { text = await readText(f); } catch (e) {
      // 글자가 없는 PDF(스캔본)는 쪽 그림을 AI에 보냄(최대 3쪽)
      if (e && e.code === 'PDF_NO_TEXT' && SS().files && SS().files.toImages) {
        try {
          const imgs = await SS().files.toImages(f), src = { kind: guessSourceKind(f.name, '', year()), name: f.name, text: '' };
          if (here()) { x.sources.push(src); R.scans.push({ src, imgs: imgs.slice(0, 3) }); }
          continue;
        } catch (e2) {}
      }
      fails.push(`${f.name}(${fileMessage(e && e.code)})`); continue;
    }
    const cl = cleanSheet(text);
    cut += cl.cut || 0;
    x.sources.push({ kind: guessSourceKind(f.name, cl.text, year()), name: f.name, text: cl.text });
  }
  R.adding--;
  save(x); render();
  if (fails.length) toast(`넣지 못한 것: ${fails.join(', ')}`, 7000);
  else if (cut) toast(`명단·전화번호가 적힌 줄 ${cut}곳은 빼고 넣었어요(AI로 보내지 않아요)`, 5000);
}

/* ---------- AI 한 번 → 칸 → 공문·보고서 ---------- */
export async function write() {
  if (R.busy) return;
  const x = c();
  const hasText = x.sources.some(s => s.text.trim()) || x.memo.trim();
  // 쪽 그림은 지금 목록에 있는 문서 것만(뺀 문서 것은 보내지 않음), 모두 6쪽까지
  const scans = R.scans.filter(e => x.sources.includes(e.src)).flatMap(e => e.imgs).slice(0, 6);
  if (!hasText && !R.photos.length && !scans.length) { toast('계획서·공문 파일이나 한 일 메모, 사진을 넣어 주세요.', 5000); return; }
  if (!ai.ready()) { toast('설정 › AI에서 키를 넣어 주세요', 5000); return; }
  R.busy = true; R.msg = 'AI가 결과 보고를 쓰는 중…'; render();
  try {
    const memo = cleanSheet(x.memo).text;
    // 보낸 사진 차례를 기억: 기다리는 동안 사진을 빼거나 옮겨도 설명이 제 사진에 감
    const shots = R.photos.slice();
    const images = [...shots.map(p => p.ai), ...scans];
    const v = await ai.generateJSON(reportPrompt({ sources: x.sources, memo, nPhotos: shots.length, nDocImages: scans.length, year: year() }),
      { images, task: 'report', valid: o => !!o && typeof o === 'object' && !Array.isArray(o) });
    x.r = normReport(v, { year: year() });
    const here = c() === x;
    // 사진 설명: 선생님이 쓴 것은 그대로, 빈 것만 그 사진의 AI 설명 (그새 다른 결과 보고로 옮겼으면 보낸 차례대로)
    const now = here ? R.photos : shots;
    x.captions = now.map((p, i) => { const k = shots.indexOf(p); return (here ? String(x.captions[i] || '').trim() : '') || (k >= 0 ? x.r.photos[k] || '' : ''); });
    recompose(true, x);
    save(x, { now: true });
    toast(here ? '결과 보고 공문과 보고서를 썼어요. 내용을 확인해 주세요. 숫자·성과는 꼭 확인해 주세요.'
      : `「${reportTitle(x.r)}」를 다 써서 최근 결과 보고에 넣었어요.`, 5000);
  } catch (e) {
    toast(e && e.code === 'bad_json' ? 'AI 답을 읽지 못했어요. 다시 눌러 주세요.' : ai.errorMessage(e && e.code, e), 6000);
  }
  R.busy = false; R.msg = '';
  render();
}

/* ---------- 그리기 ---------- */
const srcHTML = x => (x.sources.length ? `<ul class="rp-src" id="rpSrc">${x.sources.map((s, i) => `<li><span class="rp-name" title="${esc(s.name)}">${esc(s.name)}</span>
    <select class="field" data-rp-kind="${i}" aria-label="${esc(s.name)} 종류">${SOURCE_KINDS.map(([k, l]) => `<option value="${k}"${s.kind === k ? ' selected' : ''}>${l}</option>`).join('')}</select>
    <span class="muted">${s.text ? `${s.text.length.toLocaleString('ko-KR')}자` : R.scans.some(e => e.src === s) ? '쪽 그림' : '쪽 그림 · 다시 넣어 주세요'}</span><button class="icon-btn tiny" type="button" data-rp-del="${i}" aria-label="${esc(s.name)} 빼기" title="빼기">✕</button></li>`).join('')}</ul>`
  : '<p class="muted" id="rpSrc" style="margin:0">계획서·관련 공문·작년 보고서를 넣으면 종류를 짐작해 칩으로 보여요.</p>');
const photosHTML = x => (R.photos.length ? `<ul class="rp-photos" id="rpPhotos">${R.photos.map((p, i) => `<li>
    <img src="${p.url}" alt="사진 ${i + 1}"><input class="field" data-rp-cap="${i}" value="${esc(x.captions[i] || '')}" placeholder="사진 설명(AI가 채워요)" aria-label="사진 ${i + 1} 설명" autocomplete="off">
    <span class="row"><button class="icon-btn tiny" type="button" data-rp-move="${i}:-1" aria-label="앞으로"${i ? '' : ' disabled'}>◀</button><button class="icon-btn tiny" type="button" data-rp-move="${i}:1" aria-label="뒤로"${i < R.photos.length - 1 ? '' : ' disabled'}>▶</button>
    <button class="icon-btn tiny" type="button" data-rp-pdel="${i}" aria-label="사진 ${i + 1} 빼기">✕</button></span></li>`).join('')}</ul>`
  : `<p class="muted" id="rpPhotos" style="margin:0">${x.r && x.captions.length ? '사진은 저장하지 않아요. 보고서에 넣으려면 사진을 다시 넣어 주세요.' : `사진을 넣으면 보고서 끝 「사진 자료」에 2장씩 들어가요(${MAX_PHOTOS}장까지).`}</p>`);
const f = (k, label, v, ph = '', type = 'text') => `<label class="yp-f"><span class="lab">${label}</span><input class="field" data-rf="${k}" type="${type}" value="${esc(v)}" placeholder="${esc(ph)}" autocomplete="off"></label>`;
function reportCardHTML(x) {
  const r = x.r;
  if (!r) return '<p class="muted">[결과 보고 쓰기]를 누르면 개요·소제목·사진 자료가 들어간 보고서를 써요.</p>';
  const p = r.period || {};
  return `<div class="rp-fields">${f('name', '행사명', r.name, '예) 2026 과학의 날 행사')}
      <div class="row rp-two">${f('start', '시작 날', p.start, '', 'date')}${f('end', '끝 날(하루면 비움)', p.end, '', 'date')}</div>
      <div class="row rp-two">${f('time', '시간', p.time, '예) 09:00~12:00')}${f('place', '장소', r.place)}</div>
      <div class="row rp-two">${f('target', '대상', r.target, '예) 전교생')}${f('count', '참여 인원', r.count, '예) 320명')}</div>
      ${f('summary', '주요 내용(공문)', r.summary)}</div>
    <div class="rp-secs" id="rpSecs">${r.sections.map((s, i) => `<div class="rp-sec"><input class="field rp-sec-h" data-rs-h="${i}" value="${esc(s.h)}" aria-label="${i + 2}번 소제목" autocomplete="off">
      <textarea class="field" data-rs-l="${i}" rows="${Math.min(10, Math.max(3, s.lines.length + 1))}" aria-label="${esc(s.h)} 내용(한 줄에 하나)">${esc(s.lines.join('\n'))}</textarea>
      <button class="btn text tiny" type="button" data-rs-del="${i}">이 소제목 빼기</button></div>`).join('')}
      <button class="btn text" type="button" data-rp="addSec">+ 소제목 더하기</button></div>
    <div class="row rp-out">${formSelHTML()}${R.formId ? '<button class="btn primary" type="button" data-rp="formExport">학교 양식으로 한글 내려받기</button>' : exportButton('data-rp="export"', { cls: 'primary' })}</div>`;
}
/* 학교 양식(기타 › 가정통신문에서 넣은 .hwpx 양식, 같은 저장소) */
const FORM_KEY = 'report:form';
function formSelHTML() {
  if (!R.forms) { loadReportForms(); return ''; }
  if (!R.forms.length) return '<span class="muted">학교 양식(.hwpx)은 기타 › 가정통신문에서 넣어 두면 여기서도 골라 써요.</span>';
  return `<label class="yp-f"><span class="lab">양식</span><select class="field" id="rpForm"><option value="">쌤비서 기본 문서</option>
    ${R.forms.map(f => `<option value="${esc(f.id)}"${f.id === R.formId ? ' selected' : ''}>${esc(f.name)}</option>`).join('')}</select></label>`;
}
async function loadReportForms() {
  if (R.formsLoading) return;
  R.formsLoading = true;
  try { const st = await forms(); R.forms = (await st.list()).filter(f => f.kind === 'hwpx'); } catch (e) { R.forms = []; }
  R.formsLoading = false;
  const id = String(get(FORM_KEY, '') || '');
  R.formId = R.forms.some(f => f.id === id) ? id : '';
  render();
}
async function formExport(x) {
  let rec = null;
  try { rec = await (await forms()).get(R.formId); } catch (e) { rec = null; }
  if (!rec || rec.kind !== 'hwpx') { toast('양식을 찾지 못했어요. 기본 문서로 내려받아 주세요.', 5000); R.forms = null; render(); return; }
  if (!rolesValid(rec.roles, { date: false })) { toast('이 양식의 제목·본문 자리를 기타 › 가정통신문 › [양식 맞추기]에서 정해 주세요.', 7000); return; }
  const doc = reportDoc(x.r, R.photos, x.captions), name = (doc.title || '결과 보고서').replace(/[\\/:*?"<>|]/g, '_');
  try {
    const parsed = await readForm(rec.bytes);
    const t = new Date(), iso = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    const { bytes, warn } = await fillForm(parsed, rec.roles, { ...docToLetter(doc), date: iso, reply: null });
    const where = await saveFile(`${name}.hwpx`, bytes, 'application/hwp+zip');
    toast((window.__TAURI__ ? `다운로드 폴더에 저장했어요: ${String(where).split(/[\\/]/).pop()}` : '학교 양식으로 한글 파일을 내려받았어요')
      + (warn.includes('no-border') ? ' · 이 양식에는 표 테두리를 더할 수 없어 개요 표는 글로, 사진은 한 장씩 넣었어요' : '')
      + (!R.photos.length && x.captions.length ? ' · 사진은 저장하지 않아 이번 파일에는 없어요' : ''), 7000);
  } catch (e) { toast(`한글 파일을 만들지 못했어요: ${String((e && e.message) || e || '').slice(0, 80)}`, 7000); }
}
const recentHTML = () => {
  const l = listReports();
  return l.length ? `<ul class="pc-lib-list" id="rpRecent">${l.map(r => `<li class="pc-lib-row"><div class="grow"><b>${esc(r.title || '결과 보고')}</b><span class="muted">${new Date(r.at).toLocaleDateString('ko-KR')}</span></div>
    <span class="row"><button class="btn text" type="button" data-rp-open="${esc(r.id)}">열기</button></span></li>`).join('')}</ul>` : '<p class="muted" id="rpRecent" style="margin:0">쓴 결과 보고가 최근 20개까지 남아요.</p>';
};
export function render() {
  if (!box || box.hidden) return;
  const x = c(), l = x.letter;
  box.innerHTML = `<div class="m-page rp-page">
    <div class="m-head"><div><h2>결과 보고</h2><p class="muted">계획서·공문·작년 보고서와 한 일·사진을 넣으면 결과 보고 공문과 결과 보고서(사진 포함)를 써요.</p></div>
      <div class="row"><button class="btn text" type="button" data-rp="new">새 결과 보고</button></div></div>
    ${aiRowHTML('report')}
    <div class="msg-grid">
      <section class="pc-card"><h3>넣기</h3>
        <div class="msg-drop rp-drop" data-rp-drop>
          <p class="muted" style="margin:0">계획서·공문·작년 보고서(한글·PDF·워드)와 사진을 여기에 끌어 놓거나 고르세요.</p>
          <div class="row"><button class="btn" type="button" data-rp="pick">파일·사진 고르기</button>${R.adding ? '<span class="muted"><span class="spin"></span>읽는 중…</span>' : ''}
            <input type="file" id="rpFile" multiple hidden accept=".hwp,.hwpx,.pdf,.docx,.txt,.png,.jpg,.jpeg,.webp,.heic"></div></div>
        ${srcHTML(x)}
        <label class="yp-f"><span class="lab">한 일 <span class="muted">(무엇을 했는지·참여 인원·잘된 점·아쉬운 점, 줄글이면 돼요)</span></span>
          <textarea class="field" id="rpMemo" rows="6" placeholder="예) 4월 21일 강당에서 전교생 320명 참여. 1~2학년 비눗방울 실험, 3~6학년 발명품 만들기. 발표 시간이 모자랐음.">${esc(x.memo)}</textarea></label>
        <h3>사진</h3>${photosHTML(x)}
        <p class="muted" style="margin:0">사진은 AI가 보고 설명을 써요. 원본 파일과 사진은 저장하지 않아요.</p>
        <div class="row"><button class="btn primary" type="button" data-rp="write"${R.busy ? ' disabled' : ''}>${R.busy ? `<span class="spin"></span>${esc(R.msg || '쓰는 중…')}` : x.r ? '결과 보고 다시 쓰기' : '결과 보고 쓰기'}</button></div>
      </section>
      <section class="pc-card"><h3>결과 보고 공문</h3>
        ${x.r ? `<div class="pc-out"><div class="pc-out-h"><label class="lab" for="rpTitle">제목</label><button class="btn text pc-copy" type="button" data-rp="copyTitle">복사</button></div>
          <input class="field" id="rpTitle" value="${esc(l.title)}" autocomplete="off"></div>
        <div class="pc-out"><div class="pc-out-h"><label class="lab" for="rpBody">본문</label><button class="btn text pc-copy" type="button" data-rp="copyBody">복사</button></div>
          <textarea class="field" id="rpBody" rows="14">${esc(l.body)}</textarea></div>
        <div id="rpResync">${x.letterEdited ? '<p class="muted pc-resync">공문을 고쳤어요 <button class="btn text tiny" type="button" data-rp="resync">칸으로 다시 맞추기</button></p>' : ''}</div>
        <div class="row"><button class="btn" type="button" data-rp="copyAll">모두 복사</button>${canQueue() ? '<button class="btn primary" type="button" data-rp="queue">에듀파인 기안에 차례로 붙여넣기</button>' : ''}</div>
        ${canQueue() ? '<p class="muted" style="margin:0">에듀파인 기안에서 제목 칸을 누르고 Ctrl+V, 본문 칸을 누르고 Ctrl+V 하면 차례로 들어가요. 상신은 선생님이 눌러 주세요.</p>' : ''}`
    : '<p class="muted">[결과 보고 쓰기]를 누르면 관련 문서·일시·장소·대상·주요 내용과 붙임이 들어간 공문을 써요.</p>'}
        <h3>결과 보고서</h3>${reportCardHTML(x)}
      </section>
    </div>
    <section class="pc-card"><h3>최근 결과 보고</h3>${recentHTML()}</section></div>`;
}
/* 공문만 다시 넣기(입력 중인 칸은 덮지 않음) */
function refreshLetter() {
  if (!box) return;
  const x = c(), t = box.querySelector('#rpTitle'), b = box.querySelector('#rpBody'), rs = box.querySelector('#rpResync');
  if (t && document.activeElement !== t) t.value = x.letter.title;
  if (b && document.activeElement !== b) b.value = x.letter.body;
  if (rs) rs.innerHTML = x.letterEdited ? '<p class="muted pc-resync">공문을 고쳤어요 <button class="btn text tiny" type="button" data-rp="resync">칸으로 다시 맞추기</button></p>' : '';
}

/* 행사계획 등에서: 결과 보고로 가서 새 결과 보고로 글을 넣음 */
export function putReportSources({ sources = [], memo = '' } = {}) {
  go('plan', 'report');
  leave();
  cur = { ...blank(), memo: String(memo || ''), sources: sources.filter(s => s && String(s.text || '').trim()).map(s => ({ kind: s.kind || 'plan', name: String(s.name || '글'), text: cleanSheet(s.text).text })) };
  save(); render();
}

/* ---------- 누르기·입력 ---------- */
const mine = e => box && !box.hidden && box.contains(e.target);
document.addEventListener('click', e => {
  if (!mine(e)) return;
  const x = c();
  const del = e.target.closest('[data-rp-del]');
  if (del) { const [s] = x.sources.splice(+del.dataset.rpDel, 1); R.scans = R.scans.filter(e => e.src !== s); save(); render(); return; }
  const pd = e.target.closest('[data-rp-pdel]');
  if (pd) { const i = +pd.dataset.rpPdel; URL.revokeObjectURL(R.photos[i].url); R.photos.splice(i, 1); x.captions.splice(i, 1); save(); render(); return; }
  const mv = e.target.closest('[data-rp-move]');
  if (mv && !mv.disabled) {
    const [i, d] = mv.dataset.rpMove.split(':').map(Number), j = i + d;
    if (j < 0 || j >= R.photos.length) return;
    [R.photos[i], R.photos[j]] = [R.photos[j], R.photos[i]]; [x.captions[i], x.captions[j]] = [x.captions[j], x.captions[i]];
    save(); render(); return;
  }
  const rd = e.target.closest('[data-rs-del]');
  if (rd && x.r) { x.r.sections.splice(+rd.dataset.rsDel, 1); save(); render(); return; }
  const op = e.target.closest('[data-rp-open]');
  if (op) {
    const r = listReports().find(y => y.id === op.dataset.rpOpen);
    if (!r) return;
    leave();
    cur = { id: r.id, sources: r.sources, memo: r.memo, r: r.r, letter: r.letter, letterEdited: r.letterEdited, captions: r.captions };
    saveCurrent(cur); render(); return;
  }
  const b = e.target.closest('[data-rp]');
  if (!b) return;
  const a = b.dataset.rp;
  if (a === 'pick') box.querySelector('#rpFile').click();
  else if (a === 'write') write();
  else if (a === 'new') { leave(); cur = blank(); clearCurrent(); render(); }
  else if (a === 'resync') { recompose(true); save(); refreshLetter(); }
  else if (a === 'addSec' && x.r) { x.r.sections.push({ h: '새 소제목', lines: [] }); save(); render(); }
  else if (a === 'copyTitle' || a === 'copyBody' || a === 'copyAll') {
    const t = a === 'copyTitle' ? x.letter.title : a === 'copyBody' ? x.letter.body : `${x.letter.title}\n\n${x.letter.body}`;
    copyText(t).then(ok => toast(ok ? '복사했어요. 에듀파인 기안에 붙여 넣으세요' : '복사하지 못했어요'));
  } else if (a === 'queue' && x.r) openQueue({ title: x.letter.title, items: letterQueueItems(x.letter) });
  else if (a === 'formExport' && x.r) formExport(x);
  else if (a === 'export' && x.r) {
    const doc = reportDoc(x.r, R.photos, x.captions);
    exportDoc(doc, doc.title).then(m => toast(R.photos.length || !x.captions.length ? m : `${m} · 사진은 저장하지 않아 이번 파일에는 없어요(사진을 다시 넣어 주세요)`, 6000));
  }
});
document.addEventListener('change', e => {
  if (!mine(e)) return;
  const el = e.target, x = c();
  if (el.id === 'rpFile') { const fs = [...el.files]; el.value = ''; if (fs.length) addFiles(fs); return; }
  if (el.id === 'rpForm') { R.formId = el.value; set(FORM_KEY, el.value); render(); return; }
  if (el.dataset.rpKind != null) { const s = x.sources[+el.dataset.rpKind]; if (s) { s.kind = el.value; save(); } }
});
const R_KEYS = { name: 'name', place: 'place', target: 'target', count: 'count', summary: 'summary' };
document.addEventListener('input', e => {
  if (!mine(e)) return;
  const el = e.target, x = c();
  if (el.id === 'rpMemo') { x.memo = el.value; save(); return; }
  if (el.dataset.rpCap != null) { x.captions[+el.dataset.rpCap] = el.value; save(); return; }
  if (el.id === 'rpTitle' || el.id === 'rpBody') { x.letter = { ...x.letter, [el.id === 'rpTitle' ? 'title' : 'body']: el.value }; x.letterEdited = true; save(); refreshLetter(); return; }
  if (!x.r) return;
  if (el.dataset.rf) {
    const k = el.dataset.rf;
    if (R_KEYS[k]) x.r[k] = el.value;
    else x.r.period = { ...x.r.period, [k]: el.value };
    recompose(); save(); refreshLetter(); return;
  }
  if (el.dataset.rsH != null) { const s = x.r.sections[+el.dataset.rsH]; if (s) { s.h = el.value; save(); } return; }
  if (el.dataset.rsL != null) { const s = x.r.sections[+el.dataset.rsL]; if (s) { s.lines = el.value.split('\n').map(l => l.trim()).filter(Boolean); save(); } }
});
document.addEventListener('dragover', e => { const z = box && e.target.closest && e.target.closest('[data-rp-drop]'); if (z && box.contains(z)) { e.preventDefault(); z.classList.add('over'); } });
document.addEventListener('dragleave', e => { const z = e.target.closest && e.target.closest('[data-rp-drop]'); if (z) z.classList.remove('over'); });
document.addEventListener('drop', e => {
  const z = box && e.target.closest && e.target.closest('[data-rp-drop]');
  if (!z || !box.contains(z)) return;
  e.preventDefault(); z.classList.remove('over');
  const fs = [...((e.dataTransfer && e.dataTransfer.files) || [])];
  if (fs.length) { addFiles(fs); return; }
  const t = e.dataTransfer && e.dataTransfer.getData('text/plain');
  if (t && t.trim()) { const x = c(); x.sources.push({ kind: guessSourceKind('', t, year()), name: '붙여 넣은 글', text: cleanSheet(t).text }); save(); render(); }
});

onEnter('plan', (tab, section) => {
  if (!box || !section.contains(box)) { box = document.createElement('div'); box.className = 'rp-box'; section.append(box); }
  curTab = tab;
  box.hidden = tab !== 'report';
  if (tab === 'report') { R.forms = null; render(); } // 양식 목록은 들어올 때마다 다시(가정통신문에서 넣은 것)
});
export const reportKindLabel = kindLabel;
export const reportTab = () => curTab;
