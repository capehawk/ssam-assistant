/* 업무별 AI: 업무(채점·평어·계획·피드백)마다 쓰는 AI(메인)와, 켜면 한 번 더 보는 AI(검토).
   저장은 회사·모델 이름만(키는 설정 › AI에 그대로). 키가 없는 회사·Claude 계정이면 기본 AI로 */
import * as store from './store.js';

export const TASKS = [['grade', '채점'], ['writing', '평어·행특·창체'], ['plan', '계획 초안'], ['notes', '피드백·알림']];
const KEY = 'ai-roles';
const ENGINES = ['claude', 'gemini', 'openai', 'upstage'];
const TASK_IDS = TASKS.map(t => t[0]);

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
  if ('reviewOn' in patch) cur.reviewOn = !!patch.reviewOn;
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

const usable = (ai, env) => !!(ai && env.keys && env.keys[ai.engine]);

/* 업무의 메인·검토 AI. null이면 메인은 기본 AI, 검토는 하지 않음 */
export function pick(task, role, env = providerEnv()) {
  if (!TASK_IDS.includes(task) || !env || env.engine === 'account') return null;
  const r = getRoles(), t = r.tasks[task];
  if (role === 'main') return usable(t.main, env) ? t.main : null;
  if (role !== 'review' || !t.reviewOn) return null;
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

if (globalThis.window) {
  window.SSAM = window.SSAM || {};
  window.SSAM.aiRoles = { pick: (task, role) => pick(task, role) };
}
