// 품의 보관: 저장한 템플릿(일시 비움·50개·이름 바꾸기·지우기), 최근 작성(같은 품의는 그 자리·20개), 망가진 값
import test from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../../web/core/store.js';
import { listTemplates, saveTemplate, renameTemplate, deleteTemplate, templateForm, listRecent, pushRecent, deleteRecent } from '../../web/menus/purchase/library.js';

function mem() { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; }
store.useStorage(mem());
const form = { type: 'goods', project: '과학 실험 재료', date: '2026-11-10', items: [{ name: '비커', qty: '8', price: '4500' }] };

test('템플릿: 저장하면 일시는 비우고, 이름이 없으면 사업명', () => {
  const t = saveTemplate('', form);
  assert.equal(t.name, '과학 실험 재료');
  assert.equal(listTemplates().length, 1);
  assert.equal(listTemplates()[0].form.date, '');
  assert.equal(listTemplates()[0].form.items[0].qty, '8');
  assert.equal(templateForm(listTemplates()[0]).date, '');
});

test('템플릿: 이름 바꾸기·지우기, 빈 이름은 안 바꿈', () => {
  const id = listTemplates()[0].id;
  assert.ok(renameTemplate(id, '실험 재료(5학년)'));
  assert.equal(listTemplates()[0].name, '실험 재료(5학년)');
  assert.equal(renameTemplate(id, '  '), false);
  deleteTemplate(id);
  assert.equal(listTemplates().length, 0);
});

test('템플릿: 50개까지(오래된 것부터 뺌)', () => {
  for (let i = 0; i < 51; i++) saveTemplate('t' + i, form);
  const l = listTemplates();
  assert.equal(l.length, 50);
  assert.equal(l[0].name, 't50');
  assert.ok(!l.some(t => t.name === 't0'));
});

test('최근 작성: 같은 품의는 그 자리를 고쳐 맨 앞으로, 20개까지, 지우기', () => {
  for (let i = 0; i < 21; i++) pushRecent({ id: 'p' + i, at: i, form, draft: null });
  assert.equal(listRecent().length, 20);
  assert.equal(listRecent()[0].id, 'p20');
  pushRecent({ id: 'p5', at: 99, form, draft: { title: '다시 만든 초안', reason: 'r' } });
  assert.equal(listRecent()[0].id, 'p5');
  assert.equal(listRecent().filter(x => x.id === 'p5').length, 1);
  assert.equal(listRecent()[0].draft.title, '다시 만든 초안');
  deleteRecent('p5');
  assert.ok(!listRecent().some(x => x.id === 'p5'));
});

test('망가진 저장값은 버림', () => {
  store.set('purchase:recent', 'x'); assert.deepEqual(listRecent(), []);
  store.set('purchase:recent', [null, { id: 1 }, { id: 'ok', form: {} }]); assert.deepEqual(listRecent().map(x => x.id), ['ok']);
  store.set('purchase:templates', [{ id: 'a' }, { id: 'b', form: {}, name: '' }]); assert.deepEqual(listTemplates().map(x => x.name), ['이름 없는 템플릿']);
});
