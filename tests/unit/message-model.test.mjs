// 쪽지 저장: 보내는 사람(학년도와 상관없이), 지금 쪽지, 최근 쪽지 20개(같은 쪽지는 그 자리, 붙임은 이름만)
import test from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../../web/core/store.js';
import { isYearKey } from '../../web/core/years.js';
import { getSender, setSender, getDraft, saveDraft, listMessages, pushMessage, newMessageId } from '../../web/menus/etc/message-model.js';

function mem() { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; }
store.useStorage(mem());

test('보내는 사람: 학년도와 상관없이, 기본 빈 글', () => {
  assert.equal(getSender(), '');
  setSender('  교무부 ○○○(내선 123) ');
  assert.equal(getSender(), '교무부 ○○○(내선 123)');
  assert.equal(isYearKey('msg:sender'), false);
  assert.equal(isYearKey('msg:list'), true);
  assert.equal(isYearKey('msg:draft'), true);
});

test('지금 쪽지: 망가진 값이면 null, 붙임은 이름·체크만', () => {
  assert.equal(getDraft(), null);
  saveDraft({ id: 'm1', m: { kind: 'training', title: '연수' }, len: 'long', attach: [{ name: '계획', on: true, file: 'x' }], edited: true, body: '본문' });
  const d = getDraft();
  assert.deepEqual(d.attach, [{ name: '계획', on: true }]);
  assert.equal(d.len, 'long');
  assert.equal(d.edited, true);
  store.set('msg:draft', 'x');
  assert.equal(getDraft(), null);
});

test('최근 쪽지 20개: 늦은 것 먼저, 같은 id는 그 자리, 21개면 가장 오래된 것을 버림', () => {
  for (let i = 0; i < 21; i++) pushMessage({ id: 'k' + i, at: 1000 + i, title: '쪽지 ' + i, kind: 'etc', m: {}, len: 'base', attachNames: ['붙임 ' + i] });
  let l = listMessages();
  assert.equal(l.length, 20);
  assert.equal(l[0].id, 'k20');
  assert.ok(!l.some(x => x.id === 'k0'));
  pushMessage({ id: 'k5', at: 5000, title: '고침', kind: 'etc', m: {}, len: 'base', attachNames: [] });
  l = listMessages();
  assert.equal(l.length, 20);
  assert.equal(l[0].id, 'k5');
  assert.equal(l.filter(x => x.id === 'k5').length, 1);
  assert.ok(newMessageId() !== newMessageId());
});
