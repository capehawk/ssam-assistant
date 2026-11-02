/* 창 틀: 왼쪽 세로 메뉴 + 상단 헤더(메뉴 제목·가로 메뉴). 메뉴마다 <section data-menu>를 보이고 숨김.
   평가 메뉴의 가로 메뉴는 기존 앱의 화면(mode)과 같음: window.SSAM.setMode로 바꿈 */
import { icon } from './icons.js';
import { renderPlaceholder } from '../menus/placeholder.js';
import { ensureYears } from './years.js';
import { freeze, onFail, FULL_MSG, flushAll, usage } from './store.js';

export const MENUS = [
  { id: 'evaluate', label: '평가', tabs: [['pyeongeo', '교과 평어'], ['cc', '창의적 체험활동'], ['hk', '행동특성'], ['gr', '평가지 채점'], ['unit', '단원평가'], ['activity', '활동지']] },
  { id: 'training', label: '연수', tabs: [['mine', '내 필수연수'], ['board', '연수 현황판']] },
  { id: 'plan', label: '계획', tabs: [['year', '연간계획'], ['event', '행사계획'], ['class', '학급운영계획']] },
  { id: 'class', label: '학급', tabs: [['today', '오늘 수업'], ['progress', '진도표·시수'], ['weekly', '주간학습안내']] },
  { id: 'purchase', label: '품의', tabs: [['new', '새 품의'], ['templates', '저장한 템플릿'], ['recent', '최근 작성']] },
  { id: 'settings', label: '설정', tabs: [['roster', '학급 명단'], ['ai', 'AI'], ['screen', '화면'], ['school', '학교 정보'], ['years', '학년도'], ['purchase', '품의 기준']] }
].map(m => ({ ...m, icon: m.id, tabs: m.tabs.map(([id, label]) => ({ id, label })) }));

const NAV_KEY = 'ssam:nav';
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SSAM = () => window.SSAM || {};
const hooks = {};
const EVAL_ACTS = ['new', 'plans', 'pronoun'];
let cur = null;

/* 메뉴에 들어올 때 부를 함수 등록: fn(tab, section) */
export function onEnter(menu, fn) {
  (hooks[menu] || (hooks[menu] = [])).push(fn);
  if (cur && cur.menu === menu) fn(cur.tab, section(menu));
}
const section = menu => document.querySelector(`section[data-menu="${menu}"]`);
const find = id => MENUS.find(m => m.id === id);

function readNav() {
  try {
    const v = JSON.parse(localStorage.getItem(NAV_KEY));
    if (v && find(v.menu)) return v;
  } catch (e) {}
  return null;
}

/* 헤더 오른쪽(⋮ 왼쪽)에 메뉴별 버튼을 둠. 메뉴·탭이 바뀔 때마다 비워짐 */
export function setActions(html) {
  const el = $('#topExtra');
  if (el) el.innerHTML = html || '';
  return el;
}

