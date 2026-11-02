// 기타 › 쪽지 작성: 세로 메뉴 「기타」, 공문(담당자 전화·명단 줄 포함) + 계획 파일 → 명단·전화번호 줄은 빼고 AI 한 번 → 쪽지 제목·본문(일시·붙임 두 파일),
// 보내는 사람(문의), 짧게·자세히, 칸 고치기, 붙임 빼기, 모두 복사, 최근 쪽지·다시 안내,
// 붙임 파일: 웹판은 안내만, Windows 앱은 [붙임 파일 복사](저장 → 클립보드 파일)·[폴더 열기]
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { open, run, assert, mockClaude, ROOT } from './helpers.mjs';

const t = await open();
const { page, url, errors } = t;
await t.ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
await page.addInitScript(() => {
  if (!localStorage.getItem('ssam:engine')) localStorage.setItem('ssam:engine', JSON.stringify({ engine: 'claude', keys: { claude: 'sk-test' }, remember: true }));
});
const prompts = [];
await mockClaude(page, async ({ prompt }) => {
  prompts.push(prompt);
  if (prompt.startsWith('[쪽지 안내]')) return JSON.stringify({ kind: 'training', title: 'AI 활용 수업 연수', when: [{ date: '2026-11-12', time: '15:00~16:30' }], place: '시청각실', target: '전 교직원',
    apply: { due: '2026-11-06', how: '이음 쪽지로 회신' }, bring: '개인 노트북', notes: '', points: ['생성형 AI 소개', '수업 사례'] });
  return '{}';
});
const P = 'section[data-menu="etc"]';
const GONGMUN = ['○○교육지원청', '수신 각급학교장', '제목 2026 AI 활용 수업 연수 안내', '1. 일시: 2026. 11. 12.(목) 15:00~16:30', '2. 장소: 시청각실', '3. 대상: 전 교직원',
  '4. 신청: 11. 6.(금)까지 회신', '담당: 장학사 김민수 041-123-4567', '연수 명단: 김가람 이나래 박하늘 최보람', '붙임 1. 연수 계획 1부.  끝.'].join('\n');
const msgs = () => prompts.filter(p => p.startsWith('[쪽지 안내]'));
await page.goto(url);
await page.waitForTimeout(400);

