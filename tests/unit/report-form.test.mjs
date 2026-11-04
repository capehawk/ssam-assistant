// 결과 보고서 → 학교 양식(스펙 2026-11-04 4.2): 문서 → 양식 글(docToLetter), 사진 표(BinData·manifest), 날짜 없는 양식 자리
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as store from '../../web/core/store.js';
import { unzip, zipStore } from '../../web/core/zip.js';
import { docToLetter } from '../../web/core/body-table.js';
import { readForm, findRoles, fillForm, rolesValid, checkXml } from '../../web/core/hwpx-form.js';
import { reportDoc, normReport } from '../../web/menus/plan/report-ai.js';
import { letterFormHwpx } from '../../scripts/sample-letter-form.mjs';

function mem() { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; }
store.useStorage(mem());
const dec = u8 => new TextDecoder().decode(u8);
const JPG = new Uint8Array(readFileSync(new URL('../fixtures/photo-1.jpg', import.meta.url)));
const R = normReport({ name: '2026 과학의 날 행사', period: { start: '2026-04-21' }, place: '강당', target: '전교생', related: [{ no: '가-1', title: 'A' }, { no: '나-2', title: 'B' }],
  sections: [{ h: '목적', lines: ['흥미'] }], photos: ['실험'] }, { year: 2026 });

test('결과 보고서 문서 → 양식 글: 소제목·줄·개요 표(「|」 줄, 칸 안 줄바꿈은 「 / 」)·사진', () => {
  const l = docToLetter(reportDoc(R, [{ bytes: JPG, w: 4, h: 3 }], ['']));
  assert.equal(l.title, '2026 과학의 날 행사 운영 결과 보고서');
  assert.equal(l.body[0], '1. 개요');
  assert.equal(l.body[1], '| 구분 | 내용 |');
  assert.ok(l.body.some(t => /^\| 관련 \| 가-1.* \/ 나-2/.test(t)), l.body.join('\n'));
  assert.ok(l.body.includes('2. 목적') && l.body.includes('- 흥미'));
  assert.equal(l.photos.length, 1); assert.equal(l.photos[0].caption, '실험');
});

test('보고서 자리: 날짜 없이 제목·본문만 있어도 됨({ date: false })', () => {
  const r = { title: 0, bodyStart: 1, bodyEnd: 5, date: -1, sign: -1, reply: -1 };
  assert.ok(!rolesValid(r)); assert.ok(rolesValid(r, { date: false }));
  assert.ok(!rolesValid({ ...r, bodyStart: -1 }, { date: false }));
  assert.ok(rolesValid({ ...r, date: 7, sign: 8 }, { date: false }));
  assert.ok(!rolesValid({ ...r, date: 3 }, { date: false }), '날짜가 본문 안');
});

test('양식 채우기 사진: 본문 끝 2열 사진 표, BinData·manifest에 겹치지 않는 이름, XML이 잘 짜임', async () => {
  // 이미 BinData(로고)가 있는 양식
  const src = await unzip(await letterFormHwpx());
  const hpfName = [...src.keys()].find(n => /content\.hpf$/i.test(n));
  const files = [...src.entries()].map(([name, data]) => ({ name, data: name === hpfName ? dec(data).replace('</opf:manifest>', '<opf:item id="ssamimg1" href="BinData/ssamimg1.jpg" media-type="image/jpg" isEmbeded="1"/></opf:manifest>') : data }));
  files.push({ name: 'BinData/ssamimg1.jpg', data: JPG });
  const f = await readForm(zipStore(files));
  const l = docToLetter(reportDoc(R, [{ bytes: JPG, w: 4, h: 3 }, { bytes: JPG, w: 3, h: 4 }, { bytes: JPG, w: 4, h: 3 }], ['가', '나', '다']));
  const { bytes, warn } = await fillForm(f, findRoles(f.lines), { ...l, date: '2026-11-04', reply: null });
  assert.deepEqual(warn, []);
  const z = await unzip(bytes), sec = dec(z.get('Contents/section0.xml')), hpf = dec(z.get(hpfName));
  checkXml(sec); checkXml(hpf);
  const ids = [...hpf.matchAll(/<opf:item id="(ssamimg\d+)" href="BinData\/(ssamimg\d+)\.jpg"/g)];
  assert.equal(ids.length, 4, hpf);
  assert.equal(new Set(ids.map(m => m[1])).size, 4);
  for (const m of ids) assert.ok(z.get(`BinData/${m[2]}.jpg`), m[2]);
  assert.equal((sec.match(/<hp:pic /g) || []).length, (dec((await unzip(await letterFormHwpx())).get('Contents/section0.xml')).match(/<hp:pic /g) || []).length + 3);
  assert.ok(sec.includes('rowCnt="2" colCnt="2"'), '사진 표');
  const g = await readForm(bytes);
  for (const t of ['가', '나', '다']) assert.ok(g.lines.some(x => x.text === t), t);
});
