/* 설정 메뉴: 학급 명단 · AI · 화면 · 학교 정보 · 학년도 · 품의 기준 */
import { onEnter, go as goMenu } from '../../core/shell.js';
import { THEMES, getTheme, setTheme } from '../../core/theme.js';
import { getSchool, setSchool, getPurchaseLimit, setPurchaseLimit, getMeetCap, setMeetCap, getPurchaseFlow, setPurchaseFlow } from '../../core/settings.js';
import * as ai from '../../core/ai.js';
import { readTable } from '../../core/sheet.js';
import { parseRoster } from '../../core/roster.js';
import { saveFile } from '../../core/ui.js';
import { getYears, snapshot, carryOver, makeBackup, parseBackup, prepYear } from '../../core/years.js';
import { switchYear, switchError, getArchive, safeLS } from '../../core/year-switch.js';
import { FULL_MSG, usage, get as sget, set as sset } from '../../core/store.js';
import { getInboxSettings, setInboxSettings, registerInbox } from '../../core/inbox.js';
import { TASKS, getRoles, setDefaultReview, resetRoles, rowText, aiOptions, aiValue, aiFromValue, providerEnv } from '../../core/ai-roles.js';

const SSAM = () => window.SSAM || {};
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const toast = (m, ms) => SSAM().toast && SSAM().toast(m, ms);
const FULL = FULL_MSG;
/* 웹판 주소(*.github.io)는 같은 계정의 다른 GitHub Pages 페이지와 저장소를 함께 씀 (Windows 앱은 따로) */
const sharedHost = () => (!window.__TAURI__ && /\.github\.io$/i.test(location.hostname) ? location.hostname : '');
/* 시험용 업스테이지(Windows 앱): 내 키가 없으면 빌드에 넣은 키로, 기한까지 */
function testKeyNote() {
  const t = SSAM().ai && SSAM().ai.testKey ? SSAM().ai.testKey() : null;
  if (!t || !t.on) return '';
  return `<p class="banner info" style="margin:0 0 8px"><span class="grow">${t.using ? '지금은 <b>시험용 업스테이지 AI</b>를 쓰고 있어요' : '이 앱에는 <b>시험용 업스테이지 AI</b>가 들어 있어요'}(${esc(t.untilText)}까지, 하루 400번). 써 보시라고 넣어 둔 것이라 기한이 지나면 사라져요. 내 AI 키를 넣으면 그 키로 써요.</span></p>`;
}
const sharedNote = () => (sharedHost() ? `<p class="banner warn" style="margin:0 0 8px">웹판은 ${esc(sharedHost())} 주소를 같은 계정의 다른 웹페이지와 함께 써요. AI 키를 기억하게 하면 그 페이지들도 이 키를 읽을 수 있어요. 함께 쓰는 PC에서는 Windows 앱을 쓰거나 [AI 바꾸기]에서 「키 기억하기」를 꺼 주세요.</p>` : '');
const won = n => Number(n).toLocaleString('ko-KR');

// 테마 미리보기 색 (core/theme.css와 같은 값): 틀, 바탕, 카드, 포인트
const PREVIEW = {
  'dark-nav': ['#15171c', '#f5f6f8', '#ffffff', '#4f46e5', '#e4e6eb'],
  mono: ['#ffffff', '#fafafa', '#ffffff', '#111111', '#ebebeb'],
  soft: ['#ffffff', '#f2f4f6', '#ffffff', '#2563eb', '#eceef1'],
  paper: ['#efebe2', '#f7f5f0', '#fffefb', '#1f3a5f', '#ddd7ca'],
  rail: ['#eef3f2', '#ffffff', '#ffffff', '#0f766e', '#dde5e3']
};

