/* 적힌 번호로 학생 맞추기 (단원평가·평가지 채점): 걷은 순서와 상관없이 학생이 첫 쪽에 쓴 번호를 읽어 학생을 맞춤.
   학생마다 첫 쪽의 번호 칸만 잘라 「1) 2) …」 딱지를 붙여 20명씩 그림 한 장으로 모아 AI에 한 번 보냄(이름 칸이 겹치면 하얗게).
   읽은 번호는 확인 표에서 고친 뒤(못 읽음·겹침·명단 밖은 노란 줄, 다 고쳐야 채점) 번호 차례로 늘어놓음 */
import * as ai from './ai.js';
import { get } from './store.js';

export const NO_ROWS = 20;
const NONE = { no: null, sure: false };

export function noPrompt(n) {
  return ['[번호 읽기]',
    '첨부한 그림은 학생들이 평가지에 쓴 번호 칸만 모은 것입니다. 줄마다 왼쪽의 「1)」 같은 딱지는 앱이 붙인 차례이고, 그 오른쪽이 학생이 손으로 쓴 번호입니다.',
    `딱지 1)부터 ${n})까지 차례마다 학생이 쓴 번호(1~99의 수)를 읽습니다.`,
    '- 비었거나 읽을 수 없으면 no를 null로 둡니다. 알아보기 어려우면 sure를 false로 둡니다.',
    '- 「번」 같은 글자는 빼고 수만 적습니다. 이름이나 다른 글자는 읽거나 적지 않습니다.',
    '', '[출력] JSON 하나만: {"nos":[{"i":1,"no":12,"sure":true}]}'].join('\n');
}

/* AI 답 → 딱지 차례대로 [{ no, sure }] (n개). 1~99 밖·빈 것·없는 딱지는 못 읽음 */
export function normNos(v, n) {
  const list = Array.isArray(v) ? v : v && Array.isArray(v.nos) ? v.nos : [];
  const out = Array.from({ length: n }, () => ({ ...NONE }));
  for (const x of list) {
    const i = Number(x && x.i);
    if (!(i >= 1 && i <= n)) continue;
    const no = Number(String(x.no == null ? '' : x.no).replace(/[^\d]/g, '') || NaN);
    out[i - 1] = no >= 1 && no <= 99 ? { no, sure: x.sure !== false } : { ...NONE };
  }
  return out;
}

/* 번호들 → 줄마다 '' | 'unread'(못 읽음) | 'dup'(같은 번호) | 'outside'(명단 밖). allowed: Set 또는 null(명단 점검 안 함) */
export function noProblems(nos, allowed) {
  const count = new Map();
  for (const n of nos) if (n != null) count.set(n, (count.get(n) || 0) + 1);
  return nos.map(n => (n == null ? 'unread' : count.get(n) > 1 ? 'dup' : allowed && !allowed.has(n) ? 'outside' : ''));
}
export const PROBLEM = { unread: '번호를 못 읽었어요', dup: '같은 번호가 있어요', outside: '학급 명단에 없는 번호예요' };

/* 번호 차례(작은 번호부터, 같으면 스캔 차례, 못 읽은 것은 끝)로 늘어놓을 스캔 차례 */
export function byNoOrder(nos) {
  return nos.map((n, i) => i).sort((a, b) => (nos[a] == null) - (nos[b] == null) || (nos[a] || 0) - (nos[b] || 0) || a - b);
}

/* 학생 수에서 예외 번호를 뺀 번호들. 학생 수를 모르면 null */
export function allowedNos(count, except = []) {
  const n = Number(count) | 0;
  if (n < 1) return null;
  const ex = new Set((except || []).map(Number));
  return new Set(Array.from({ length: n }, (_, i) => i + 1).filter(x => !ex.has(x)));
}
/* 학급 명단(설정 › 학급 명단)의 학생 수·예외 번호 + 화면에서 더 적은 예외 번호 */
export function rosterAllowed(moreExcept = []) {
  const c = get('class', null) || {};
  return allowedNos(c.count, [...(c.except || []), ...(moreExcept || [])]);
}

