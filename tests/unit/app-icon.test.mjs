// 앱 아이콘(Windows 실행 파일·작업 표시줄·설치 파일)과 웹 탭 아이콘이 헤더 로고(말풍선 「쌤」 + 반짝임)와 같은 그림
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

const bin = p => readFileSync(new URL('../../' + p, import.meta.url));
const text = p => bin(p).toString('utf8');
const BUBBLE = 'M12 4h22a10 10 0 0 1 10 10v13a10 10 0 0 1-10 10H21.5l-7.6 6.2'; // 헤더 로고 말풍선
const SPARK = 'M40.5 1.5l1.25 3.25L45 6';

// PNG 머리(IHDR)에서 폭·높이
const pngSize = b => (b.readUInt32BE(0) === 0x89504e47 ? [b.readUInt32BE(16), b.readUInt32BE(20)] : null);
// 8비트 RGBA PNG를 풀어 (x, y) 점의 [r, g, b, a]
function pixel(b, x, y) {
  const [w] = pngSize(b), idat = [];
  for (let o = 8; o < b.length;) { const len = b.readUInt32BE(o), type = b.toString('latin1', o + 4, o + 8); if (type === 'IDAT') idat.push(b.subarray(o + 8, o + 8 + len)); o += 12 + len; }
  assert.equal(b[24], 8, '8비트'); assert.equal(b[25], 6, 'RGBA');
  const raw = inflateSync(Buffer.concat(idat)), bpp = 4, stride = w * bpp, rows = [];
  for (let r = 0, prev = Buffer.alloc(stride); r <= y; r++) {
    const f = raw[r * (stride + 1)], line = Buffer.from(raw.subarray(r * (stride + 1) + 1, (r + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? line[i - bpp] : 0, up = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      const pa = Math.abs(up - c), pb = Math.abs(a - c), pc = Math.abs(a + up - 2 * c);
      line[i] = (line[i] + [0, a, up, (a + up) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? up : c][f]) & 255;
    }
    rows.push(line); prev = line;
  }
  return [...rows[y].subarray(x * bpp, x * bpp + bpp)];
}
// ICO 안의 그림 크기들(0은 256)
function icoSizes(b) {
  assert.equal(b.readUInt16LE(2), 1, 'ICO 형식');
  const n = b.readUInt16LE(4), out = [];
  for (let i = 0; i < n; i++) { const e = 6 + i * 16; out.push([b[e] || 256, b[e + 1] || 256, b.readUInt32LE(e + 12)]); }
  return out;
}

test('헤더 로고 SVG: 말풍선·반짝임 그대로', () => {
  const html = text('web/index.html');
  const logo = html.slice(html.indexOf('class="app-logo"'), html.indexOf('</div>', html.indexOf('class="app-logo"')));
  assert.ok(logo.includes(BUBBLE) && logo.includes(SPARK), '헤더 로고 모양이 바뀌면 아이콘도 함께 바꿔 주세요');
});

test('웹 탭 아이콘(favicon)이 헤더 로고 그림이고 글꼴 없이 그려짐(<text> 없음)', () => {
  const html = text('web/index.html');
  const m = /<link rel="icon" type="image\/svg\+xml" href="data:image\/svg\+xml,([^"]+)">/.exec(html);
  assert.ok(m, 'SVG 탭 아이콘');
  const svg = decodeURIComponent(m[1]).replace(/'/g, '"'); // href 안이라 작은따옴표로 씀
  assert.ok(svg.includes(BUBBLE) && svg.includes(SPARK), svg.slice(0, 200));
  assert.ok(!/<text/.test(svg), '탭 아이콘은 글자 대신 도형(어느 컴퓨터든 같은 모양)');
  assert.ok(/fill="#fff" d="M[\d.]+ [\d.]+V/.test(svg), '「쌤」 글자 도형');
  assert.ok(svg === text('src-tauri/icons/ssam-icon.svg'), '앱 아이콘과 같은 그림');
});

test('앱 아이콘 PNG 크기와 새 그림(투명 바탕 말풍선)', () => {
  for (const [f, n] of [['32x32.png', 32], ['128x128.png', 128], ['128x128@2x.png', 256], ['icon.png', 512]]) {
    assert.deepEqual(pngSize(bin('src-tauri/icons/' + f)), [n, n], f);
  }
  // 옛 아이콘은 둥근 사각형 바탕이 오른쪽 아래까지 꽉 찼지만, 새 아이콘은 말풍선 오른쪽 아래(꼬리 반대편)가 투명하고 왼쪽 가운데는 보라색
  for (const [f, n] of [['icon.png', 512], ['128x128.png', 128], ['32x32.png', 32]]) {
    const b = bin('src-tauri/icons/' + f), k = n / 32;
    assert.equal(pixel(b, Math.round(28 * k), Math.round(28 * k))[3], 0, `${f}: 오른쪽 아래는 투명`);
    const [r, g, bl, a] = pixel(b, Math.round(4 * k), Math.round(16 * k));
    assert.ok(a > 240 && bl > 200 && bl > r && r > g - 20, `${f}: 말풍선 보라색 ${[r, g, bl, a]}`);
  }
  const svg = text('src-tauri/icons/ssam-icon.svg');
  assert.ok(svg.includes(BUBBLE) && svg.includes(SPARK) && !/<text/.test(svg) && !/<rect/.test(svg), svg.slice(0, 160));
});

test('icon.ico: 16·24·32·48·64·128·256 일곱 크기, 모두 새 그림(PNG)', () => {
  const b = bin('src-tauri/icons/icon.ico'), sizes = icoSizes(b);
  assert.deepEqual(sizes.map(s => s[0]).sort((x, y) => x - y), [16, 24, 32, 48, 64, 128, 256]);
  for (const [w, h, off] of sizes) assert.deepEqual(pngSize(b.subarray(off)), [w, h], `${w}px 칸`);
  // 앱 아이콘 PNG와 같은 그림: 32px·256px 칸은 32x32.png·128x128@2x.png와 같은 바이트
  const entry = n => { const [, , off] = sizes.find(s => s[0] === n), len = b.readUInt32LE(6 + sizes.findIndex(s => s[0] === n) * 16 + 8); return b.subarray(off, off + len); };
  assert.ok(entry(32).equals(bin('src-tauri/icons/32x32.png')), '32px 칸');
  assert.ok(entry(256).equals(bin('src-tauri/icons/128x128@2x.png')), '256px 칸');
});
