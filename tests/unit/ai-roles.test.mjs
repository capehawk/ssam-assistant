// 업무별 AI: 업무마다 메인 AI, 켜면 검토 AI. 키가 없는 회사·account면 기본(null)
import test from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../../web/core/store.js';
import { TASKS, getRoles, setTaskRole, setDefaultReview, resetRoles, pick, aiLabel } from '../../web/core/ai-roles.js';
import { isYearKey } from '../../web/core/years.js';

function mem() { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; }
store.useStorage(mem());
const OPUS = { engine: 'claude', model: 'claude-opus-5-5' };
const GEM = { engine: 'gemini', model: 'gemini-3.8-flash' };
const env = (over = {}) => ({
  engine: 'claude',
  keys: { claude: true, gemini: false, openai: true, upstage: false },
  models: { claude: ['claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-opus-5-5'], gemini: ['gemini-3.8-flash'], openai: ['gpt-6-luna'], upstage: ['solar-pro3'] },
  ...over
});

test('업무 4개', () => {
  assert.deepEqual(TASKS.map(t => t[0]), ['grade', 'writing', 'plan', 'notes']);
});

test('처음: 업무 4개 모두 기본, 검토 꺼짐, 기본 검토 AI 없음', () => {
  resetRoles();
  const r = getRoles();
  assert.equal(r.review, null);
  for (const [t] of TASKS) assert.deepEqual(r.tasks[t], { main: null, reviewOn: false, review: null });
});

test('모르는 업무 키·잘못된 AI는 버림', () => {
  store.set('ai-roles', { review: { engine: 'zzz', model: 'x' }, tasks: { grade: { main: { engine: 'claude' }, reviewOn: 'yes', review: OPUS }, foo: { main: OPUS } } });
  const r = getRoles();
  assert.equal(r.review, null);
  assert.deepEqual(r.tasks.grade, { main: null, reviewOn: false, review: OPUS });
  assert.ok(!('foo' in r.tasks));
});

test('setTaskRole·setDefaultReview 저장, resetRoles는 모두 기본', () => {
  resetRoles();
  setTaskRole('grade', { main: OPUS });
  setTaskRole('grade', { reviewOn: true });
  setDefaultReview(GEM);
  let r = getRoles();
  assert.deepEqual(r.tasks.grade, { main: OPUS, reviewOn: true, review: null });
  assert.deepEqual(r.review, GEM);
  assert.equal(store.get('ai-roles').tasks.grade.main.model, 'claude-opus-5-5');
  resetRoles();
  r = getRoles();
  assert.equal(r.review, null);
  assert.deepEqual(r.tasks.grade, { main: null, reviewOn: false, review: null });
});

test('pick main: 정하지 않음 → null, 키 있음 → 그것, 키 없음 → null(기본으로)', () => {
  resetRoles();
  assert.equal(pick('grade', 'main', env()), null);
  setTaskRole('grade', { main: OPUS });
  assert.deepEqual(pick('grade', 'main', env()), OPUS);
  assert.equal(pick('grade', 'main', env({ keys: { claude: false } })), null);
  setTaskRole('grade', { main: GEM });
  assert.equal(pick('grade', 'main', env()), null, 'Gemini 키 없음');
  assert.equal(pick('writing', 'main', env()), null, '다른 업무는 기본');
});

test('pick review: 꺼짐 → null, 업무 review → 기본 검토 AI → null, 업무 review 키 없으면 기본으로', () => {
  resetRoles();
  setTaskRole('grade', { review: OPUS });
  assert.equal(pick('grade', 'review', env()), null, '검토 꺼짐');
  setTaskRole('grade', { reviewOn: true });
  assert.deepEqual(pick('grade', 'review', env()), OPUS);
  setTaskRole('grade', { review: null });
  assert.equal(pick('grade', 'review', env()), null, '검토 AI가 없음');
  setDefaultReview({ engine: 'openai', model: 'gpt-6-luna' });
  assert.deepEqual(pick('grade', 'review', env()), { engine: 'openai', model: 'gpt-6-luna' }, '기본 검토 AI');
  setTaskRole('grade', { review: GEM });
  assert.deepEqual(pick('grade', 'review', env()), { engine: 'openai', model: 'gpt-6-luna' }, 'Gemini 키 없음 → 기본 검토');
  setDefaultReview(GEM);
  assert.equal(pick('grade', 'review', env()), null, '기본 검토 AI도 키 없음');
});

test('account 엔진이면 main·review 모두 null', () => {
  resetRoles();
  setTaskRole('grade', { main: OPUS, reviewOn: true, review: OPUS });
  assert.equal(pick('grade', 'main', env({ engine: 'account' })), null);
  assert.equal(pick('grade', 'review', env({ engine: 'account' })), null);
});

test('모델 목록에 없는 모델(직접 입력)이어도 키가 있으면 씀', () => {
  resetRoles();
  setTaskRole('plan', { main: { engine: 'claude', model: 'claude-new-9' } });
  assert.deepEqual(pick('plan', 'main', env()), { engine: 'claude', model: 'claude-new-9' });
});

test('모르는 업무·역할 → null', () => {
  assert.equal(pick('zzz', 'main', env()), null);
  assert.equal(pick('grade', 'zzz', env()), null);
});

test('aiLabel: 회사 모델이름', () => {
  const e = env({ labels: { claude: 'Claude', gemini: 'Gemini' }, modelLabels: { 'claude-opus-5-5': 'Claude Opus 5.5 · 가장 꼼꼼' } });
  assert.equal(aiLabel(OPUS, e), 'Claude Opus 5.5');
  assert.equal(aiLabel({ engine: 'claude', model: 'claude-new-9' }, e), 'Claude claude-new-9');
  assert.equal(aiLabel(null, e), '');
});

test('ai-roles는 학년도와 상관없음', () => {
  assert.equal(isYearKey('ai-roles'), false);
});
