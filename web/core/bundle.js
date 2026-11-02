/* 한꺼번에 넣기 (스펙 3장): 문서 안 학생용·교사용 나누기, 스캔 쪽 표시(정답·교사용 / 빈 활동지 / 학생), 확인 카드.
   활동지·단원평가·평가지 채점이 같이 씀. 이 파일의 규칙 함수는 화면 없이도 돌아감(시험) */

export const ROLE_NAME = { teacher: '정답·교사용', blank: '빈 활동지', student: '학생' };
const ROLES = Object.keys(ROLE_NAME);

/* ---------- 문서 안 나누기 ---------- */
// 줄 머리의 교사용·(예시)·예시 답안·모범 답안·[정답]·정답(및 해설)·채점 기준, 또는 이름 칸 끝의 「교사용」
const MARK = /^\s*(\|\s*)*(교사용|\(예시\)|예시\s*답안|모범\s*답안|\[정답\]|정답(\s*및\s*해설지?)?|채점\s*기준)\s*(\||$)/;
const NAME_TEACHER = /이름\s*:?.*교사용\s*\)?\s*$/;
const cut = (lines, at, how) => ({ student: lines.slice(0, at).join('\n').trim(), teacher: lines.slice(at).join('\n').trim(), how });

/* → { student, teacher, how: 'marker'|'repeat'|'none' }. 표시가 있으면 그 줄(바로 앞 8줄 안에 첫 머리 줄이 다시 나오면 그 머리 줄)에서,
   표시 없이 첫 머리 줄이 다시 나오면 거기서 나눔(학생용 쪽 다음 같은 양식의 교사용 쪽) */
export function splitDoc(text) {
  const src = String(text || '').trim();
  if (!src) return { student: '', teacher: '', how: 'none' };
  const lines = src.split('\n');
  const head = (lines.find(l => l.trim().length >= 4) || '').trim();
  const isHead = l => !!head && l.trim() === head;
  const m = lines.findIndex((l, i) => i > 0 && (MARK.test(l) || NAME_TEACHER.test(l)));
  if (m > 0) {
    let at = m;
    for (let j = m; j >= Math.max(1, m - 8); j--) if (isHead(lines[j])) { at = j; break; }
    return cut(lines, at, 'marker');
  }
  const r = lines.findIndex((l, i) => i > 0 && isHead(l));
  if (r > 0) return cut(lines, r, 'repeat');
  return { student: src, teacher: '', how: 'none' };
}

/* 파일 하나가 정답·교사용인지: 이름에 교사용·정답·해설·예시·모범 답안, 첫 줄이 표시, 앞 8줄 안에 「이름: 교사용」 */
export function teacherFile(name, text) {
  if (/교사용|정답|해설|예시|모범\s*답안|채점\s*기준/.test(String(name || ''))) return true;
  const ls = String(text || '').split('\n').filter(l => l.trim()).slice(0, 8);
  return !!ls.length && (MARK.test(ls[0]) || ls.some(l => NAME_TEACHER.test(l)));
}

/* ---------- 스캔 쪽 표시 ---------- */
/* 정답·교사용 쪽은 보통 맨 앞이나 맨 뒤: 앞 2쪽·뒤 2쪽 */
export function edgeIdx(n) {
  const out = [];
  for (const i of [0, 1, n - 2, n - 1]) if (i >= 0 && i < n && !out.includes(i)) out.push(i);
  return out.sort((a, b) => a - b);
}

