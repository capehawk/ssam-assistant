/* 업무별 AI: 업무(채점·평어·계획·피드백·품의)마다 쓰는 AI(메인)와, 켜면 한 번 더 보는 AI(검토).
   저장은 회사·모델 이름만(키는 설정 › AI에 그대로). 키가 없는 회사·Claude 계정이면 기본 AI로 */
import * as store from './store.js';

export const TASKS = [['grade', '채점'], ['writing', '평어·행특·창체'], ['plan', '계획 초안'], ['notes', '피드백·알림'], ['purchase', '품의'], ['message', '쪽지'], ['report', '결과 보고'], ['letter', '가정통신문'], ['gongmun', '공문 처리'], ['reply', '회신서 읽기']];
const KEY = 'ai-roles';
const ENGINES = ['claude', 'gemini', 'openai', 'upstage'];
const TASK_IDS = TASKS.map(t => t[0]);
/* 검토 AI가 없는 업무(쪽지는 칸만 뽑고 글은 앱이 맞춤 — 스펙 2026-11-02 4장) */
const NO_REVIEW = ['message', 'report', 'letter', 'gongmun', 'reply'];
export const hasReview = task => TASK_IDS.includes(task) && !NO_REVIEW.includes(task);

const normAI = a => (a && ENGINES.includes(a.engine) && typeof a.model === 'string' && a.model.trim() ? { engine: a.engine, model: a.model.trim() } : null);
const blank = () => ({ main: null, reviewOn: false, review: null });

export function getRoles() {
  const v = store.get(KEY, null) || {};
  const tasks = {};
  for (const t of TASK_IDS) {
    const x = (v.tasks && v.tasks[t]) || {};
    tasks[t] = { main: normAI(x.main), reviewOn: x.reviewOn === true, review: normAI(x.review) };
  }
  return { review: normAI(v.review), tasks };
}
const save = r => store.set(KEY, r);

export function setTaskRole(task, patch) {
  if (!TASK_IDS.includes(task)) return;
  const r = getRoles();
  const cur = r.tasks[task];
  if ('main' in patch) cur.main = normAI(patch.main);
  if ('reviewOn' in patch) cur.reviewOn = !!patch.reviewOn && hasReview(task);
  if ('review' in patch) cur.review = normAI(patch.review);
  save(r);
}
export function setDefaultReview(ai) { const r = getRoles(); r.review = normAI(ai); save(r); }
export function resetRoles() {
  save({ review: null, tasks: Object.fromEntries(TASK_IDS.map(t => [t, blank()])) });
}

/* 지금 넣은 키·모델 목록 (평가 메뉴의 SSAM.ai에서). 키 값은 가져오지 않고 있는지만 */
export function providerEnv() {
  const a = globalThis.window && window.SSAM && window.SSAM.ai;
  const cur = a && a.current ? a.current() : { engine: null };
  const list = a && a.providers ? a.providers() : [];
  const env = { engine: cur.engine, current: cur, keys: {}, models: {}, labels: {}, modelLabels: {} };
  for (const p of list) {
    env.keys[p.id] = !!p.hasKey;
    env.models[p.id] = p.models.map(m => m[0]);
    env.labels[p.id] = p.name || p.label;
    for (const [id, l] of p.models) env.modelLabels[id] = l;
  }
  return env;
}

/* 쓸 수 있는 AI: 그 회사 키가 있고, 모델이 그 회사 목록(설정 › AI에 직접 넣은 모델 포함)에 있음 */
const usable = (ai, env) => !!(ai && env.keys && env.keys[ai.engine] && (env.models[ai.engine] || []).includes(ai.model));

/* 업무의 메인·검토 AI. null이면 메인은 기본 AI, 검토는 하지 않음 */
export function pick(task, role, env = providerEnv()) {
  if (!TASK_IDS.includes(task) || !env || env.engine === 'account') return null;
  const r = getRoles(), t = r.tasks[task];
  if (role === 'main') return usable(t.main, env) ? t.main : null;
  if (role !== 'review' || !t.reviewOn || !hasReview(task)) return null;
  if (usable(t.review, env)) return t.review;
  return usable(r.review, env) ? r.review : null;
}

