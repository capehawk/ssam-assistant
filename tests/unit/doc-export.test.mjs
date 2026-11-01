// 파일 형식 고르기: 같은 문서(제목·문단·표·쪽 나눔)를 워드(docx)·인쇄용 HTML(PDF)로, 고른 형식 기억
import test from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../../web/core/store.js';
import { unzip } from '../../web/core/zip.js';
import { makeDocx, docHtml, getFormat, setFormat, FORMATS, fileName } from '../../web/core/doc-export.js';
import { isYearKey } from '../../web/core/years.js';

function mem() { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; }
store.useStorage(mem());
const DOC = { title: '2027학년도 <독서> 운영 계획', blocks: [{ type: 'h', text: 'Ⅰ. 목적' }, { type: 'p', text: 'A & B\n둘째 줄' }, { type: 'break' }, { type: 'table', head: true, rows: [['월', '할 일'], ['3', '독서의 달']] }] };
const dec = u => new TextDecoder().decode(u);

test('워드 파일: 담는 파일, 본문에 제목·문단(줄마다)·표 2×2·머리줄, 쪽 나눔, A4', async () => {
  const m = await unzip(makeDocx(DOC));
  for (const n of ['[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/styles.xml', 'word/_rels/document.xml.rels', 'docProps/core.xml', 'docProps/app.xml']) assert.ok(m.has(n), n + ' 없음');
  assert.match(dec(m.get('[Content_Types].xml')), /wordprocessingml\.document\.main\+xml/);
  const d = dec(m.get('word/document.xml'));
  assert.ok(d.includes('2027학년도 &lt;독서&gt; 운영 계획'));
  assert.ok(d.includes('A &amp; B') && d.includes('둘째 줄'));
  assert.equal((d.match(/<w:tbl>/g) || []).length, 1);
  assert.equal((d.match(/<w:tr>/g) || []).length, 2);
  assert.ok(d.includes('<w:tblHeader/>'), '머리줄 반복');
  assert.ok(d.includes('w:type="page"'), '쪽 나눔');
  assert.match(d, /<w:pgSz w:w="11906" w:h="16838"\/>/);
  assert.ok(dec(m.get('docProps/core.xml')).includes('&lt;독서&gt;'));
  assert.match(dec(m.get('word/styles.xml')), /맑은 고딕/);
});

test('인쇄용 HTML(PDF): 제목·소제목·문단·표, 쪽 나눔 표시, 글자 이스케이프', () => {
  const h = docHtml(DOC);
  assert.ok(h.includes('<h1>2027학년도 &lt;독서&gt; 운영 계획</h1>'));
  assert.ok(h.includes('<h2>Ⅰ. 목적</h2>'));
  assert.ok(h.includes('<p>A &amp; B</p><p>둘째 줄</p>'));
  assert.match(h, /<th[^>]*>월<\/th>/); assert.match(h, /<td[^>]*>독서의 달<\/td>/);
  assert.ok(h.includes('class="pd-break"'));
});

test('인쇄용 HTML: 칸 글이 모두 짧은 열(교시·월·구분 등)은 줄을 바꾸지 않음', () => {
  const h = docHtml({ title: 't', blocks: [{ type: 'table', head: true, rows: [['교시', '월 11/2'], ['1교시', '국어 · 배운 내용 마무리하기']] }] });
  assert.ok(h.includes('<th class="nw">교시</th>') && h.includes('<td class="nw">1교시</td>'), h);
  assert.ok(h.includes('<td>국어 · 배운 내용 마무리하기</td>'), h);
});

test('형식: 한글·워드·PDF, 처음엔 한글, 고르면 기억(학년도와 상관없이), 모르는 값은 한글', () => {
  assert.deepEqual(FORMATS.map(f => f[0]), ['hwpx', 'docx', 'pdf']);
  assert.equal(getFormat(), 'hwpx');
  setFormat('docx'); assert.equal(getFormat(), 'docx');
  setFormat('zip'); assert.equal(getFormat(), 'docx');
  store.set('export', { format: '??' }); assert.equal(getFormat(), 'hwpx');
  assert.equal(isYearKey('export'), false);
});

test('파일 이름: 확장자를 형식에 맞게 바꾸고 쓸 수 없는 글자는 _', () => {
  assert.equal(fileName('3학년 1반 주간학습안내.hwpx', 'docx'), '3학년 1반 주간학습안내.docx');
  assert.equal(fileName('독서 운영 계획', 'hwpx'), '독서 운영 계획.hwpx');
  assert.equal(fileName('a/b:c', 'docx'), 'a_b_c.docx');
});