await run('message', [
  ['세로 메뉴에 「기타」 → 가로 메뉴 「쪽지 작성」', async () => {
    assert((await page.textContent('nav.app-side [data-menu-go="etc"]')).includes('기타'), '기타');
    await page.click('nav.app-side [data-menu-go="etc"]');
    assert((await page.textContent('#menuTabs')).includes('쪽지 작성'), '쪽지 작성 탭');
    await page.waitForSelector(`${P} #msgFile`, { state: 'attached' });
  }],
  ['공문 txt + 계획 hwpx 넣기 → 명단·전화번호 줄은 빼고 AI 한 번 → 쪽지 제목·본문(일시·붙임 두 파일)', async () => {
    await page.setInputFiles(`${P} #msgFile`, [
      { name: '연수 공문.txt', mimeType: 'text/plain', buffer: Buffer.from(GONGMUN) },
      { name: 'AI 활용 연수 계획.hwpx', mimeType: 'application/octet-stream', buffer: readFileSync(join(ROOT, 'samples', '활동지-예시.hwpx')) }]);
    await page.waitForFunction(s => (document.querySelector(`${s} #msgTitle`) || {}).value === '[연수 안내] AI 활용 수업 연수', P);
    assert(msgs().length === 1, 'AI 요청 수 ' + msgs().length);
    const p = msgs()[0];
    assert(p.includes('AI 활용 수업 연수 안내') && !p.includes('041-123-4567') && !p.includes('김가람') && !p.includes('김민수'), p.slice(0, 600));
    assert((await page.textContent('#toast')).includes('뺐어요'), await page.textContent('#toast'));
    const body = await page.inputValue(`${P} #msgBody`);
    assert(body.includes('□ 일시: 2026. 11. 12.(목) 15:00~16:30') && body.includes('붙임  1. 연수 공문 1부.\n      2. AI 활용 연수 계획 1부.  끝.'), body);
  }],
  ['보내는 사람 → 본문 끝 「문의: …」, 새로고침해도 남음', async () => {
    await page.fill(`${P} #msgSender`, '교무부 ○○○(내선 123)');
    await page.waitForFunction(s => document.querySelector(`${s} #msgBody`).value.includes('문의: 교무부 ○○○(내선 123)'), P);
    await page.reload(); await page.waitForTimeout(500);
    await page.waitForSelector(`${P} #msgBody`);
    assert((await page.inputValue(`${P} #msgSender`)) === '교무부 ○○○(내선 123)' && (await page.inputValue(`${P} #msgBody`)).includes('문의: 교무부'), '남음');
  }],
  ['[짧게]는 준비물 없음, [자세히]는 주요 내용, 장소 칸을 고치면 본문도', async () => {
    await page.click(`${P} [data-len="short"]`);
    await page.waitForFunction(s => !document.querySelector(`${s} #msgBody`).value.includes('준비물'), P);
    await page.click(`${P} [data-len="long"]`);
    await page.waitForFunction(s => document.querySelector(`${s} #msgBody`).value.includes('□ 주요 내용\n  - 생성형 AI 소개'), P);
    await page.fill(`${P} [data-mf="place"]`, '강당');
    await page.waitForFunction(s => document.querySelector(`${s} #msgBody`).value.includes('□ 장소: 강당'), P);
  }],
  ['붙임 하나를 빼면 붙임 1개·끝., [모두 복사]는 제목과 본문', async () => {
    await page.uncheck(`${P} [data-att="1"]`);
    await page.waitForFunction(s => document.querySelector(`${s} #msgBody`).value.includes('붙임  연수 공문 1부.  끝.'), P);
    await page.click(`${P} [data-msg="copyAll"]`);
    await page.waitForTimeout(200);
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    assert(clip.startsWith('[연수 안내] AI 활용 수업 연수') && clip.includes('□ 장소: 강당'), clip.slice(0, 200));
  }],
  ['최근 쪽지에 남고 [다시 안내] → 제목 「[다시 안내] …」·「다시 한번 안내드립니다.」', async () => {
    await page.waitForSelector(`${P} #msgRecent [data-msg-again]`);
    await page.click(`${P} #msgRecent [data-msg-again]`);
    await page.waitForFunction(s => (document.querySelector(`${s} #msgTitle`) || {}).value === '[다시 안내] AI 활용 수업 연수', P);
    assert((await page.inputValue(`${P} #msgBody`)).includes('다시 한번 안내드립니다.'), '다시 안내 첫 줄');
    assert(msgs().length === 1, '다시 안내에 AI');
  }],
  ['웹판: 붙임 파일 복사 단추 없이 「Windows 앱에서는 …」 안내', async () => {
    assert(!(await page.$(`${P} [data-msg="copyFiles"]`)) && (await page.textContent(`${P} #msgFiles`)).includes('Windows 앱에서는'), await page.textContent(`${P} #msgFiles`));
  }],
  ['Windows 앱: [붙임 파일 복사] → 체크한 파일을 「날짜 제목」 폴더에 저장한 뒤 클립보드 파일로, [폴더 열기] → 그 폴더', async () => {
    await page.evaluate(() => { window.__calls = []; window.__TAURI__ = { core: { invoke: async (cmd, args) => { window.__calls.push([cmd, JSON.parse(JSON.stringify(args))]); return cmd === 'note_save_attachments' ? { dir: 'C:/붙임', paths: args.files.map(f => 'C:/붙임/' + f.name) } : null; } } }; });
    await page.click(`${P} [data-msg="new"]`);
    await page.setInputFiles(`${P} #msgFile`, [
      { name: '연수 공문.txt', mimeType: 'text/plain', buffer: Buffer.from(GONGMUN) },
      { name: 'AI 활용 연수 계획.hwpx', mimeType: 'application/octet-stream', buffer: readFileSync(join(ROOT, 'samples', '활동지-예시.hwpx')) }]);
    await page.waitForFunction(s => (document.querySelector(`${s} #msgTitle`) || {}).value === '[연수 안내] AI 활용 수업 연수', P);
    await page.uncheck(`${P} [data-att="0"]`);
    await page.click(`${P} [data-msg="copyFiles"]`);
    await page.waitForFunction(() => window.__calls.length >= 2);
    const calls = await page.evaluate(() => window.__calls);
    const today = await page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
    assert(calls[0][0] === 'note_save_attachments' && calls[0][1].folder === `${today} AI 활용 수업 연수` && calls[0][1].files.length === 1 && calls[0][1].files[0].name === 'AI 활용 연수 계획.hwpx' && calls[0][1].files[0].bytes.length > 100, JSON.stringify(calls[0][1]).slice(0, 200));
    assert(calls[1][0] === 'note_copy_files' && calls[1][1].paths[0] === 'C:/붙임/AI 활용 연수 계획.hwpx', JSON.stringify(calls[1]));
    assert((await page.textContent('#toast')).includes('Ctrl+V'), await page.textContent('#toast'));
    await page.click(`${P} [data-msg="openDir"]`);
    await page.waitForFunction(() => window.__calls.some(c => c[0] === 'note_open_dir'));
    assert((await page.evaluate(() => window.__calls.find(c => c[0] === 'note_open_dir')[1].dir)) === 'C:/붙임', '폴더');
  }],
  ['페이지 오류 없음', async () => { assert(errors.length === 0, errors.join(' | ')); }]
]);
await t.close();