/* 'Claude Opus 5.5'처럼: 모델 이름표의 ' · ' 앞, 모르는 모델이면 회사 이름 + 모델 */
export function aiLabel(ai, env = providerEnv()) {
  if (!ai) return '';
  const l = env.modelLabels && env.modelLabels[ai.model];
  if (l) return l.split(' · ')[0];
  return `${(env.labels && env.labels[ai.engine]) || ai.engine} ${ai.model}`;
}

/* ---------- 메뉴의 AI 줄 ---------- */
const TASK_NAME = Object.fromEntries(TASKS);
export const aiValue = ai => (ai ? `${ai.engine}|${ai.model}` : '');
/* 'engine|model' → AI (모르는 회사·빈 값이면 null) */
export const aiFromValue = v => { v = String(v || ''); const i = v.indexOf('|'); return i > 0 ? normAI({ engine: v.slice(0, i), model: v.slice(i + 1) }) : null; };
const fromVal = aiFromValue;
const defaultLabel = env => (env.current && env.current.engine && env.keys[env.current.engine] ? aiLabel(env.current, env) : '');

/* 키를 넣은 회사의 모델들: [{ value: 'engine|model', label }] */
export function aiOptions(env = providerEnv()) {
  const out = [];
  for (const e of ENGINES) if (env.keys[e]) for (const m of env.models[e] || []) out.push({ value: `${e}|${m}`, label: aiLabel({ engine: e, model: m }, env) });
  return out;
}

/* 'AI: Claude Sonnet 5.5 · 검토 끔' — 업무에 정한 회사의 키가 없으면 「키가 없어 기본 AI로」 */
export function rowText(task, env = providerEnv()) {
  if (env.engine === 'account') return 'AI: Claude 계정 하나로';
  const r = getRoles(), t = r.tasks[task];
  if (!t) return '';
  const main = pick(task, 'main', env);
  const dflt = defaultLabel(env);
  let s = `AI: ${main ? aiLabel(main, env) : dflt || '아직 정하지 않았어요'}`;
  // 시험용 업스테이지(Windows 앱, 내 업스테이지 키 없음)로 부르면 표시
  const tk = globalThis.window && window.SSAM && window.SSAM.ai && window.SSAM.ai.testKey ? window.SSAM.ai.testKey() : null;
  if (tk && tk.on && !tk.own && (main ? main.engine : env.engine) === 'upstage' && (main || dflt)) s += ' (시험용)';
  if (t.main && !main) s += env.keys[t.main.engine] ? ' (쓸 수 없는 모델이라 기본 AI로)' : ' (키가 없어 기본 AI로)';
  if (!hasReview(task)) return s;
  if (!t.reviewOn) return s + ' · 검토 끔';
  const rv = pick(task, 'review', env);
  return s + (rv ? ` · 검토: ${aiLabel(rv, env)}` : ' · 검토: 검토 AI를 골라 주세요');
}

export const aiRowHTML = task => `<div class="ai-row" data-ai-row="${task}"></div>`;
const escH = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* 화면에 있는 AI 줄 자리를 모두 채움(글이 같으면 그대로) */
export function fillRows(root = globalThis.document) {
  if (!root || !root.querySelectorAll) return;
  const els = root.querySelectorAll('[data-ai-row]');
  if (!els.length) return;
  const env = providerEnv();
  const texts = {};
  els.forEach(el => {
    const task = el.dataset.aiRow;
    if (!TASK_NAME[task]) return;
    const text = texts[task] || (texts[task] = rowText(task, env));
    if (el.dataset.aiV === text) return;
    el.dataset.aiV = text;
    el.innerHTML = `<span class="ai-row-t">${escH(text)}</span>${env.engine === 'account' ? '' : `<button class="btn text tiny" type="button" data-ai-edit="${task}" aria-label="${escH(TASK_NAME[task])} AI 바꾸기">바꾸기</button>`}`;
  });
}

