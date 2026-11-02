// 업무별 AI: 업무마다 메인 AI, 켜면 검토 AI. 키가 없는 회사·account면 기본(null)
import test from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../../web/core/store.js';
import { TASKS, getRoles, setTaskRole, setDefaultReview, resetRoles, pick, aiLabel, rowText, aiOptions, aiFromValue } from '../../web/core/ai-roles.js';
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

test('모르는 모델(목록에서 빠짐)이면 기본으로, 설정 › AI에 직접 넣은 모델(목록에 있음)은 씀', () => {
  resetRoles();
  setTaskRole('plan', { main: { engine: 'claude', model: 'claude-old-1' }, reviewOn: true, review: { engine: 'claude', model: 'claude-old-1' } });
  assert.equal(pick('plan', 'main', env()), null);
  assert.equal(pick('plan', 'review', env()), null);
  const e = env({ models: { ...env().models, claude: [...env().models.claude, 'claude-new-9'] } });
  setTaskRole('plan', { main: { engine: 'claude', model: 'claude-new-9' } });
  assert.deepEqual(pick('plan', 'main', e), { engine: 'claude', model: 'claude-new-9' });
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

test('AI 줄 글: 기본·업무 AI·검토 끔/켬·검토 AI 없음·키 없음·Claude 계정', () => {
  const e = env({ current: { engine: 'claude', model: 'claude-sonnet-5-5' }, labels: { claude: 'Claude', gemini: 'Gemini', openai: 'GPT' }, modelLabels: { 'claude-sonnet-5-5': 'Claude Sonnet 5.5 · 추천', 'claude-opus-5-5': 'Claude Opus 5.5 · 가장 꼼꼼', 'gemini-3.8-flash': 'Gemini 3.8 Flash · 추천' } });
  resetRoles();
  assert.equal(rowText('grade', e), 'AI: Claude Sonnet 5.5 · 검토 끔');
  setTaskRole('grade', { main: OPUS, reviewOn: true, review: OPUS });
  assert.equal(rowText('grade', e), 'AI: Claude Opus 5.5 · 검토: Claude Opus 5.5');
  setTaskRole('grade', { review: null });
  assert.equal(rowText('grade', e), 'AI: Claude Opus 5.5 · 검토: 검토 AI를 골라 주세요');
  setTaskRole('grade', { main: GEM, reviewOn: false });
  assert.equal(rowText('grade', e), 'AI: Claude Sonnet 5.5 (키가 없어 기본 AI로) · 검토 끔');
  assert.equal(rowText('grade', { ...e, engine: 'account' }), 'AI: Claude 계정 하나로');
  setTaskRole('grade', { main: { engine: 'claude', model: 'claude-old-1' } });
  assert.equal(rowText('grade', e), 'AI: Claude Sonnet 5.5 (쓸 수 없는 모델이라 기본 AI로) · 검토 끔');
});

test('고를 수 있는 AI: 키를 넣은 회사의 모델만, 값은 engine|model', () => {
  const o = aiOptions(env({ labels: { claude: 'Claude', openai: 'GPT' }, modelLabels: {} }));
  assert.ok(o.every(x => /^(claude|openai)\|/.test(x.value)), JSON.stringify(o));
  assert.ok(o.some(x => x.value === 'claude|claude-opus-5-5'));
  assert.deepEqual(aiFromValue('claude|claude-opus-5-5'), OPUS);
  assert.equal(aiFromValue(''), null);
  assert.equal(aiFromValue('zzz|x'), null);
});
