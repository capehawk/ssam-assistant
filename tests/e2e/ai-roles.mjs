// 업무별 AI: 업무에 정한 모델로만 요청이 가고, 다른 업무는 기본 AI. 옛 화면(창체)도 같음
import { join } from 'node:path';
import { open, run, assert, FIXTURES } from './helpers.mjs';

const t = await open();
const { page, url, errors } = t;
await page.clock.setFixedTime(new Date('2026-10-29T09:00:00'));
await page.addInitScript(() => {
  if (!localStorage.getItem('ssam:engine')) localStorage.setItem('ssam:engine', JSON.stringify({ engine: 'claude', keys: { claude: 'sk-test' }, remember: true }));
});
const calls = [];
// 가짜 Claude: 요청 본문의 model과 프롬프트 머리를 기록
await page.route('https://api.anthropic.com/**', async route => {
  const body = JSON.parse(route.request().postData());
  const c = body.messages[0].content;
  const prompt = typeof c === 'string' ? c : c.filter(x => x.type === 'text').map(x => x.text).join('\n');
  const images = typeof c === 'string' ? 0 : c.filter(x => x.type === 'image').length;
  calls.push({ model: body.model, prompt, images });
  let out = 'ok';
  if (prompt.startsWith('[단원평가 피드백]')) {
    const nos = [...prompt.matchAll(/^- (\d+)번 \|/gm)].map(m => Number(m[1]));
    out = JSON.stringify({ students: nos.map(no => ({ no, good: `G${no}`, cheer: `C${no}` })) });
  } else if (images) out = JSON.stringify({ note: '학습지: 교실 정리를 다짐함', text: '교실을 깨끗하게 하려고 방법을 스스로 정해 꾸준히 실천함.', blank: false });
  else if (/학생 (\d+)명에게/.test(prompt)) {
    const n = +(prompt.match(/학생 (\d+)명에게/) || [])[1] || 1;
    out = Array.from({ length: n }, (_, j) => `공통 활동에 즐겁게 참여하며 ${j + 1}번째로 서로 돕는 태도를 보여 줌.`).join('\n');
  }
  const ev = [{ type: 'content_block_delta', delta: { type: 'text_delta', text: out } }, { type: 'message_delta', delta: { stop_reason: 'end_turn' } }];
  await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: ev.map(e => 'data: ' + JSON.stringify(e) + '\n\n').join('') }).catch(() => {});
});
const OPUS = { engine: 'claude', model: 'claude-opus-5-5' }, HAIKU = { engine: 'claude', model: 'claude-haiku-5-5' };
const setRoles = r => page.evaluate(r => localStorage.setItem('ssam:ai-roles', JSON.stringify(r)), r);
const V = 'section[data-menu="evaluate"] .unit-box';
await page.goto(url);
await page.waitForTimeout(500);