export function pageRolesPrompt(k) {
  return ['[쪽 나누기]',
    `첨부한 그림 ${k}장은 한 반의 활동지·평가지를 스캔한 묶음에서 고른 쪽입니다(차례대로 0번부터). 이름 칸은 가려져 있을 수 있습니다.`,
    '쪽마다 아래 셋 중 하나를 고릅니다.',
    '- teacher: 정답·예시 답안·교사용으로 인쇄된 쪽(손글씨 없이 답이 인쇄되어 있음)',
    '- blank: 아무것도 쓰지 않은 빈 활동지·평가지',
    '- student: 학생이 손으로 쓴 답·그림이 있는 쪽',
    '', '[출력] JSON 하나만 출력합니다.', '{"pages":[{"i":0,"role":"teacher|blank|student"}]}'].join('\n');
}
/* AI 답 → 길이 k의 표시 배열(범위 밖·모르는 표시는 버림, 없으면 학생) */
export function normPageRoles(v, k) {
  const out = Array.from({ length: k }, () => 'student');
  const list = Array.isArray(v) ? v : v && Array.isArray(v.pages) ? v.pages : [];
  for (const x of list) {
    const i = Number(x && x.i);
    if (Number.isInteger(i) && i >= 0 && i < k && ROLES.includes(x.role)) out[i] = x.role;
  }
  return out;
}
/* 쪽마다 표시: 글자층(인쇄본 PDF 쪽)이 30자 이상이면 정답·교사용, 아니면 AI 답({쪽 번호: 표시}), 아니면 학생 */
export function pickRoles(pages, ai) {
  return (pages || []).map((p, i) => {
    if (p && String(p.text || '').replace(/\s/g, '').length >= 30) return 'teacher';
    const r = ai && ai[i];
    return ROLES.includes(r) ? r : 'student';
  });
}
/* 나눌 것이 있을 때만 확인 카드(학생 스캔만이면 바로 넣음) */
export const needsCard = ({ doc, roles } = {}) => !!(doc && String(doc.teacher || '').trim()) || (roles || []).some(r => r !== 'student');

/* ---------- 파일 읽기 ---------- */
const DOC = /\.(hwpx?|txt)$/i;
const hasText = p => String((p && p.text) || '').replace(/\s/g, '').length >= 30;
const SS = () => globalThis.window && window.SSAM || {};
/* AI에 보내는 작은 그림(긴 변 512px): 정한 이름 칸과 맨 위 띠(이름 칸이 흔히 있는 곳)를 흰색으로 */
async function smallImage(page, mask) {
  const img = await SS().files.pageImage(page, [...(mask || []), { x: 0, y: 0, w: 1, h: 0.18 }]);
  const bmp = await createImageBitmap(img.blob);
  const s = Math.min(1, 512 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); bmp.close && bmp.close();
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.8));
  const b64 = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(',')[1]); fr.readAsDataURL(blob); });
  return { mime: 'image/jpeg', blob, b64 };
}

/* 파일 여러 개 → { doc: { student, teacher, how, names }, pages, roles, skipped }
   한글·txt는 글, PDF·사진은 쪽. 모든 쪽에 글자층이 있는 PDF는 문서로(쪽은 버림), 스캔 사이 글자층 쪽은 정답·교사용 쪽(글은 교사용 글로).
   글자층 없는 스캔이 3쪽 이상이고 AI가 되면 앞 2쪽·뒤 2쪽을 한 번 보냄(실패하면 모두 학생) */
