// 본문 표(스펙 2026-11-04 3장): 「| a | b |」 줄 묶음 → 표, 양식 채우기·기본 양식·AI 지시
import test from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../../web/core/store.js';
import { unzip } from '../../web/core/zip.js';
import { parseTableLines, isTableLine } from '../../web/core/body-table.js';
import { readForm, findRoles, fillForm, checkXml } from '../../web/core/hwpx-form.js';
import { plainLetterDoc, defaultPlain, letterPrompt } from '../../web/menus/etc/letter-ai.js';
import { letterFormHwpx } from '../../scripts/sample-letter-form.mjs';

function mem() { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; }
store.useStorage(mem());
const dec = u8 => new TextDecoder().decode(u8);

test('표 줄 묶기: 이어진 「|」 줄은 표 하나, 구분 줄은 버림, 칸 수는 가장 긴 줄', () => {
  assert.ok(isTableLine('| 시간 | 내용 |') && isTableLine('  |a|b|') && !isTableLine('a | b') && !isTableLine('|'));
  const out = parseTableLines(['1. 일정', '| 시간 | 내용 |', '|---|:---:|', '| 09:00 | 출발 |', '| 15:00 |', '', '2. 준비물']);
  assert.deepEqual(out, [
    { type: 'line', text: '1. 일정' },
    { type: 'table', rows: [['시간', '내용'], ['09:00', '출발'], ['15:00', '']] },
    { type: 'line', text: '' }, { type: 'line', text: '2. 준비물' }]);
  assert.deepEqual(parseTableLines(['|---|---|']), []);
  assert.deepEqual(parseTableLines(['| a | b |', 'x', '| c |']), [{ type: 'table', rows: [['a', 'b']] }, { type: 'line', text: 'x' }, { type: 'table', rows: [['c']] }]);
});

test('양식 채우기: 표 줄은 표(칸 수·글), 테두리는 한 번만 더함, 표가 본문 처음·끝이어도 XML이 잘 짜임', async () => {
  const f = await readForm(await letterFormHwpx());
  const body = ['| 시간 | 내용 |', '| 09:00 | 출발 |', '본문 줄', '| 준비물 | 도시락 | 물 |'];
  const { bytes, warn } = await fillForm(f, findRoles(f.lines), { title: 'T', date: '2026-11-04', body, reply: { title: '동의서', fields: ['참가: □ 예 □ 아니오'], due: '' } });
  assert.deepEqual(warn, []);
  const z = await unzip(bytes), sec = dec(z.get('Contents/section0.xml')), head = dec(z.get('Contents/header.xml'));
  checkXml(sec); checkXml(head);
  assert.ok(sec.includes('rowCnt="2" colCnt="2"') && sec.includes('rowCnt="1" colCnt="3"'), '표 크기');
  assert.ok(!sec.includes('| 시간 |'), '표 줄이 글로 남음');
  const g = await readForm(bytes);
  for (const t of ['시간', '09:00', '출발', '본문 줄', '도시락', '물']) assert.ok(g.lines.some(l => l.text === t), t);
  const before = (dec((await unzip(await letterFormHwpx())).get('Contents/header.xml')).match(/<hh:borderFill /g) || []).length;
  assert.equal((head.match(/<hh:borderFill /g) || []).length, before + 1, '테두리를 여러 번 더함');
});

test('기본 양식 문서: 표 줄은 표 블록(첫 줄 머리)', () => {
  const d = plainLetterDoc(defaultPlain('새싹초등학교'), { title: 'T', date: '2026-11-04', body: ['가', '| a | b |', '| 1 | 2 |'], reply: null });
  const tb = d.blocks.find(b => b.type === 'table');
  assert.deepEqual(tb, { type: 'table', head: true, rows: [['a', 'b'], ['1', '2']] });
  assert.ok(!d.blocks.some(b => b.type === 'p' && /\|/.test(b.text)));
});

test('AI 지시: 칸이 있는 내용은 「| 시간 | 내용 |」 줄로', () => {
  assert.ok(letterPrompt({ memo: 'x' }).includes('| 시간 | 내용 |'));
});
