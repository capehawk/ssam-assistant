// 품의 계산·점검 규칙 (PRD 5.2 P-1·P-4~P-7)
import test from 'node:test';
import assert from 'node:assert/strict';
import { TYPES, emptyForm, emptyItem, toNumber, itemAmount, cleanItems, sumItems, findPersonal, checkPurchase, itemsTSV, composeReason, reasonTail, purchaseDoc,
  defaultUnit, koreanWon, basisLine, supplyValue, quoteNote, withholding, meetingItem, budgetHints, ATTACH, attachLines, attachText } from '../../web/menus/purchase/rules.js';
import { isYearKey, carryOver } from '../../web/core/years.js';

test('품의 종류 4개', () => {
  assert.deepEqual(TYPES.map(t => [t.id, t.label]), [['goods', '물품 구입'], ['lecturer', '강사 수당'], ['event', '행사 운영'], ['meeting', '협의회']]);
  for (const t of TYPES) { assert.ok(t.hint); assert.ok(t.example && t.example.items.length); }
  assert.equal(emptyForm().type, 'goods'); assert.equal(emptyForm('meeting').items.length, 1);
});

test('숫자 읽기와 금액', () => {
  assert.equal(toNumber('12,000원'), 12000); assert.equal(toNumber(' 2.5 '), 2.5); assert.equal(toNumber('abc'), 0);
  assert.equal(itemAmount({ qty: '2.5', price: '1,000' }), 2500);
  assert.deepEqual(cleanItems([{ name: ' ', qty: 1, price: 5 }, { name: '비커', qty: '', price: 3000 }]).map(i => [i.name, i.qty]), [['비커', 1]]);
  assert.equal(sumItems([{ name: '비커', qty: 2, price: 3000 }, { name: '', qty: 9, price: 9 }]), 6000);
});

test('주민번호·계좌번호 찾기', () => {
  assert.equal(findPersonal('강사 900101-1234567'), 'rrn');
  assert.equal(findPersonal('국민은행 123-45-6789-012'), 'account');
  assert.equal(findPersonal('연락처 010-1234-5678'), null);
  assert.equal(findPersonal('신한 12-34'), null);
  assert.equal(findPersonal('우리 반 연락처 010-1234-5678'), null);   // 「우리」만으로는 은행이 아님, 휴대전화는 계좌 아님
  assert.equal(findPersonal('우리은행 1002-123-456789'), 'account');
});

const ok = { ...emptyForm(), purpose: '실험', date: '2026-11-10', target: '5학년', budget: '', budgetUnknown: false, total: 6000, items: [{ name: '비커', spec: '500ml', qty: 2, price: 3000 }] };

test('필수 칸이 비면 초안을 만들지 않음', () => {
  const f = { ...emptyForm(), purpose: '', date: '', target: '5학년', items: [{ name: '', spec: '', qty: '', price: '' }] };
  const r = checkPurchase(f, { limit: 20000000 });
  assert.deepEqual(r.missing.sort(), ['date', 'items', 'purpose']); assert.equal(r.canDraft, false);
});