/* 업무의 AI 창: 이 업무의 AI · 검토 켜기 · 검토 AI */
export function openRoleSheet(task) {
  const S = window.SSAM || {};
  if (!S.openSheet || !TASK_NAME[task]) return;
  const env = providerEnv(), r = getRoles(), t = r.tasks[task];
  const opts = aiOptions(env);
  const dflt = defaultLabel(env), dRv = usable(r.review, env) ? aiLabel(r.review, env) : '';
  const optHTML = cur => opts.map(o => `<option value="${escH(o.value)}"${o.value === cur ? ' selected' : ''}>${escH(o.label)}</option>`).join('');
  const mainV = usable(t.main, env) ? aiValue(t.main) : '';
  const rvV = usable(t.review, env) ? aiValue(t.review) : '';
  S.openSheet(`<div id="aiRoleSheet" class="ai-role-sheet"><h3>${escH(TASK_NAME[task])} AI</h3>
    <label class="ar-f"><span class="lab">이 업무의 AI</span>
      <select class="field" id="arMain"><option value="">기본 AI 따름 (지금: ${escH(dflt || '정하지 않음')})</option>${optHTML(mainV)}</select></label>
    ${t.main && !usable(t.main, env) ? `<p class="muted warn" style="margin:0">정해 둔 ${escH(aiLabel(t.main, env))}는 ${env.keys[t.main.engine] ? '이제 쓸 수 없는 모델이라' : '키가 없어'} 기본 AI로 써요.</p>` : ''}
    <label class="switch"${hasReview(task) ? '' : ' hidden'}><input type="checkbox" id="arReviewOn"${t.reviewOn && hasReview(task) ? ' checked' : ''}>검토 AI로 한 번 더 보기</label>
    <label class="ar-f" id="arReviewF"><span class="lab">검토 AI</span>
      <select class="field" id="arReview"><option value="">기본 검토 AI 따름 (지금: ${escH(dRv || '정하지 않음')})</option>${optHTML(rvV)}</select></label>
    <p class="muted" id="arNote" style="margin:0"></p>
    <p class="muted" style="margin:0">키를 넣은 회사만 고를 수 있어요. 키는 설정 › AI에서 넣어요.</p>
    <div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-close>취소</button><button class="btn primary" type="button" id="arSave">저장</button></div></div>`, sh => {
    const q = id => sh.querySelector('#' + id);
    const note = () => {
      const on = q('arReviewOn').checked;
      q('arReviewF').hidden = !on;
      const main = fromVal(q('arMain').value) || (env.current && env.current.engine ? env.current : null);
      const rv = fromVal(q('arReview').value) || (usable(r.review, env) ? r.review : null);
      const out = [];
      if (on) {
        out.push('검토를 켜면 AI 사용량이 대략 1.2~1.5배예요.');
        if (!rv) out.push('검토 AI를 골라 주세요. 고르기 전에는 검토하지 않아요.');
        else if (task === 'grade' && main && rv.engine !== main.engine) out.push('학생 답안 그림(이름 가림)이 두 회사로 가요.');
      }
      q('arNote').textContent = out.join(' ');
    };
    ['arMain', 'arReviewOn', 'arReview'].forEach(id => q(id).addEventListener('change', note));
    note();
    q('arSave').addEventListener('click', () => {
      setTaskRole(task, { main: fromVal(q('arMain').value), reviewOn: q('arReviewOn').checked, review: fromVal(q('arReview').value) });
      S.closeSheet && S.closeSheet();
      fillRows();
      S.toast && S.toast(`${TASK_NAME[task]} AI를 저장했어요`);
    });
  });
}

const CSS = `.ai-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:12.5px;color:var(--ink3);margin:6px 0}
.ai-row:empty{display:none}.ai-row-t{font-weight:500}
.ai-role-sheet{display:flex;flex-direction:column;gap:10px}.ar-f{display:flex;flex-direction:column;gap:4px}.ar-f .field{width:100%;box-sizing:border-box}.ar-f[hidden]{display:none}
.set-roles{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}.set-roles li{display:flex;gap:10px;flex-wrap:wrap}.set-roles b{min-width:110px}`;

if (globalThis.window && globalThis.document) {
  window.SSAM = window.SSAM || {};
  window.SSAM.aiRoles = { pick: (task, role) => pick(task, role), fillRows };
  if (!document.getElementById('aiRolesCss')) { const st = document.createElement('style'); st.id = 'aiRolesCss'; st.textContent = CSS; document.head.appendChild(st); }
  let queued = false;
  const later = () => { if (queued) return; queued = true; Promise.resolve().then(() => { queued = false; fillRows(); }); };
  new MutationObserver(later).observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('storage', later);
  later();
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-ai-edit]');
    if (b) { e.preventDefault(); openRoleSheet(b.dataset.aiEdit); }
  });
}
