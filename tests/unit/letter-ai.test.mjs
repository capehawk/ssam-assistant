// 가정통신문: .hwp·기본 양식(글 짜임만), AI 프롬프트·답 정리, 본문 맞추기, 발송 기안
import test from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../../web/core/store.js';
import { plainFromText, defaultPlain, plainLetterDoc, letterPrompt, normLetter, composeBody, composeSend, spaced } from '../../web/menus/etc/letter-ai.js';
import { docHtml, makeDocx } from '../../web/core/doc-export.js';
import { makeHwpx } from '../../web/core/hwpx.js';
import { unzip } from '../../web/core/zip.js';

function mem() { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; }
store.useStorage(mem());
const HWP_TEXT = ['꿈을 키우는 새싹 교육', '가 정 통 신 문', '교장 : 김새싹', '우)00000 ○○시 새싹로 1 (☎ 000-000-0000)', '2026학년도 학부모 상담 주간 안내', '안녕하십니까?', '1. 기간: 3. 16.~3. 20.', '', '2026 . 3 . 3 .', '새 싹 초 등 학 교 장', '학부모 상담 신청서'].join('\n');

test('.hwp 양식(글만): 머리 줄들·학교장 줄·날짜 꼴을 얻음(옛 제목·본문·회신서는 뺌), 기본 양식은 학교 이름으로', () => {
  const p = plainFromText(HWP_TEXT);
  assert.deepEqual(p.head, ['꿈을 키우는 새싹 교육', '가 정 통 신 문', '교장 : 김새싹', '우)00000 ○○시 새싹로 1 (☎ 000-000-0000)']);
  assert.equal(p.sign, '새 싹 초 등 학 교 장');
  assert.equal(p.dateFmt, '2026 . 3 . 3 .');
  assert.ok(p.sample.includes('안녕하십니까?') && !p.sample.includes('학부모 상담 신청서'), '문체 참고는 옛 제목·본문');
  assert.equal(spaced('새싹초등학교장'), '새 싹 초 등 학 교 장');
  const d = defaultPlain('새싹초등학교');
  assert.deepEqual([d.head, d.sign, d.dateFmt], [['가 정 통 신 문', '새싹초등학교'], '새 싹 초 등 학 교 장', '{날짜}']);
  assert.equal(defaultPlain('').sign, '○ ○ 초 등 학 교 장');
});

const LETTER = { title: '가을 현장체험학습 안내', date: '2026-11-03', body: ['안녕하십니까?', '1. 일시: 11. 12.(목)', '  가. 장소: 과학관'], reply: { title: '참가 동의서', fields: ['참가 여부: □ 참가  □ 불참'], due: '11. 7.(금)까지 제출' } };

test('글 짜임 양식 문서: 「가 정 통 신 문」이 맨 위, 머리 줄 가운데, 제목, 본문, 날짜·학교장 가운데, 회신서(자르는 선·표)', async () => {
  const doc = plainLetterDoc(plainFromText(HWP_TEXT), LETTER);
  assert.equal(doc.title, '가 정 통 신 문');
  const b = doc.blocks;
  assert.deepEqual(b.slice(0, 3).map(x => [x.type, x.text]), [['c', '꿈을 키우는 새싹 교육'], ['c', '교장 : 김새싹'], ['c', '우)00000 ○○시 새싹로 1 (☎ 000-000-0000)']]);
  assert.ok(b.some(x => x.type === 'c' && x.bold && x.text === '가을 현장체험학습 안내'));
  assert.ok(b.some(x => x.type === 'p' && x.text === '  가. 장소: 과학관'));
  assert.ok(b.some(x => x.type === 'c' && x.text === '2026 . 11 . 3 .') && b.some(x => x.type === 'c' && x.bold && x.text === '새 싹 초 등 학 교 장'));
  const t = b.find(x => x.type === 'table');
  assert.deepEqual(t.rows, [['학년 반 번호', '      학년        반        번'], ['학생 이름', ''], ['참가 여부', '□ 참가  □ 불참']]);
  assert.ok(b.some(x => /자 르 는 선/.test(x.text || '')));
  assert.ok(!plainLetterDoc(defaultPlain('새싹초등학교'), { ...LETTER, reply: null }).blocks.some(x => x.type === 'table'), '회신서 끄면 표 없음');
  assert.ok(plainLetterDoc(defaultPlain('새싹초등학교'), LETTER).blocks.some(x => x.text === '2026. 11. 3.'), '기본 양식 날짜');
  // 가운데 줄 블록(c)은 한글·워드·PDF 모두
  const sec = new TextDecoder().decode((await unzip(makeHwpx(doc))).get('Contents/section0.xml'));
  assert.ok(/<hp:p [^>]*paraPrIDRef="1"[^>]*><hp:run charPrIDRef="1"><hp:t>새 싹 초 등 학 교 장<\/hp:t>/.test(sec), '한글 가운데 굵게');
  assert.ok(new TextDecoder().decode((await unzip(makeDocx(doc))).get('word/document.xml')).includes('<w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">새 싹 초 등 학 교 장'), '워드 가운데');
  assert.ok(docHtml(doc).includes('<p class="c"><b>새 싹 초 등 학 교 장</b></p>'), 'PDF 가운데');
});

