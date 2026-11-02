// 계획 14 최종 검토 고침: 품목 이름의 강사 이름 가리기, AI가 채운 칸·종류 칩·오늘 날짜, 쪽지 고친 본문 남기기, 괄호 전화번호 빼기
import test from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../../web/core/store.js';
import { emptyForm, checkPurchase } from '../../web/menus/purchase/rules.js';
import { oneshotPrompt, confirmChips } from '../../web/menus/purchase/oneshot.js';
import { stripNames } from '../../web/core/privacy.js';
import { pushMessage, listMessages } from '../../web/menus/etc/message-model.js';

function mem() { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; }
store.useStorage(mem());
const item = (name, qty, price) => ({ name, spec: '', unit: '', qty: String(qty), price: String(price), vendor: '' });

test('I1 종류를 고르지 않아도 품목 이름의 강사 이름은 초안 AI로 가지 않음', () => {
  const p = oneshotPrompt({ ...emptyForm(), items: [item('김철수 강사', 2, 100000)] }, '김철수 강사 2시간 10만원');
  assert.ok(!p.includes('김철수'), p);
  assert.ok(p.includes('○○○ 강사'), p);
});

test('I4 AI가 채운 일시·장소·사업명·대상과 바꾼 종류도 칩, 프롬프트에 오늘 날짜', () => {
  const f = { ...emptyForm(), purpose: '실험', budget: '교과 운영비', date: '2026. 11. 10.', place: '과학실', items: [item('비커', 2, 3000)], typeGuessed: true };
  const c = confirmChips(f, checkPurchase(f, { limit: 20000000 }), ['date', 'place']);
  assert.ok(c.some(x => x.key === 'date' && x.text === '일시 · AI가 채움'), JSON.stringify(c));
  assert.ok(c.some(x => x.key === 'place' && x.text === '장소 · AI가 채움'), JSON.stringify(c));
  assert.ok(c.some(x => x.key === 'type' && x.text.includes('종류') && x.text.includes('물품 구입')), JSON.stringify(c));
  const p = oneshotPrompt(f, '다음 주 화요일', { today: '2026-11-02' });
  assert.ok(p.includes('오늘: 2026-11-02(월)'), p);
});

test('I5 최근 쪽지는 손으로 고친 본문·제목도 남김', () => {
  pushMessage({ id: 'e1', title: '[연수 안내] 연수', kind: 'training', m: { title: '연수' }, len: 'base', attachNames: [], body: '고친 본문', edited: true });
  const r = listMessages().find(x => x.id === 'e1');
  assert.equal(r.body, '고친 본문');
  assert.equal(r.edited, true);
});

test('I8 괄호 전화번호 줄도 뺌', () => {
  const r = stripNames('연수 안내\n담당 (041)640-1234\n문의 041) 640-1234\n일시: 11. 12.');
  assert.ok(!r.text.includes('640-1234') && r.text.includes('일시: 11. 12.'), r.text);
  assert.equal(r.dropped, 2);
});
