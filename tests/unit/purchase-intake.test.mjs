// 품의 아무거나 넣기: 줄글 규칙 읽기, 장바구니·견적 AI 답 다듬기(개인정보 버림), 배송비 줄, 빈 칸만 채우기, 더하기·바꾸기, 구입처별 나누기
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLines, intakePrompt, normIntake, shippingItems, fillEmpty, mergeItems, vendorsOf, splitByVendor } from '../../web/menus/purchase/intake.js';
import { emptyItem, emptyForm } from '../../web/menus/purchase/rules.js';

const pick = it => ({ name: it.name, unit: it.unit, qty: it.qty, price: it.price });

test('줄글 규칙 읽기: 수량·단위·금액(만원·쉼표·×·총액)', () => {
  const r = parseLines('A4 용지 5박스 2만원\n보드마커 검정 10개 1200원\n풀 3개×500\n가위 4자루 총 1만원\n그냥 메모');
  assert.deepEqual(r.items.map(pick), [
    { name: 'A4 용지', unit: '박스', qty: '5', price: '20000' },
    { name: '보드마커 검정', unit: '개', qty: '10', price: '1200' },
    { name: '풀', unit: '개', qty: '3', price: '500' },
    { name: '가위', unit: '자루', qty: '4', price: '2500' }
  ]);
  assert.deepEqual(r.missed, ['그냥 메모']);
});

test('줄글: 1.2만원·쉼표 금액·빈 줄·목록 기호', () => {
  const r = parseLines('- 색연필 12색 30세트 1.2만원\n\n• 테이프 20,000원\n3) 클립 2통 * 1500');
  assert.deepEqual(r.items.map(pick), [
    { name: '색연필 12색', unit: '세트', qty: '30', price: '12000' },
    { name: '테이프', unit: '', qty: '1', price: '20000' },
    { name: '클립', unit: '통', qty: '2', price: '1500' }
  ]);
  assert.deepEqual(r.missed, []);
});

test('AI 답 다듬기: 품목·배송비·칸 6개만, 주문자·주소·전화 버림, 개인정보 모양 품목 버림', () => {
  const v = normIntake({
    items: [{ name: '물티슈', spec: '100매', unit: '팩', qty: 2, price: 3000, vendor: '쿠팡' }, { name: '', price: 1 }, { name: '강사 900101-1234567', qty: 1, price: 1 }],
    shipping: [{ vendor: '쿠팡', fee: 3000 }, { vendor: '학교장터', fee: 0 }, 'x'],
    fields: { purpose: '교실 환경 정리', buyer: '홍길동', address: '서울시 어딘가', phone: '010-1234-5678', target: '3학년 1반', memo: 'x' }
  });
  assert.equal(v.items.length, 1);
  assert.deepEqual(v.items[0], { name: '물티슈', spec: '100매', unit: '팩', qty: '2', price: '3000', vendor: '쿠팡' });
  assert.equal(v.shipping.length, 2);
  assert.deepEqual(Object.keys(v.fields).sort(), ['purpose', 'target']);
  assert.deepEqual(normIntake(null), { items: [], shipping: [], fields: {} });
  assert.deepEqual(normIntake({ fields: { purpose: '국민은행 123-45-6789-012' } }).fields, {});
});

test('배송비 줄: 0원·무료는 넣지 않음', () => {
  assert.deepEqual(shippingItems([{ vendor: '쿠팡', fee: 3000 }, { vendor: '학교장터', fee: 0 }, { vendor: 'x', fee: '무료' }]),
    [{ name: '배송비', spec: '쿠팡', unit: '건', qty: '1', price: '3000', vendor: '쿠팡' }]);
});

test('빈 칸만 채우기', () => {
  const f = fillEmpty({ ...emptyForm(), purpose: '쓴 목적', target: '' }, { purpose: '새 목적', target: '3학년', project: '환경 정리' });
  assert.equal(f.purpose, '쓴 목적'); assert.equal(f.target, '3학년'); assert.equal(f.project, '환경 정리');
});

test('품목 합치기: 빈 줄 먼저 채움·더하기·바꾸기', () => {
  const a = { ...emptyItem(), name: 'a', qty: '1', price: '1' }, b = { ...emptyItem(), name: 'b', qty: '1', price: '2' };
  assert.deepEqual(mergeItems([emptyItem()], [b], 'add').map(x => x.name), ['b']);
  assert.deepEqual(mergeItems([a], [b], 'add').map(x => x.name), ['a', 'b']);
  assert.deepEqual(mergeItems([a, emptyItem()], [b], 'replace').map(x => x.name), ['b']);
});

test('구입처: 처음 나온 차례, 나누기(배송비는 그 구입처, 구입처 없는 품목은 첫째)', () => {
  const items = [
    { ...emptyItem(), name: '물티슈', vendor: '쿠팡' }, { ...emptyItem(), name: '메모' },
    { ...emptyItem(), name: '배송비', spec: '쿠팡', vendor: '쿠팡' }, { ...emptyItem(), name: '색지', vendor: '학교장터' },
    { ...emptyItem(), name: '배송비', spec: '학교장터', vendor: '학교장터' }
  ];
  assert.deepEqual(vendorsOf(items), ['쿠팡', '학교장터']);
  const parts = splitByVendor({ ...emptyForm(), project: '환경 정리', items });
  assert.equal(parts.length, 2);
  assert.deepEqual(parts[0].items.map(x => x.name), ['물티슈', '메모', '배송비']);
  assert.deepEqual(parts[1].items.map(x => x.name), ['색지', '배송비']);
  assert.equal(parts[1].project, '환경 정리');
  assert.equal(splitByVendor({ ...emptyForm(), items: [items[0]] }).length, 1);
});

test('AI 프롬프트: 머리, 받을 것만, 주문자·받는 사람·주소·전화는 쓰지 말라고', () => {
  const p = intakePrompt('image');
  assert.ok(p.startsWith('[품의 넣기]'));
  for (const w of ['주문자', '받는 사람', '주소', '전화']) assert.ok(p.includes(w), w);
  assert.ok(p.includes('"shipping"') && p.includes('"vendor"'));
  assert.ok(intakePrompt('text', '물티슈 2개').includes('물티슈 2개'));
});