test('확인 목록: 예산 과목·총액·계약 기준·개인정보', () => {
  let r = checkPurchase(ok, { limit: 20000000 });
  assert.ok(r.canDraft); assert.equal(r.total, 6000);
  assert.ok(r.warnings.includes('예산 과목 · 행정실 확인 필요'));
  assert.ok(r.oks.includes('품목 금액의 합과 총액이 같아요'));
  assert.ok(r.oks.includes('주민번호·계좌번호가 들어 있지 않아요'));
  assert.ok(checkPurchase({ ...ok, total: 7000 }, { limit: 20000000 }).warnings.some(w => w.startsWith('품목 금액의 합(6,000원)과 총액(7,000원)이 달라요')));
  assert.ok(!checkPurchase({ ...ok, total: '' }, { limit: 20000000 }).oks.includes('품목 금액의 합과 총액이 같아요'));
  assert.ok(checkPurchase({ ...ok, total: '' }, { limit: 5000 }).warnings.some(w => w.startsWith('별도 계약 절차 확인 필요')));
  r = checkPurchase({ ...ok, memo: '계좌 농협 123-4567-8901-23' }, { limit: 20000000 });
  assert.deepEqual(r.personal, ['memo']); assert.equal(r.canDraft, false);
  assert.ok(!r.oks.includes('주민번호·계좌번호가 들어 있지 않아요'));
  assert.deepEqual(checkPurchase({ ...ok, items: [{ name: '강사 900101-1234567', spec: '', qty: 1, price: 1 }] }, { limit: 20000000 }).personal, ['items']);
  assert.equal(checkPurchase({ ...ok, budgetUnknown: true }, { limit: 20000000 }).warnings.includes('예산 과목 · 행정실 확인 필요'), true);
  assert.equal(checkPurchase({ ...ok, budget: '운영비' }, { limit: 20000000 }).warnings.includes('예산 과목 · 행정실 확인 필요'), false);
});

test('표 복사: 품명·규격·단위·수량·단가·금액 (구입처가 있으면 구입처 열)', () => {
  assert.equal(itemsTSV(ok.items), '품명\t규격\t단위\t수량\t단가\t금액\n비커\t500ml\t개\t2\t3000\t6000\n합계\t\t\t\t\t6000');
  const v = itemsTSV([{ name: '물티슈', spec: '', unit: '팩', qty: 2, price: 3000, vendor: '쿠팡' }]);
  assert.equal(v.split('\n')[0], '품명\t규격\t단위\t수량\t단가\t금액\t구입처');
  assert.equal(v.split('\n')[1], '물티슈\t\t팩\t2\t3000\t6000\t쿠팡');
});

test('한글 금액 읽기', () => {
  assert.equal(koreanWon(75000), '금칠만오천원');
  assert.equal(koreanWon(12345678), '금일천이백삼십사만오천육백칠십팔원');
  assert.equal(koreanWon(100000), '금일십만원'); // 행정업무운영 편람: 금113,560원(금일십일만삼천오백육십원)
  assert.equal(koreanWon(113560), '금일십일만삼천오백육십원');
  assert.equal(koreanWon(10), '금일십원');
  assert.equal(koreanWon(0), '금영원');
  assert.equal(koreanWon(100000000), '금일억원');
});

test('단위·산출 근거 줄', () => {
  assert.deepEqual(emptyItem(), { name: '', spec: '', unit: '', qty: '', price: '', vendor: '' });
  assert.equal(defaultUnit('goods'), '개'); assert.equal(defaultUnit('lecturer'), '시간'); assert.equal(defaultUnit('meeting'), '명');
  assert.equal(basisLine({ name: '비커', spec: '500ml', unit: '', qty: '8', price: '4500' }, 'goods'), '비커(500ml) 4,500원 × 8개 = 36,000원');
  assert.equal(basisLine({ name: '강사 수당(외부 강사 1)', spec: '', unit: '시간', qty: '2', price: '100000' }, 'lecturer'), '강사 수당(외부 강사 1) 100,000원 × 2시간 = 200,000원');
});

test('견적 안내: 공급가액(부가세 포함이면 ÷1.1) 2천만 원 이하면 1인 견적', () => {
  assert.equal(supplyValue(22000000, true), 20000000);
  assert.equal(supplyValue(1000, false), 1000);
  assert.equal(supplyValue(1001, true), 910);
  assert.equal(quoteNote(22000000, true).solo, true);
  assert.equal(quoteNote(22000001, false).solo, false);
  assert.match(quoteNote(5000, true).text, /1인 견적/);
  assert.match(quoteNote(30000000, true).text, /2인 이상/);
});

