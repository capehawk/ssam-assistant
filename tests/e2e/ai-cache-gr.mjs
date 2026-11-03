// 평가지 채점 AI 요청: 기준 그림 2장 → 공통 글(cache_control, 「앞의 그림 2장은 정답·채점 기준」) → 학생 그림 → 학생 글,
// 공통은 학생마다 같음, 끝나면 「AI 사용량」 줄, 기록에 남아 다시 열면 「지난 채점」
import { join } from 'node:path';
import { open, run, assert, mockClaude, FIXTURES } from './helpers.mjs';

const t = await open();
const { page, url, errors } = t;
await page.addInitScript(() => {
  if (!localStorage.getItem('ssam:engine')) localStorage.setItem('ssam:engine', JSON.stringify({ engine: 'claude', keys: { claude: 'sk-test' }, remember: true }));
});
const grades = [];
await mockClaude(page, ({ prompt, content }) => {
  if (prompt.includes('수행평가를 채점하는')) {
    grades.push(content);
    return { text: JSON.stringify({ score: 70 + grades.length, summary: '바르게 풀었음', evidence: ['풀이가 맞음'], strengths: '꼼꼼함', improve: '검산', unreadable: false }), usage: { input_tokens: 150, cache_read_input_tokens: 3000, output_tokens: 200 } };
  }
  const nos = [...prompt.matchAll(/"no": (\d+)/g)].map(m => +m[1]);
  return JSON.stringify((nos.length ? nos : [1, 2, 3]).map(no => ({ no, score: 80, text: '수를 바르게 계산함.' })));
});
await page.goto(url);
await page.waitForTimeout(300);
await page.evaluate(() => localStorage.setItem('ssam:grset', JSON.stringify({ maskOn: false, mask: [] })));
await page.reload(); await page.waitForTimeout(500);

await run('ai-cache-gr', [
  ['기준 그림이 앞, 공통 글에 cache_control·「앞의 그림 2장은 정답·채점 기준」, 학생 그림·글이 뒤, 공통은 학생마다 같음', async () => {
    await page.click('nav.app-side [data-menu-go="evaluate"]'); await page.click('#menuTabs [data-tab="gr"]');
    await page.waitForSelector('#grDrop');
    const [c1] = await Promise.all([page.waitForEvent('filechooser'), page.click('[data-gr="critImg"]')]);
    await c1.setFiles([join(FIXTURES, 'sheet-2.png'), join(FIXTURES, 'sheet-3.png')]);
    await page.waitForFunction(() => document.querySelectorAll('#grCritBox .chip').length === 2);
    const [c2] = await Promise.all([page.waitForEvent('filechooser'), page.click('#grDrop')]);
    await c2.setFiles([join(FIXTURES, 'sheet-1.png'), join(FIXTURES, 'sheet-2.png'), join(FIXTURES, 'sheet-3.png')]);
    await page.waitForFunction(() => document.querySelector('#grSetup').textContent.includes('학생 3명'));
    await page.fill('#grTitle', '세 자리 수 덧셈'); await page.dispatchEvent('#grTitle', 'input');
    await page.click('[data-gr="start"]');
    await page.waitForFunction(() => /3\/3명 채점함|채점과 평어를 마쳤어요/.test(document.querySelector('#grResults').textContent), null, { timeout: 15000 });
    assert(grades.length === 3, '채점 요청 ' + grades.length);
    const kinds = grades.map(c => c.map(x => x.type).join(','));
    assert(kinds.every(k => k === 'image,image,text,image,text'), kinds.join(' / '));
    assert(grades.every(c => c[2].cache_control && !c[1].cache_control && !c[4].cache_control), 'cache_control');
    assert(grades[0][2].text.includes('앞의 그림 2장은 정답·채점 기준') && grades[0][4].text.includes('바로 위 그림 1장은 한 학생의 수행평가지'), grades[0][4].text);
    assert(new Set(grades.map(c => c[2].text)).size === 1, '공통 글이 학생마다 다름');
  }],
  ['끝나면 「AI 사용량」 줄, 기록에 숫자만 저장, 다시 열면 「지난 채점 AI 사용량」', async () => {
    await page.waitForSelector('#grResults #grAiUse');
    assert((await page.textContent('#grAiUse')).includes('캐시로 싸게'), await page.textContent('#grAiUse'));
    await page.waitForTimeout(900);
    const u = await page.evaluate(() => { const id = JSON.parse(localStorage.getItem('ssam:grs'))[0]; return JSON.parse(localStorage.getItem('ssam:gr:' + id)).aiUse; });
    assert(u && u.sent === 9450 && u.cached === 9000 && u.out === 600, JSON.stringify(u));
    await page.reload(); await page.waitForTimeout(500);
    await page.click('nav.app-side [data-menu-go="evaluate"]'); await page.click('#menuTabs [data-tab="gr"]');
    await page.click('[data-grhist]');
    await page.waitForSelector('#grResults #grAiUse');
    assert((await page.textContent('#grAiUse')).startsWith('지난 채점 AI 사용량'), await page.textContent('#grAiUse'));
  }],
  ['페이지 오류 없음', async () => { assert(errors.length === 0, errors.join(' | ')); }]
]);
await t.close();