/* ---------- 번호 칸 잘라 모으기 (브라우저) ---------- */
const toBlob = (c, type, q) => new Promise(r => c.toBlob(r, type, q));
const toB64 = blob => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.onerror = rej; fr.readAsDataURL(blob); });
async function bitmap(blob) {
  if (window.createImageBitmap) { try { return await createImageBitmap(blob); } catch (e) {} }
  const url = URL.createObjectURL(blob);
  try { const img = new Image(); img.src = url; await img.decode(); return img; } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
}
const CROP_H = 80, LABEL_W = 90, MAX_W = 520;
/* 쪽 하나의 번호 칸(box: 쪽에 대한 비율 { x, y, w, h }) → 캔버스. 이름 칸(mask)이 겹치면 그 자리는 흰색 */
async function cropOne(page, box, mask) {
  const bmp = await bitmap(page.blob);
  const W = bmp.width, H = bmp.height;
  const sx = Math.max(0, box.x * W), sy = Math.max(0, box.y * H), sw = Math.max(1, Math.min(W - sx, box.w * W)), sh = Math.max(1, Math.min(H - sy, box.h * H));
  const s = Math.min(CROP_H / sh, MAX_W / sw);
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(sw * s)); c.height = Math.max(1, Math.round(sh * s));
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  g.drawImage(bmp, sx, sy, sw, sh, 0, 0, c.width, c.height);
  try { if (bmp.close) bmp.close(); } catch (e) {}
  g.fillStyle = '#fff';
  for (const r of mask || []) g.fillRect((r.x * W - sx) * s, (r.y * H - sy) * s, r.w * W * s, r.h * H * s);
  return c;
}
/* 학생마다 첫 쪽 → { images: AI에 보낼 그림(20줄씩), crops: 확인 표에 보일 번호 칸 그림 주소 } */
export async function cropNos(pages, box, mask) {
  const cuts = [];
  for (const p of pages) cuts.push(await cropOne(p, box, mask));
  const crops = cuts.map(c => c.toDataURL('image/jpeg', 0.85));
  const images = [];
  for (let k = 0; k < cuts.length; k += NO_ROWS) {
    const rows = cuts.slice(k, k + NO_ROWS);
    const c = document.createElement('canvas');
    c.width = LABEL_W + Math.max(...rows.map(r => r.width)) + 20; c.height = rows.length * (CROP_H + 16) + 8;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    rows.forEach((r, j) => {
      const y = 8 + j * (CROP_H + 16);
      g.fillStyle = '#000'; g.font = 'bold 30px sans-serif'; g.textBaseline = 'middle';
      g.fillText(`${k + j + 1})`, 8, y + CROP_H / 2);
      g.strokeStyle = '#999'; g.strokeRect(LABEL_W - 4, y - 4, r.width + 8, r.height + 8);
      g.drawImage(r, LABEL_W, y);
    });
    const blob = await toBlob(c, 'image/jpeg', 0.9);
    images.push({ mime: 'image/jpeg', blob, b64: await toB64(blob) });
    c.width = 0;
  }
  cuts.forEach(c => { c.width = 0; });
  return { images, crops };
}

/* 학생마다 첫 쪽에서 번호를 읽음 → { nos: [{ no, sure }], crops }. AI 오류는 { code }로 던짐 */
export async function readNos(pages, { box, mask, signal } = {}) {
  if (!ai.ready()) throw { code: 'NO_AI' };
  const { images, crops } = await cropNos(pages, box, mask);
  if (signal && signal.aborted) throw { code: 'aborted' };
  const v = await ai.generateJSON(noPrompt(pages.length), { images, signal, valid: x => Array.isArray(x) || !!(x && Array.isArray(x.nos)) });
  // 확인 표에서 번호 칸을 누르면 그 학생의 첫 쪽을 크게 보여 주려고 쪽·번호 칸 자리를 함께 돌려줌(화면에만, 저장·전송 안 함)
  return { nos: normNos(v, pages.length).map((x, k) => ({ ...x, page: pages[k], box })), crops };
}

