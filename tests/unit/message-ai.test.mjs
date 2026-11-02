// 쪽지 규칙: 안내 프롬프트, AI 답 다듬기(연도 채우기·없는 날·종류·주요 내용 5줄·전화번호 지움), 날짜 꼴, 쪽지 글 맞추기(짧게·기본·자세히·붙임·문의·다시 안내)
import test from 'node:test';
import assert from 'node:assert/strict';
import { KINDS, messagePrompt, normMessage, fmtDay, composeMessage } from '../../web/menus/etc/message-ai.js';

const RAW = { kind: 'training', title: 'AI 활용 수업 연수', when: [{ date: '11-12', time: '15:00~16:30' }], place: '시청각실', target: '전 교직원',
  apply: { due: '2026-11-06', how: '이음 쪽지로 회신' }, bring: '개인 노트북', notes: '출장 처리 없음', points: ['생성형 AI 소개', '수업 사례', '실습', '질의응답', '설문', '여섯째'] };

test('날짜 꼴: 2026. 11. 12.(목), 없는 날은 빈 글', () => {
  assert.equal(fmtDay('2026-11-12'), '2026. 11. 12.(목)');
  assert.equal(fmtDay('2026-11-06'), '2026. 11. 6.(금)');
  assert.equal(fmtDay('2026-13-40'), '');
  assert.equal(fmtDay(''), '');
});

test('답 다듬기: 연도 없는 날은 지금 학년도, 없는 날은 날짜를 비우고 글은 남김, 모르는 종류는 etc, 주요 내용 5줄, 전화번호 지움', () => {
  const m = normMessage(RAW, { year: 2026 });
  assert.equal(m.kind, 'training');
  assert.deepEqual(m.when, [{ date: '2026-11-12', time: '15:00~16:30', note: '' }]);
  assert.equal(m.apply.due, '2026-11-06');
  assert.equal(m.points.length, 5);
  const bad = normMessage({ kind: '?', when: [{ date: '2026-13-40', note: '13월 40일' }], place: '강당(문의 041-123-4567)' }, { year: 2026 });
  assert.equal(bad.kind, 'etc');
  assert.equal(bad.when[0].date, '');
  assert.equal(bad.when[0].note, '13월 40일');
  assert.ok(!bad.place.includes('041-123-4567'), bad.place);
  const none = normMessage(null, { year: 2026 });
  assert.deepEqual(none.when, []);
  assert.equal(none.title, '');
  assert.equal(KINDS.training, '연수 안내');
});

test('쪽지 글(기본): 제목 머리, 인사, □ 일시·장소·대상·신청·준비물, 붙임 번호·끝., 문의, 감사합니다', () => {
  const m = normMessage(RAW, { year: 2026 });
  const r = composeMessage(m, { len: 'base', attach: ['AI 활용 연수 계획', '연수 공문'], sender: '교무부 ○○○(내선 123)' });
  assert.equal(r.title, '[연수 안내] AI 활용 수업 연수');
  const b = r.body;
  assert.ok(b.startsWith('선생님들, 안녕하세요.\nAI 활용 수업 연수를 아래와 같이 안내드립니다.'), b.slice(0, 80));
  for (const l of ['□ 일시: 2026. 11. 12.(목) 15:00~16:30', '□ 장소: 시청각실', '□ 대상: 전 교직원', '□ 신청: 2026. 11. 6.(금)까지 이음 쪽지로 회신', '□ 준비물·유의 사항: 개인 노트북 / 출장 처리 없음',
    '붙임  1. AI 활용 연수 계획 1부.\n      2. 연수 공문 1부.  끝.', '문의: 교무부 ○○○(내선 123)']) assert.ok(b.includes(l), l + '\n---\n' + b);
  assert.ok(b.trim().endsWith('감사합니다.'), b);
  assert.ok(!b.includes('주요 내용'), '기본에 주요 내용');
});

test('짧게·자세히·없는 줄 빼기·문의·붙임 없음·다시 안내', () => {
  const m = normMessage(RAW, { year: 2026 });
  const short = composeMessage(m, { len: 'short' }).body;
  assert.ok(!short.includes('준비물') && short.includes('□ 신청'), short);
  const long = composeMessage(m, { len: 'long' }).body;
  assert.ok(long.includes('□ 주요 내용\n  - 생성형 AI 소개'), long);
  const noPlace = composeMessage({ ...m, place: '' }, {}).body;
  assert.ok(!noPlace.includes('□ 장소'), noPlace);
  const plain = composeMessage(m, { attach: [], sender: '' }).body;
  assert.ok(!plain.includes('붙임') && !plain.includes('문의'), plain);
  const one = composeMessage(m, { attach: ['연수 계획'] }).body;
  assert.ok(one.includes('붙임  연수 계획 1부.  끝.'), one);
  const again = composeMessage(m, { again: true });
  assert.equal(again.title, '[다시 안내] AI 활용 수업 연수');
  assert.ok(again.body.includes('다시 한번 안내드립니다.'), again.body);
  const two = composeMessage({ ...m, when: [{ date: '2026-11-12', time: '15:00', note: '' }, { date: '2026-11-19', time: '15:00', note: '2차' }] }, {}).body;
  assert.ok(two.includes('□ 일시: 2026. 11. 12.(목) 15:00\n        2026. 11. 19.(목) 15:00 (2차)'), two);
  assert.equal(composeMessage({ ...m, kind: 'etc', title: '' }, {}).title, '[안내]');
});

test('안내 프롬프트: 머리·출력 모양·지어내지 않기·사람 이름·전화번호 쓰지 않기', () => {
  const p = messagePrompt('2026 AI 활용 수업 연수 안내\n일시: 11. 12.(목) 15:00', { nImages: 1 });
  assert.ok(p.startsWith('[쪽지 안내]'), p.slice(0, 20));
  assert.ok(p.includes('"apply"') && p.includes('지어내지') && p.includes('전화번호') && p.includes('그림 1장') && p.includes('AI 활용 수업 연수 안내'), p);
});