let box = null, school = null, msg = '', capMsg = '', aiMsg = null; // aiMsg: { ok, text } | { busy }
let yrList = null; // 보관한 학년도 [{ year, savedAt, size }] (null = 불러오는 중)
const kb = n => `${Math.max(1, Math.round(n / 1024)).toLocaleString('ko-KR')}KB`;
const ymd = t => { const d = new Date(t); return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}.`; };
const curYear = () => getYears(safeLS()).current;
const snapSize = snap => Object.entries(snap).reduce((n, [k, v]) => n + k.length + String(v).length, 0);

function page(title, desc, body) {
  return `<div class="m-page set-page"><div class="m-head"><h2>${title}</h2>${desc ? `<p class="muted">${desc}</p>` : ''}</div>${body}</div>`;
}
const card = (title, body) => `<section class="set-card"><h3>${title}</h3>${body}</section>`;
/* 기본 검토 AI와 업무별 설정 한눈에 (업무마다 정하는 곳은 각 메뉴의 AI 줄) */
function rolesCards() {
  const env = providerEnv();
  if (env.engine === 'account') return card('업무별 AI', '<p class="muted" style="margin:0">Claude 계정을 쓰는 동안에는 AI 하나로 모든 업무를 해요. 업무별 AI와 검토 AI는 API 키를 넣으면 쓸 수 있어요.</p>');
  const r = getRoles(), cur = r.review && env.keys[r.review.engine] ? aiValue(r.review) : '';
  const opts = aiOptions(env).map(o => `<option value="${esc(o.value)}"${o.value === cur ? ' selected' : ''}>${esc(o.label)}</option>`).join('');
  return card('기본 검토 AI', `<p class="muted" style="margin-top:0">업무 메뉴의 AI 줄에서 「검토 AI로 한 번 더 보기」를 켜면, 따로 고르지 않은 업무는 이 AI가 검토해요. 키를 넣은 회사만 고를 수 있어요.</p>
      <label class="set-f"><span class="lab">기본 검토 AI</span><select class="field" id="setReviewAi"><option value="">검토 안 함</option>${opts}</select></label>`)
    + card('업무별 설정 한눈에', `<ul class="set-roles" id="setRoleList">${TASKS.map(([t, name]) => `<li><b>${esc(name)}</b><span class="muted">${esc(rowText(t, env))}</span></li>`).join('')}</ul>
      <p class="muted">업무마다 바꾸는 곳은 각 메뉴 위쪽의 AI 줄 [바꾸기]예요.</p>
      <div class="row"><button class="btn" type="button" data-set="resetRoles">기본으로 되돌리기</button></div>`);
}
/* 떠 있는 버튼: 아무 파일이나 넣으면 쌤비서가 알아서 */
function inboxCard() {
  const s = getInboxSettings();
  const radio = (name, id, value, label, desc) => `<label class="set-radio"><input type="radio" name="${name}" id="${id}" value="${value}" data-ib-set="${name}"${s[name] === value ? ' checked' : ''}> <b>${label}</b> <span class="muted">${desc}</span></label>`;
  return card('떠 있는 버튼', `<p class="muted" style="margin-top:0">오른쪽 아래 「쌤」 버튼에 아무 파일이나 넣으면, 평가지인지 계획인지 알아보고 그 메뉴에서 해 줘요.</p>
    <label class="set-radio"><input type="checkbox" id="ibSetOn" data-ib-set="on"${s.on ? ' checked' : ''}> <b>버튼 보이기</b></label>
    <fieldset class="set-fs"><legend class="lab">알아본 뒤</legend>${radio('mode', 'ibSetModeConfirm', 'confirm', '확인 카드', '무엇으로 보이는지 보여 주고 [실행]을 누르면 해요')}${radio('mode', 'ibSetModeDirect', 'direct', '바로 실행', '모자란 값이 없으면 카드 없이 바로 해요')}</fieldset>
    <fieldset class="set-fs"><legend class="lab">계획 파일</legend>${radio('plan', 'ibSetPlanDraft', 'draft', '초안까지', '새 계획을 만들고 AI 초안까지 써요')}${radio('plan', 'ibSetPlanOpen', 'open', '자료로만', '새 계획에 자료로만 넣고 열어요')}</fieldset>
    ${window.__TAURI__ ? `<p class="muted">Windows 앱에서는 버튼이 바탕화면 위에 떠 있어요. 끌어서 옮기고, 오른쪽 클릭으로 메뉴를 열어요.</p>
    <label class="set-radio"><input type="checkbox" id="ibSetKeep" data-ib-set="keepOnClose"${s.keepOnClose ? ' checked' : ''}> <b>쌤비서 창을 닫아도 버튼은 남기기</b> <span class="muted">끄면 창을 닫을 때 버튼도 같이 닫혀요</span></label>
    <label class="set-radio"><input type="checkbox" id="ibSetAuto" data-ib-set="autostart"${s.autostart ? ' checked' : ''}> <b>컴퓨터를 켜면 버튼 띄우기</b> <span class="muted">쌤비서 창은 열지 않고 버튼만 떠요</span></label>` : ''}`);
}

const VIEWS = {
  roster: () => page('학급 명단', '창의적 체험활동·행동특성·평가지 채점이 같은 명단을 써요.',
    card('학생 수와 예외 번호', prepNote() + (SSAM().rosterHTML ? SSAM().rosterHTML() : '')
      + `<div class="row"><button class="btn" type="button" data-set="rosterFile">엑셀·CSV에서 가져오기</button>
        <span class="muted">나이스 학생 명렬표처럼 「번호」 칸이 있는 파일. 번호만 읽고 이름은 저장하지 않아요.</span></div>
        <input type="file" id="rosterFile" accept=".xlsx,.csv,.xls" hidden>`)),
  ai: () => {
    const ready = SSAM().ai && SSAM().ai.engineReady();
    return page('AI', 'Claude·Gemini·GPT·업스테이지 중 하나의 키를 넣어 써요. 키는 이 컴퓨터에만 저장돼요.',
      card('지금 쓰는 AI', `${sharedNote()}${testKeyNote()}<p class="set-big">${esc(ready ? SSAM().ai.engineName() : '아직 정하지 않았어요')}</p>
        <div class="row"><button class="btn primary" type="button" data-set="openAi">AI 바꾸기</button>
          <button class="btn" type="button" data-set="testAi" ${ready && !(aiMsg && aiMsg.busy) ? '' : 'disabled'}>연결 확인</button></div>
        ${aiMsg ? `<p class="set-msg ${aiMsg.busy ? '' : aiMsg.ok ? 'ok' : 'err'}" role="status">${aiMsg.busy ? '확인하는 중…' : esc(aiMsg.text)}</p>` : ''}`) + rolesCards());
  },
  screen: () => {
    const cur = getTheme();
    return page('화면', '고른 테마는 이 컴퓨터에 저장되고 바로 바뀌어요.',
      card('테마', `<div class="theme-grid" role="radiogroup" aria-label="테마">${THEMES.map(t => {
        const [f, p, c, a, l] = PREVIEW[t.id];
        const narrow = t.id === 'rail' ? ' narrow' : '';
        return `<label class="theme-card" data-theme-pick="${t.id}">
          <span class="tp${narrow}" aria-hidden="true" style="--tf:${f};--tp:${p};--tc:${c};--ta:${a};--tl:${l}"><i class="tp-side"></i><i class="tp-top"></i><i class="tp-body"><b></b><b class="acc"></b></i></span>
          <span class="tn"><input type="radio" name="theme" value="${t.id}" ${t.id === cur ? 'checked' : ''}>${esc(t.label)}${t.id === 'dark-nav' ? ' · 기본' : ''}</span>
          <span class="muted">${esc(t.desc)}</span></label>`;
      }).join('')}</div>`) + inboxCard());
  },
  school: () => {
    const s = school || (school = getSchool());
    return page('학교 정보', '연간계획·행사계획이 학교 현황과 방학·재량휴업일을 여기서 가져가요.',
      card('학교', `<div class="set-fields">
          <label class="set-f"><span class="lab">학교명</span><input class="field" id="schName" value="${esc(s.name)}" autocomplete="off"></label>
          <label class="set-f"><span class="lab">계획 학년도</span><input class="field" id="schYear" type="number" min="2020" max="2100" value="${s.year}" aria-describedby="schYearNote"></label>
          <label class="set-f"><span class="lab">학급 수</span><input class="field" id="schClasses" type="number" min="0" value="${s.classes || ''}"></label>
          <label class="set-f"><span class="lab">학생 수</span><input class="field" id="schStudents" type="number" min="0" value="${s.students || ''}"></label>
        </div>
        <p class="muted" id="schYearNote" style="margin:0">계획 학년도는 연간계획을 세울 학년도예요. 10월부터는 다음 학년도로 잡혀요. 자료를 나누는 학년도는 설정 › 학년도에서 바꿔요.</p>`) +
      card('방학·재량휴업일', `<div class="break-list">${s.breaks.map((b, i) => `<div class="break-row">
          <input class="field" data-break="${i}" data-f="label" value="${esc(b.label)}" placeholder="예) 여름방학" aria-label="이름">
          <input class="field" type="date" data-break="${i}" data-f="from" value="${esc(b.from)}" aria-label="시작일">
          <span aria-hidden="true">~</span>
          <input class="field" type="date" data-break="${i}" data-f="to" value="${esc(b.to)}" aria-label="끝일">
          <button class="btn text" type="button" data-set="delBreak" data-i="${i}">빼기</button></div>`).join('') || '<p class="muted">아직 없어요.</p>'}</div>
        <div class="row"><button class="btn text" type="button" data-set="addBreak">+ 더하기</button></div>`) +
      `${msg ? `<p class="set-msg err" role="alert">${esc(msg)}</p>` : ''}<div class="row"><button class="btn primary" type="button" data-set="saveSchool">저장</button></div>`);
  },
  years: () => {
    const cur = curYear();
    const rows = yrList === null ? '<li class="muted">보관한 학년도를 불러오는 중…</li>'
      : yrList.filter(x => x.year !== cur).map(x => `<li class="yr-row" data-yr="${x.year}"><b>${x.year}학년도</b><span class="muted">보관됨 · ${ymd(x.savedAt)} · ${kb(x.size)}</span><span class="grow"></span>
          <button class="btn" type="button" data-set="goYear" data-y="${x.year}">이 학년도로 가기</button><button class="btn text" type="button" data-set="delYear" data-y="${x.year}">지우기</button></li>`).join('');
    return page('학년도', '학년도마다 자료를 따로 두고 오갈 수 있어요. AI 키와 화면 테마는 모든 학년도가 같이 써요.',
      card('지금 학년도', `<p class="set-big">${cur}학년도</p><p class="muted" style="margin:0">자료 ${kb(snapSize(snapshot(safeLS())))} · ${usageLine()}</p>${usageWarn()}`) +
      card('백업 파일', `<p class="muted" style="margin:0">지금 학년도와 보관한 학년도 자료를 파일 하나로 저장해요(AI 키는 넣지 않아요). 앱 안의 보관함은 이 컴퓨터에만 있어서, 컴퓨터를 바꾸거나 프로그램을 지우면 사라져요. 백업 파일을 만들어 두세요.</p>
        <p class="muted" style="margin:0">${backupLine()}</p>
        <div class="row"><button class="btn primary" type="button" data-set="backup">백업 파일 만들기</button><button class="btn" type="button" data-set="restore">백업 파일 불러오기</button></div>
        <input type="file" id="backupFile" accept=".json,application/json" hidden>`) +
      card('학년도 목록', `<ul class="yr-list"><li class="yr-row" data-yr="${cur}"><b>${cur}학년도</b><span class="muted">지금</span></li>${rows}</ul>`) +
      card('새 학년도', `<p class="muted" style="margin:0">학년도가 끝나면 새 학년도를 시작해요. 지금 자료는 보관함에 남고, 연간계획·행사계획은 새 학년도로 가져가요.</p>
        <div class="row"><button class="btn" type="button" data-set="newYear">${(yrList || []).some(x => x.year === cur + 1) ? `${cur + 1}학년도 자료가 이미 있어요 · 그 학년도로 가기` : `${cur + 1}학년도 시작하기`}</button></div>`));
  },
  purchase: () => page('품의 기준', '',
    card('넣는 방식', `<div class="set-radios" role="radiogroup" aria-label="품의 넣는 방식">
        <label class="switch"><input type="radio" name="pcFlow" value="oneshot"${getPurchaseFlow() === 'oneshot' ? ' checked' : ''}>바로 초안 (기본) <span class="muted">넣기 칸에 넣고 [초안 만들기]를 누르면 빈 칸은 AI가 채워 바로 초안을 써요</span></label>
        <label class="switch"><input type="radio" name="pcFlow" value="ask"${getPurchaseFlow() === 'ask' ? ' checked' : ''}>빠진 것만 물어보기 <span class="muted">목적·품목이 없으면 초안 전에 그것만 물어봐요</span></label></div>`)
    + card('계약 기준 금액', `<label class="set-f"><span class="lab">원 (합계가 이 금액을 넘으면 「별도 계약 절차 확인 필요」라고 알려요)</span>
        <input class="field" id="limitWon" type="number" min="1" step="10000" value="${getPurchaseLimit()}"></label>
      <p class="muted">지금: ${won(getPurchaseLimit())}원 · 학교마다 다를 수 있어요. 행정실에 확인해 주세요.</p>
      ${msg ? `<p class="set-msg err" role="alert">${esc(msg)}</p>` : ''}
      <div class="row"><button class="btn primary" type="button" data-set="saveLimit">저장</button></div>`)
    + card('협의회 1인 상한', `<label class="set-f"><span class="lab">원 (협의회 품의에서 1인 단가가 이보다 크면 확인 목록에 알려요)</span>
        <input class="field" id="meetCap" type="number" min="1" step="1000" value="${getMeetCap()}"></label>
      <p class="muted">지금: ${won(getMeetCap())}원 · 교육청·학교마다 달라요(대체로 3만~4만 원). 행정실에 확인해 주세요.</p>
      ${capMsg ? `<p class="set-msg err" role="alert">${esc(capMsg)}</p>` : ''}
      <div class="row"><button class="btn primary" type="button" data-set="saveMeetCap">저장</button></div>`))
};

let curTab = 'roster';
function render(tab, section) {
  if (tab !== curTab) { msg = ''; capMsg = ''; school = null; aiMsg = null; }
  const entering = tab === 'years' && (curTab !== 'years' || yrList === null);
  curTab = tab;
  if (entering) loadYears();
  if (!box || !section.contains(box)) { box = document.createElement('div'); box.className = 'set-box'; section.prepend(box); }
  box.innerHTML = (VIEWS[tab] || VIEWS.roster)();
}
const again = () => box && render(curTab, box.parentElement);

/* 짧은 요청으로 키·모델이 맞는지 확인 (PRD S-2) */
async function testAi() {
  aiMsg = { busy: true }; again();
  try {
    await ai.generate('연결 확인입니다. "확인"이라고만 답하세요.');
    aiMsg = { ok: true, text: `연결됐어요 · ${ai.providerName()}` };
  } catch (e) {
    aiMsg = { ok: false, text: ai.errorMessage(e && e.code, e) };
  }
  if (curTab === 'ai') again();
}

/* ---------- 학년도 ---------- */
/* 1·2월에 지난 학년도에서 명단을 넣으면 새 학년도를 먼저 시작하라고 알림 */
function prepNote() {
  const d = new Date(), today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const cur = curYear(), next = prepYear(today, cur);
  return next ? `<p class="banner warn" style="margin:0 0 8px">${next}학년도 명단이라면 설정 › 학년도에서 새 학년도를 먼저 시작해 주세요. 지금 넣으면 ${cur}학년도 자료에 들어가요. (새 학년도를 시작할 때 「학급 준비도 가져가기」로 옮길 수도 있어요)</p>` : '';
}
/* 이 컴퓨터 저장 공간(사이트마다 약 5MB) 사용량, 70%가 넘으면 경고 */
const usagePct = () => Math.round(usage(safeLS()).ratio * 100);
/* 같은 주소의 다른 페이지가 쓴 몫 (ssam: 로 시작하지 않는 키) */
function otherUse() {
  const ls = safeLS(); let n = 0;
  try { if (ls) for (let i = 0; i < ls.length; i++) { const k = ls.key(i); if (!k.startsWith('ssam:')) n += k.length + String(ls.getItem(k) || '').length; } } catch (e) {}
  return n;
}
const usageLine = () => { const o = otherUse(); return `이 컴퓨터 저장 공간 ${usagePct()}% 사용 (약 5MB 중${o >= 1024 ? ` · 같은 주소의 다른 페이지 ${kb(o)}` : ''})`; };
const usageWarn = () => (usagePct() >= 70 ? '<p class="banner warn" style="margin:8px 0 0">저장 공간이 70% 넘게 찼어요. 백업 파일을 만든 뒤 지난 학년도·단원평가·평가지 채점 기록처럼 쓰지 않는 자료를 지워 주세요.</p>' : '');
function backupLine() {
  const at = sget('backupAt', 0);
  if (!at) return '아직 백업 파일을 만들지 않았어요.';
  const days = Math.floor((Date.now() - at) / 864e5);
  return `마지막 백업: ${days < 1 ? '오늘' : `${days}일 전`}${days > 30 ? ' · 한 달이 넘었어요. 새로 만들어 두세요.' : ''}`;
}
let persistAsked = false;
function loadYears() {
  // 브라우저가 공간이 모자랄 때 보관함(이 사이트 자료)을 먼저 지우지 않게 요청 (학년도 화면을 처음 열 때 한 번)
  if (!persistAsked) { persistAsked = true; try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (e) {} }
  yrList = null;
  getArchive().list().then(l => { yrList = l; }, () => { yrList = []; toast('보관함을 열지 못했어요', 5000); })
    .then(() => { if (curTab === 'years') again(); });
}
/* AI 키를 「기억하기」 없이 넣었으면 학년도를 옮겨 앱을 다시 열 때 키를 다시 넣어야 함 */
const keyNote = () => { try { const e = JSON.parse(localStorage.getItem('ssam:engine') || 'null'); return e && e.remember === false ? '<p class="banner warn" style="margin:0">AI 키를 기억하지 않게 해 두셨어요. 학년도를 옮기면 앱을 다시 여니 키를 다시 넣어야 해요.</p>' : ''; } catch (e) { return ''; } };
const sheetBtns = (okId, okLabel, extra = '') => `<div class="row" style="justify-content:flex-end">${extra}<span class="grow"></span><button class="btn" type="button" data-close>취소</button><button class="btn primary" type="button" id="${okId}">${okLabel}</button></div>`;
const onOk = (id, fn) => sh => {
  sh.querySelector('#' + id).addEventListener('click', fn);
  const b = sh.querySelector('[data-sheet="backup"]'); if (b) b.addEventListener('click', makeBackupFile);
};
async function makeBackupFile() {
  try {
    const cur = curYear(), archives = {};
    // 보관함을 못 열어도(시크릿 창 등) 지금 학년도는 백업함
    let partial = false;
    try { for (const x of await getArchive().list()) if (x.year !== cur) archives[x.year] = await getArchive().get(x.year); }
    catch (e) { partial = true; }
    const b = makeBackup({ current: cur, snap: snapshot(safeLS()), archives });
    const d = new Date(), pad = n => String(n).padStart(2, '0');
    const name = `쌤비서 백업 ${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
    const where = await saveFile(name, new TextEncoder().encode(JSON.stringify(b)), 'application/json');
    sset('backupAt', Date.now());
    if (curTab === 'years') again();
    toast(partial ? '보관함을 열지 못해 지금 학년도만 백업했어요' : window.__TAURI__ ? `다운로드 폴더에 저장했어요: ${String(where).split(/[\\/]/).pop()}` : '백업 파일을 내려받았어요', partial ? 6000 : undefined);
  } catch (e) { toast('백업 파일을 만들지 못했어요', 5000); }
}
async function go(target, data) {
  toast('학년도를 옮기는 중이에요…', 8000);
  const r = await switchYear(target, data);
  if (!r.ok) toast(switchError(r.code), 7000);
}
async function askNewYear() {
  const cur = curYear(), next = cur + 1;
  // 목록을 아직 못 불러왔어도 보관함을 직접 봄 (보관한 그 학년도를 새로 시작해 덮어쓰지 않게)
  let exists = (yrList || []).some(x => x.year === next);
  if (!exists) { try { exists = !!(await getArchive().get(next)); } catch (e) {} }
  if (exists) {
    SSAM().openSheet(`<h3>${next}학년도 자료가 이미 있어요</h3><p class="muted" style="margin:0">보관함에 있는 ${next}학년도로 가요. 지금(${cur}학년도) 자료는 보관함에 남아요.</p>${keyNote()}${sheetBtns('yrGoOk', '그 학년도로 가기')}`,
      onOk('yrGoOk', () => { SSAM().closeSheet(); go(next); }));
    return;
  }
  SSAM().openSheet(`<h3>${next}학년도를 시작할까요?</h3>
    <p class="muted" style="margin:0">${cur}학년도 자료는 보관함에 그대로 남고, 언제든 돌아올 수 있어요. 백업 파일도 만들어 두면 좋아요.</p>
    <ul class="yr-sum"><li><b>가져가는 것</b> 연간계획·행사계획(내년 계획의 작년 자료로), 학사일정 중 ${next}학년도(3월 1일부터) 날짜, 학교명·학급 수·학생 수, 평어·행특·채점·나이스 입력 설정, 품의 기준 금액</li>
      <li><b>비우는 것</b> 학급 명단, 평가 자료(평가계획·평어·창체·행특·채점 결과), 학급 메뉴(시간표·진도표·체크·주간학습안내), 작성 중인 품의</li></ul>
    <label class="switch"><input type="checkbox" id="yrClassToo">학급 준비도 가져가기: 학급 명단·학년 반·시간표·진도표 (2월에 ${next}학년도 준비를 미리 넣었을 때. 진도는 처음부터, 체크는 비워요)</label>
    ${keyNote()}${sheetBtns('yrNewOk', `${next}학년도 시작하기`, '<button class="btn" type="button" data-sheet="backup">백업 파일 만들기</button>')}`,
  sh => sh.querySelector('#yrNewOk').addEventListener('click', () => {
    const classSetup = sh.querySelector('#yrClassToo').checked;
    SSAM().closeSheet(); go(next, carryOver(snapshot(safeLS()), next, { classSetup }));
  }));
}
function askGo(y) {
  SSAM().openSheet(`<h3>${y}학년도로 갈까요?</h3><p class="muted" style="margin:0">지금(${curYear()}학년도) 자료는 보관함에 남아요. 앱을 다시 열어요.</p>${keyNote()}${sheetBtns('yrGoOk', `${y}학년도로 가기`)}`,
    onOk('yrGoOk', () => { SSAM().closeSheet(); go(y); }));
}
function askDel(y) {
  SSAM().openSheet(`<h3>${y}학년도 보관 자료를 지울까요?</h3><p class="muted" style="margin:0">지우면 되돌릴 수 없어요. 먼저 백업 파일을 만들어 두세요.</p>
    ${sheetBtns('yrDelOk', '지우기', '<button class="btn" type="button" data-sheet="backup">백업 파일 만들기</button>')}`,
  onOk('yrDelOk', async () => {
    SSAM().closeSheet();
    try { await getArchive().del(y); toast(`${y}학년도 보관 자료를 지웠어요`); } catch (e) { toast('지우지 못했어요', 5000); }
    loadYears();
  }));
}
async function restoreFile(file) {
  let r;
  try { r = parseBackup(await file.text()); } catch (e) { toast('쌤비서 백업 파일이 아니에요', 6000); return; }
  const cur = curYear(), years = Object.keys(r.years).map(Number).sort((a, b) => b - a);
  // 지금 학년도에 자료가 있으면 미리 체크하지 않음 (더 새로운 지금 자료를 실수로 덮어쓰지 않게)
  const liveEmpty = !Object.keys(snapshot(safeLS())).length;
  if (!years.length) { toast('백업 파일에 학년도 자료가 없어요', 5000); return; }
  SSAM().openSheet(`<h3>백업 파일에서 불러올 학년도</h3>
    <p class="muted" style="margin:0">「${esc(file.name)}」</p>
    <ul class="yr-pick">${years.map(y => `<li><label><input type="checkbox" data-ry="${y}"${y !== cur || liveEmpty ? ' checked' : ''}> <b>${y}학년도</b>
      <span class="muted">${y === cur ? '지금 자료를 파일 내용으로 바꿔요 — 파일보다 새로 쓴 자료는 사라져요' : (yrList || []).some(x => x.year === y) ? '보관함의 자료를 바꿔요' : '보관함에 넣어요'}</span></label></li>`).join('')}</ul>
    ${sheetBtns('yrRestoreOk', '불러오기')}`,
  onOk('yrRestoreOk', async () => {
    const pick = [...document.querySelectorAll('#sheetRoot [data-ry]')].filter(c => c.checked).map(c => +c.dataset.ry);
    if (!pick.length) { toast('학년도를 하나 이상 골라 주세요'); return; }
    SSAM().closeSheet();
    try { for (const y of pick) if (y !== cur) await getArchive().put(y, r.years[y]); }
    catch (e) { toast('보관함에 넣지 못했어요', 6000); return; }
    if (pick.includes(cur)) { go(cur, r.years[cur]); return; }
    toast(`${pick.join(', ')}학년도를 보관함에 넣었어요`);
    loadYears();
    // 백업 파일의 지금 학년도가 이 앱과 다르면(새 컴퓨터로 옮길 때 등) 그 학년도로 갈지 물어봄
    if (r.current && r.current !== cur && pick.includes(r.current)) {
      SSAM().openSheet(`<h3>${r.current}학년도로 갈까요?</h3><p class="muted" style="margin:0">백업 파일의 지금 학년도는 ${r.current}학년도예요. 이 앱은 ${cur}학년도예요. 가면 ${cur}학년도 자료는 보관함에 남아요.</p>${keyNote()}${sheetBtns('yrGoOk', `${r.current}학년도로 가기`)}`,
        onOk('yrGoOk', () => { SSAM().closeSheet(); go(r.current); }));
    }
  }));
}