await run('ai-roles', [
  ['정하지 않으면 모든 업무가 기본 AI(Sonnet)', async () => {
    calls.length = 0;
    const m = await page.evaluate(async () => { const ai = await import('./core/ai.js'); await ai.generate('[시험] 하나', { task: 'grade' }); await ai.generate('[시험] 둘'); return 1; });
    assert(m && calls.length === 2 && calls.every(c => c.model === 'claude-sonnet-5-5'), JSON.stringify(calls.map(c => c.model)));
  }],
  ['채점에 Opus를 정하면 task:grade 요청만 Opus, 다른 업무·task 없음은 기본', async () => {
    await setRoles({ review: null, tasks: { grade: { main: OPUS, reviewOn: false, review: null } } });
    calls.length = 0;
    await page.evaluate(async () => { const ai = await import('./core/ai.js'); await ai.generate('[시험] 채점', { task: 'grade' }); await ai.generate('[시험] 계획', { task: 'plan' }); await ai.generate('[시험] 없음'); });
    assert(calls.map(c => c.model).join(',') === 'claude-opus-5-5,claude-sonnet-5-5,claude-sonnet-5-5', calls.map(c => c.model).join(','));
  }],
  ['검토 역할: 검토를 켜고 검토 AI를 정하면 role:review는 그 모델, use를 주면 그 모델', async () => {
    await setRoles({ review: HAIKU, tasks: { grade: { main: null, reviewOn: true, review: null } } });
    calls.length = 0;
    await page.evaluate(async () => { const ai = await import('./core/ai.js'); await ai.generate('[시험] 검토', { task: 'grade', role: 'review' }); await ai.generate('[시험] use', { use: { engine: 'claude', model: 'claude-opus-5-5' } }); });
    assert(calls.map(c => c.model).join(',') === 'claude-haiku-5-5,claude-opus-5-5', calls.map(c => c.model).join(','));
  }],
  ['SSAM.ai.providers·current: 키 있는 회사만 hasKey, 키 값은 없음', async () => {
    const p = await page.evaluate(() => ({ list: window.SSAM.ai.providers(), cur: window.SSAM.ai.current() }));
    assert(p.cur.engine === 'claude' && p.cur.model === 'claude-sonnet-5-5', JSON.stringify(p.cur));
    const c = p.list.find(x => x.id === 'claude'), g = p.list.find(x => x.id === 'gemini');
    assert(c.hasKey && !g.hasKey && c.models.some(m => m[0] === 'claude-opus-5-5'), JSON.stringify(p.list).slice(0, 200));
    assert(!JSON.stringify(p).includes('sk-test'), '키 값이 나옴');
  }],
  ['단원평가 피드백(notes)에 Haiku, 채점에 Opus → 피드백 요청은 Haiku', async () => {
    await setRoles({ review: null, tasks: { grade: { main: OPUS }, notes: { main: HAIKU } } });
    await page.click('nav.app-side [data-menu-go="evaluate"]'); await page.click('#menuTabs [data-tab="unit"]');
    await page.click(`${V} [data-un="sample"]`);
    await page.evaluate(() => { const k = 'ssam:unit:t:sample-1', x = JSON.parse(localStorage.getItem(k)); x.students.forEach(s => { s.good = ''; s.cheer = ''; }); localStorage.setItem(k, JSON.stringify(x)); });
    await page.reload(); await page.waitForTimeout(500);
    await page.click('nav.app-side [data-menu-go="evaluate"]'); await page.click('#menuTabs [data-tab="unit"]');
    await page.click(`${V} [data-un-open="sample-1"]`);
    calls.length = 0;
    await page.click(`${V} [data-un="fbAI"]`);
    await page.waitForFunction(() => document.querySelector('textarea[data-fb="2-good"]') && document.querySelector('textarea[data-fb="2-good"]').value === 'G2');
    assert(calls.length > 0 && calls.every(c => c.model === 'claude-haiku-5-5'), calls.map(c => c.model).join(','));
  }],
  ['옛 화면 창체(writing)에 Haiku → 학습지 읽기·문장 쓰기 모두 Haiku', async () => {
    await setRoles({ review: null, tasks: { writing: { main: HAIKU } } });
    await page.evaluate(() => window.SSAM.setMode('cc'));
    await page.fill('#ccSetup [data-cls="count"]', '3'); await page.press('#ccSetup [data-cls="count"]', 'Tab');
    await page.fill('[data-ccf="name"][data-cck="auto"]', '교실 환경 지킴이');
    await page.fill('[data-ccf="desc"][data-cck="auto"]', '교실을 깨끗하게 하는 방법을 정해 실천함');
    calls.length = 0;
    await page.click('#ccGrade');
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('[data-ccsheet][data-cck="auto"]')]);
    await fc.setFiles([1, 2, 3].map(i => join(FIXTURES, `sheet-${i}.png`)));
    await page.waitForSelector('[data-ccsheetinfo]');
    await page.click('[data-cc="genAll"]');
    await page.waitForFunction(() => document.querySelectorAll('#ccResults .gr-sum').length === 3, null, { timeout: 15000 });
    assert(calls.length > 0 && calls.some(c => c.images) && calls.every(c => c.model === 'claude-haiku-5-5'), calls.map(c => c.model + ':' + c.images).join(','));
  }],
  ['키가 없는 회사(Gemini)를 정해 두면 기본 AI로', async () => {
    await setRoles({ review: null, tasks: { grade: { main: { engine: 'gemini', model: 'gemini-3.8-flash' } } } });
    calls.length = 0;
    await page.evaluate(async () => { const ai = await import('./core/ai.js'); await ai.generate('[시험] 채점', { task: 'grade' }); });
    assert(calls.length === 1 && calls[0].model === 'claude-sonnet-5-5', calls.map(c => c.model).join(','));
  }],
  ['다른 회사(GPT)로 부른 오류는 그 회사 이름으로 안내', async () => {
    await page.route('https://api.openai.com/**', r => r.fulfill({ status: 401, body: JSON.stringify({ error: { message: 'bad key' } }) }));
    await page.evaluate(() => { const v = JSON.parse(localStorage.getItem('ssam:engine')); v.keys.openai = 'sk-o'; localStorage.setItem('ssam:engine', JSON.stringify(v)); });
    await page.reload(); await page.waitForTimeout(500);
    await setRoles({ review: null, tasks: { grade: { main: { engine: 'openai', model: 'gpt-6-luna' } } } });
    const msg = await page.evaluate(async () => { const ai = await import('./core/ai.js'); try { await ai.generate('[시험] 채점', { task: 'grade' }); return 'no error'; } catch (e) { return ai.errorMessage(e.code, e); } });
    assert(msg.includes('GPT API') && !msg.includes('Claude'), msg);
  }],
  ['AI 줄: 단원평가 3단계에 「AI: Claude Sonnet 5.5 · 검토 끔」', async () => {
    await page.evaluate(() => { localStorage.setItem('ssam:engine', JSON.stringify({ engine: 'claude', keys: { claude: 'sk-test' }, remember: true })); localStorage.removeItem('ssam:ai-roles'); });
    await page.reload(); await page.waitForTimeout(500);
    await page.click('nav.app-side [data-menu-go="evaluate"]'); await page.click('#menuTabs [data-tab="unit"]');
    if (await page.locator(`${V} [data-un="back"]`).count()) await page.click(`${V} [data-un="back"]`);
    await page.click(`${V} [data-un-open="sample-1"]`);
    await page.click(`${V} .steps [data-step="3"]`);
    await page.waitForSelector(`${V} [data-ai-row="grade"] .ai-row-t`);
    const txt = (await page.textContent(`${V} [data-ai-row="grade"] .ai-row-t`)).trim();
    assert(txt === 'AI: Claude Sonnet 5.5 · 검토 끔', txt);
  }],
  ['[바꾸기] → 키 있는 회사 모델만, Opus·검토 켬·검토 Opus → 사용량 안내 → 저장하면 줄이 바뀜', async () => {
    await page.click(`${V} [data-ai-edit="grade"]`);
    await page.waitForSelector('#aiRoleSheet #arMain');
    const vals = await page.$$eval('#arMain option', os => os.map(o => o.value));
    assert(vals[0] === '' && vals.includes('claude|claude-opus-5-5') && !vals.some(v => v.startsWith('gemini')), vals.join(','));
    await page.selectOption('#arMain', 'claude|claude-opus-5-5');
    await page.check('#arReviewOn');
    await page.selectOption('#arReview', 'claude|claude-opus-5-5');
    assert((await page.textContent('#arNote')).includes('1.2~1.5배'), await page.textContent('#arNote'));
    await page.click('#arSave');
    await page.waitForFunction(() => document.querySelector('.unit-box [data-ai-row="grade"] .ai-row-t').textContent.includes('검토: Claude Opus'));
    const txt = (await page.textContent(`${V} [data-ai-row="grade"] .ai-row-t`)).trim();
    assert(txt === 'AI: Claude Opus 5.5 · 검토: Claude Opus 5.5', txt);
    const r = await page.evaluate(() => JSON.parse(localStorage.getItem('ssam:ai-roles')));
    assert(r.tasks.grade.main.model === 'claude-opus-5-5' && r.tasks.grade.reviewOn === true, JSON.stringify(r));
  }],
  ['같은 업무(채점)인 평가지 채점 화면의 AI 줄도 같은 글, 피드백 줄은 기본', async () => {
    const fb = await page.evaluate(() => { const x = document.querySelector('[data-ai-row="notes"] .ai-row-t'); return x ? x.textContent : ''; });
    await page.click('#menuTabs [data-tab="gr"]');
    await page.waitForSelector('#grSetup [data-ai-row="grade"] .ai-row-t');
    const txt = (await page.textContent('#grSetup [data-ai-row="grade"] .ai-row-t')).trim();
    assert(txt === 'AI: Claude Opus 5.5 · 검토: Claude Opus 5.5', txt);
    assert((await page.textContent('#grSetup [data-ai-row="writing"] .ai-row-t')).trim() === 'AI: Claude Sonnet 5.5 · 검토 끔', '평어 줄');
    assert(!fb || fb.includes('검토 끔'), fb);
  }],
  ['설정 › AI: 기본 검토 AI 고르기·업무별 한눈에 6줄(품의·쪽지 포함)·[기본으로 되돌리기]', async () => {
    await page.click('nav.app-side [data-menu-go="settings"]'); await page.click('#menuTabs [data-tab="ai"]');
    await page.waitForSelector('#setReviewAi');
    await page.selectOption('#setReviewAi', 'claude|claude-haiku-5-5');
    await page.waitForFunction(() => (JSON.parse(localStorage.getItem('ssam:ai-roles')).review || {}).model === 'claude-haiku-5-5');
    assert(await page.locator('#setRoleList li').count() === 6, '6줄');
    assert((await page.textContent('#setRoleList')).includes('품의'), '품의 줄');
    assert((await page.textContent('#setRoleList')).includes('채점') && (await page.textContent('#setRoleList')).includes('검토: Claude Opus 5.5'), await page.textContent('#setRoleList'));
    await page.click('[data-set="resetRoles"]');
    await page.waitForFunction(() => !(JSON.parse(localStorage.getItem('ssam:ai-roles')).tasks.grade.main));
    const r = await page.evaluate(() => JSON.parse(localStorage.getItem('ssam:ai-roles')));
    assert(r.review === null && Object.values(r.tasks).every(x => !x.main && !x.reviewOn && !x.review), JSON.stringify(r));
    assert((await page.$eval('#setReviewAi', e => e.value)) === '', '기본 검토 AI가 남음');
    assert(!(await page.textContent('#setRoleList')).includes('Opus'), await page.textContent('#setRoleList'));
  }],
  ['업무에 정한 회사의 키를 지우면 AI 줄에 「키가 없어 기본 AI로」', async () => {
    await setRoles({ review: null, tasks: { plan: { main: { engine: 'gemini', model: 'gemini-3.8-flash' } } } });
    await page.reload(); await page.waitForTimeout(500);
    await page.click('nav.app-side [data-menu-go="settings"]'); await page.click('#menuTabs [data-tab="ai"]');
    await page.waitForSelector('#setRoleList');
    assert((await page.textContent('#setRoleList')).includes('키가 없어 기본 AI로'), await page.textContent('#setRoleList'));
  }],
  ['페이지 오류 없음', async () => { const bad = errors.filter(e => !/status of 401/.test(e)); assert(bad.length === 0, bad.join(' | ')); }]
]);
await t.close();