export async function readBundle(files, { say = () => {}, mask = null } = {}) {
  const { readText } = await import('./files.js');
  const ai = await import('./ai.js');
  const list = [...files].sort((a, b) => String(a.name).localeCompare(String(b.name), 'ko', { numeric: true }));
  const docTexts = [], teacherTexts = [], names = [], skipped = [], pages = [];
  for (const f of list) {
    if (DOC.test(f.name || '')) {
      try { say(`「${f.name}」 읽는 중`); docTexts.push(await readText(f)); names.push(f.name); } catch (e) { skipped.push(f.name); }
      continue;
    }
    let r;
    try { r = await SS().files.readPages([f], say); } catch (e) { if (e && e.message === 'PDFJS') throw e; skipped.push(f.name); continue; }
    skipped.push(...(r.skipped || []));
    if (r.pages.length && r.pages.every(hasText)) { docTexts.push(r.pages.map(p => p.text).join('\n')); names.push(f.name); SS().files.freePages(r.pages); continue; }
    for (const p of r.pages) { if (hasText(p)) teacherTexts.push(p.text); pages.push(p); }
  }
  // 학생용·교사용을 따로 넣었으면 교사용 파일을 뒤로(이름 차례면 「교사용」이 「학생용」보다 앞이라 거꾸로 나뉨)
  const order = docTexts.map((text, i) => ({ text, i, t: teacherFile(names[i], text) ? 1 : 0 })).sort((a, b) => a.t - b.t || a.i - b.i);
  const d = splitDoc(order.map(x => x.text).join('\n'));
  const teacher = [d.teacher, ...teacherTexts].filter(s => String(s).trim()).join('\n').trim();
  const doc = { student: d.student, teacher, how: teacherTexts.length && !d.teacher ? 'marker' : d.how, names };
  let aiRoles = null;
  if (pages.length >= 3 && !pages.some(hasText) && ai.ready()) {
    const idx = edgeIdx(pages.length);
    try {
      say('정답·교사용 쪽을 찾는 중');
      const images = [];
      for (const i of idx) images.push(await smallImage(pages[i], mask));
      const v = await ai.generateJSON(pageRolesPrompt(idx.length), { images, task: 'grade', valid: x => !!x && (Array.isArray(x) || Array.isArray(x.pages)) });
      const rs = normPageRoles(v, idx.length);
      aiRoles = Object.fromEntries(idx.map((pi, k) => [pi, rs[k]]));
    } catch (e) { aiRoles = null; }
  }
  return { doc, pages, roles: pickRoles(pages, aiRoles), skipped };
}

/* ---------- 확인 카드 ---------- */
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const NEXT = { student: 'teacher', teacher: 'blank', blank: 'student' };
export function bundleSummary(b) {
  const parts = [];
  if (b.doc && b.doc.teacher) parts.push(b.doc.student ? '문서를 학생용 · 교사용으로 나눴어요' : '정답·교사용 문서');
  else if (b.doc && b.doc.student) parts.push(`문서 ${Math.max(1, (b.doc.names || []).length)}개`);
  const n = r => (b.roles || []).filter(x => x === r).length;
  for (const r of ['teacher', 'blank', 'student']) if (n(r)) parts.push(`${ROLE_NAME[r]} ${n(r)}쪽`);
  return parts.join(' · ') || '넣을 것이 없어요';
}
/* 나눈 결과를 보여 주고 확인받음 → 고친 b, 취소면 null */
export function openBundleCard(b, { what = '' } = {}) {
  return new Promise(resolve => {
    const cur = { ...b, doc: { ...b.doc }, roles: [...(b.roles || [])] };
    let done = false;
    const finish = v => { if (done) return; done = true; obs.disconnect(); resolve(v); };
    const docHTML = () => (cur.doc.teacher && cur.doc.student
      ? `<div class="bundle-doc"><span><b>학생용</b> ${cur.doc.student.split('\n').length}줄 · <b>교사용</b> ${cur.doc.teacher.split('\n').length}줄</span><button class="btn text tiny" type="button" id="bundleNoSplit">나누지 않기</button></div>` : '');
    const pagesHTML = () => (cur.pages && cur.pages.length
      ? `<div class="bundle-pages">${cur.pages.map((p, i) => `<button type="button" class="bundle-pg role-${cur.roles[i]}" data-bundle-page="${i}" aria-label="${i + 1}쪽 ${ROLE_NAME[cur.roles[i]]}"><img src="${esc(p.thumb || p.url)}" alt=""><span>${i + 1}쪽 · ${ROLE_NAME[cur.roles[i]]}</span></button>`).join('')}</div>
        <p class="muted" style="margin:0">쪽을 누르면 학생 → 정답·교사용 → 빈 활동지로 바뀌어요. 정답·교사용·빈 쪽은 채점 기준으로만 쓰고 학생으로 세지 않아요.</p>` : '');
    const draw = sh => {
      sh.querySelector('#bundleSum').textContent = bundleSummary(cur);
      sh.querySelector('#bundleBody').innerHTML = docHTML() + pagesHTML();
    };
    SS().openSheet(`<div id="bundleCard" class="bundle-card"><h3>${esc(what ? `${what}에 이렇게 넣을까요?` : '이렇게 나눠 넣을까요?')}</h3>
      <p class="muted" id="bundleSum" style="margin:0"></p><div id="bundleBody"></div>
      <div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-close>취소</button><button class="btn primary" type="button" id="bundleOk">이대로 넣기</button></div></div>`, sh => {
      draw(sh);
      sh.addEventListener('click', e => {
        const pg = e.target.closest('[data-bundle-page]');
        if (pg) { const i = +pg.dataset.bundlePage; cur.roles[i] = NEXT[cur.roles[i]] || 'student'; draw(sh); return; }
        if (e.target.closest('#bundleNoSplit')) { cur.doc = { ...cur.doc, student: [cur.doc.student, cur.doc.teacher].filter(Boolean).join('\n'), teacher: '', how: 'none' }; draw(sh); return; }
        if (e.target.closest('#bundleOk')) { const v = { ...cur }; SS().closeSheet(); finish(v); }
      });
    });
    const root = document.getElementById('sheetRoot');
    const obs = new MutationObserver(() => { if (!root.querySelector('#bundleCard')) finish(null); });
    obs.observe(root, { childList: true, subtree: true });
  });
}