/* 명렬표 엑셀·CSV → 미리 보기 → 넣기 (번호만) */
async function importRoster(file) {
  if (/\.xls$/i.test(file.name)) { toast('엑셀에서 .xlsx로 다시 저장해 주세요', 5000); return; }
  let r = null;
  try { r = parseRoster(await readTable(file.name, new Uint8Array(await file.arrayBuffer()))); }
  catch (e) { toast('파일을 읽지 못했어요. 엑셀(.xlsx)이나 CSV 파일인지 확인해 주세요', 5000); return; }
  if (!r) { toast('번호 칸을 찾지 못했어요. 첫 줄에 「번호」가 있는 명렬표인지 확인해 주세요', 6000); return; }
  SSAM().openSheet(`<h3>이 명단으로 바꿀까요?</h3>
    <p class="set-big">학생 ${r.count}명${r.except.length ? ` · 예외 번호 ${r.except.join(', ')}` : ''}</p>
    <p class="muted" style="margin:0">「${esc(file.name)}」에서 번호만 읽었어요. 예외 번호는 전출 등으로 나이스에 칸이 없는 번호예요. 창체·행특·평가지 채점이 같은 명단을 써요.</p>
    <div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-close>취소</button><button class="btn primary" type="button" id="rosterOk">넣기</button></div>`,
  sh => sh.querySelector('#rosterOk').addEventListener('click', () => {
    SSAM().closeSheet();
    if (SSAM().setClass) SSAM().setClass(r.count, r.except);
    if (curTab === 'roster') again();
    toast(`학생 ${r.count}명으로 정했어요${r.except.length ? ` · ${r.except.join(', ')}번 제외` : ''}`);
  }));
}

