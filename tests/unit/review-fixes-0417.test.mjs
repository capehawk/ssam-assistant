// 계획 18 최종 검토 고침(단위): I2 연도 없는 기한은 오늘 이후 가까운 날, I3 공문 기한은 주간학습안내·날짜 겹침에 안 들어감,
// I4 학년도를 넘길 때 끝나지 않은 공문과 그 기한을 가져감, I6 회신서 답은 띄어쓰기를 빼고 맞추고 정확히 같지 않으면 「못 읽음」
import test from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../../web/core/store.js';
import { normGongmun, validDue } from '../../web/menus/etc/gongmun-ai.js';
import { dayIssues } from '../../web/core/calendar.js';
import { carryOver } from '../../web/core/years.js';
import { replyOptions, normReply } from '../../web/menus/etc/reply-collect.js';

function mem() { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; }
store.useStorage(mem());

test('I2 연도 없는 기한: 2월에 받은 새 학년도 공문 「3. 10.까지」는 다음 3월, 2. 29.도 맞는 해에서', () => {
  assert.equal(normGongmun({ due: '3. 10.' }, { year: 2026, today: '2027-02-15' }).due, '2027-03-10');
  assert.equal(normGongmun({ due: '11. 20.' }, { year: 2026, today: '2026-11-04' }).due, '2026-11-20');
  assert.equal(normGongmun({ due: '11. 1.' }, { year: 2026, today: '2026-11-04' }).due, '2026-11-01', '조금 지난 기한은 그대로(지남 표시)');
  assert.equal(normGongmun({ due: '2. 29.' }, { year: 2027, today: '2027-11-04' }).due, '2028-02-29');
  assert.equal(normGongmun({ due: '2026-03-10' }, { year: 2026, today: '2027-02-15' }).due, '2026-03-10', '연도를 쓴 날은 그대로');
});

test('I1 기한 칸 값: 2000~2100년의 날만(키보드로 연도를 고치는 중간 값은 버림)', () => {
  assert.ok(validDue('2026-11-20') && !validDue('0002-11-20') && !validDue('0202-11-20') && !validDue('') && !validDue('2026-13-01'));
});

test('I3 공문 기한(source gongmun)은 날짜 겹침 알림에 넣지 않음', () => {
  const events = [{ date: '2026-11-10', title: '[제출] A', source: 'gongmun' }, { date: '2026-11-10', title: '현장체험학습', source: 'event:x' }];
  assert.deepEqual(dayIssues('2026-11-10', { events, source: 'year:p' }), ['「현장체험학습」 일정과 겹쳐요']);
});

test('I4 학년도 넘기기: 끝나지 않은 공문은 가져가고 그 기한·할 일을 달력에 다시, 끝난 공문·옛 공문 일정은 버림', () => {
  const J = v => JSON.stringify(v);
  const snap = {
    calendar: J([{ date: '2027-03-02', title: '입학식', source: 'year:p' }, { date: '2027-03-05', title: '[제출] 끝난 것', source: 'gongmun' }, { date: '2027-02-20', title: '[제출] B', source: 'gongmun' }]),
    'gongmun:list': J([{ id: 'a', title: 'B', due: '2027-02-20', done: false, tasks: [{ text: '조사', due: '2027-03-03', done: false }] }, { id: 'b', title: '끝난 것', due: '2027-03-05', done: true, tasks: [] }])
  };
  const c = carryOver(snap, 2027);
  assert.deepEqual(JSON.parse(c['gongmun:list']).map(d => d.id), ['a']);
  const cal = JSON.parse(c.calendar);
  assert.deepEqual(cal.map(e => e.title).sort(), ['[제출] B', '[할 일] 조사', '입학식'].sort());
});

test('I6 회신서 답: 띄어쓰기만 다르면 그 선택지, 짧은 선택지가 긴 답 속에 들어 있다고 고르지 않음, 정확히 같지 않으면 못 읽음', () => {
  const opts = replyOptions(['동의 여부: □ 동의 □ 동의 안 함']);
  assert.deepEqual(normReply({ no: 1, answers: { '동의 여부': '동의 안함' } }, opts), { no: 1, answers: { '동의 여부': '동의 안 함' }, unsure: [] });
  const r = normReply({ no: 1, answers: { '동의 여부': '동의하지 않음' } }, opts);
  assert.ok(r.unsure.includes('동의 여부') && r.answers['동의 여부'] !== '동의', JSON.stringify(r));
  assert.deepEqual(normReply({ no: 1, answers: { '동의 여부': '동의' } }, opts).unsure, []);
});
