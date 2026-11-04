// 에듀파인에 차례로 붙여넣기: 품의 조각(제목 → 품의 사유 → 산출 내역 표 한 번에 / 칸마다)
import test from 'node:test';
import assert from 'node:assert/strict';
import { purchaseQueueItems, itemsTSV } from '../../web/menus/purchase/rules.js';

const it = (name, spec, qty, price, unit = '') => ({ name, spec, unit, qty: String(qty), price: String(price), vendor: '' });
const form = { type: 'goods', items: [it('비커', '500ml', 2, 3000), it('시험관', '', 10, 500, '개'), it('', '', '', '')] };
const draft = { title: '5학년 과학 실험 재료 구입', reason: '실험 재료를 구입하고자 합니다.\n\n가. 목적: 실험' };

test('표 한 번에: 제목 · 품의 사유 · 산출 내역(표 복사와 같은 글)', () => {
  const q = purchaseQueueItems(draft, form, 'table');
  assert.deepEqual(q.map(x => x.label), ['제목', '품의 사유', '산출 내역(표)']);
  assert.equal(q[1].text, draft.reason);
  assert.equal(q[2].text, itemsTSV(form.items, 'goods'));
});

test('칸마다: 품목마다 품명·규격·단위·수량·단가 한 칸씩(빈 품목 줄은 빼고, 빈 규격은 빈 조각)', () => {
  const q = purchaseQueueItems(draft, form, 'cells');
  assert.deepEqual(q.map(x => x.label), ['제목', '품의 사유', '1. 품명', '1. 규격', '1. 단위', '1. 수량', '1. 단가', '2. 품명', '2. 규격', '2. 단위', '2. 수량', '2. 단가']);
  assert.deepEqual(q.slice(2).map(x => x.text), ['비커', '500ml', '개', '2', '3000', '시험관', '', '개', '10', '500']);
});

test('모르는 방식은 칸마다', () => {
  assert.equal(purchaseQueueItems(draft, form, 'x').length, 12);
});