/* 읽는 동안 띄워 두는 창 (떠 있는 버튼의 다음 카드가 확인 표를 덮지 않게, 그만두기도 여기서).
   창이 닫히면(그만두기·다른 창) 읽기도 멈춤(signal) → 곧바로 다시 누를 수 있음
   → { gone(): 그만뒀는지(다른 창으로 바뀌었는지), close(), signal } */
export function openNoWait() {
  let sheet = null;
  const ctrl = new AbortController(), root = document.getElementById('sheetRoot');
  window.SSAM.openSheet(`<h3>학생이 쓴 번호를 읽는 중이에요</h3>
    <p class="muted" style="margin:0">학생마다 번호 칸만 모아 AI가 읽고 있어요. 다 읽으면 확인 표가 떠요.</p>
    <div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-close>그만두기</button></div>`, sh => { sheet = sh; });
  const gone = () => !sheet || !sheet.isConnected;
  if (root) { const obs = new MutationObserver(() => { if (gone()) { obs.disconnect(); ctrl.abort(); } }); obs.observe(root, { childList: true, subtree: true }); }
  return { gone, close: () => { if (!gone()) window.SSAM.closeSheet(); }, signal: ctrl.signal };
}

/* ---------- 확인 표 ---------- */
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/* 줄 아래에 펼치는 크게 보기: 번호 칸 그림(크게) + 시험지 첫 쪽(번호 칸을 빨간 테두리로). 쪽 그림이 없으면 번호 칸만 */
const pct = v => `${Math.max(0, Math.min(100, Number(v) * 100 || 0)).toFixed(2)}%`;
function noViewHTML(r, i, pageUrl) {
  const b = r.box || null;
  return `<figure class="no-view-crop"><img src="${esc(r.crop)}" alt="${i + 1}번째 학생의 번호 칸(크게)"><figcaption class="muted">번호 칸</figcaption></figure>`
    + (pageUrl ? `<figure class="no-view-page"><div class="no-view-stage"><img src="${esc(pageUrl)}" alt="${i + 1}번째 학생의 시험지 첫 쪽">${b ? `<span class="no-view-box" style="left:${pct(b.x)};top:${pct(b.y)};width:${pct(b.w)};height:${pct(b.h)}"></span>` : ''}</div><figcaption class="muted">시험지 첫 쪽${b ? ' · 빨간 칸이 번호 칸' : ''}</figcaption></figure>` : '');
}
/* rows: [{ crop, no, sure, page?, box? }] · allowed: Set|null · onOk(번호들). 노란 줄을 다 고쳐야 [이대로 채점].
   번호 칸 그림이나 번호 칸을 누르면 그 줄 아래에 번호 칸·시험지 첫 쪽을 크게 보여 줌(한 번에 한 줄) */
