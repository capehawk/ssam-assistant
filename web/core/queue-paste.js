/* 에듀파인에 차례로 붙여넣기 (스펙 2026-11-03 3장, Windows 앱): 품의·공문 기안의 조각(제목·품의 사유·산출 내역…)을
   받아 두고, 브라우저에서 칸을 누르고 Ctrl+V를 누를 때마다 다음 조각을 붙임(앱 Rust queue_arm).
   저장·결재·상신은 늘 선생님이 누름. 나이스 자동 붙여넣기와 Ctrl+V를 같이 맡지 않음(ssam:paste-owner 알림) */
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const OPT = 'ssam:queue';
const core = () => (window.__TAURI__ && window.__TAURI__.core ? window.__TAURI__.core : null);
export const canQueue = () => !!core();

/* 화면 상태: state idle·arming·armed·end·expired·error, items [{ label, text }], next(다음 조각), gen */
const Q = { state: 'idle', title: '', items: [], next: 0, gen: 0, msg: '', note: '', until: 0, timer: null, listening: false, seq: 0 };
const filled = i => !!String((Q.items[i] || {}).text || '').trim();
const nextFilled = from => { for (let i = Math.max(0, from); i < Q.items.length; i++) if (filled(i)) return i; return -1; };
function opts() { try { return { anyWindow: !!(JSON.parse(localStorage.getItem(OPT)) || {}).anyWindow }; } catch (e) { return { anyWindow: false }; } }
function saveOpts(o) { try { localStorage.setItem(OPT, JSON.stringify(o)); } catch (e) {} }

function listen() {
  if (Q.listening) return;
  const ev = window.__TAURI__ && window.__TAURI__.event;
  if (!ev || !ev.listen) return;
  Q.listening = true;
  Promise.resolve(ev.listen('neis-paste', e => onEvent((e && e.payload) || {}))).catch(() => { Q.listening = false; });
}
function onEvent(p) {
  if (Q.state === 'idle' || !Q.gen || p.gen !== Q.gen) return; // 나이스 붙여넣기나 예전 준비의 알림
  if (p.state === 'queue') { Q.next = p.done | 0; Q.note = ''; Q.until = Date.now() + 900000; }
  else if (p.state === 'end') { Q.state = p.reason === 'finished' ? 'end' : 'error'; Q.msg = p.message || ''; Q.next = p.done | 0; }
  else if (p.state === 'expired') Q.state = 'expired';
  else if (p.state === 'elsewhere') Q.note = p.message || '다른 프로그램';
  render();
}

/* items: [{ label, text }]. 다른 화면에서 다시 부르면 새 조각으로 바꿈 */
export async function openQueue({ title = '', items = [] } = {}) {
  if (!core()) return false;
  Q.title = title; Q.items = items.map(x => ({ label: String(x.label || ''), text: String(x.text == null ? '' : x.text) }));
  if (nextFilled(0) < 0) { Q.state = 'error'; Q.msg = '붙여넣을 내용이 없어요'; render(); return false; }
  await arm(0);
  return true;
}
async function arm(from) {
  listen();
  // 나이스 붙여넣기 창은 닫음(앱은 Ctrl+V를 하나만 맡음 — 준비는 queue_arm이 바꿈)
  document.dispatchEvent(new CustomEvent('ssam:paste-owner', { detail: 'queue' }));
  const seq = ++Q.seq;
  Q.state = 'arming'; Q.msg = ''; Q.note = ''; Q.next = from;
  render();
  try {
    const r = await core().invoke('queue_arm', { items: Q.items.map(x => x.text), start: from, anyWindow: opts().anyWindow });
    if (seq !== Q.seq || Q.state !== 'arming') return;
    Q.gen = (r && r.gen) || 0; Q.state = 'armed'; Q.until = Date.now() + ((r && +r.secs) || 900) * 1000;
  } catch (e) {
    if (seq !== Q.seq) return;
    Q.state = 'error'; Q.msg = String((e && e.message) || e || '준비하지 못했어요');
  }
  render();
}
export function closeQueue() {
  const was = Q.state;
  Q.seq++; Q.state = 'idle'; Q.gen = 0;
  if (was !== 'idle' && was !== 'end' && core()) Promise.resolve(core().invoke('neis_disarm')).catch(() => {});
  render();
}
async function goto(i) {
  if (Q.state !== 'armed') return;
  Q.next = Math.max(0, Math.min(Q.items.length, i));
  render();
  try { await core().invoke('queue_goto', { gen: Q.gen, index: Q.next }); }
  catch (e) { Q.state = 'error'; Q.msg = String((e && e.message) || e || '준비가 풀렸어요'); render(); }
}

