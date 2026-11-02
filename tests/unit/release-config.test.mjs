// 릴리즈 설정: 이름·버전·업데이트 레포·배포 워크플로가 쌤비서를 가리킴
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');

test('tauri.conf.json 이름·실행 파일·식별자', () => {
  const c = JSON.parse(read('src-tauri/tauri.conf.json'));
  assert.equal(c.productName, '쌤비서');
  assert.equal(c.mainBinaryName, 'ssam');
  assert.equal(c.identifier, 'kr.doguri.ssam');
  assert.equal(c.app.windows[0].title, '쌤비서');
});

test('package.json·Cargo.toml 버전이 0.11.0, tauri.conf.json은 package.json을 따름', () => {
  assert.equal(JSON.parse(read('package.json')).version, '0.11.0');
  assert.match(read('src-tauri/Cargo.toml'), /^version = "0\.11\.0"$/m);
  assert.equal(JSON.parse(read('src-tauri/tauri.conf.json')).version, '../package.json'); // package.json 버전을 따름
});

test('자동 업데이트는 같은 레포 릴리즈를 봄', () => {
  const u = read('src-tauri/src/updater.rs');
  assert.match(u, /RELEASES_REPO: &str = "doguri25\/ssam-assistant"/);
  assert.doesNotMatch(u, /nice-releases/);
});

test('release.yml: ssam 파일 이름, 공개 릴리즈 레포 없음, Rust 시험 돌림', () => {
  const r = read('.github/workflows/release.yml');
  assert.doesNotMatch(r, /nice-releases/);
  assert.match(r, /ssam-\$v-setup\.exe/);
  assert.match(r, /ssam-\$v-portable\.exe/);
  assert.match(r, /cargo test/);
});

test('pages.yml은 main에 올리면 web 폴더를 배포', () => {
  const p = read('.github/workflows/pages.yml');
  assert.match(p, /branches:\s*\[\s*main\s*\]/);
  assert.match(p, /upload-pages-artifact[\s\S]*path:\s*web\b/);
  assert.match(p, /deploy-pages/);
});
