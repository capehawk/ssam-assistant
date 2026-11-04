// 기타 › 가정통신문: 탭(쪽지 화면은 숨음), 학교 양식(.hwpx) 넣기 → 자리 찾기·저장(새로 고침 뒤 남음)·양식 맞추기,
// 공문(전화번호 줄 빼기)·넣을 내용 → AI 한 번(양식 옛 글은 문체 참고) → 제목·본문·회신서·알림 글·발송 기안,
// 한글 내려받기(양식 머리·로고 그대로, 새 제목·본문·회신서), 회신서 끄기, 기본 양식 내려받기
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { open, run, assert, mockClaude, ROOT } from './helpers.mjs';

const t = await open();
const { page, ctx, url, errors } = t;
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: url.replace(/\/$/, '') });
await page.addInitScript(() => {
  if (!localStorage.getItem('ssam:engine')) localStorage.setItem('ssam:engine', JSON.stringify({ engine: 'claude', keys: { claude: 'sk-test' }, remember: true }));
});
const reqs = [];
await mockClaude(page, ({ prompt }) => {
  reqs.push(prompt);
  return JSON.stringify({ title: '2026학년도 가을 현장체험학습 안내', greeting: ['안녕하십니까?', '항상 본교 교육 활동에 관심을 가져 주시는 보호자님께 감사드립니다.'],
    intro: '3학년 현장체험학습을 다음과 같이 실시하오니 협조를 부탁드립니다.', items: ['1. 일시: 2026. 11. 12.(목) 09:00~15:00', '2. 장소: 국립중앙과학관', '  가. 준비물: 도시락, 물'],
    closing: '안전한 체험학습이 되도록 가정에서도 지도를 부탁드립니다.', reply: { need: true, title: '현장체험학습 참가 동의서', fields: ['참가 여부: □ 참가합니다  □ 참가하지 않습니다'], due: '11. 7.(금)까지 담임 선생님께 제출해 주세요.' },
    short: '11월 12일(목) 3학년 현장체험학습이 있어요.\n참가 동의서를 11월 7일까지 보내 주세요.', related: [{ no: '○○교육청 안전과-123', date: '2026-10-30', title: '현장체험학습 안전 강화 안내' }], target: '3학년 보호자' });
});
const P = 'section[data-menu="etc"] .lf-box';
const FORM = readFileSync(join(ROOT, 'samples', '가정통신문-양식-예시.hwpx'));
const today = () => page.evaluate(() => { const d = new Date(); return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`; });
const unzipDl = async dl => { const { unzip } = await import('../../web/core/zip.js'); return unzip(new Uint8Array(readFileSync(await dl.path()))); };
const dec = u8 => new TextDecoder().decode(u8);

await page.goto(url);
await page.waitForTimeout(400);

await run('letter', [
  ['기타에 「가정통신문」 탭, 쪽지 화면은 숨고 기본 양식이 골라져 있음', async () => {
    await page.click('nav.app-side [data-menu-go="etc"]');
    assert((await page.textContent('#menuTabs')).includes('가정통신문'), '탭');
    await page.click('#menuTabs [data-tab="letter"]');
    await page.waitForSelector(`${P} #lfForm`);
    assert(await page.isHidden('section[data-menu="etc"] .msg-box'), '쪽지 화면이 보임');
    assert((await page.inputValue(`${P} #lfForm`)) === '', '기본 양식');
  }],
  ['양식(.hwpx) 넣기 → 저장·골라짐, [양식 맞추기]에 제목·본문·날짜·학교장·회신서 자리', async () => {
    await page.setInputFiles(`${P} #lfFormFile`, { name: '가정통신문-양식-예시.hwpx', mimeType: 'application/octet-stream', buffer: FORM });
    await page.waitForFunction(s => (document.querySelector(`${s} #lfForm`) || {}).value, P, { timeout: 8000 });
    assert((await page.textContent(`${P} #lfForm`)).includes('가정통신문-양식-예시'), '양식 이름');
    await page.click(`${P} [data-lf="map"]`);
    await page.waitForSelector(`${P} #lfMap`);
    const badge = async text => page.evaluate(([s, t]) => { const li = [...document.querySelectorAll(`${s} .lf-lines li`)].find(l => l.querySelector('.lf-text').textContent === t); return li ? li.querySelector('.lf-badge').textContent : ''; }, [P, text]);
    assert((await badge('2026학년도 학부모 상담 주간 안내')) === '제목', await badge('2026학년도 학부모 상담 주간 안내'));
    assert((await badge('안녕하십니까?')) === '본문' && (await badge('2026 . 3 . 3 .')) === '날짜' && (await badge('새 싹 초 등 학 교 장')) === '학교장' && (await badge('학부모 상담 신청서')) === '회신서');
    assert((await badge('가 정 통 신 문')) === '머리', '머리');
    await page.click(`${P} [data-lf="mapClose"]`);
  }],
  ['공문(전화번호 줄)·넣을 내용 → [가정통신문 쓰기] → AI 한 번(양식 옛 글은 참고, 전화번호 없음) → 제목·본문·회신서·알림 글·발송 기안', async () => {
    await page.setInputFiles(`${P} #lfFile`, { name: '교육청 공문.txt', mimeType: 'text/plain', buffer: Buffer.from('현장체험학습 안전 강화 안내\n담당 장학사 041-123-4567\n학교는 사전 답사를 실시함') });
    await page.waitForFunction(s => document.querySelectorAll(`${s} [data-lf-del]`).length === 1, P);
    await page.fill(`${P} #lfMemo`, '11월 12일 3학년 국립중앙과학관 현장체험학습, 도시락, 동의서 11월 7일까지');
    await page.click(`${P} [data-lf="write"]`);
    await page.waitForSelector(`${P} [data-lo="title"]`, { timeout: 8000 });
    assert(reqs.length === 1, 'AI ' + reqs.length);
    const p = reqs[0];
    assert(p.includes('[공문·계획: 교육청 공문.txt]') && p.includes('사전 답사') && !p.includes('041-123-4567') && p.includes('동의서 11월 7일까지'), p.slice(0, 400));
    assert(p.includes('[양식의 옛 글(문체만 참고)]') && p.includes('학부모 상담 주간') && !p.includes('김새싹') && !p.includes('새 싹 초 등 학 교 장'), '양식 옛 글');
    assert((await page.inputValue(`${P} [data-lo="title"]`)) === '2026학년도 가을 현장체험학습 안내');
    const body = await page.inputValue(`${P} [data-lo="body"]`);
    assert(body.startsWith('안녕하십니까?\n항상 본교') && body.includes('\n1. 일시: 2026. 11. 12.(목) 09:00~15:00\n2. 장소: 국립중앙과학관\n  가. 준비물: 도시락, 물\n'), body);
    assert(await page.isChecked(`${P} #lfReplyOn`) && (await page.inputValue(`${P} [data-lr="title"]`)) === '현장체험학습 참가 동의서');
    assert((await page.inputValue(`${P} #lfShort`)).startsWith('11월 12일(목)'), '알림 글');
    assert((await page.inputValue(`${P} #lfSendTitle`)) === '2026학년도 가을 현장체험학습 안내 가정통신문 발송');
    assert((await page.inputValue(`${P} #lfSendBody`)).startsWith('1. 관련: ○○교육청 안전과-123(2026. 10. 30.) 「현장체험학습 안전 강화 안내」'), await page.inputValue(`${P} #lfSendBody`));
  }],
  ['[한글로 내려받기] → 양식 머리·로고·학교장 그대로, 새 제목·본문·발행일(양식 꼴)·회신서', async () => {
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click(`${P} [data-lf="download"]`)]);
    assert(dl.suggestedFilename() === '2026학년도 가을 현장체험학습 안내.hwpx', dl.suggestedFilename());
    const z = await unzipDl(dl), sec = dec(z.get('Contents/section0.xml'));
    assert(z.has('BinData/image1.png') && sec.includes('가 정 통 신 문') && sec.includes('교장 : 김새싹') && sec.includes('새 싹 초 등 학 교 장'), '양식 그대로');
    assert(sec.includes('2026학년도 가을 현장체험학습 안내') && !sec.includes('학부모 상담 주간') && sec.includes('2. 장소: 국립중앙과학관'), '새 글');
    const d = (await today()).split('. ').map(x => x.replace('.', ''));
    assert(sec.includes(`${d[0]} . ${d[1]} . ${d[2]} .`), '발행일 양식 꼴');
    assert(sec.includes('현장체험학습 참가 동의서') && sec.includes('자 르 는 선') && !sec.includes('학부모 상담 신청서'), '회신서');
  }],
  ['회신서를 끄면 내려받은 파일에 회신서 없음, 제목을 고치면 발송 기안도', async () => {
    await page.uncheck(`${P} #lfReplyOn`);
    await page.fill(`${P} [data-lo="title"]`, '가을 현장체험학습 안내');
    await page.waitForFunction(s => document.querySelector(`${s} #lfSendTitle`).value === '가을 현장체험학습 안내 가정통신문 발송', P);
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click(`${P} [data-lf="download"]`)]);
    const sec = dec((await unzipDl(dl)).get('Contents/section0.xml'));
    assert(!sec.includes('자 르 는 선') && !sec.includes('참가 동의서') && sec.includes('가을 현장체험학습 안내'), '회신서 없음');
  }],
  ['알림 글·발송 기안 복사', async () => {
    await page.click(`${P} [data-lf="copyShort"]`); await page.waitForTimeout(150);
    assert((await page.evaluate(() => navigator.clipboard.readText())).startsWith('11월 12일(목)'), '알림 글');
    await page.click(`${P} [data-lf="copySend"]`); await page.waitForTimeout(150);
    assert((await page.evaluate(() => navigator.clipboard.readText())).startsWith('가을 현장체험학습 안내 가정통신문 발송\n\n1. 관련:'), '기안');
  }],
  ['새로 고침 → 양식은 저장돼 골라져 있고 글도 남음, 최근 가정통신문', async () => {
    await page.reload(); await page.waitForTimeout(500);
    await page.click('nav.app-side [data-menu-go="etc"]'); await page.click('#menuTabs [data-tab="letter"]');
    await page.waitForFunction(s => (document.querySelector(`${s} #lfForm`) || {}).value, P, { timeout: 8000 });
    assert((await page.textContent(`${P} #lfForm`)).includes('가정통신문-양식-예시'), '양식');
    assert((await page.inputValue(`${P} [data-lo="title"]`)) === '가을 현장체험학습 안내', '글');
    assert((await page.textContent(`${P} #lfRecent`)).includes('가을 현장체험학습 안내'), '최근');
  }],
  ['기본 양식으로 바꾸면 쌤비서 문서(「가 정 통 신 문」·학교장 줄)로 내려받기', async () => {
    await page.selectOption(`${P} #lfForm`, '');
    await page.waitForSelector(`${P} [data-exp-main][data-lf="download"]`);
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click(`${P} [data-lf="download"]`)]);
    const sec = dec((await unzipDl(dl)).get('Contents/section0.xml'));
    assert(sec.includes('가 정 통 신 문') && sec.includes('가을 현장체험학습 안내') && /초 등 학 교 장/.test(sec), sec.slice(0, 300));
  }],
  ['[양식 지우기] → 목록에서 빠짐', async () => {
    await page.selectOption(`${P} #lfForm`, { index: 1 });
    await page.waitForSelector(`${P} [data-lf="delForm"]`);
    await page.click(`${P} [data-lf="delForm"]`);
    await page.waitForFunction(s => document.querySelectorAll(`${s} #lfForm option`).length === 1, P);
  }],
  ['[양식 맞추기]에서 줄을 눌러 자리를 바꾸고 [저장] → 새로 고침 뒤에도 그 자리', async () => {
    await page.setInputFiles(`${P} #lfFormFile`, { name: '가정통신문-양식-예시.hwpx', mimeType: 'application/octet-stream', buffer: FORM });
    await page.waitForFunction(s => (document.querySelector(`${s} #lfForm`) || {}).value, P, { timeout: 8000 });
    await page.click(`${P} [data-lf="map"]`);
    const line = text => page.evaluate(([s, t]) => [...document.querySelectorAll(`${s} .lf-lines li`)].findIndex(l => l.querySelector('.lf-text').textContent === t), [P, text]);
    const i = await line('항상 본교 교육 활동에 관심을 가져 주시는 보호자님께 감사드립니다.');
    await page.click(`${P} [data-lf-line="${i}"]`);
    await page.click(`${P} [data-lf-role="bodyStart"]`);
    await page.click(`${P} [data-lf="mapSave"]`);
    await page.waitForFunction(() => (document.querySelector('#toast') || {}).textContent?.includes('양식 자리를 저장했어요'));
    await page.reload(); await page.waitForTimeout(500);
    await page.click('nav.app-side [data-menu-go="etc"]'); await page.click('#menuTabs [data-tab="letter"]');
    await page.waitForSelector(`${P} [data-lf="map"]`, { timeout: 8000 });
    await page.click(`${P} [data-lf="map"]`);
    const badge = async text => page.evaluate(([s, t]) => { const li = [...document.querySelectorAll(`${s} .lf-lines li`)].find(l => l.querySelector('.lf-text').textContent === t); return li ? li.querySelector('.lf-badge').textContent : ''; }, [P, text]);
    assert((await badge('안녕하십니까?')) !== '본문' && (await badge('항상 본교 교육 활동에 관심을 가져 주시는 보호자님께 감사드립니다.')) === '본문', await badge('안녕하십니까?'));
  }],
  ['페이지 오류 없음', async () => { assert(errors.length === 0, errors.join(' | ')); }]
]);
await t.close();