/* 화면의 방학 칸을 school.breaks로 읽어 옴 (저장 전 편집 상태 유지) */
function readBreaks() {
  const rows = [];
  box.querySelectorAll('[data-break]').forEach(el => { const i = +el.dataset.break; (rows[i] || (rows[i] = {}))[el.dataset.f] = el.value; });
  return rows.filter(Boolean).map(r => ({ label: r.label || '', from: r.from || '', to: r.to || '' }));
}
function readSchool() {
  return { name: box.querySelector('#schName').value, year: +box.querySelector('#schYear').value, classes: box.querySelector('#schClasses').value, students: box.querySelector('#schStudents').value, breaks: readBreaks() };
}

document.addEventListener('click', e => {
  if (!box || !box.contains(e.target)) return;
  const b = e.target.closest('[data-set]');
  if (b) {
    const a = b.dataset.set;
    if (a === 'openAi') { aiMsg = null; SSAM().ai.openSettings(); }
    else if (a === 'testAi') testAi();
    else if (a === 'resetRoles') { resetRoles(); again(); toast('업무별 AI를 기본으로 되돌렸어요'); }
    else if (a === 'rosterFile') box.querySelector('#rosterFile').click();
    else if (a === 'backup') makeBackupFile();
    else if (a === 'restore') box.querySelector('#backupFile').click();
    else if (a === 'newYear') askNewYear();
    else if (a === 'goYear') askGo(+b.dataset.y);
    else if (a === 'delYear') askDel(+b.dataset.y);
    else if (a === 'addBreak') { school = { ...readSchool(), breaks: [...readBreaks(), { label: '', from: '', to: '' }] }; again(); }
    else if (a === 'delBreak') { const br = readBreaks(); br.splice(+b.dataset.i, 1); school = { ...readSchool(), breaks: br }; again(); }
    else if (a === 'saveSchool') {
      const s = readSchool();
      const bad = s.breaks.find(x => x.from && x.to && x.from > x.to);
      const empty = s.breaks.find(x => !x.from || !x.to);
      if (bad) { msg = `「${bad.label || '이름 없는 기간'}」의 시작일이 끝일보다 늦어요.`; school = s; again(); return; }
      if (empty) { msg = `「${empty.label || '이름 없는 기간'}」의 시작일과 끝일을 모두 넣어 주세요.`; school = s; again(); return; }
      const saved = setSchool(s);
      if (!saved) { msg = FULL; school = s; again(); return; }
      msg = ''; school = saved; again(); toast('학교 정보를 저장했어요');
    } else if (a === 'saveMeetCap') {
      const r = setMeetCap(box.querySelector('#meetCap').value);
      if (r === 'full') { capMsg = FULL; again(); return; }
      if (!r) { capMsg = '1인 상한은 1원 이상으로 넣어 주세요.'; again(); return; }
      capMsg = ''; again(); toast(`협의회 1인 상한을 ${won(getMeetCap())}원으로 정했어요`);
    } else if (a === 'saveLimit') {
      const v = box.querySelector('#limitWon').value;
      const r = setPurchaseLimit(v);
      if (r === 'full') { msg = FULL; again(); return; }
      if (!r) { msg = '기준 금액은 1원 이상으로 넣어 주세요.'; again(); return; }
      msg = ''; again(); toast(`계약 기준 금액을 ${won(getPurchaseLimit())}원으로 정했어요`);
    }
    return;
  }
  const pick = e.target.closest('[data-theme-pick]');
  if (pick) {
    setTheme(pick.dataset.themePick);
    box.querySelectorAll('[data-theme-pick] input').forEach(i => { i.checked = i.value === pick.dataset.themePick; });
  }
});

