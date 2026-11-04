// 기타 › 공문 처리(스펙 2026-11-04 5장): 프롬프트·정리·차례·D-n·달력·오늘 수업 띠·저장
import test from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../../web/core/store.js';
import { gongmunPrompt, normGongmun, sortDocs, dday, ddayText, dueEvents, dueSoon, KINDS } from '../../web/menus/etc/gongmun-ai.js';

function mem() { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; }
store.useStorage(mem());

test('프롬프트: 공문 글(명단·전화번호 줄은 부르는 쪽에서 뺌)·오늘·학년도, JSON 꼴, 8천 자까지', () => {
  const p = gongmunPrompt({ name: '안내.hwp', text: '가'.repeat(9000), today: '2026-11-04', year: 2026 });
  assert.ok(p.startsWith('[공문 처리]') && p.includes('2026-11-04') && p.includes('"due"') && p.includes('"tasks"') && p.includes('"kinds"'));
  assert.ok(p.length < 8000 + 2500, String(p.length));
});

test('정리: 날짜는 YYYY-MM-DD(월·일만 오면 학년도로, 1~2월은 다음 해), 할 일 6개·끝냄 거짓, 넘기기는 아는 것만', () => {
  const g = normGongmun({ title: ' 2026 과학의 날 운영 안내 ', from: '○○교육청 과학과', no: '과학과-1234', date: '11. 2.', due: '1월 9일', dueNote: '공문 회신',
    summary: '요약 010-1234-5678', tasks: [{ text: '참가 신청서 제출', due: '11/20' }, ...Array.from({ length: 8 }, (_, i) => ({ text: `할 일 ${i}` })), { text: '' }], kinds: ['message', 'zzz', 'report', 'message'] }, { year: 2026 });
  assert.equal(g.title, '2026 과학의 날 운영 안내');
  assert.equal(g.date, '2026-11-02'); assert.equal(g.due, '2027-01-09');
  assert.equal(g.tasks.length, 6); assert.deepEqual(g.tasks[0], { text: '참가 신청서 제출', due: '2026-11-20', done: false });
  assert.deepEqual(g.kinds, ['message', 'report']);
  assert.ok(!g.summary.includes('010'));
  assert.deepEqual(normGongmun(null, { year: 2026 }).tasks, []);
  assert.deepEqual(KINDS.map(k => k[0]), ['message', 'letter', 'purchase', 'report']);
});

test('D-n: 오늘 D-day, 지나면 「n일 지남」, 기한 없으면 빈칸', () => {
  assert.equal(dday('2026-11-04', '2026-11-04'), 0); assert.equal(dday('2026-11-07', '2026-11-04'), 3); assert.equal(dday('2026-11-01', '2026-11-04'), -3);
  assert.equal(dday('', '2026-11-04'), null);
  assert.equal(ddayText(0), 'D-day'); assert.equal(ddayText(3), 'D-3'); assert.equal(ddayText(-3), '3일 지남'); assert.equal(ddayText(null), '');
  assert.equal(dday('2027-01-02', '2026-12-30'), 3, '해 넘김');
});

test('차례: 끝나지 않은 것 → 기한 가까운 것(지난 것 먼저) → 기한 없음 → 넣은 차례(늦은 것 먼저), 끝난 것은 맨 아래', () => {
  const d = (id, due, at, done = false) => ({ id, due, at, done, tasks: [] });
  const out = sortDocs([d('a', '', 5), d('b', '2026-11-10', 1), d('c', '2026-11-01', 2), d('e', '2026-11-05', 3, true), d('f', '', 9)]).map(x => x.id);
  assert.deepEqual(out, ['c', 'b', 'f', 'a', 'e']);
});

test('달력: 끝나지 않은 문서의 기한(「[제출] 제목」)과 기한 있는 할 일(끝난 것 빼고)', () => {
  const ev = dueEvents([{ title: 'A 안내', due: '2026-11-10', done: false, tasks: [{ text: '신청', due: '2026-11-07', done: false }, { text: '끝난 일', due: '2026-11-08', done: true }, { text: '기한 없음', due: '', done: false }] },
    { title: '끝난 공문', due: '2026-11-11', done: true, tasks: [{ text: 'x', due: '2026-11-12', done: false }] }]);
  assert.deepEqual(ev, [{ date: '2026-11-10', title: '[제출] A 안내' }, { date: '2026-11-07', title: '[할 일] 신청' }]);
});

test('오늘 수업 띠: 오늘부터 7일 안(지난 것 포함)·끝나지 않은 것, 가까운 차례 3개까지', () => {
  const d = (title, due, done = false) => ({ id: title, title, due, done, tasks: [], at: 0 });
  const s = dueSoon([d('먼 것', '2026-11-20'), d('지난 것', '2026-11-01'), d('오늘', '2026-11-04'), d('끝남', '2026-11-05', true), d('사흘', '2026-11-07'), d('이레', '2026-11-11'), d('기한 없음', '')], '2026-11-04');
  assert.deepEqual(s.map(x => [x.title, x.n]), [['지난 것', -3], ['오늘', 0], ['사흘', 3]]);
});

test('저장: 40개까지, 글은 8천 자까지, 바꿀 때마다 달력에', async () => {
  const { listDocs, putDoc, removeDoc, newDocId } = await import('../../web/menus/etc/gongmun-model.js');
  const { listEvents } = await import('../../web/core/calendar.js');
  for (let i = 0; i < 42; i++) putDoc({ id: 'g' + i, name: 'a', title: 't' + i, text: 'x'.repeat(9000), due: i === 41 ? '2026-11-10' : '', tasks: [], kinds: [], at: i });
  assert.equal(listDocs().length, 40);
  assert.equal(listDocs().find(x => x.id === 'g41').text.length, 8000);
  assert.ok(listEvents().some(e => e.source === 'gongmun' && e.title === '[제출] t41'));
  removeDoc('g41');
  assert.ok(!listEvents().some(e => e.source === 'gongmun'));
  assert.ok(newDocId() !== newDocId());
});
