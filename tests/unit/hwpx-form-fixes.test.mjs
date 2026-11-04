// 가정통신문 양식 최종 검토 고침: 직인생략 학교장 줄, 인사 없는·머리에 연락처만 있는 양식, 꼬리말·떠 있는 그림 보존, 둘째 구역 회신서,
// 날짜·학교장 한 문단(조각·탭) 그대로, 요일, 양식 옛 글 개인정보, 긴 본문 저장, {표시} 양식의 옛 회신서, 자리 순서 점검
import test from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../../web/core/store.js';
import { unzip } from '../../web/core/zip.js';
import { readForm, findRoles, fillForm, swapDate, checkXml, isSign, rolesValid } from '../../web/core/hwpx-form.js';
import { letterFormHwpx } from '../../scripts/sample-letter-form.mjs';

function mem() { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; }
store.useStorage(mem());
const dec = u8 => new TextDecoder().decode(u8);
const at = (f, i) => (i >= 0 ? f.lines[i].text : null);
const L = { title: '새 제목', date: '2026-11-04', body: ['안녕하십니까?', '1. 일시: 11. 12.'], reply: null };
const secOf = async (bytes, n = 0) => dec((await unzip(bytes)).get(`Contents/section${n}.xml`));

test('I-1 학교장 줄: 「…학교장 [직인생략]」·「(직인 생략)」·「○○초등학교 교장」도, 날짜와 한 문단(탭)이어도', async () => {
  assert.ok(isSign('새싹초등학교장 [직인생략]') && isSign('새 싹 초 등 학 교 장(직인 생략)') && isSign('새싹초등학교 교장'));
  assert.ok(!isSign('2. 신청 방법: 학교 누리집') && !isSign('학교장 인사말을 드립니다. 이번 행사는 학교에서 큰 의미가 있습니다.'));
  const f = await readForm(await letterFormHwpx({ dateSign: true, sign: '새싹초등학교장 [직인생략]' }));
  const r = findRoles(f.lines);
  assert.equal(at(f, r.date), '2026. 3. 3.(화)\t새싹초등학교장 [직인생략]');
  assert.equal(r.sign, r.date);
  assert.equal(at(f, r.bodyEnd), '붙임  상담 신청서 1부.');
  assert.equal(at(f, r.reply), '✂ - - - - - - 자 르 는 선 - - - - - -');
});

test('자리 순서 점검(rolesValid): 제목 < 본문 시작 ≤ 본문 끝 < 날짜 ≤ 학교장 < 회신서', () => {
  assert.ok(rolesValid({ title: 1, bodyStart: 2, bodyEnd: 5, date: 7, sign: 8, reply: 10 }));
  assert.ok(rolesValid({ title: 1, bodyStart: 2, bodyEnd: 5, date: 7, sign: 7, reply: -1 }));
  assert.ok(!rolesValid({ title: 1, bodyStart: 2, bodyEnd: 7, date: 7, sign: 8, reply: -1 }), '본문이 날짜를 덮음');
  assert.ok(!rolesValid({ title: 3, bodyStart: 2, bodyEnd: 5, date: 7, sign: 8, reply: -1 }));
  assert.ok(!rolesValid({ title: 1, bodyStart: 2, bodyEnd: 5, date: 7, sign: 8, reply: 6 }), '회신서가 날짜 위');
  assert.ok(!rolesValid({ title: 1, bodyStart: 2, bodyEnd: 5, date: -1, sign: -1, reply: -1 }));
});

test('I-2 인사가 없고 머리 표에 주소·전화·누리집만 있어도 제목·본문은 머리 표 밖에서', async () => {
  const f = await readForm(await letterFormHwpx({ contacts: true, noGreet: true }));
  const r = findRoles(f.lines);
  assert.equal(at(f, r.title), '2026학년도 학부모 상담 주간 안내');
  assert.equal(at(f, r.bodyStart), '학생의 학교생활을 함께 살피기 위하여 학부모 상담 주간을 운영합니다.');
  assert.ok(!f.lines[r.title].inBox && !f.lines[r.bodyStart].inBox);
});

test('I-2 제목이 「학부모님께 드리는 글」이어도 제목, 머리 줄(교장·담당)은 제목이 아님', async () => {
  const f = await readForm(await letterFormHwpx({ title: '학부모님께 드리는 글' }));
  const r = findRoles(f.lines);
  assert.equal(at(f, r.title), '학부모님께 드리는 글');
  assert.equal(at(f, r.bodyStart), '안녕하십니까?');
});

test('I-3 지운 옛 본문에 있던 꼬리말(조절자)·떠 있는 그림은 새 본문 첫 문단으로 옮겨 남음', async () => {
  const f = await readForm(await letterFormHwpx({ anchors: true }));
  const sec = await secOf((await fillForm(f, findRoles(f.lines), L)).bytes);
  assert.doesNotThrow(() => checkXml(sec));
  assert.ok(sec.includes('새싹초등학교 꼬리말') && sec.includes('<hp:footer') && /<hp:pic id="9[^"]*"[^>]*instid="2"/.test(sec), '꼬리말·떠 있는 그림');
  assert.ok(!sec.includes('항상 본교 교육 활동에'), '옛 본문 글은 지움');
});