document.addEventListener('change', e => {
  const ib = e.target.dataset && e.target.dataset.ibSet;
  if (ib && box && box.contains(e.target)) { setInboxSettings({ [ib]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }); toast('떠 있는 버튼 설정을 바꿨어요'); return; }
  if (box && e.target.name === 'pcFlow' && box.contains(e.target)) { setPurchaseFlow(e.target.value); toast('품의 넣는 방식을 바꿨어요'); return; }
  if (box && e.target.id === 'setReviewAi' && box.contains(e.target)) { setDefaultReview(aiFromValue(e.target.value)); again(); toast('기본 검토 AI를 저장했어요'); return; }
  if (!box || !box.contains(e.target) || !['rosterFile', 'backupFile'].includes(e.target.id)) return;
  const f = e.target.files[0], id = e.target.id; e.target.value = '';
  if (f) (id === 'rosterFile' ? importRoster : restoreFile)(f);
});

// AI 창(평어 쓰는 방식)을 닫으면 설정 › AI의 요약을 다시 그림
const sheetRoot = document.getElementById('sheetRoot');
if (sheetRoot) new MutationObserver(() => {
  if (!sheetRoot.childElementCount && curTab === 'ai' && box && box.isConnected && !box.parentElement.hidden) again();
}).observe(sheetRoot, { childList: true });

onEnter('settings', render);

/* 떠 있는 버튼: 학급 명단(명렬표 엑셀·CSV) → 설정 › 학급 명단 확인 창 */
registerInbox('roster', {
  one: true,
  act: () => '설정 › 학급 명단으로 넣기 (번호만 읽어요)',
  async run(files) {
    goMenu('settings', 'roster');
    await importRoster(files[0]);
    return '';
  }
});
