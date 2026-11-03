// 계획 14 뒤 미뤄 둔 작은 것: 쪽지 날짜 기간·신청 기한 글·글로 온 일시, 뺀 줄·가린 이름 따로 세기, 쪽지 검토 없음,
// 품의 단가·수량 칩 나누기, 넣은 글의 전화번호·이메일 줄
import test from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../../web/core/store.js';
import { normMessage, composeMessage, messagePrompt } from '../../web/menus/etc/message-ai.js';
import { cleanSheet } from '../../web/menus/evaluate/activity/activity-read.js';
import { setTaskRole, pick, rowText, resetRoles, hasReview } from '../../web/core/ai-roles.js';
import { emptyForm, checkPurchase } from '../../web/menus/purchase/rules.js';
import { oneshotPrompt, confirmChips } from '../../web/menus/purchase/oneshot.js';

function mem() { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; }
store.useStorage(mem());
const item = (name, qty, price) => ({ name, spec: '', unit: '', qty: String(qty), price: String(price), vendor: '' });
const env = { engine: 'claude', keys: { claude: true }, models: { claude: ['claude-opus-5-5'] }, labels: { claude: 'Claude' } };
const OPUS = { engine: 'claude', model: 'claude-opus-5-5' };

test('쪽지 날짜: 「11-12~11-13」·「2026-11-12~2026-11-13」 기간은 시작·끝으로, 끝이 앞서면 버림', () => {
  assert.deepEqual(normMessage({ when: [{ date: '2026-11-12~2026-11-13', time: '' }] }).when, [{ date: '2026-11-12', end: '2026-11-13', time: '', note: '' }]);
  assert.deepEqual(normMessage({ when: [{ date: '11-12 ~ 11-13' }] }, { year: 2026 }).when, [{ date: '2026-11-12', end: '2026-11-13', time: '', note: '' }]);
  assert.deepEqual(normMessage({ when: [{ date: '2026-11-12', end: '2026-11-14', time: '09:00~16:00' }] }).when, [{ date: '2026-11-12', end: '2026-11-14', time: '09:00~16:00', note: '' }]);
  assert.equal(normMessage({ when: [{ date: '2026-11-12', end: '2026-11-10' }] }).when[0].end, '');
  assert.ok(messagePrompt('글').includes('"end"'), '프롬프트에 기간 끝');
});

test('쪽지 날짜: 기간은 본문에 「시작~끝(요일)」, 해가 다르면 끝도 연도까지', () => {
  const b = composeMessage(normMessage({ title: '연수', when: [{ date: '2026-11-12', end: '2026-11-13', time: '09:00~16:00' }] })).body;
  assert.ok(b.includes('□ 일시: 2026. 11. 12.(목)~11. 13.(금) 09:00~16:00'), b);
  const b2 = composeMessage(normMessage({ title: '연수', when: [{ date: '2026-12-30', end: '2027-01-02' }] })).body;
  assert.ok(b2.includes('□ 일시: 2026. 12. 30.(수)~2027. 1. 2.(토)'), b2);
});

test('쪽지 날짜: 글로 온 일시도 넣고(날짜는 읽고 나머지는 시간), 일시 하나가 글이어도 됨', () => {
  assert.deepEqual(normMessage({ when: ['2026. 11. 12.(목) 15:00~16:30'] }).when, [{ date: '2026-11-12', end: '', time: '15:00~16:30', note: '' }]);
  assert.deepEqual(normMessage({ when: '11월 중 추후 안내' }).when, [{ date: '', end: '', time: '', note: '11월 중 추후 안내' }]);
});

test('쪽지 신청 기한: 날짜로 못 읽으면 버리지 않고 글 그대로 신청 줄에', () => {
  const m = normMessage({ title: '연수', apply: { due: '11월 둘째 주까지', how: '이음 쪽지로 회신' } });
  assert.equal(m.apply.due, '');
  assert.equal(m.apply.dueNote, '11월 둘째 주까지');
  assert.ok(composeMessage(m).body.includes('□ 신청: 11월 둘째 주까지 이음 쪽지로 회신'), composeMessage(m).body);
  assert.equal(normMessage({ apply: { due: '2026-11-06' } }).apply.dueNote, '');
});

test('뺀 줄과 가린 이름을 따로 셈(cut은 둘을 더한 것)', () => {
  const c = cleanSheet(['연수 안내', '담당: 장학사 김민수 041-123-4567', '연수 명단: 김가람 이나래 박하늘 최보람', '이름: 홍길동', '일시: 11. 12.'].join('\n'));
  assert.equal(c.lines, 2, JSON.stringify(c));
  assert.equal(c.names, 1, JSON.stringify(c));
  assert.equal(c.cut, c.lines + c.names);
});

