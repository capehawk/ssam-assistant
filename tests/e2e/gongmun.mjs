// 기타 › 공문 처리(스펙 2026-11-04 5장): 글 붙여 넣기·파일 → AI(명단·전화번호 줄은 빼고) → 기한·할 일·요약, 기한 차례 목록·D-n,
// 할 일 체크·기한 고치기·다 했어요, 학사일정(달력)·오늘 수업 띠, 넘기기(가정통신문·결과 보고·품의·쪽지), 새로 고침 뒤 남음
import { open, run, assert, mockClaude } from './helpers.mjs';

const t = await open();
const { page, url, errors } = t;
await page.addInitScript(() => {
  if (!localStorage.getItem('ssam:engine')) localStorage.setItem('ssam:engine', JSON.stringify({ engine: 'claude', keys: { claude: 'sk-test' }, remember: true }));
});
const prompts = [];
const iso = n => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
await mockClaude(page, async ({ prompt }) => {
  prompts.push(prompt);
  if (prompt.startsWith('[공문 처리]')) {
    if (prompt.includes('과학의 날')) return JSON.stringify({ title: '2026 과학의 날 운영 안내', from: '○○교육청 과학과', no: '과학과-1234', date: iso(-2), due: iso(2), dueNote: '참가 신청서 회신',
      summary: '학교별 참가 신청서를 내야 해요.', tasks: [{ text: '참가 학생 조사', due: iso(1) }, { text: '신청서 제출', due: iso(2) }], kinds: ['letter', 'report'] });
    return JSON.stringify({ title: '연수 안내', due: iso(10), tasks: [], kinds: ['message'] });
  }
  if (prompt.startsWith('[쪽지 안내]')) return JSON.stringify({ kind: 'notice', title: '과학의 날 안내' });
  return '{}';
});
const G = 'section[data-menu="etc"] .gm-box';
const TEXT = '○○교육청\n수신  수신자 참조\n제목  2026 과학의 날 운영 안내\n1. 참가 신청서를 제출해 주시기 바랍니다.\n담당 장학사 010-1234-5678\n참가 명단: 김가람 이나래 박하늘';
await page.goto(url);
await page.waitForTimeout(400);