test('프롬프트: 공문·넣을 내용·양식 옛 글(문체 참고)·오늘, 지어내지 않기·이름 없음, JSON 꼴', () => {
  const p = letterPrompt({ sources: [{ name: '교육청 공문.hwp', text: '현장체험학습 안전 강화 안내' + '가'.repeat(7000) }], memo: '11월 12일 과학관 견학, 도시락', sample: '안녕하십니까? 항상 감사드립니다.', today: '2026-11-03', year: 2026 });
  assert.ok(p.includes('[공문·계획: 교육청 공문.hwp]') && p.includes('[넣을 내용]\n11월 12일 과학관 견학, 도시락') && p.includes('[양식의 옛 글(문체만 참고)]'));
  assert.ok(p.includes('2026-11-03') && p.includes('지어내지') && p.includes('"reply"') && p.includes('"short"'));
  assert.ok(!p.includes('가'.repeat(6001)));
});

test('답 정리·본문 맞추기: 인사 → 빈 줄 → 취지 → 빈 줄 → 항목 → 빈 줄 → 맺음, 전화번호 지움, 회신서 칸', () => {
  const n = normLetter({ title: '가을 현장체험학습 안내', greeting: ['안녕하십니까?', '항상 감사드립니다.'], intro: '견학을 다음과 같이 실시합니다.', items: ['1. 일시: 11. 12.(목)', '2. 문의: 담임(010-1234-5678)'], closing: '많은 관심 부탁드립니다.',
    reply: { need: true, title: '참가 동의서', fields: ['참가 여부: □ 참가  □ 불참', 7], due: '11. 7.까지' }, short: '11월 12일 과학관 견학이 있어요.', related: [{ no: 'A-1', date: '2026-10-30', title: '안전 강화' }], target: '3학년 보호자' }, { year: 2026 });
  assert.deepEqual(composeBody(n), ['안녕하십니까?', '항상 감사드립니다.', '', '견학을 다음과 같이 실시합니다.', '', '1. 일시: 11. 12.(목)', '2. 문의: 담임', '', '많은 관심 부탁드립니다.']);
  assert.deepEqual(n.reply, { need: true, title: '참가 동의서', fields: ['참가 여부: □ 참가  □ 불참'], due: '11. 7.까지' });
  assert.equal(normLetter(null).title, '');
  assert.deepEqual(normLetter({ reply: { need: false } }).reply.need, false);
});

test('발송 기안: 관련 → 발송하고자 합니다 → 가·나·다 → 붙임 가정통신문 1부. 끝.', () => {
  const s = composeSend({ title: '가을 현장체험학습 안내', related: [{ no: 'A-1', date: '2026-10-30', title: '안전 강화' }], target: '3학년 보호자', date: '2026-11-03' });
  assert.equal(s.title, '가을 현장체험학습 안내 가정통신문 발송');
  assert.equal(s.body, ['1. 관련: A-1(2026. 10. 30.) 「안전 강화」', '2. 위 호와 관련하여 「가을 현장체험학습 안내」 가정통신문을 다음과 같이 발송하고자 합니다.',
    '  가. 발송 대상: 3학년 보호자', '  나. 발송일: 2026. 11. 3.(화)', '  다. 발송 방법: 학부모 알림 앱(e알리미 등) 및 가정통신문', '', '붙임  「가을 현장체험학습 안내」 가정통신문 1부.  끝.'].join('\n'));
  assert.ok(composeSend({ title: 'T', related: [], target: '', date: '2026-11-03' }).body.startsWith('1. 「T」 가정통신문을 다음과 같이 발송하고자 합니다.\n  가. 발송 대상: 보호자'));
});
