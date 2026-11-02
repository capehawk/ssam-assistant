// 미뤄 둔 작은 것(품의): 「2만」, 합계 줄 → 총액, 나누어떨어지지 않는 「총」 → 총액, 포장 단위가 수량(100매는 규격),
// 글 파일(.txt)도 줄글로, 배송비 단위 건, 협의회 상한은 1인당 줄만, 템플릿에 메모·총액 안 남김, 강사 메모 말, 문서에 겹치는 문단 없음
import test from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../../web/core/store.js';

globalThis.window = { SSAM: { ai: { generate: async () => ({ text: '{}' }), engineReady: () => false, errMsg: c => c } } };
const { parseLines, readIntake, fillEmpty } = await import('../../web/menus/purchase/intake.js');
const R = await import('../../web/menus/purchase/rules.js');
const L = await import('../../web/menus/purchase/library.js');
function mem() { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; }
store.useStorage(mem());
const row = it => [it.name, it.spec, it.unit, it.qty, it.price];

test('「2만」「1.2만」처럼 원이 없어도 금액', () => {
  assert.deepEqual(parseLines('A4 용지 5박스 2만\n색연필 30세트 1.2만').items.map(row), [['A4 용지', '', '박스', '5', '20000'], ['색연필', '', '세트', '30', '12000']]);
});

test('합계 줄은 못 읽은 줄이 아니라 총액으로, 빈 총액 칸만 채움', () => {
  const r = parseLines('비커 8개 4,500원\n합계 36,000원');
  assert.equal(r.items.length, 1);
  assert.deepEqual(r.missed, []);
  assert.equal(r.fields.total, '36000');
  assert.equal(fillEmpty({ ...R.emptyForm('goods') }, r.fields).total, '36000');
  assert.equal(fillEmpty({ ...R.emptyForm('goods'), total: '40000' }, r.fields).total, '40000');
});

test('「총」 금액이 수량으로 나누어떨어지지 않으면 적은 총액을 총액 칸에(확인 목록이 알려 줌), 나누어떨어지면 그대로', () => {
  assert.equal(parseLines('가위 3개 총 1만원').fields.total, '10000');
  assert.equal(parseLines('가위 3개 총 1만원\n풀 2개 500원').fields.total, '11000');
  assert.equal(parseLines('가위 4자루 총 1만원').fields.total, undefined);
  assert.equal(parseLines('가위 3개 총 1만원\n합계 12,000원').fields.total, '12000');
});

test('포장 단위(팩·박스)가 수량, 매·g 같은 단위는 규격으로', () => {
  assert.deepEqual(parseLines('물티슈 10팩 100매 3,000원\nA4 용지 80g 5박스 2만원\n복사지 500매 5,000원').items.map(row), [
    ['물티슈', '100매', '팩', '10', '3000'], ['A4 용지', '80g', '박스', '5', '20000'], ['복사지', '', '매', '500', '5000']
  ]);
});

test('배송비·택배비 줄은 단위 「건」', () => {
  assert.deepEqual(parseLines('배송비 3,000원\n택배비 2500원').items.map(row), [['배송비', '', '건', '1', '3000'], ['택배비', '', '건', '1', '2500']]);
});

test('글 파일(.txt)은 [파일 고르기]로 넣어도 줄글로 읽음', async () => {
  const r = await readIntake({ file: new File(['A4 용지 5박스 2만원\n보드마커 12개 1,500원'], '메모.txt', { type: 'text/plain' }) });
  assert.deepEqual(r.items.map(row), [['A4 용지', '', '박스', '5', '20000'], ['보드마커', '', '개', '12', '1500']]);
});

test('협의회 상한: 1인당 줄(명·다과·식사)만 봄, 대관료 1식은 경고 없음', () => {
  const f = { ...R.emptyForm('meeting'), purpose: 'p', date: 'd', target: 't', items: [{ name: '협의회 다과비', spec: '4명 × 1회', unit: '명', qty: '4', price: '30000' }, { name: '대관료', spec: '', unit: '식', qty: '1', price: '100000' }] };
  assert.ok(!R.checkPurchase(f, { meetCap: 40000 }).warnings.some(w => w.includes('협의회 상한')));
  f.items.push({ name: '다과', spec: '', unit: '개', qty: '5', price: '50000' });
  assert.ok(R.checkPurchase(f, { meetCap: 40000 }).warnings.some(w => w.includes('50,000원이 협의회 상한 40,000원')));
});

test('템플릿: 메모·총액은 남기지 않음(일시도 비움)', () => {
  L.saveTemplate('t', { ...R.emptyForm('goods'), project: 'p', date: '2026-11-10', memo: '이번만 쓰는 메모', total: '36000', items: [{ name: '비커', qty: '8', price: '4500' }] });
  const f = L.listTemplates()[0].form;
  assert.ok(f.memo === '' && f.total === '' && f.date === '' && f.project === 'p', JSON.stringify(f));
});

test('초안 메모: 강사는 「강사 N명」(외부라 하지 않음), 협의회 단위는 기본 단위(명)', () => {
  const lec = R.draftMemo({ type: 'lecturer', items: [{ name: '김강사', qty: '2', price: '100000' }] });
  assert.ok(lec.includes('- 품목: 강사 1명, 모두 2시간') && !lec.includes('외부'), lec);
  assert.ok(R.draftMemo({ type: 'meeting', items: [{ name: '다과', qty: '4', price: '5000' }] }).includes('다과 4명 × 5,000원'));
});

test('문서: 사유에 이미 있는 산출 근거·예산 과목·붙임은 다시 쓰지 않고, 사유에 없으면 씀', () => {
  const form = { ...R.emptyForm('goods'), purpose: '수업', date: '2026-11-10', target: '3학년', budget: '교육운영비', items: [{ name: '비커', unit: '개', qty: '8', price: '4500' }] };
  const texts = d => R.purchaseDoc(form, d).blocks.filter(b => b.type === 'p').map(b => b.text);
  const full = texts({ title: 't', reason: R.composeReason({ intro: '비커를 구입하고자 합니다.', form }) });
  assert.equal(full.length, 1, full.join(' | '));
  const short = texts({ title: 't', reason: '비커를 구입하고자 합니다.' });
  assert.ok(short.some(t => t.startsWith('산출 근거')) && short.some(t => t.startsWith('예산 과목')) && short.some(t => t.startsWith('붙임')), short.join(' | '));
});
