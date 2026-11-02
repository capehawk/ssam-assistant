// 품의 「한 칸 → 바로 초안」 규칙: 필수는 목적·품목, 한 번에 초안 프롬프트·답 다듬기(빈 칸만·개인정보 버림), 확인할 것 칩, 빠진 것 묻기
import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyForm, checkPurchase, reasonTail } from '../../web/menus/purchase/rules.js';
import { oneshotPrompt, normOneshot, confirmChips, askNeeds } from '../../web/menus/purchase/oneshot.js';

const item = (name, qty, price) => ({ name, spec: '', unit: '', qty: String(qty), price: String(price), vendor: '' });
const base = (over = {}) => ({ ...emptyForm(), items: [item('알코올램프', 10, 5000)], ...over });

test('필수는 목적·품목 1개(일시·대상은 아님), 목적은 AI가 짐작하면 빼도 됨', () => {
  let r = checkPurchase(base({ purpose: '실험' }), { limit: 20000000 });
  assert.deepEqual(r.missing, []); assert.equal(r.canDraft, true);
  r = checkPurchase(base(), { limit: 20000000 });
  assert.deepEqual(r.missing, ['purpose']);
  r = checkPurchase(base(), { limit: 20000000, guessPurpose: true });
  assert.deepEqual(r.missing, []); assert.equal(r.canDraft, true);
  r = checkPurchase({ ...emptyForm(), purpose: '실험' }, { limit: 20000000 });
  assert.deepEqual(r.missing, ['items']);
});

test('일시·대상이 비면 품의 사유에서 그 줄을 빼고 가·나·다를 다시 매김', () => {
  const t = reasonTail(base({ purpose: '과학 실험', place: '과학실' }));
  assert.ok(t.startsWith('가. 목적: 과학 실험\n나. 장소: 과학실'), t);
  assert.ok(!t.includes('일시') && !t.includes('대상'), t);
});

test('한 번에 초안 프롬프트: 머리·넣은 글·빈 칸 이름, 강사 수당은 넣은 글을 보내지 않음, 종류 묻기', () => {
  const p = oneshotPrompt(base(), '알코올램프 10개 5천원 다음 주 화요일 과학실');
  assert.ok(p.startsWith('[품의 초안]'), p.slice(0, 40));
  assert.ok(p.includes('알코올램프 10개 5천원 다음 주 화요일 과학실'), '넣은 글');
  assert.ok(p.includes('purpose') && p.includes('date'), '빈 칸');
  assert.ok(!p.includes('"type"'), 'askType 아니면 종류 안 물음');
  assert.ok(oneshotPrompt(base(), '', { askType: true }).includes('"type"'));
  const lec = oneshotPrompt({ ...emptyForm('lecturer'), items: [item('외부 강사 1', 2, 50000)] }, '김철수 강사 2시간 10만원');
  assert.ok(!lec.includes('김철수') && !lec.includes('10만원'), lec);
  assert.ok(lec.includes('강사 1명'), '사람 수·시간만');
});

test('답 다듬기: 빈 칸만 채우고, 전화번호 든 값은 버리고, 모르는 종류는 빈칸', () => {
  const v = { title: ' 과학 실험 재료 구입 ', intro: '과학 실험 재료를 다음과 같이 구입하고자 합니다.', fields: { purpose: '과학 실험 수업', date: '11. 12.', place: '과학실 010-1234-5678', target: '3학년' }, type: 'event' };
  const r = normOneshot(v, { ...emptyForm(), purpose: '', date: '11월', place: '', target: '' });
  assert.equal(r.title, '과학 실험 재료 구입');
  assert.deepEqual(r.fields, { purpose: '과학 실험 수업', target: '3학년' });
  assert.equal(r.type, 'event');
  assert.equal(normOneshot({ ...v, type: 'x' }, emptyForm()).type, '');
  assert.deepEqual(normOneshot(null, emptyForm()), { title: '', intro: '', fields: {}, type: '' });
});

test('확인할 것 칩: 예산 과목·단가 없는 품목·AI가 짐작한 목적·일시·대상 없음(정보)·그 밖의 경고', () => {
  const f = base({ purpose: '실험', items: [item('비커', 2, ''), item('스포이트', '', 300), item('알코올램프', 1, 5000)] });
  const r = checkPurchase(f, { limit: 20000000 });
  const c = confirmChips(f, r, ['purpose']);
  assert.deepEqual(c[0], { key: 'budget', text: '예산 과목 · 행정실 확인', level: 'warn' });
  assert.ok(c.some(x => x.key === 'items' && x.text === '단가 없는 품목 2개' && x.level === 'warn'), JSON.stringify(c));
  assert.ok(c.some(x => x.key === 'purpose' && x.text === '목적 · AI가 짐작함'), JSON.stringify(c));
  assert.ok(c.some(x => x.key === 'date' && x.text === '일시·대상 없이 썼어요' && x.level === 'info'), JSON.stringify(c));
  assert.ok(!c.some(x => x.key === '' && x.text.includes('예산 과목')), '예산 경고 겹침');
  const over = base({ purpose: '실험', budget: '교과 운영비', date: '11. 12.', items: [item('노트북', 1, 30000000)] });
  const c2 = confirmChips(over, checkPurchase(over, { limit: 20000000 }), []);
  assert.ok(c2.some(x => x.key === '' && x.text.includes('별도 계약 절차')), JSON.stringify(c2));
  assert.ok(!c2.some(x => x.key === 'date'), '일시가 있으면 정보 칩 없음');
});

test('빠진 것 묻기: 비어 있는 목적·품목만', () => {
  assert.deepEqual(askNeeds({ ...emptyForm(), purpose: '' }), ['purpose', 'items']);
  assert.deepEqual(askNeeds(base({ purpose: '' })), ['purpose']);
  assert.deepEqual(askNeeds(base({ purpose: '실험' })), []);
});
