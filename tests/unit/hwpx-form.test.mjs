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

/* ---------- 채우기 ---------- */
const LETTER = {
  title: '2026학년도 가을 현장체험학습 안내', date: '2026-11-03',
  body: ['안녕하십니까?', '보호자님 가정에 평안을 빕니다.', '', '1. 일시: 2026. 11. 12.(목) 09:00~15:00', '  가. 장소: 국립중앙과학관', '나. 준비물: 도시락 & 물', '1) 비가 오면 교내 활동으로 바꿉니다.', '- 멀미약은 미리 먹여 주세요.', '', '가정에서도 안전 지도를 부탁드립니다.'],
  reply: { title: '현장체험학습 참가 동의서', fields: ['참가 여부: □ 참가합니다  □ 참가하지 않습니다', '알레르기: '], due: '11. 7.(금)까지 담임 선생님께 제출해 주세요.' }
};
const parasOf = xml => { const out = []; const re = /<hp:p [^>]*>[\s\S]*?<\/hp:p>/g; let m; while ((m = re.exec(xml))) out.push(m[0]); return out; };
const paraWith = (xml, text) => parasOf(xml).filter(p => !/<hp:tbl/.test(p)).find(p => p.includes(`<hp:t>${text}</hp:t>`));

test('채우기: 제목·날짜(양식 꼴)·본문은 바뀌고 머리·로고·학교장은 그대로, XML이 잘 짜임', async () => {
  const src = await letterFormHwpx(), form = await readForm(src);
  const { bytes, warn } = await fillForm(form, findRoles(form.lines), LETTER);
  assert.deepEqual(warn, []);
  const z = await unzip(bytes), sec = dec(z.get('Contents/section0.xml'));
  assert.doesNotThrow(() => checkXml(sec)); assert.doesNotThrow(() => checkXml(dec(z.get('Contents/header.xml'))));
  assert.deepEqual([...z.keys()], [...(await unzip(src)).keys()], '파일·차례 그대로');
  assert.deepEqual(z.get('BinData/image1.png'), SAMPLE_PNG);
  const out = await readForm(bytes), t = out.lines.map(l => l.text);
  for (const keep of ['가 정 통 신 문', '교장 : 김새싹', '새 싹 초 등 학 교 장', '우)00000 ○○시 새싹로 1 (☎ 000-000-0000) http://saessak.example']) assert.ok(t.includes(keep), keep);
  assert.ok(t.includes('2026학년도 가을 현장체험학습 안내') && !t.includes('2026학년도 학부모 상담 주간 안내'));
  assert.ok(t.includes('2026 . 11 . 3 .') && !t.includes('2026 . 3 . 3 .'), '날짜');
  assert.ok(!t.some(x => x.includes('대면 상담')), '옛 본문');
  const i0 = t.indexOf('2026학년도 가을 현장체험학습 안내'), i1 = t.indexOf('2026 . 11 . 3 .');
  assert.deepEqual(t.slice(i0 + 1, i1).filter(x => x.trim()), LETTER.body.filter(x => x.trim()).map(x => x.replace(/^\s+/, s => s)).map(x => (/^(  )?가\./.test(x) || /^나\./.test(x) ? '  ' + x.trim() : /^1\)/.test(x) ? '    ' + x : x)));
  assert.ok(dec(z.get('Preview/PrvText.txt')).includes('현장체험학습'), '미리 보기 글');
});

test('채우기: 본문 줄은 양식의 같은 단계 문단 모양(1. 3번 · 가. 4번 · 1) 5번, 앞 공백)을 따르고, 바꾼 문단은 줄 배치를 지움', async () => {
  const form = await readForm(await letterFormHwpx());
  const sec = dec((await unzip((await fillForm(form, findRoles(form.lines), LETTER)).bytes)).get('Contents/section0.xml'));
  const p1 = paraWith(sec, '1. 일시: 2026. 11. 12.(목) 09:00~15:00'), p2 = paraWith(sec, '  나. 준비물: 도시락 &amp; 물'), p3 = paraWith(sec, '    1) 비가 오면 교내 활동으로 바꿉니다.');
  assert.ok(p1 && /paraPrIDRef="3"/.test(p1) && /charPrIDRef="1"/.test(p1), p1);
  assert.ok(p2 && /paraPrIDRef="4"/.test(p2), p2);
  assert.ok(p3 && /paraPrIDRef="5"/.test(p3), p3);
  assert.ok(/paraPrIDRef="0"/.test(paraWith(sec, '보호자님 가정에 평안을 빕니다.')));
  assert.ok(/paraPrIDRef="0"/.test(paraWith(sec, '- 멀미약은 미리 먹여 주세요.')), '「-」 줄은 양식에 없으면 보통 문단');
  for (const p of [p1, p2, p3, paraWith(sec, '2026학년도 가을 현장체험학습 안내'), paraWith(sec, '2026 . 11 . 3 .')]) assert.ok(!p.includes('linesegarray'), p.slice(0, 80));
  assert.ok(paraWith(sec, '새 싹 초 등 학 교 장').includes('linesegarray'), '안 바꾼 문단은 그대로');
});

