// 가정통신문 양식 미뤄 둔 것(0.16): 대체 단계는 선생님이 쓴 앞 공백, 글 바꿀 때 글이 든 조각의 글자 모양,
// 테두리를 더할 수 없는 양식의 회신서 알림, 회신서 칸은 보통 문단 모양, opf:title
import test from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../../web/core/store.js';
import { unzip, zipStore } from '../../web/core/zip.js';
import { readForm, findRoles, fillForm, scanXml, checkXml, _test } from '../../web/core/hwpx-form.js';
import { letterFormHwpx } from '../../scripts/sample-letter-form.mjs';

function mem() { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; }
store.useStorage(mem());
const dec = u8 => new TextDecoder().decode(u8);
const secOf = async (bytes, n = 0) => dec((await unzip(bytes)).get(`Contents/section${n}.xml`));

test('M1 양식에 없는 단계(가))는 가까운 단계 모양을 따르되 앞 공백은 선생님이 쓴 그대로', async () => {
  const f = await readForm(await letterFormHwpx());
  const { bytes } = await fillForm(f, findRoles(f.lines), { title: 'T', date: '2026-11-04', body: ['1. 일시', '      가) 세부 내용'], reply: null });
  const g = await readForm(bytes);
  assert.ok(g.lines.some(l => l.text === '      가) 세부 내용'), g.lines.map(l => JSON.stringify(l.text)).join('\n'));
});

test('M3 글 바꾸기: 앞에 빈 조각이 있어도 글이 든 조각의 글자 모양으로', () => {
  const xml = '<hp:p id="1" paraPrIDRef="0"><hp:run charPrIDRef="5"><hp:t/></hp:run><hp:run charPrIDRef="7"><hp:t>옛 제목</hp:t></hp:run></hp:p>';
  const p = scanXml(xml).kids[0];
  const out = _test.setText(xml, p, '새 제목');
  assert.ok(out.includes('<hp:run charPrIDRef="7"><hp:t>새 제목</hp:t></hp:run>'), out);
  assert.ok(!out.includes('옛 제목'));
});

test('M11 테두리를 더할 수 없는 양식(borderFills 없음)에 회신서를 켜면 알림(no-border), 회신서 칸은 보통 문단 모양·단 나눔 없음', async () => {
  const src = await unzip(await letterFormHwpx());
  const files = [...src.entries()].map(([name, data]) => ({ name, data: name === 'Contents/header.xml' ? dec(data).replace(/<hh:borderFills[\s\S]*?<\/hh:borderFills>/, '') : data }));
  const f = await readForm(zipStore(files));
  const r = await fillForm(f, findRoles(f.lines), { title: 'T', date: '2026-11-04', body: ['본문'], reply: { title: '참가 동의서', fields: ['참가 여부: □ 참가 □ 불참'], due: '' } });
  assert.ok(r.warn.includes('no-border'), JSON.stringify(r.warn));
  const f2 = await readForm(await letterFormHwpx());
  const r2 = await fillForm(f2, findRoles(f2.lines), { title: 'T', date: '2026-11-04', body: ['본문'], reply: { title: '참가 동의서', fields: ['참가 여부: □ 참가 □ 불참'], due: '' } });
  const sec = await secOf(r2.bytes);
  const tbl = sec.slice(sec.lastIndexOf('<hp:tbl'), sec.lastIndexOf('</hp:tbl>'));
  const prs = new Set([...tbl.matchAll(/<hp:p id="\d+" paraPrIDRef="(\d+)"/g)].map(m => m[1]));
  assert.equal(prs.size, 1, '칸마다 다른 문단 모양 ' + [...prs]);
  assert.ok(!/<hp:p [^>]*columnBreak="1"[^>]*><hp:run[^>]*><hp:tbl/.test(sec), '표 문단에 단 나눔');
  checkXml(sec);
});

test('M12 채운 파일의 문서 제목(opf:title)은 새 제목', async () => {
  const f = await readForm(await letterFormHwpx());
  const { bytes } = await fillForm(f, findRoles(f.lines), { title: '새 & 제목', date: '2026-11-04', body: ['본문'], reply: null });
  const hpf = dec((await unzip(bytes)).get('Contents/content.hpf'));
  assert.ok(hpf.includes('<opf:title>새 &amp; 제목</opf:title>'), hpf.slice(0, 400));
});
