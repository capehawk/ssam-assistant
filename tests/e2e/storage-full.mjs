// 저장 공간이 꽉 차면 조용히 넘어가지 않음: 학교 정보·품의 기준·새 품의·평가계획 넣기, 경고가 한 번으로 끝나지 않음
import { open, run, assert } from './helpers.mjs';

const t = await open();
const { page, url, errors } = t;
// 품의 칸을 다루는 시험: [자세히 고치기]를 펼친 채로 (처음 화면은 purchase-oneshot.mjs)
await page.addInitScript(() => { if (!localStorage.getItem('ssam:purchase:view')) localStorage.setItem('ssam:purchase:view', JSON.stringify('full')); });
await page.addInitScript(() => {
  window.__persist = 0;
  if (navigator.storage) navigator.storage.persist = async () => { window.__persist++; return true; };
});
await page.goto(url);
await page.waitForTimeout(300);
await page.evaluate(() => localStorage.setItem('ssam:hk', JSON.stringify({ settings: {}, students: [{ id: 'a', no: 1, label: '', memo: '', done: 0, results: [] }] })));
await page.reload(); await page.waitForTimeout(400);
// 고른 키만 저장 실패 (QuotaExceededError)
const full = re => page.evaluate(re => {
  const o = window.__set || Storage.prototype.setItem; window.__set = o;
  Storage.prototype.setItem = function (k, v) { if (new RegExp(re).test(k)) throw new DOMException('꽉 참', 'QuotaExceededError'); return o.call(this, k, v); };
}, re);
const ok = () => page.evaluate(() => { if (window.__set) Storage.prototype.setItem = window.__set; });
const toast = () => page.textContent('#toast');
const S = 'section[data-menu="settings"]';

await run('storage-full', [
  ['학교 정보를 저장하지 못하면 「저장했어요」 대신 알림', async () => {
    await page.click('nav.app-side [data-menu-go="settings"]'); await page.click('#menuTabs [data-tab="school"]');
    await page.fill(`${S} #schName`, '쌤초');
    await full('^ssam:school$');
    await page.click(`${S} [data-set="saveSchool"]`);
    await page.waitForTimeout(100);
    await ok();
    const txt = await page.textContent(S);
    assert(txt.includes('저장 공간이 모자라') && !(await toast()).includes('학교 정보를 저장했어요'), await toast());
  }],
  ['품의 기준 금액을 저장하지 못하면 「1원 이상」이 아니라 저장 공간 알림', async () => {
    await page.click('#menuTabs [data-tab="purchase"]');
    await page.fill(`${S} #limitWon`, '30000000');
    await full('^ssam:purchaseLimit$');
    await page.click(`${S} [data-set="saveLimit"]`);
    await page.waitForTimeout(100);
    await ok();
    const txt = await page.textContent(S);
    assert(txt.includes('저장 공간이 모자라') && !txt.includes('1원 이상으로'), txt.slice(0, 200));
  }],
  ['새 품의에 쓰다가 저장하지 못하면 알림', async () => {
    await page.click('nav.app-side [data-menu-go="purchase"]');
    await page.waitForSelector('[data-item="0"][data-f="name"]');
    await full('^ssam:purchase:current$');
    await page.fill('[data-item="0"][data-f="name"]', '복사 용지');
    await page.waitForTimeout(150);
    await ok();
    assert((await toast()).includes('저장 공간이 모자라'), await toast());
  }],
  ['평가계획을 넣는데 저장하지 못하면 「찾았어요」에 묻히지 않고 알림, 다음에 또 실패해도 다시 알림', async () => {
    await page.click('nav.app-side [data-menu-go="evaluate"]'); await page.click('#menuTabs [data-tab="pyeongeo"]');
    await page.click('#srcPaste');
    await page.fill('#pasteBox', await page.getAttribute('#pasteBox', 'placeholder'));
    await full('^ssam:plan');
    await page.click('#pasteGo');
    await page.waitForTimeout(300);
    assert((await toast()).includes('저장 공간'), await toast());
    await ok();
    // 처음 한 번만 알리고 끝나지 않음: 시간이 지나 행특 메모 저장이 실패하면 다시 알림
    await page.evaluate(() => { const n = Date.now; Date.now = () => n() + 120000; });
    await page.keyboard.press('Escape'); // AI 키 창이 열렸으면 닫음
    await page.waitForTimeout(150);
    await page.click('#menuTabs [data-tab="hk"]');
    await page.waitForSelector('#hkMemo');
    await full('^ssam:hk$');
    await page.fill('#hkMemo', '메모');
    await page.waitForTimeout(900);
    await ok();
    assert((await toast()).includes('저장 공간'), '두 번째: ' + await toast());
  }],
  ['설정 › 학년도: 저장 공간 사용량과 마지막 백업(백업하면 「오늘」), 브라우저에 자료를 지우지 말라고 요청', async () => {
    await page.click('nav.app-side [data-menu-go="settings"]'); await page.click('#menuTabs [data-tab="years"]');
    await page.waitForSelector(`${S} [data-set="backup"]`);
    assert(await page.evaluate(() => window.__persist) >= 1, 'persist를 부르지 않음');
    let txt = await page.textContent(S);
    assert(/저장 공간 \d+% 사용/.test(txt) && txt.includes('아직 백업 파일을 만들지 않았어요'), txt.slice(0, 300));
    await Promise.all([page.waitForEvent('download'), page.click(`${S} [data-set="backup"]`)]);
    await page.waitForTimeout(200);
    txt = await page.textContent(S);
    assert(txt.includes('마지막 백업: 오늘'), txt.slice(0, 300));
  }],
  ['저장 공간이 70%를 넘으면 설정에 경고, 앱을 열 때도 한 번 알림', async () => {
    await page.evaluate(() => localStorage.setItem('zz-test-junk', 'x'.repeat(3900000)));
    await page.reload(); await page.waitForTimeout(1600);
    assert((await toast()).includes('저장 공간이') && (await toast()).includes('%'), '열 때 알림: ' + await toast());
    await page.click('nav.app-side [data-menu-go="settings"]'); await page.click('#menuTabs [data-tab="years"]');
    await page.waitForSelector(`${S} [data-set="backup"]`);
    const txt = await page.textContent(S);
    await page.evaluate(() => localStorage.removeItem('zz-test-junk'));
    assert(txt.includes('저장 공간이 70% 넘게 찼어요'), txt.slice(0, 300));
  }],
  ['페이지 오류 없음', async () => { assert(errors.length === 0, errors.join(' | ')); }]
]);
await t.close();