test('강사 수당 원천징수(참고): 기타소득 125,000원 넘으면 8.8%, 사업소득 3.3%, 10원 아래 버림', () => {
  assert.equal(withholding(125000, 'other').tax, 0);
  assert.deepEqual([withholding(200000, 'other').tax, withholding(200000, 'other').net], [17600, 182400]);
  assert.equal(withholding(123456, 'business').tax, 4070);
  assert.equal(withholding(1, 'staff').tax, null);
  assert.match(withholding(1, 'staff').note, /근로소득/);
});

test('협의회 계산 줄', () => {
  assert.deepEqual(meetingItem({ people: 4, price: 8000, times: 2 }), { name: '협의회 다과비', spec: '4명 × 2회', unit: '명', qty: '8', price: '8000', vendor: '' });
  assert.equal(meetingItem({ people: 4, price: 8000 }).qty, '4');
});

test('예산 과목 추천', () => {
  const f = (type, items, x = {}) => ({ ...emptyForm(type), items, ...x });
  assert.deepEqual(budgetHints(f('meeting', [])), ['업무추진비']);
  assert.deepEqual(budgetHints(f('lecturer', [], { income: 'other' })), ['운영수당']);
  assert.deepEqual(budgetHints(f('lecturer', [], { income: 'staff' })), ['기타수당']);
  assert.deepEqual(budgetHints(f('goods', [{ name: '실험 재료', price: 3000 }])), ['교육운영비']);
  assert.deepEqual(budgetHints(f('goods', [{ name: '토너', price: 30000 }])), ['일반수용비']);
  assert.equal(budgetHints(f('goods', [{ name: '노트북', price: 500000 }]))[0], '자산취득비');
  assert.deepEqual(budgetHints(f('goods', [{ name: '무언가', price: 1 }])), ['일반수용비', '교육운영비']);
  assert.deepEqual(budgetHints(f('event', [{ name: '간식', price: 2000 }])), ['교육운영비', '업무추진비']);
  assert.deepEqual(budgetHints(f('event', [{ name: '현수막', price: 2000 }])), ['교육운영비']);
});

test('붙임: 지출품의서 1부가 늘 먼저, 종류별 기본 체크, 직접 더한 것, 끝.', () => {
  for (const t of ['goods', 'lecturer', 'event', 'meeting']) assert.ok(ATTACH[t].length >= 2 && ATTACH[t].some(a => a.on));
  const g = emptyForm('goods');
  assert.equal(attachLines(g)[0], '지출품의서 1부');
  assert.ok(attachLines(g).includes('견적서 1부'));
  assert.equal(attachLines({ ...g, attachMore: ['참고 자료'] }).at(-1), '참고 자료 1부');
  assert.deepEqual(attachLines({ ...g, attach: [] }), ['지출품의서 1부']);
  assert.equal(attachText(['지출품의서 1부', '견적서 1부']), '붙임  1. 지출품의서 1부.\n      2. 견적서 1부.  끝.');
  assert.equal(attachText(['지출품의서 1부']), '붙임  지출품의서 1부.  끝.');
});

test('품의 사유: 첫 문장 + 가~ 줄(빈 줄 빼고 다시 매김) + 소요 예산·산출 근거 + 붙임', () => {
  const form = { ...emptyForm('goods'), purpose: '실험', date: '11월 10일', target: '5학년', place: '', items: [{ name: '비커', spec: '500ml', unit: '', qty: 2, price: 3000 }] };
  const r = composeReason({ intro: '실험 재료를 다음과 같이 구입하고자 합니다.', form });
  const lines = r.split('\n');
  assert.equal(lines[0], '실험 재료를 다음과 같이 구입하고자 합니다.');
  assert.deepEqual(lines.filter(l => /^[가-하]\. /.test(l)).map(l => l.slice(0, 7)), ['가. 목적: ', '나. 일시: ', '다. 대상: ', '라. 소요 예산', '마. 산출 근거'].map(x => x.slice(0, 7)));
  assert.ok(r.includes('라. 소요 예산: 금6,000원(금육천원)'));
  assert.ok(r.includes('마. 산출 근거: 비커(500ml) 3,000원 × 2개 = 6,000원'));
  assert.ok(r.endsWith('붙임  1. 지출품의서 1부.\n      2. 견적서 1부.  끝.'));
  const many = { ...form, place: '과학실', budget: '교육운영비', items: [1, 2, 3, 4].map(i => ({ name: '물품' + i, qty: 1, price: 1000 })) };
  const r2 = composeReason({ intro: 'A', form: many });
  assert.ok(r2.includes('라. 장소: 과학실') && r2.includes('바. 예산 과목: 교육운영비'));
  assert.ok(r2.includes('사. 산출 근거: 물품1 1,000원 × 1개 = 1,000원 외 3건'));
  assert.equal(composeReason({ intro: 'X', form: many }), 'X\n\n' + reasonTail(many));
});