export function openNoCheck({ rows, allowed, onOk }) {
  const SS = window.SSAM;
  const missing = () => (allowed ? [...allowed].filter(n => !cur().includes(n)) : []);
  let cur = () => rows.map(r => r.no);
  SS.openSheet(`<h3>읽은 번호를 확인해 주세요</h3>
    <p class="muted" style="margin:0">스캔 차례마다 학생이 쓴 번호 칸과 읽은 번호예요. 노란 줄을 고치면 번호 차례로 늘어놓고 채점해요. 번호 칸 그림이나 번호를 누르면 그 학생의 번호 칸과 시험지를 크게 볼 수 있어요.</p>
    <ol class="no-check">${rows.map((r, i) => `<li data-noline="${i}"><span class="muted num">${i + 1}번째</span><button type="button" class="no-zoom" data-nozoom="${i}" aria-expanded="false" aria-controls="noView${i}" title="크게 보기"><img src="${esc(r.crop)}" alt="${i + 1}번째 학생의 번호 칸 · 눌러서 크게 보기"></button><label class="cls-inline"><input class="field num" type="number" min="1" max="99" data-noi="${i}" value="${r.no == null ? '' : r.no}" aria-label="${i + 1}번째 학생 번호">번</label><span class="no-why" data-nowhy="${i}"></span><div class="no-view" id="noView${i}" data-noview="${i}" hidden></div></li>`).join('')}</ol>
    <p class="muted" id="noMissing"></p>
    <div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-close>취소</button><button class="btn primary" type="button" id="noOk">이대로 채점</button></div>`,
  sh => {
    sh.classList.add('wide');
    const inputs = [...sh.querySelectorAll('[data-noi]')];
    cur = () => inputs.map(el => { const v = Math.round(Number(el.value)); return el.value.trim() && v >= 1 && v <= 99 ? v : null; });
    const draw = () => {
      const probs = noProblems(cur(), allowed);
      probs.forEach((p, i) => {
        sh.querySelector(`[data-noline="${i}"]`).classList.toggle('warn', !!p || rows[i].sure === false);
        sh.querySelector(`[data-nowhy="${i}"]`).textContent = p ? PROBLEM[p] : rows[i].sure === false && inputs[i].dataset.touched !== '1' ? '글씨를 확인해 주세요' : '';
      });
      const bad = probs.filter(Boolean).length, miss = missing();
      sh.querySelector('#noOk').disabled = bad > 0;
      sh.querySelector('#noMissing').textContent = (bad ? `노란 줄 ${bad}개를 고쳐 주세요. ` : '') + (miss.length ? `읽은 번호에 없는 번호: ${miss.join(', ')}번 (결석이면 그대로 두세요)` : '');
    };
    inputs.forEach(el => el.addEventListener('input', () => { el.dataset.touched = '1'; draw(); }));
    // 크게 보기: 쪽 그림 주소는 앱이 이미 만든 것(page.url)을 쓰고, 없으면 여기서 만들어 창이 닫힐 때 돌려줌
    const urlOf = r => { const p = r.page; if (!p) return ''; if (p.url) return p.url; if (p.blob) { p.url = URL.createObjectURL(p.blob); p._noUrl = true; return p.url; } return ''; };
    const views = [...sh.querySelectorAll('[data-noview]')], zooms = [...sh.querySelectorAll('[data-nozoom]')];
    const show = (i, on) => {
      views.forEach((v, k) => { const o = on && k === i; if (o && !v.innerHTML) v.innerHTML = noViewHTML(rows[k], k, urlOf(rows[k])); v.hidden = !o; zooms[k].setAttribute('aria-expanded', String(o)); });
      if (on) requestAnimationFrame(() => { const li = sh.querySelector(`[data-noline="${i}"]`); if (li && li.scrollIntoView) li.scrollIntoView({ block: 'nearest' }); });
    };
    zooms.forEach((b, i) => b.addEventListener('click', () => show(i, views[i].hidden)));
    inputs.forEach((el, i) => el.addEventListener('click', () => { if (views[i].hidden) show(i, true); }));
    const root = document.getElementById('sheetRoot');
    if (root) { const obs = new MutationObserver(() => { if (!sh.isConnected) { obs.disconnect(); rows.forEach(r => { if (r.page && r.page._noUrl) { URL.revokeObjectURL(r.page.url); delete r.page.url; delete r.page._noUrl; } }); } }); obs.observe(root, { childList: true }); }
    sh.querySelector('#noOk').addEventListener('click', () => {
      const nos = cur();
      if (noProblems(nos, allowed).some(Boolean)) return;
      SS.closeSheet(); onOk(nos);
    });
    draw();
  });
}

// 옛 평가 화면(평가지 채점, evaluate.js)도 같은 기능을 씀
if (typeof window !== 'undefined' && window.SSAM) window.SSAM.studentNo = { readNos, openNoCheck, openNoWait, rosterAllowed, byNoOrder };