const LEGACY = ['pyeongeo', 'cc', 'hk', 'gr'];
export function go(menuId, tabId) {
  const m = find(menuId) || MENUS[0];
  setActions('');
  let tab = m.tabs.find(x => x.id === tabId) ? tabId : null;
  if (!tab) tab = m.id === 'evaluate' ? (SSAM().getMode && SSAM().getMode()) || 'pyeongeo' : m.tabs[0].id;
  cur = { menu: m.id, tab };
  document.querySelectorAll('section[data-menu]').forEach(s => { s.hidden = s.dataset.menu !== m.id; });
  document.querySelectorAll('[data-menu-go]').forEach(b => {
    if (b.dataset.menuGo === m.id) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  $('#menuTitle').textContent = m.label;
  drawTabs(m);
  if (m.id === 'evaluate') {
    // 기존 앱의 화면(mode)이 아닌 탭(단원평가)은 새 모듈이 그림: 기존 화면을 숨김
    const ev = section('evaluate');
    if (ev) ev.classList.toggle('ev-new', !LEGACY.includes(tab));
    if (LEGACY.includes(tab) && SSAM().getMode && SSAM().getMode() !== tab) SSAM().setMode(tab);
  }
  try { localStorage.setItem(NAV_KEY, JSON.stringify(cur)); } catch (e) {}
  drawAi();
  document.dispatchEvent(new CustomEvent('menu:go', { detail: { menu: m.id, tab } }));
  const fns = hooks[m.id];
  if (fns && fns.length) {
    const ph = section(m.id) && section(m.id).querySelector('.ph');
    if (ph) ph.remove();
    fns.forEach(fn => fn(tab, section(m.id)));
  } else if (m.id !== 'evaluate') renderPlaceholder(section(m.id), m, tab);
}

function drawTabs(m) {
  $('#menuTabs').setAttribute('aria-label', `${m.label} 메뉴`);
  $('#menuTabs').innerHTML = m.tabs.map(t => `<button type="button" data-tab="${t.id}"${t.id === cur.tab ? ' aria-current="page"' : ''}>${esc(t.label)}</button>`).join('');
}

function drawSide() {
  const btn = m => `<button type="button" class="side-btn" data-menu-go="${m.id}">${icon(m.icon)}<span>${esc(m.label)}</span></button>`;
  $('#sideMenus').innerHTML = MENUS.filter(m => m.id !== 'settings').map(btn).join('');
  $('#sideSettings').innerHTML = btn(find('settings'));
}

/* 세로 메뉴 아래 「2026학년도」 (누르면 설정 › 학년도) */
function drawYear() {
  const el = $('#sideYear');
  if (!el) return;
  let ls = null;
  try { ls = window.localStorage; } catch (e) {}
  // 처음 연 날의 학년도를 저장해 둠 (저장소가 막혀 있으면 오늘이 든 학년도만 보임)
  el.innerHTML = `<small>학년도</small><b>${ensureYears(ls).current}학년도</b>`;
}

/* 세로 메뉴 아래 「사용 중인 AI」 */
function drawAi() {
  const name = SSAM().ai && SSAM().ai.engineReady && SSAM().ai.engineReady() ? SSAM().ai.engineName() : '';
  $('#sideAiName').textContent = name || 'AI를 정해 주세요';
}

function init() {
  drawSide();
  drawYear();
  document.addEventListener('click', e => {
    const g = e.target.closest('[data-menu-go]'); if (g) { go(g.dataset.menuGo); return; }
    const t = e.target.closest('#menuTabs [data-tab]'); if (t) { go(cur.menu, t.dataset.tab); return; }
    if (e.target.closest('#sideAi')) { go('settings', 'ai'); return; }
    if (e.target.closest('#sideYear')) { go('settings', 'years'); return; }
    // ⋮ 메뉴의 평가계획 일(새로 넣기·저장된 계획·대명사 줄이기)은 평가 화면에서 보이게 함
    const a = e.target.closest('#menu [data-act]');
    if (a && EVAL_ACTS.includes(a.dataset.act) && cur && cur.menu !== 'evaluate') go('evaluate');
  });
  // 기존 앱이 스스로 화면을 바꾸면(새 평가계획 넣기 등) 가로 메뉴도 맞춤
  if (SSAM().onModeChange) SSAM().onModeChange(mode => {
    if (!cur || cur.menu !== 'evaluate' || cur.tab === mode) return;
    if (!LEGACY.includes(cur.tab)) { go('evaluate', mode); return; }
    cur.tab = mode; drawTabs(find('evaluate'));
    try { localStorage.setItem(NAV_KEY, JSON.stringify(cur)); } catch (e) {}
  });
  // 다른 탭에서 학년도를 옮기면 이 탭은 저장을 멈추고 다시 엶 (지난 학년도 자료를 새 학년도에 쓰지 않게)
  window.addEventListener('storage', e => {
    if (e.key !== 'ssam:years' && e.key !== null) return;
    freeze(); if (SSAM().freeze) SSAM().freeze(true);
    location.reload();
  });
  // 저장 공간이 70%를 넘으면 열 때 한 번 알림 (처음 뜨는 다른 알림에 덮이지 않게 조금 뒤에)
  setTimeout(() => {
    let r = 0;
    try { r = usage(window.localStorage).ratio; } catch (e) {}
    if (r >= 0.7 && SSAM().toast) SSAM().toast(`저장 공간이 ${Math.round(r * 100)}% 찼어요. 설정 › 학년도에서 백업 파일을 만든 뒤 쓰지 않는 자료를 지워 주세요.`, 9000);
  }, 1200);
  // 창을 닫거나 다른 창으로 가면 미뤄 둔 저장을 바로 씀
  window.addEventListener('pagehide', flushAll);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushAll(); });
  // 저장 공간이 꽉 차 저장하지 못하면 알림 (20초에 한 번까지: 쓰는 동안 계속 뜨지 않게)
  let failAt = -1e9;
  onFail(() => {
    if (Date.now() - failAt < 20000) return;
    failAt = Date.now();
    if (SSAM().toast) SSAM().toast(FULL_MSG, 8000);
  });
  // 설정 시트를 닫으면 AI 이름을 다시 읽음
  const root = $('#sheetRoot');
  if (root) new MutationObserver(drawAi).observe(root, { childList: true });
  const saved = readNav();
  go(saved ? saved.menu : 'evaluate', saved && (saved.menu !== 'evaluate' || !LEGACY.includes(saved.tab)) ? saved.tab : undefined);
}

// 메뉴 모듈들이 onEnter를 등록한 뒤에 처음 화면을 그림.
// 모듈은 문서를 다 읽은 뒤(readyState 'interactive') DOMContentLoaded 전에 실행되므로 늘 그 이벤트를 기다림
if (document.readyState === 'complete') init();
else document.addEventListener('DOMContentLoaded', init);