test('쪽지는 검토 AI가 없음: 켜도 검토 안 하고, AI 줄에 「검토」 말이 없음', () => {
  resetRoles();
  assert.equal(hasReview('message'), false);
  assert.equal(hasReview('purchase'), true);
  setTaskRole('message', { main: OPUS, reviewOn: true, review: OPUS });
  assert.equal(pick('message', 'review', env), null);
  assert.equal(rowText('message', env), 'AI: Claude claude-opus-5-5');
  setTaskRole('purchase', { reviewOn: true, review: OPUS });
  assert.ok(pick('purchase', 'review', env), '품의 검토는 그대로');
});

test('품의 칩: 단가가 빈 품목과 수량이 빈 품목을 따로 셈', () => {
  const f = { ...emptyForm(), purpose: '실험', budget: '교과 운영비', date: 'x', items: [item('비커', '', 3000), item('플라스크', 2, ''), item('스포이트', '', '')] };
  const c = confirmChips(f, checkPurchase(f, { limit: 20000000 }), []);
  assert.ok(c.some(x => x.key === 'items' && x.text === '단가 없는 품목 2개'), JSON.stringify(c));
  assert.ok(c.some(x => x.key === 'items' && x.text === '수량 없는 품목 2개'), JSON.stringify(c));
  const ok = { ...f, items: [item('비커', 2, 3000)] };
  assert.ok(!confirmChips(ok, checkPurchase(ok, { limit: 20000000 }), []).some(x => x.key === 'items'));
});

test('품의 초안 AI: 넣은 글의 전화번호·이메일 줄은 보내지 않음(넣기 때와 같음)', () => {
  const p = oneshotPrompt({ ...emptyForm(), items: [item('A4 용지', 5, 25000)] }, 'A4 용지 5박스 2만5천원\n받는 분 010-1234-5678\n메일 teacher@school.kr\n다음 주 화요일까지');
  assert.ok(!p.includes('010-1234-5678') && !p.includes('teacher@school.kr'), p);
  assert.ok(p.includes('다음 주 화요일까지'), p);
});

test('쪽지 다시 읽기: 선생님이 고친 칸(제목·날짜·시간·장소·신청 기한·방법 등)은 그대로, 나머지는 새로 읽은 것', async () => {
  const { keepFields } = await import('../../web/menus/etc/message-ai.js');
  const prev = normMessage({ title: '내 제목', when: [{ date: '2026-11-12', time: '14:00' }], place: '강당', target: '전 교직원', apply: { due: '2026-11-06', how: '쪽지 회신' } });
  const next = normMessage({ title: 'AI 제목', when: [{ date: '2026-11-13', time: '15:00' }], place: '시청각실', target: '3학년 담임', apply: { due: '11월 둘째 주', how: '메일' }, bring: '노트북' });
  const m = keepFields(next, prev, ['title', 'time', 'place', 'due']);
  assert.equal(m.title, '내 제목');
  assert.deepEqual([m.when[0].date, m.when[0].time], ['2026-11-13', '14:00']);
  assert.equal(m.place, '강당');
  assert.equal(m.target, '3학년 담임');
  assert.deepEqual([m.apply.due, m.apply.dueNote, m.apply.how], ['2026-11-06', '', '메일']);
  assert.equal(m.bring, '노트북');
  assert.deepEqual(keepFields(next, prev, []), next);
  assert.equal(keepFields(normMessage({}), prev, ['date']).when[0].date, '2026-11-12', '새로 읽은 일시가 없어도');
});

test('쪽지 저장: 고친 칸 목록(touched)도 남음', async () => {
  const { saveDraft, getDraft } = await import('../../web/menus/etc/message-model.js');
  saveDraft({ id: 'd1', m: { title: 'x' }, len: 'base', attach: [], touched: ['place', 'zzz', 'title'] });
  assert.deepEqual(getDraft().touched, ['place', 'title']);
});

test('미뤄 둔 M10: 글로 온 기간 일시는 끝 날짜를 시간에 섞지 않고, 해를 넘기는 기간은 끝을 다음 해로', () => {
  assert.deepEqual(normMessage({ when: ['11.12~11.13 09:00'] }, { year: 2026 }).when, [{ date: '2026-11-12', end: '2026-11-13', time: '09:00', note: '' }]);
  assert.deepEqual(normMessage({ when: ['2026. 11. 12.(목) ~ 11. 13.(금) 09:00~16:00'] }).when, [{ date: '2026-11-12', end: '2026-11-13', time: '09:00~16:00', note: '' }]);
  assert.equal(normMessage({ when: [{ date: '12-30~01-02' }] }, { year: 2026 }).when[0].end, '2027-01-02');
  assert.equal(normMessage({ when: [{ date: '2026-12-30', end: '2026-12-28' }] }).when[0].end, '', '연도를 적은 앞선 끝은 버림');
});
