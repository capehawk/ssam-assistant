// 에듀파인에 차례로 붙여넣기(Windows 앱): 품의 초안 → [에듀파인에 차례로 붙여넣기] → queue_arm(제목·사유·산출 내역 칸마다),
// 패널이 다음 조각을 보이고, 붙일 때마다(이벤트) 다음으로, 건너뛰기 → queue_goto, 끝 → 「다 넣었어요」, 표 한 번에, 나이스 준비면 닫힘
import { open, run, assert, mockClaude } from './helpers.mjs';

const t = await open();
const { page, url, errors } = t;
await page.addInitScript(() => {
  if (!localStorage.getItem('ssam:purchase:view')) localStorage.setItem('ssam:purchase:view', JSON.stringify('full'));
  if (!localStorage.getItem('ssam:engine')) localStorage.setItem('ssam:engine', JSON.stringify({ engine: 'claude', keys: { claude: 'sk-test' }, remember: true }));
});
await mockClaude(page, () => '```json\n' + JSON.stringify({ title: '5학년 과학 실험 재료 구입', intro: '5학년 과학 실험에 쓸 재료를 다음과 같이 구입하고자 합니다.' }) + '\n```');
const P = 'section[data-menu="purchase"]';
const fakeApp = () => page.evaluate(() => {
  window.__calls = [];
  window.__TAURI__ = {
    core: { invoke: async (cmd, args) => { window.__calls.push([cmd, JSON.parse(JSON.stringify(args || {}))]); return cmd === 'queue_arm' ? { gen: 7, secs: 900 } : null; } },
    event: { listen: async (name, cb) => { if (name === 'neis-paste') window.__qh = cb; return () => {}; } }
  };
});
const fire = p => page.evaluate(p => window.__qh({ payload: p }), p);
const calls = () => page.evaluate(() => window.__calls);
const nextLabel = () => page.evaluate(() => { const b = document.querySelector('#qpPanel .qp-next b'); return b ? b.textContent : ''; });

await page.goto(url);
await page.waitForTimeout(500);
await page.click('nav.app-side [data-menu-go="purchase"]');
await page.click('#menuTabs [data-tab="new"]');
const fill = async (sel, v) => { await page.fill(`${P} ${sel}`, v); };

await run('queue-paste', [
  ['웹판: 초안에 차례로 붙여넣기 단추가 없음', async () => {
    await fill('#pcProject', '5학년 과학 실험 재료 구입'); await fill('#pcPurpose', '용해와 용액 모둠 실험');
    await fill('[data-item="0"][data-f="name"]', '비커'); await fill('[data-item="0"][data-f="spec"]', '500ml');
    await fill('[data-item="0"][data-f="qty"]', '2'); await fill('[data-item="0"][data-f="price"]', '3000');
    await page.click(`${P} [data-pc="draft"]`);
    await page.waitForFunction(s => document.querySelector(`${s} #pcTitle`) && document.querySelector(`${s} #pcTitle`).value.includes('실험 재료'), P, { timeout: 8000 });
    assert(!(await page.$(`${P} [data-pc="queue"]`)), '웹판에 단추');
  }],
  ['Windows 앱: [에듀파인에 차례로 붙여넣기] → queue_arm(제목·사유·품목 칸마다), 패널 「제목 칸을 누르고 Ctrl+V」', async () => {
    await fakeApp();
    await page.click('#menuTabs [data-tab="recent"]'); await page.click('#menuTabs [data-tab="new"]');
    await page.waitForSelector(`${P} [data-pc="queue"]`);
    await page.click(`${P} [data-pc="queue"]`);
    await page.waitForFunction(() => window.__calls.some(c => c[0] === 'queue_arm'));
    const a = (await calls()).find(c => c[0] === 'queue_arm')[1];
    assert(a.items.length === 7 && a.items[0] === '5학년 과학 실험 재료 구입' && a.items[1].includes('구입하고자 합니다') && JSON.stringify(a.items.slice(2)) === JSON.stringify(['비커', '500ml', '개', '2', '3000']) && a.start === 0 && a.anyWindow === false, JSON.stringify(a));
    await page.waitForFunction(() => (document.querySelector('#qpPanel') || {}).textContent?.includes('칸을 누르고'));
    assert((await nextLabel()) === '제목', await nextLabel());
    assert((await page.textContent('#qpPanel')).includes('저장·결재는 선생님이'), '저장 안내');
  }],
  ['붙일 때마다(state queue) 다음 조각, [건너뛰기] → queue_goto, 다른 준비의 알림은 무시', async () => {
    await fire({ state: 'queue', gen: 7, done: 1, total: 7 });
    assert((await nextLabel()) === '품의 사유', await nextLabel());
    await fire({ state: 'queue', gen: 3, done: 5, total: 9 });
    assert((await nextLabel()) === '품의 사유', '다른 준비 알림에 바뀜');
    await page.click('#qpPanel [data-qp="skip"]');
    await page.waitForFunction(() => window.__calls.some(c => c[0] === 'queue_goto'));
    assert(JSON.stringify((await calls()).find(c => c[0] === 'queue_goto')[1]) === JSON.stringify({ gen: 7, index: 2 }), JSON.stringify(await calls()));
    assert((await nextLabel()) === '1. 품명', await nextLabel());
    await page.click('#qpPanel [data-qp-go="5"]');
    assert((await nextLabel()) === '1. 수량', await nextLabel());
  }],
  ['끝(end finished) → 「다 넣었어요」·저장은 선생님', async () => {
    await fire({ state: 'end', gen: 7, done: 7, total: 7, reason: 'finished' });
    const txt = await page.textContent('#qpPanel');
    assert(txt.includes('다 넣었어요') && txt.includes('저장·결재는 선생님이'), txt);
  }],
  ['[표 한 번에]를 고르면 조각 3개(산출 내역 표), 나이스 붙여넣기를 준비하면 패널이 닫힘', async () => {
    await page.click('#qpPanel [data-qp="close"]');
    await page.click(`${P} [data-qcalc="table"]`);
    await page.evaluate(() => { window.__calls = []; });
    await page.click(`${P} [data-pc="queue"]`);
    await page.waitForFunction(() => window.__calls.some(c => c[0] === 'queue_arm'));
    const a = (await calls()).find(c => c[0] === 'queue_arm')[1];
    assert(a.items.length === 3 && a.items[2].startsWith('품명\t규격'), JSON.stringify(a.items));
    await page.waitForSelector('#qpPanel');
    await page.evaluate(() => document.dispatchEvent(new CustomEvent('ssam:paste-owner', { detail: 'neis' })));
    assert(!(await page.$('#qpPanel')), '패널이 남음');
  }],
  ['[닫기] → neis_disarm(준비 풂)', async () => {
    await page.click(`${P} [data-pc="queue"]`);
    await page.waitForSelector('#qpPanel [data-qp="close"]');
    await page.evaluate(() => { window.__calls = []; });
    await page.click('#qpPanel [data-qp="close"]');
    await page.waitForFunction(() => window.__calls.some(c => c[0] === 'neis_disarm'));
    assert(!(await page.$('#qpPanel')), '패널이 남음');
  }],
  ['페이지 오류 없음', async () => { assert(errors.length === 0, errors.join(' | ')); }]
]);
await t.close();