test('I-4 회신서가 둘째 구역(구역 설정 문단부터)이면 구역 설정 문단은 남기고 회신서만 바꿈', async () => {
  const f = await readForm(await letterFormHwpx({ twoSections: true }));
  const r = findRoles(f.lines);
  assert.equal(at(f, r.reply), '✂ - - - - - - 자 르 는 선 - - - - - -');
  for (const reply of [null, { title: '참가 동의서', fields: ['참가: □'], due: '' }]) {
    const s1 = await secOf((await fillForm(f, r, { ...L, reply })).bytes, 1);
    assert.doesNotThrow(() => checkXml(s1));
    assert.ok(s1.includes('<hp:secPr') && /<hp:p /.test(s1), '구역 설정·문단이 남음');
    assert.ok(!s1.includes('학부모 상담 신청서'), '옛 회신서 지움');
    assert.equal(s1.includes('참가 동의서'), !!reply);
  }
});

test('I-5·I-6 날짜·학교장 한 문단: 날짜 글자만 바꾸고(요일도) 학교장 조각(글자 모양)·탭은 그대로', async () => {
  const f = await readForm(await letterFormHwpx({ dateSign: true, sign: '새싹초등학교장 [직인생략]' }));
  const sec = await secOf((await fillForm(f, findRoles(f.lines), L)).bytes);
  const p = /<hp:p [^>]*>(?:(?!<\/hp:p>)[\s\S])*새싹초등학교장 \[직인생략\][\s\S]*?<\/hp:p>/.exec(sec)[0];
  assert.ok(p.includes('<hp:t>2026. 11. 4.(수)<hp:tab width="4000" leader="0" type="1"/></hp:t>'), p);
  assert.ok(p.includes('<hp:run charPrIDRef="2"><hp:t>새싹초등학교장 [직인생략]</hp:t></hp:run>'), p);
  assert.ok(!p.includes('linesegarray') && !/<hp:t>[^<]*\t/.test(p));
  assert.equal(swapDate('2026. 3. 3.(화)', '2026-11-04'), '2026. 11. 4.(수)');
  assert.equal(swapDate('2026년 3월 3일 (화)', '2026-11-05'), '2026년 11월 5일 (목)');
  assert.equal(swapDate('2026년 3월 3일 화요일', '2026-11-06'), '2026년 11월 6일 금요일');
  assert.equal(swapDate('2026 . 3 . 3 .', '2026-11-04'), '2026 . 11 . 4 .');
});

test('M2 {표시} 양식도 학교장 아래 옛 회신서를 찾아, 끄면 지움', async () => {
  const f = await readForm(await letterFormHwpx({ marker: true, markerReply: true }));
  const r = findRoles(f.lines);
  assert.equal(at(f, r.reply), '✂ - - - - - - 자 르 는 선 - - - - - -');
  const sec = await secOf((await fillForm(f, r, L)).bytes);
  assert.ok(!sec.includes('학부모 상담 신청서') && sec.includes('새 싹 초 등 학 교 장'));
});

test('I-7 양식 옛 글(문체 참고): 전화번호·이메일 줄은 빼고, 머리·학교장 줄은 넣지 않음', async () => {
  const { formSample, plainFromText } = await import('../../web/menus/etc/letter-ai.js');
  const lines = ['가 정 통 신 문', '교장 : 김새싹', '현장체험학습 안내', '안녕하십니까?', '※ 문의: 교무부장 김새싹 (☎ 041-550-1234)', '☎ 550-1234', '전화 041) 550-1234', '메일 a@b.kr 로 보내 주세요', '1. 일시: 11. 12.', '2026. 3. 3.', '새싹초등학교장']
    .map(text => ({ text, box: 'sec', inBox: false, obj: false }));
  const s = formSample(lines, findRoles(lines));
  assert.ok(s.startsWith('현장체험학습 안내') && s.includes('1. 일시') && s.includes('안녕하십니까?'), s);
  for (const bad of ['550-1234', 'a@b.kr', '김새싹', '교장 :', '새싹초등학교장']) assert.ok(!s.includes(bad), bad + ' | ' + s);
  assert.ok(!plainFromText(lines.map(l => l.text).join('\n')).sample.includes('550-1234'));
});

test('I-8 긴 본문(한 줄 1,500자·150줄)도 저장한 그대로', async () => {
  const { saveCurrent, getCurrent } = await import('../../web/menus/etc/letter-model.js');
  const body = Array.from({ length: 150 }, (_, i) => `${i}. ` + '가'.repeat(1500));
  saveCurrent({ id: 'lt1', out: { title: 'T', date: '2026-11-04', body, replyOn: false, reply: {}, short: '' } });
  const got = getCurrent().out.body;
  assert.ok(got.length === 150 && got.every((l, i) => l === body[i]), `줄 ${got.length}, 첫 줄 ${got[0] && got[0].length}자`);
});
