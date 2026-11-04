// 문서에 사진 블록(스펙 2026-11-03 5.4): { type: 'photos', items: [{ bytes, w, h, caption }] } → 한글·워드·PDF(인쇄 HTML)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as store from '../../web/core/store.js';
import { unzip } from '../../web/core/zip.js';
import { makeHwpx } from '../../web/core/hwpx.js';
import { makeDocx, docHtml } from '../../web/core/doc-export.js';

function mem() { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; }
store.useStorage(mem());
const FX = join(import.meta.dirname, '..', 'fixtures');
const ph = (n, w, h, caption) => ({ bytes: new Uint8Array(readFileSync(join(FX, `photo-${n}.jpg`))), w, h, caption });
const PHOTOS = [ph(1, 640, 480, '모둠별 실험 장면'), ph(2, 800, 450, '결과 발표'), ph(3, 360, 480, '전시 & 정리')];
const DOC = { title: '과학의 날 운영 결과 보고서', blocks: [{ type: 'h', text: '5. 사진 자료' }, { type: 'photos', items: PHOTOS }, { type: 'p', text: '끝' }] };
const dec = u8 => new TextDecoder().decode(u8);
// 큰 바이트를 deepEqual로 견주면 틀릴 때 차이 글을 만드느라 오래 걸림 → 같은지만
const same = (a, b) => !!a && !!b && a.length === b.length && a.every((v, i) => v === b[i]);
const count = (s, re) => (s.match(re) || []).length;

test('한글: 사진은 BinData/imageN.jpg(그대로), content.hpf에 항목, 2열 표 칸마다 hp:pic + 설명', async () => {
  const z = await unzip(makeHwpx(DOC));
  for (let i = 0; i < 3; i++) assert.ok(same(z.get(`BinData/image${i + 1}.jpg`), PHOTOS[i].bytes), `image${i + 1}`);
  const hpf = dec(z.get('Contents/content.hpf'));
  for (let i = 1; i <= 3; i++) assert.ok(hpf.includes(`<opf:item id="image${i}" href="BinData/image${i}.jpg" media-type="image/jpg" isEmbeded="1"/>`), hpf);
  const sec = dec(z.get('Contents/section0.xml'));
  assert.equal(count(sec, /<hp:pic /g), 3);
  assert.equal(count(sec, /<\/hp:pic>/g), 3);
  for (let i = 1; i <= 3; i++) assert.ok(sec.includes(`binaryItemIDRef="image${i}"`), 'image' + i);
  assert.ok(sec.includes('모둠별 실험 장면') && sec.includes('전시 &amp; 정리'), '설명');
  assert.ok(/<hp:tbl [^>]*rowCnt="2" colCnt="2"/.test(sec), '2열 2줄 표');
  // 칸 너비 안에서 가로세로 비율 그대로
  const sz = [...sec.matchAll(/<hp:pic [\s\S]*?<hp:sz width="(\d+)" widthRelTo="ABSOLUTE" height="(\d+)"/g)].map(m => [+m[1], +m[2]]);
  assert.equal(sz.length, 3);
  for (const [k, [w, h]] of sz.entries()) {
    assert.ok(w <= 24000 && h <= 24000 && w > 5000, `크기 ${w}x${h}`);
    assert.ok(Math.abs(w / h - PHOTOS[k].w / PHOTOS[k].h) < 0.02, `비율 ${w}/${h}`);
  }
  assert.ok(dec(z.get('Preview/PrvText.txt')).includes('결과 발표'), '미리 보기 글에 설명');
});

test('한글: 사진이 없으면 BinData·항목 없이 그대로(다른 메뉴 문서와 같음)', async () => {
  const z = await unzip(makeHwpx({ title: '보고서', blocks: [{ type: 'photos', items: [] }, { type: 'p', text: '글' }] }));
  assert.ok(![...z.keys()].some(k => k.startsWith('BinData/')));
  assert.ok(!dec(z.get('Contents/content.hpf')).includes('image'));
  assert.ok(!dec(z.get('Contents/section0.xml')).includes('<hp:pic'));
});

test('워드: word/media/imageN.jpeg, 관계·jpeg 형식, 표 칸마다 그림(wp:inline)과 설명', async () => {
  const z = await unzip(makeDocx(DOC));
  for (let i = 0; i < 3; i++) assert.ok(same(z.get(`word/media/image${i + 1}.jpeg`), PHOTOS[i].bytes), `image${i + 1}`);
  assert.ok(dec(z.get('[Content_Types].xml')).includes('<Default Extension="jpeg" ContentType="image/jpeg"/>'));
  const rels = dec(z.get('word/_rels/document.xml.rels'));
  for (let i = 1; i <= 3; i++) assert.ok(rels.includes(`Id="rIdImg${i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image${i}.jpeg"`), rels);
  const doc = dec(z.get('word/document.xml'));
  assert.equal(count(doc, /<wp:inline /g), 3);
  for (let i = 1; i <= 3; i++) assert.ok(doc.includes(`r:embed="rIdImg${i}"`));
  assert.ok(doc.includes('xmlns:wp=') && doc.includes('xmlns:pic=') && doc.includes('xmlns:a='), '이름공간');
  assert.ok(doc.includes('결과 발표') && doc.includes('전시 &amp; 정리'), '설명');
  const ext = [...doc.matchAll(/<wp:extent cx="(\d+)" cy="(\d+)"\/>/g)].map(m => [+m[1], +m[2]]);
  assert.ok(ext.every(([cx, cy], k) => cx <= 3100000 && Math.abs(cx / cy - PHOTOS[k].w / PHOTOS[k].h) < 0.02), JSON.stringify(ext));
});

test('워드: 사진이 없으면 media·jpeg 형식 없음', async () => {
  const z = await unzip(makeDocx({ title: '보고서', blocks: [{ type: 'photos', items: [] }] }));
  assert.ok(![...z.keys()].some(k => k.startsWith('word/media/')));
  assert.ok(!dec(z.get('word/document.xml')).includes('<w:drawing'));
});

test('PDF(인쇄 HTML): 2열 표에 data: 그림과 설명', () => {
  const h = docHtml(DOC);
  assert.equal(count(h, /<img src="data:image\/jpeg;base64,/g), 3);
  assert.ok(h.includes('class="pd-photos"') && h.includes('모둠별 실험 장면') && h.includes('전시 &amp; 정리'), h.slice(0, 300));
  assert.ok(!docHtml({ title: 'x', blocks: [{ type: 'photos', items: [] }] }).includes('<img'));
});
