// 가정통신문 학교 양식(.hwpx): XML 읽개, 줄 읽기, 자리 찾기(자동·{표시}), 채우기 — 지어낸 「새싹초등학교」 양식
import test from 'node:test';
import assert from 'node:assert/strict';
import { unzip } from '../../web/core/zip.js';
import { scanXml, checkXml, readForm, findRoles, fillForm } from '../../web/core/hwpx-form.js';
import { letterFormHwpx, SAMPLE_PNG } from '../../scripts/sample-letter-form.mjs';

const dec = u8 => new TextDecoder().decode(u8);
const lineOf = (f, i) => (i >= 0 ? f.lines[i].text : null);

test('XML 읽개: 요소 위치·자식, 따옴표 안의 >, 잘 짜이지 않은 XML은 알림', () => {
  const x = '<?xml version="1.0"?><a k="1>2"><b/><c>t<d x="y"/></c><!-- <z> --></a>';
  const r = scanXml(x);
  const a = r.kids[0];
  assert.equal(a.name, 'a');
  assert.deepEqual(a.kids.map(k => k.name), ['b', 'c']);
  assert.equal(x.slice(a.kids[1].s, a.kids[1].e), '<c>t<d x="y"/></c>');
  assert.equal(x.slice(a.kids[1].oe, a.kids[1].cs), 't<d x="y"/>');
  assert.doesNotThrow(() => checkXml(x));
  assert.throws(() => checkXml('<a><b></a></b>'));
  assert.throws(() => checkXml('<a><b></b>'));
});

test('양식 읽기: 표 칸 안 줄도 글 차례대로, 머리·제목·본문·날짜·학교장·회신서', async () => {
  const f = await readForm(await letterFormHwpx());
  const t = f.lines.map(l => l.text);
  assert.ok(t.indexOf('가 정 통 신 문') < t.indexOf('교장 : 김새싹') && t.indexOf('교장 : 김새싹') < t.indexOf('2026학년도 학부모 상담 주간 안내'), t.slice(0, 12).join(' | '));
  assert.ok(f.lines.find(l => l.text === '가 정 통 신 문').inBox, '머리 표 안');
  assert.ok(f.lines.some(l => l.obj), '로고 그림 줄');
  const r = findRoles(f.lines);
  assert.equal(lineOf(f, r.title), '2026학년도 학부모 상담 주간 안내');
  assert.equal(lineOf(f, r.bodyStart), '안녕하십니까?');
  assert.equal(lineOf(f, r.bodyEnd), '붙임  상담 신청서 1부.');
  assert.equal(lineOf(f, r.date), '2026 . 3 . 3 .');
  assert.equal(lineOf(f, r.sign), '새 싹 초 등 학 교 장');
  assert.equal(lineOf(f, r.reply), '✂ - - - - - - 자 르 는 선 - - - - - -');
});

test('자리 찾기: {제목}·{본문}·{날짜} 표시가 있으면 그 줄, 회신서 없음', async () => {
  const f = await readForm(await letterFormHwpx({ marker: true }));
  const r = findRoles(f.lines);
  assert.deepEqual([lineOf(f, r.title), lineOf(f, r.bodyStart), lineOf(f, r.bodyEnd), lineOf(f, r.date), r.reply], ['{제목}', '{본문}', '{본문}', '{날짜}', -1]);
});

test('자리 찾기: 날짜와 학교 이름이 한 줄(「2025년 12월 12일 새 싹 초 등 학 교」), 인사가 없으면 제목 다음부터 본문', () => {
  const L = (text, box = 'sec') => ({ text, box, inBox: false, obj: false });
  const lines = [L('가 정 통 신 문'), L('겨울방학 안전 안내'), L('방학 동안 다음을 지도해 주세요.'), L('1. 물놀이 안전'), L(''), L('2025년 12월 12일 새 싹 초 등 학 교')];
  const r = findRoles(lines);
  assert.deepEqual([r.title, r.bodyStart, r.bodyEnd, r.date, r.sign, r.reply], [1, 2, 3, 5, 5, -1]);
});