test('채우기: 회신서를 켜면 옛 회신서 대신 자르는 선·제목·표·제출 안내, 끄면 옛 회신서만 지움', async () => {
  const form = await readForm(await letterFormHwpx());
  const roles = findRoles(form.lines);
  const on = await unzip((await fillForm(form, roles, LETTER)).bytes);
  const sec = dec(on.get('Contents/section0.xml')), head = dec(on.get('Contents/header.xml'));
  assert.ok(!sec.includes('학부모 상담 신청서') && sec.includes('현장체험학습 참가 동의서') && sec.includes('자 르 는 선'));
  // 칸은 「이름: 내용」을 두 칸(이름 | 내용)으로
  assert.ok(sec.includes('<hp:t>참가 여부</hp:t>') && sec.includes('<hp:t>□ 참가합니다  □ 참가하지 않습니다</hp:t>') && sec.includes('<hp:t>알레르기</hp:t>') && sec.includes('<hp:t>학생 이름</hp:t>') && sec.includes('11. 7.(금)까지 담임 선생님께 제출해 주세요.'), sec.slice(-2500));
  assert.equal((sec.match(/<hp:tbl /g) || []).length, 2, '머리 표 + 새 회신서 표');
  assert.ok(/<hh:borderFills itemCnt="5">/.test(head) && head.includes('<hh:borderFill id="5"'), '실선 테두리 더함');
  assert.ok(new RegExp('<hp:tbl [^>]*borderFillIDRef="5"').test(sec), '새 표가 새 테두리');
  const off = dec((await unzip((await fillForm(form, roles, { ...LETTER, reply: null })).bytes)).get('Contents/section0.xml'));
  assert.ok(!off.includes('자 르 는 선') && !off.includes('학부모 상담 신청서') && (off.match(/<hp:tbl /g) || []).length === 1, '회신서 지움');
  assert.ok(off.includes('새 싹 초 등 학 교 장'));
});

test('채우기: 같은 양식으로 두 번 채워도 첫 결과가 남지 않음, {표시} 양식은 표시 자리에(단계 모양이 없으면 그 문단 모양)', async () => {
  const form = await readForm(await letterFormHwpx());
  const roles = findRoles(form.lines);
  await fillForm(form, roles, { ...LETTER, title: '첫째 제목' });
  const second = dec((await unzip((await fillForm(form, roles, { ...LETTER, title: '둘째 제목' })).bytes)).get('Contents/section0.xml'));
  assert.ok(second.includes('둘째 제목') && !second.includes('첫째 제목'));
  const mf = await readForm(await letterFormHwpx({ marker: true }));
  const ms = dec((await unzip((await fillForm(mf, findRoles(mf.lines), { ...LETTER, reply: null })).bytes)).get('Contents/section0.xml'));
  assert.ok(!ms.includes('{제목}') && !ms.includes('{본문}') && !ms.includes('{날짜}') && ms.includes('2026 . 11 . 3 .') === false && ms.includes('2026. 11. 3.'), '표시 날짜는 「YYYY. M. D.」');
  assert.ok(/paraPrIDRef="0"/.test(paraWith(ms, '1. 일시: 2026. 11. 12.(목) 09:00~15:00')), '표시 문단 모양');
});

test('채우기: 회신서가 본문과 같은 큰 표 안이면 회신서는 지우지 않고 알림, 본문은 그 칸 안에서 바뀜', async () => {
  const form = await readForm(await letterFormHwpx({ box: true }));
  const roles = findRoles(form.lines);
  const r = await fillForm(form, roles, { ...LETTER, reply: null });
  assert.deepEqual(r.warn, ['reply-in-box']);
  const t = (await readForm(r.bytes)).lines.map(l => l.text);
  assert.ok(t.includes('학부모 상담 신청서') && t.includes('2026학년도 가을 현장체험학습 안내') && !t.some(x => x.includes('대면 상담')), t.join(' | ').slice(0, 300));
});

test('날짜 바꾸기: 양식 꼴 그대로, 같은 줄의 학교 이름은 그대로, 날이 비어 있어도', async () => {
  const { swapDate } = await import('../../web/core/hwpx-form.js');
  assert.equal(swapDate('2026 . 3 . 3 .', '2026-11-03'), '2026 . 11 . 3 .');
  assert.equal(swapDate('2025년 12월 12일 새 싹 초 등 학 교', '2026-11-03'), '2026년 11월 3일 새 싹 초 등 학 교');
  assert.equal(swapDate('2026. 3. 3.', '2026-11-03'), '2026. 11. 3.');
  assert.equal(swapDate('2026 .  3 .    .', '2026-11-03'), '2026 .  11 .    3.');
  assert.equal(swapDate('{날짜}', '2026-11-03'), '2026. 11. 3.');
});
