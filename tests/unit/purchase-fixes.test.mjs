// 최종 검토에서 고친 것(품의 넣기): 엑셀에서 복사한 칸(탭 글) 읽기, 개인정보 줄은 AI로 안 보냄, AI 답의 전화·이메일 버림,
// 한 줄에 금액이 둘(단가·금액)이면 단가, 연결 말 빼기, 견적서 표의 단위 열
import test from 'node:test';
import assert from 'node:assert/strict';

const calls = [];
let reply = () => ({ text: '{"items":[{"name":"칭찬 스티커","qty":2,"price":3000}]}' });
globalThis.window = { SSAM: { ai: { generate: async (prompt, o) => { calls.push({ prompt, o }); return reply(prompt, o); }, engineReady: () => true, errMsg: c => c } } };
const { readIntake, parseLines, normIntake } = await import('../../web/menus/purchase/intake.js');
const { findItems } = await import('../../web/core/sheet.js');
const { normQuoteItems } = await import('../../web/menus/purchase/quote.js');
const pick = it => ({ name: it.name, spec: it.spec, unit: it.unit, qty: it.qty, price: it.price });

test('엑셀에서 복사한 칸(머리줄 없음): 품명·규격·단위·수량·단가(·금액) 열로 읽고 AI는 안 부름', async () => {
  calls.length = 0;
  const r = await readIntake({ text: '비커\t500ml\t개\t8\t4500\t36000\n유리 막대\t30cm\t개\t4\t1,200\t4,800\nA4 용지\t\t박스\t5\t20000' });
  assert.deepEqual(r.items.map(pick), [
    { name: '비커', spec: '500ml', unit: '개', qty: '8', price: '4500' },
    { name: '유리 막대', spec: '30cm', unit: '개', qty: '4', price: '1200' },
    { name: 'A4 용지', spec: '', unit: '박스', qty: '5', price: '20000' }
  ]);
  assert.equal(calls.length, 0);
  assert.deepEqual(r.missed, []);
});

test('엑셀에서 복사한 칸(머리줄 있음): 머리줄 열 이름대로, 합계 줄 뺌', async () => {
  calls.length = 0;
  const r = await readIntake({ text: '품명\t규격\t단위\t수량\t단가\t금액\n비커\t500ml\t개\t8\t4500\t36000\n합계\t\t\t\t\t36000' });
  assert.deepEqual(r.items.map(pick), [{ name: '비커', spec: '500ml', unit: '개', qty: '8', price: '4500' }]);
  assert.equal(calls.length, 0);
});

test('개인정보(주민번호·계좌) 모양이 있는 줄은 AI로 보내지 않고 수를 알려 줌', async () => {
  calls.length = 0;
  const r = await readIntake({ text: '칭찬 스티커 좀 사고\n강사 김철수 800101-1234567 국민은행 123-456-789012' });
  assert.equal(calls.length, 1);
  assert.ok(!calls[0].prompt.includes('800101') && !calls[0].prompt.includes('김철수') && calls[0].prompt.includes('칭찬 스티커 좀 사고'), calls[0].prompt.slice(-200));
  assert.equal(r.personal, 1);
  calls.length = 0;
  const r2 = await readIntake({ text: 'A4 용지 5박스 2만원\n주민번호 800101-1234567' });
  assert.equal(calls.length, 0, '개인정보 줄만 못 읽었으면 AI를 부르지 않음');
  assert.equal(r2.personal, 1);
  assert.equal(r2.items.length, 1);
});

test('AI 답: 전화번호·이메일이 든 칸·품목 글은 버리고 수를 셈, 캡처에서는 장소를 받지 않음', () => {
  const v = normIntake({
    items: [{ name: '물티슈', spec: '100매', unit: '팩', qty: 2, price: 3000, vendor: '쿠팡 010-1234-5678' }, { name: '홍길동 hong@mail.com', qty: 1, price: 1 }],
    fields: { place: '서울시 강남구 테헤란로 1 홍길동 010-1234-5678', purpose: '교실 환경 정리', target: '문의 02-123-4567' }
  });
  assert.equal(v.items.length, 1);
  assert.equal(v.items[0].vendor, '');
  assert.deepEqual(v.fields, { purpose: '교실 환경 정리' });
  assert.equal(v.dropped, 4);
  assert.deepEqual(normIntake({ items: [{ name: '풀', qty: 1, price: 500 }], fields: { place: '과학실', purpose: '실험' } }, 'image').fields, { purpose: '실험' });
  assert.deepEqual(normIntake({ items: [{ name: '풀', qty: 1, price: 500 }], fields: { place: '과학실' } }, 'text').fields, { place: '과학실' });
});

test('줄글: 한 줄에 단가와 금액이 같이 있으면 단가, 연결 말(=·×·각·개당·괄호)은 품명에서 뺌', () => {
  const r = parseLines('보드마커 10개 1,200원 = 12,000원\n보드마커 10개 1,200원 (12,000원)\n공책 10권 각 1,000원\n물감 12색 5개 개당 3,000원\n풀 3개 x 800원');
  assert.deepEqual(r.items.map(it => [it.name, it.qty, it.price]), [
    ['보드마커', '10', '1200'], ['보드마커', '10', '1200'], ['공책', '10', '1000'], ['물감 12색', '5', '3000'], ['풀', '3', '800']
  ]);
  assert.deepEqual(parseLines('정가 15,000원 할인가 12,000원').items.map(it => it.price), ['12000']);
});

test('견적서 표: 단위 열이 있으면 단위도 가져옴', () => {
  assert.deepEqual(findItems([['품명', '규격', '단위', '수량', '단가'], ['A4 용지', '80g', '박스', '5', '20000']]), [{ name: 'A4 용지', spec: '80g', unit: '박스', qty: 5, price: 20000 }]);
  assert.deepEqual(normQuoteItems([{ name: 'A4 용지', unit: '박스', qty: 5, price: 20000 }])[0].unit, '박스');
});