const short = t => { const s = String(t || '').replace(/\s+/g, ' ').trim(); return s.length > 34 ? s.slice(0, 34) + '…' : s; };
function render() {
  let box = document.getElementById('qpPanel');
  if (Q.state === 'idle') { if (box) box.remove(); clearInterval(Q.timer); Q.timer = null; return; }
  if (!box) { box = document.createElement('section'); box.id = 'qpPanel'; box.className = 'neis qp'; box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
  const nx = nextFilled(Q.next), live = Q.state === 'armed' || Q.state === 'arming';
  const list = `<ol class="qp-list">${Q.items.map((x, i) => {
    const st = !filled(i) ? 'empty' : i < Q.next || (Q.state === 'end') ? 'done' : i === nx && live ? 'next' : '';
    return `<li class="qp-${st || 'wait'}"><button type="button" data-qp-go="${i}"${filled(i) && live ? '' : ' disabled'}>${st === 'done' ? '✓ ' : st === 'next' ? '▶ ' : ''}<b>${esc(x.label)}</b><span class="muted">${filled(i) ? esc(short(x.text)) : '(비어 있어 건너뜀)'}</span></button></li>`;
  }).join('')}</ol>`;
  let body = '', acts = '';
  if (live) {
    body = `<p>${nx >= 0 ? `에듀파인에서 <b>${esc(Q.items[nx].label)}</b> 칸을 누르고 <kbd>Ctrl</kbd>+<kbd>V</kbd> 하세요.` : '남은 조각이 없어요.'} 누를 때마다 아래 차례로 들어가요.</p>
      ${list}
      ${Q.note ? `<p class="muted warn">방금 Ctrl+V를 누른 곳(${esc(Q.note)})은 브라우저가 아니어서 평소처럼 붙여넣었어요.</p>` : ''}
      <label class="neis-row chk"><input type="checkbox" data-qp-any ${opts().anyWindow ? 'checked' : ''}><span>브라우저가 아닌 창(가상 PC 등)에서도 쓰기</span></label>
      <p class="muted">${Q.state === 'arming' ? '<span class="spin"></span>준비하는 중…' : `저장·결재는 선생님이 눌러 주세요 · 쓰지 않으면 <span class="num" data-qpleft></span> 뒤에 꺼져요`}</p>`;
    acts = `<button class="btn" type="button" data-qp="prev"${Q.next > 0 ? '' : ' disabled'}>◀ 앞으로</button><button class="btn" type="button" data-qp="skip"${nx >= 0 ? '' : ' disabled'}>건너뛰기 ▶</button><button class="btn" type="button" data-qp="close">닫기</button>`;
  } else if (Q.state === 'end') {
    body = `<p class="neis-ok"><b>다 넣었어요</b></p><p class="muted">에듀파인에서 내용을 확인하고 저장·결재는 선생님이 눌러 주세요.</p>${list}`;
    acts = `<button class="btn" type="button" data-qp="again">처음부터 다시</button><button class="btn primary" type="button" data-qp="close">닫기</button>`;
  } else if (Q.state === 'expired') {
    body = '<p><b>쓰지 않은 채 15분이 지나 꺼졌어요</b></p><p class="muted">이어서 넣으려면 다시 준비해 주세요.</p>';
    acts = `<button class="btn primary" type="button" data-qp="resume">이어서 준비</button><button class="btn" type="button" data-qp="close">닫기</button>`;
  } else {
    body = `<p class="muted err">${esc(Q.msg || '멈췄어요')}</p>`;
    acts = `${Q.items.length && nextFilled(0) >= 0 ? '<button class="btn primary" type="button" data-qp="resume">다시 준비</button>' : ''}<button class="btn" type="button" data-qp="close">닫기</button>`;
  }
  box.innerHTML = `<div class="neis-h"><h3>에듀파인에 차례로 붙여넣기${Q.title ? `<small>${esc(Q.title)}</small>` : ''}</h3><button class="icon-btn" type="button" data-qp="close" aria-label="닫기" title="닫기">✕</button></div>
    <div class="neis-b">${body}</div><div class="neis-a">${acts}</div>`;
  tick();
  clearInterval(Q.timer); Q.timer = null;
  if (Q.state === 'armed') Q.timer = setInterval(tick, 1000);
}
function tick() {
  const el = document.querySelector('#qpPanel [data-qpleft]'); if (!el) return;
  const left = Math.max(0, Math.round((Q.until - Date.now()) / 1000));
  el.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
}

if (typeof document !== 'undefined') {
  document.addEventListener('click', e => {
    const t = e.target; if (!t.closest || !t.closest('#qpPanel')) return;
    const g = t.closest('[data-qp-go]');
    if (g && !g.disabled) { goto(+g.dataset.qpGo); return; }
    const b = t.closest('[data-qp]'); if (!b || b.disabled) return;
    const a = b.dataset.qp;
    if (a === 'close') closeQueue();
    else if (a === 'prev') { let i = Q.next - 1; while (i > 0 && !filled(i)) i--; goto(Math.max(0, i)); }
    else if (a === 'skip') { const nx = nextFilled(Q.next); if (nx >= 0) goto(nx + 1); }
    else if (a === 'again') arm(0);
    else if (a === 'resume') arm(Math.max(0, nextFilled(Q.next) >= 0 ? Q.next : 0));
  });
  document.addEventListener('change', e => {
    if (!e.target.matches || !e.target.matches('#qpPanel [data-qp-any]')) return;
    saveOpts({ ...opts(), anyWindow: e.target.checked });
    if (Q.state === 'armed') arm(Q.next);
  });
  // 나이스 붙여넣기를 준비하면 이 창은 닫음(앱 준비는 neis_arm이 바꿈)
  document.addEventListener('ssam:paste-owner', e => {
    if (e.detail !== 'queue' && Q.state !== 'idle') { Q.seq++; Q.state = 'idle'; Q.gen = 0; render(); }
  });
}
