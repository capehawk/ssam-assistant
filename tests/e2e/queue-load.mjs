// 차례로 붙여넣기 최종 검토 M7(→중요): 앱 화면을 새로 열면(F5) 남아 있던 준비를 풂(패널 없이 Ctrl+V를 맡지 않게),
// 준비하는 중에 [닫기]를 눌러도 준비가 끝난 뒤 다시 풂(명령 차례가 바뀌어도)
import { open, run, assert } from './helpers.mjs';

const t = await open();
const { page, url, errors } = t;
// Windows 앱처럼: 처음부터 __TAURI__가 있음. queue_arm은 늦게 끝남
await page.addInitScript(() => {
  window.__calls = [];
  window.__TAURI__ = {
    core: { invoke: (cmd, args) => { window.__calls.push(cmd); return cmd === 'queue_arm' ? new Promise(r => setTimeout(() => { window.__calls.push('queue_arm:done'); r({ gen: 9, secs: 900 }); }, 400)) : Promise.resolve(null); } },
    event: { listen: async () => () => {} }
  };
});
await page.goto(url);
await page.waitForTimeout(600);

await run('queue-load', [
  ['앱 화면을 열면 neis_disarm을 한 번 부름(남은 준비 풀기)', async () => {
    const c = await page.evaluate(() => window.__calls.filter(x => x === 'neis_disarm').length);
    assert(c === 1, 'neis_disarm ' + c + ' · ' + JSON.stringify(await page.evaluate(() => window.__calls)));
  }],
  ['준비하는 중에 [닫기] → 준비가 끝난 뒤에도 neis_disarm', async () => {
    await page.evaluate(async () => { const m = await import('./core/queue-paste.js'); window.__calls = []; m.openQueue({ title: 'T', items: [{ label: '제목', text: '가' }] }); });
    await page.waitForSelector('#qpPanel [data-qp="close"]');
    await page.click('#qpPanel [data-qp="close"]');
    await page.waitForTimeout(800);
    const calls = await page.evaluate(() => window.__calls);
    const done = calls.indexOf('queue_arm:done');
    assert(done >= 0 && calls.slice(done + 1).includes('neis_disarm'), JSON.stringify(calls));
  }],
  ['페이지 오류 없음', async () => { assert(errors.length === 0, errors.join(' | ')); }]
]);
await t.close();