/* ---------- 「한꺼번에 넣기」 칸 ---------- */
export const bundleBoxHTML = (id, note = '') => `<div class="bundle-box" data-bundle-drop="${esc(id)}">
  <div class="bundle-box-h"><b>한꺼번에 넣기</b><span class="muted">${esc(note || '정답지·교사용·학생 스캔을 한꺼번에 넣으면 알아서 나눠요')}</span></div>
  <div class="row"><button class="btn tonal" type="button" data-bundle-pick="${esc(id)}">파일 고르기</button><span class="muted bundle-msg" data-bundle-msg="${esc(id)}" role="status"></span></div>
  <input type="file" id="bundleFile-${esc(id)}" multiple hidden accept=".hwp,.hwpx,.txt,.pdf,.png,.jpg,.jpeg,.webp"></div>`;
/* 칸에 넣은 파일을 받는 곳: 고르기·끌어 놓기·붙여넣기(한 번만 걸어 둠) */
const handlers = {};
let wired = false;
export function onBundle(id, fn) {
  handlers[id] = fn;
  if (wired || !globalThis.document) return;
  wired = true;
  const box = el => el && el.closest && el.closest('[data-bundle-drop]');
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-bundle-pick]'); if (b) { const inp = document.getElementById('bundleFile-' + b.dataset.bundlePick); if (inp) inp.click(); } });
  document.addEventListener('change', e => { const m = /^bundleFile-(.+)$/.exec(e.target.id || ''); if (!m || !handlers[m[1]]) return; const fs = [...e.target.files]; e.target.value = ''; if (fs.length) handlers[m[1]](fs); });
  document.addEventListener('dragover', e => { const b = box(e.target); if (b) { e.preventDefault(); b.classList.add('over'); } });
  document.addEventListener('dragleave', e => { const b = box(e.target); if (b) b.classList.remove('over'); });
  document.addEventListener('drop', e => { const b = box(e.target); if (!b || !handlers[b.dataset.bundleDrop]) return; e.preventDefault(); b.classList.remove('over'); const fs = [...((e.dataTransfer && e.dataTransfer.files) || [])]; if (fs.length) handlers[b.dataset.bundleDrop](fs); });
}
export function bundleMsg(id, text) { const el = globalThis.document && document.querySelector(`[data-bundle-msg="${id}"]`); if (el) el.textContent = text; }