await run('gongmun', [
  ['기타 메뉴에 「공문 처리」 탭, 글을 붙여 넣고 [넣기] → AI(전화번호·명단 줄 빼고) → 제목·발신·D-2·요약·할 일', async () => {
    await page.click('nav.app-side [data-menu-go="etc"]');
    assert((await page.textContent('#menuTabs')).includes('공문 처리'), '탭');
    await page.click('#menuTabs [data-tab="gongmun"]');
    await page.waitForSelector(`${G} #gmPaste`);
    assert(await page.isHidden('section[data-menu="etc"] .msg-box') && await page.isHidden('section[data-menu="etc"] .lf-box'), '다른 탭이 보임');
    await page.fill(`${G} #gmPaste`, TEXT);
    await page.click(`${G} [data-gm="paste"]`);
    await page.waitForFunction(s => (document.querySelector(`${s} .gm-doc`) || {}).textContent?.includes('과학과-1234'), G, { timeout: 8000 });
    const p = prompts.find(x => x.startsWith('[공문 처리]'));
    assert(p.includes('참가 신청서를 제출') && !p.includes('010-1234-5678') && !p.includes('김가람'), JSON.stringify([p.includes('참가 신청서를 제출'), p.includes('010-1234-5678'), p.includes('김가람'), p.slice(-160)]));
    const card = await page.textContent(`${G} .gm-doc`);
    assert(card.includes('2026 과학의 날 운영 안내') && card.includes('D-2') && card.includes('참가 학생 조사') && card.includes('학교별 참가 신청서'), card);
    assert(await page.locator(`${G} .gm-doc [data-gm-go="letter"].primary`).count() === 1, 'AI가 고른 넘기기 강조');
  }],
  ['둘째 공문은 기한이 멀어 아래, 할 일 체크·기한 고치기는 저장되고 새로 고침 뒤에도 남음', async () => {
    await page.fill(`${G} #gmPaste`, '연수 안내 공문\n수신 각 학교');
    await page.click(`${G} [data-gm="paste"]`);
    await page.waitForFunction(s => document.querySelectorAll(`${s} .gm-doc`).length === 2, G, { timeout: 8000 });
    await page.waitForFunction(s => document.querySelectorAll(`${s} .gm-doc`)[1].textContent.includes('D-10'), G, { timeout: 8000 });
    assert((await page.textContent(`${G} .gm-doc >> nth=0`)).includes('과학의 날'), '차례');
    await page.check(`${G} .gm-doc >> nth=0 >> [data-gm-task="0"]`);
    await page.fill(`${G} .gm-doc >> nth=0 >> [data-gm-due]`, iso(3));
    await page.waitForTimeout(200);
    await page.reload(); await page.waitForTimeout(400);
    await page.click('nav.app-side [data-menu-go="etc"]'); await page.click('#menuTabs [data-tab="gongmun"]');
    await page.waitForSelector(`${G} .gm-doc`);
    assert(await page.isChecked(`${G} .gm-doc >> nth=0 >> [data-gm-task="0"]`), '체크가 사라짐');
    assert((await page.textContent(`${G} .gm-doc >> nth=0`)).includes('D-3'), '기한이 안 바뀜');
  }],
  ['학사일정(달력)에 제출 기한·남은 할 일, 오늘 수업 위에 「공문 기한」 띠(누르면 공문 처리)', async () => {
    const ev = await page.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => /calendar|events/.test(k)) || '[]') || '[]'));
    const titles = (Array.isArray(ev) ? ev : []).filter(e => e.source === 'gongmun').map(e => e.title);
    assert(titles.includes('[제출] 2026 과학의 날 운영 안내') && titles.includes('[할 일] 신청서 제출') && !titles.includes('[할 일] 참가 학생 조사'), JSON.stringify(titles));
    await page.click('nav.app-side [data-menu-go="class"]'); await page.click('#menuTabs [data-tab="today"]');
    await page.waitForSelector('#gmBand');
    const band = await page.textContent('#gmBand');
    assert(band.includes('D-3') && band.includes('과학의 날') && !band.includes('연수 안내'), band);
    await page.click('#gmBand [data-gm-band]');
    await page.waitForSelector(`${G} .gm-doc`);
  }],
  ['넘기기: [가정통신문]은 넣기 칸에 그 공문, [결과 보고]는 「관련 공문」, [품의]는 넣기 칸 글로 초안, [쪽지]는 쪽지 AI', async () => {
    await page.click(`${G} .gm-doc >> nth=0 >> [data-gm-go="letter"]`);
    await page.waitForSelector('section[data-menu="etc"] .lf-box #lfSrc li');
    assert((await page.textContent('section[data-menu="etc"] .lf-box #lfSrc')).includes('과학의 날'), '가정통신문 넣기');
    await page.click('#menuTabs [data-tab="gongmun"]');
    await page.click(`${G} .gm-doc >> nth=0 >> [data-gm-go="report"]`);
    await page.waitForSelector('section[data-menu="plan"] .rp-box [data-rp-kind]');
    assert((await page.inputValue('section[data-menu="plan"] .rp-box [data-rp-kind]')) === 'official', '관련 공문');
    await page.click('nav.app-side [data-menu-go="etc"]'); await page.click('#menuTabs [data-tab="gongmun"]');
    const n0 = prompts.length;
    await page.click(`${G} .gm-doc >> nth=0 >> [data-gm-go="purchase"]`);
    await page.waitForFunction(n => window.__pc || true, n0);
    await page.waitForSelector('section[data-menu="purchase"] #pcIntake', { timeout: 5000 });
    await page.waitForFunction(() => document.querySelector('#menuTabs [data-tab="new"][aria-current="page"]'));
    await page.waitForTimeout(800);
    assert(prompts.slice(n0).some(p => p.includes('과학의 날')), '품의 AI에 공문이 안 감');
    await page.click('nav.app-side [data-menu-go="etc"]'); await page.click('#menuTabs [data-tab="gongmun"]');
    await page.click(`${G} .gm-doc >> nth=0 >> [data-gm-go="message"]`);
    await page.waitForFunction(() => document.querySelector('#menuTabs [data-tab="message"][aria-current="page"]'));
    await page.waitForTimeout(800);
    assert(prompts.some(p => p.startsWith('[쪽지 안내]') && p.includes('과학의 날')), '쪽지 AI');
  }],
  ['[다 했어요] → 맨 아래로 접히고 달력·띠에서 빠짐, [지우기]', async () => {
    await page.click('#menuTabs [data-tab="gongmun"]');
    await page.click(`${G} .gm-doc >> nth=0 >> [data-gm-done]`);
    await page.waitForTimeout(200);
    assert((await page.textContent(`${G} .gm-doc >> nth=0`)).includes('연수 안내'), '차례');
    assert(await page.locator(`${G} .gm-doc.done`).count() === 1, '끝난 것');
    const ev = await page.evaluate(() => Object.values(localStorage).join(''));
    assert(!ev.includes('[제출] 2026 과학의 날'), '달력에 남음');
    assert(!(await page.isVisible(`${G} .gm-doc.done`)), '끝난 것이 펼쳐져 있음');
    await page.click(`${G} .gm-done-box summary`);
    page.once('dialog', d => d.accept());
    await page.click(`${G} .gm-doc.done [data-gm-del]`);
    await page.waitForTimeout(200);
    assert(await page.locator(`${G} .gm-doc`).count() === 1, '지우기');
  }],
  ['I1 기한 칸을 키보드로 고치는 중간 값(0002-…)은 저장하지 않고 칸도 그대로', async () => {
    await page.fill(`${G} #gmPaste`, '세 번째 공문\n수신 각 학교');
    await page.click(`${G} [data-gm="paste"]`);
    await page.waitForFunction(s => document.querySelectorAll(`${s} .gm-doc:not(.done)`).length >= 1, G, { timeout: 8000 });
    await page.waitForTimeout(500);
    const sel = `${G} .gm-doc >> nth=0 >> [data-gm-due]`;
    const before = await page.inputValue(sel);
    await page.focus(sel);
    await page.evaluate(s => { const el = document.querySelector(`${s} .gm-doc [data-gm-due]`); el.value = '0002-11-20'; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, G);
    await page.waitForTimeout(200);
    assert(await page.evaluate(s => document.activeElement === document.querySelector(`${s} .gm-doc [data-gm-due]`), G), '칸에서 초점이 빠짐');
    const saved = await page.evaluate(() => localStorage.getItem('ssam:gongmun:list'));
    assert(!saved.includes('0002-11-20'), '중간 값이 저장됨');
    assert(before !== '0002-11-20');
  }],
  ['I7 초안 없이 쓰던 품의가 있으면 [품의]는 묻고, 그만두면 쓰던 품의 그대로', async () => {
    await page.click('nav.app-side [data-menu-go="purchase"]'); await page.click('#menuTabs [data-tab="new"]');
    await page.waitForSelector('#pcProject');
    await page.click('[data-pc="fresh"]').catch(() => {});
    await page.fill('#pcProject', '쓰던 사업명');
    await page.waitForTimeout(200);
    await page.click('nav.app-side [data-menu-go="etc"]'); await page.click('#menuTabs [data-tab="gongmun"]');
    await page.click(`${G} .gm-doc >> nth=0 >> [data-gm-go="purchase"]`);
    await page.waitForSelector('#sheetRoot .sheet', { timeout: 3000 });
    assert((await page.textContent('#sheetRoot .sheet')).includes('쓰던 품의'), '묻지 않음');
    await page.click('#sheetRoot .sheet [data-close]');
    await page.click('nav.app-side [data-menu-go="purchase"]'); await page.click('#menuTabs [data-tab="new"]');
    assert((await page.inputValue('#pcProject')) === '쓰던 사업명', '쓰던 품의가 바뀜');
  }],
  ['페이지 오류 없음', async () => { assert(errors.length === 0, errors.join(' | ')); }]
]);
await t.close();