test('예전 값(단위·붙임 없음)도 사유·문서가 만들어짐', () => {
  const old = { type: 'goods', purpose: 'p', date: 'd', target: 't', items: [{ name: '비커', spec: '', qty: 1, price: 100 }] };
  assert.ok(composeReason({ intro: 'A', form: old }).endsWith('붙임  지출품의서 1부.  끝.'));
  assert.ok(purchaseDoc(old, { title: 't', reason: 'r' }).blocks.length > 0);
});

test('확인 목록 더함: 협의회 1인 상한·행사 식비·새 칸 개인정보', () => {
  const m = { ...ok, type: 'meeting', items: [meetingItem({ people: 4, price: 50000 })] };
  assert.ok(checkPurchase(m, { limit: 20000000, meetCap: 40000 }).warnings.includes('1인 단가 50,000원이 협의회 상한 40,000원보다 커요 · 행정실 확인'));
  assert.ok(!checkPurchase(m, { limit: 20000000, meetCap: 60000 }).warnings.some(w => w.includes('협의회 상한')));
  const e = { ...ok, type: 'event', items: [{ name: '도시락', qty: 10, price: 8000 }] };
  assert.ok(checkPurchase(e, { limit: 20000000 }).warnings.some(w => w.includes('업무추진비')));
  assert.deepEqual(checkPurchase({ ...ok, items: [{ name: '풀', qty: 1, price: 1, vendor: '900101-1234567' }] }, { limit: 20000000 }).personal, ['items']);
  assert.deepEqual(checkPurchase({ ...ok, attachMore: ['국민은행 123-45-6789-012'] }, { limit: 20000000 }).personal, ['attach']);
});

test('문서: 산출 내역 표에 단위, 산출 근거·예산 과목·붙임', () => {
  const d = purchaseDoc({ ...ok, budget: '운영비' }, { title: '실험 재료 구입', reason: '사유' });
  const t = d.blocks.find(b => b.type === 'table');
  assert.deepEqual(t.rows[0], ['품명', '규격', '단위', '수량', '단가', '금액']);
  assert.deepEqual(t.rows[1], ['비커', '500ml', '개', '2', '3,000', '6,000']);
  assert.deepEqual(t.rows.at(-1), ['합계', '', '', '', '', '6,000']);
  const text = d.blocks.filter(b => b.type === 'p').map(b => b.text).join('\n');
  assert.ok(text.includes('예산 과목: 운영비') && text.includes('산출 근거') && text.includes('붙임  1. 지출품의서 1부.'));
  assert.equal(d.title, '실험 재료 구입');
});

test('템플릿·협의회 상한은 학년도 자료로 새 학년도에 가져가고, 최근 작성은 두고 감', () => {
  assert.equal(isYearKey('purchase:templates'), true);
  const out = carryOver({ 'purchase:templates': '[]', purchaseMeetCap: '30000', 'purchase:recent': '[]' }, 2027);
  assert.equal(out['purchase:templates'], '[]'); assert.equal(out.purchaseMeetCap, '30000'); assert.ok(!('purchase:recent' in out));
});
