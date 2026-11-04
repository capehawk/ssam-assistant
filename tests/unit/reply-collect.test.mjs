// 회신서 모으기(스펙 2026-11-04 6장): □ 칸만 읽기, AI 답 정리, 겹침·번호 없음 표시, 집계·미제출, 복사·문서
import test from 'node:test';
import assert from 'node:assert/strict';
import { replyOptions, replyPrompt, normReply, flagRows, tally, missingNos, collectTSV, collectDoc } from '../../web/menus/etc/reply-collect.js';

const FIELDS = ['참가 여부: □ 참가합니다  □ 참가하지 않습니다', '보호자 연락처:', '도시락: □ 싸 옴 □ 급식', '알레르기 □있음 □없음'];
const OPTS = replyOptions(FIELDS);

test('□가 있는 칸만, 선택지는 □ 뒤 글(「:」 없는 칸도)', () => {
  assert.deepEqual(OPTS, [{ name: '참가 여부', options: ['참가합니다', '참가하지 않습니다'] }, { name: '도시락', options: ['싸 옴', '급식'] }, { name: '알레르기', options: ['있음', '없음'] }]);
  assert.deepEqual(replyOptions(['보호자 서명:']), []);
});

test('프롬프트: 번호와 ☑만, 이름·학년·반은 읽지 않음, 칸·선택지 목록', () => {
  const p = replyPrompt(OPTS);
  assert.ok(p.startsWith('[회신서 읽기]') && p.includes('참가 여부: 참가합니다 / 참가하지 않습니다') && p.includes('"no"') && p.includes('"unsure"'));
  assert.ok(/이름[^\n]*(읽지|쓰지)/.test(p), '이름 읽지 않기');
});

test('AI 답 정리: 번호는 1~99 정수, 선택지 밖의 답·빈 답은 빈칸이고 「못 읽음」', () => {
  const r = normReply({ no: '12번', answers: { '참가 여부': '참가합니다', '도시락': '김밥', '알레르기': '' }, unsure: ['도시락', '없는 칸'] }, OPTS);
  assert.deepEqual(r, { no: 12, answers: { '참가 여부': '참가합니다', '도시락': '', '알레르기': '' }, unsure: ['도시락', '알레르기'] });
  assert.deepEqual(normReply(null, OPTS), { no: null, answers: { '참가 여부': '', '도시락': '', '알레르기': '' }, unsure: ['참가 여부', '도시락', '알레르기'] });
  assert.equal(normReply({ no: 0 }, OPTS).no, null); assert.equal(normReply({ no: 150 }, OPTS).no, null);
});

test('표시: 번호 없음·겹친 번호는 노랑(warn), 못 읽은 칸은 그 칸만', () => {
  const rows = flagRows([{ no: 3, answers: {}, unsure: [] }, { no: null, answers: {}, unsure: [] }, { no: 3, answers: {}, unsure: ['도시락'] }, { no: 5, answers: {}, unsure: [] }]);
  assert.deepEqual(rows.map(r => r.warn), ['dup', 'none', 'dup', '']);
});

test('집계·미제출: 칸마다 선택지 수와 빈칸, 명단 번호 중 빠진 것(명단이 없으면 1~가장 큰 번호)', () => {
  const rows = [{ no: 1, answers: { '참가 여부': '참가합니다', '도시락': '급식' } }, { no: 3, answers: { '참가 여부': '참가합니다', '도시락': '' } }, { no: 4, answers: { '참가 여부': '참가하지 않습니다' } }];
  const t = tally(rows, OPTS);
  assert.deepEqual(t[0], { name: '참가 여부', counts: [['참가합니다', 2], ['참가하지 않습니다', 1]], blank: 0 });
  assert.deepEqual(t[1], { name: '도시락', counts: [['싸 옴', 0], ['급식', 1]], blank: 2 });
  assert.deepEqual(missingNos(rows, new Set([1, 2, 3, 4, 5])), [2, 5]);
  assert.deepEqual(missingNos(rows, null), [2]);
});

test('복사(탭)·문서(번호 차례 표·집계·미제출)', () => {
  const rows = [{ no: 4, answers: { '참가 여부': '참가하지 않습니다' } }, { no: 1, answers: { '참가 여부': '참가합니다', '도시락': '급식' } }];
  assert.equal(collectTSV(rows, OPTS), '번호\t참가 여부\t도시락\t알레르기\n1\t참가합니다\t급식\t\n4\t참가하지 않습니다\t\t');
  const d = collectDoc(rows, OPTS, { title: '현장체험학습 참가 동의서', allowed: new Set([1, 2, 3, 4]) });
  assert.equal(d.title, '현장체험학습 참가 동의서 회신 결과');
  const tb = d.blocks.find(b => b.type === 'table');
  assert.deepEqual(tb.rows[0], ['번호', '참가 여부', '도시락', '알레르기']); assert.deepEqual(tb.rows[1][0], '1');
  assert.ok(d.blocks.some(b => b.type === 'p' && b.text.includes('미제출: 2, 3번')));
  assert.ok(d.blocks.some(b => b.type === 'p' && b.text.includes('참가합니다 1명')));
});
