// 단원평가 한꺼번에 넣기: 문제지+정답(한 파일) + 답안 사진 3장 → 카드 → 정답·평가지 채움 → 2단계에 학생 3명 그대로,
// 답안 사진만 넣으면 카드 없이 2단계, 「교과 평어에 참고하기」 기본 꺼짐 → 켜고 영역 고르면 이음 저장
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { open, run, assert } from './helpers.mjs';

const ROOT = join(import.meta.dirname, '..', '..');
const t = await open();
const { page, url, errors } = t;
const PLAN = { kind: 'plan', title: '2학기 평가계획', grade: 3, source: '', createdAt: 1, subjects: [{ name: '과학', units: [
  { id: 'u1', subject: '과학', period: '', std: '[4과01-02] 동물의 생김새를 설명한다.', unit: '3. 동물의 생활', area: '생명', elem: '동물의 생김새', focus: '', crit: { top: '', high: '잘 설명함', mid: '설명함', low: '도움을 받아 설명함' } }] }] };
await page.addInitScript(p => {
  if (!localStorage.getItem('ssam:engine')) localStorage.setItem('ssam:engine', JSON.stringify({ engine: 'claude', keys: { claude: 'sk-test' }, remember: true }));
  if (!localStorage.getItem('ssam:unit:set')) localStorage.setItem('ssam:unit:set', JSON.stringify({ pagesPer: 1, maskOn: false, mask: [], maskAll: false }));
  if (!localStorage.getItem('ssam:plans')) { localStorage.setItem('ssam:plan:P1', JSON.stringify(p)); localStorage.setItem('ssam:plans', JSON.stringify(['P1'])); localStorage.setItem('ssam:prefs', JSON.stringify({ current: 'P1' })); }
}, PLAN);
const calls = [];
await page.route('https://api.anthropic.com/**', async route => {
  const body = JSON.parse(route.request().postData());
  const c = body.messages[0].content;
  const prompt = typeof c === 'string' ? c : c.filter(x => x.type === 'text').map(x => x.text).join('\n');
  calls.push(prompt.split('\n')[0]);
  const out = prompt.startsWith('[쪽 나누기]') ? JSON.stringify({ pages: [] }) : '{}';
  await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: [{ type: 'content_block_delta', delta: { type: 'text_delta', text: out } }, { type: 'message_delta', delta: { stop_reason: 'end_turn' } }].map(e => 'data: ' + JSON.stringify(e) + '\n\n').join('') }).catch(() => {});
});
const P = 'section[data-menu="evaluate"]';
const tests = () => page.evaluate(() => (JSON.parse(localStorage.getItem('ssam:unit:list') || '[]')).map(s => JSON.parse(localStorage.getItem('ssam:unit:t:' + s.id))));
const pngs = n => page.evaluate(async n => { const out = []; for (let i = 0; i < n; i++) { const c = document.createElement('canvas'); c.width = 300; c.height = 420; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 300, 420); g.fillStyle = '#000'; g.fillRect(20 + i * 9, 80, 120, 25); out.push(c.toDataURL('image/png').split(',')[1]); } return out; }, n);
const files = async (n, withDoc) => [...(withDoc ? [{ name: '중간 평가 2회.txt', mimeType: 'text/plain', buffer: readFileSync(join(ROOT, 'tests', 'fixtures', 'unit-combined.txt')) }] : []), ...(await pngs(n)).map((b, i) => ({ name: `답안${i + 1}.png`, mimeType: 'image/png', buffer: Buffer.from(b, 'base64') }))];
await page.goto(url);
await page.waitForTimeout(500);

await run('unit-bundle', [
  ['1단계 한꺼번에 넣기: 문제지+정답 한 파일 + 답안 3장 → 카드 → 정답·평가지 → 2단계 학생 3명', async () => {
    await page.click('nav.app-side [data-menu-go="evaluate"]'); await page.click('#menuTabs [data-tab="unit"]');
    await page.click(`${P} #unNew`);
    await page.waitForSelector(`${P} [data-bundle-pick="unit"]`);
    await page.setInputFiles('#bundleFile-unit', await files(3, true));
    await page.waitForSelector('#sheetRoot #bundleCard');
    assert((await page.textContent('#sheetRoot #bundleSum')).includes('학생 3쪽'), await page.textContent('#sheetRoot #bundleSum'));
    await page.click('#sheetRoot #bundleOk');
    await page.waitForFunction(() => { const l = JSON.parse(localStorage.getItem('ssam:unit:list') || '[]'); return l.length && JSON.parse(localStorage.getItem('ssam:unit:t:' + l[0].id)).students.length === 3; });
    const tt = (await tests())[0];
    assert(tt.key.items.length === 6 && tt.paper.text.includes('곤충이 아닌 것') && !tt.paper.text.includes('정답 및 해설'), JSON.stringify(tt.key.items.length));
    assert(await page.isVisible(`${P} .steps li.cur:nth-child(2)`), '2단계');
  }],
  ['답안 사진만 넣으면 카드 없이 2단계(학생 2명으로 다시 나눔)', async () => {
    await page.click(`${P} [data-step="1"]`);
    const n0 = calls.length;
    await page.setInputFiles('#bundleFile-unit', await files(2, false));
    await page.waitForFunction(() => { const l = JSON.parse(localStorage.getItem('ssam:unit:list')); return JSON.parse(localStorage.getItem('ssam:unit:t:' + l[0].id)).students.length === 2; });
    assert(!(await page.$('#sheetRoot #bundleCard')) && calls.length === n0, '카드·AI');
    assert(await page.isVisible(`${P} .steps li.cur:nth-child(2)`), '2단계');
  }],
  ['「교과 평어에 참고하기」 기본 꺼짐 → 켜고 영역 고르면 이음 저장', async () => {
    await page.click(`${P} [data-step="1"]`);
    await page.waitForSelector(`${P} [data-un="link"]`);
    assert(!(await page.isChecked(`${P} [data-un="link"]`)), '기본 꺼짐');
    await page.check(`${P} [data-un="link"]`);
    await page.waitForSelector('#sheetRoot #elUnit');
    assert(await page.inputValue('#sheetRoot #elSubject') === '과학', '교과');
    await page.click('#sheetRoot #elOk');
    await page.waitForFunction(() => { const l = JSON.parse(localStorage.getItem('ssam:unit:list')); const tt = JSON.parse(localStorage.getItem('ssam:unit:t:' + l[0].id)); return tt.link && tt.link.unitId === 'u1'; });
    assert((await page.textContent(`${P} .el-box`)).includes('생명 · 동물의 생김새'), await page.textContent(`${P} .el-box`));
  }],
  ['페이지 오류 없음', async () => { assert(errors.length === 0, errors.join(' | ')); }]
]);
await t.close();
