// 품의 아무거나 넣기 화면: 줄글(규칙·AI), 장바구니 캡처 붙여넣기, 더하기/바꾸기 묻기, 구입처별 나누기, CSV 끌어 놓기, 개인정보는 칸에 안 들어감
import { open, run, assert } from './helpers.mjs';

const t = await open();
const { page, url, errors } = t;
// 품의 칸을 다루는 시험: [자세히 고치기]를 펼친 채로 (처음 화면은 purchase-oneshot.mjs)
await page.addInitScript(() => { if (!localStorage.getItem('ssam:purchase:view')) localStorage.setItem('ssam:purchase:view', JSON.stringify('full')); });
await page.addInitScript(() => {
  if (!localStorage.getItem('ssam:engine')) localStorage.setItem('ssam:engine', JSON.stringify({ engine: 'claude', keys: { claude: 'sk-test' }, remember: true }));
});
const calls = [];
let imageN = 0;
await page.route('https://api.anthropic.com/**', async route => {
  const body = JSON.parse(route.request().postData());
  const c = body.messages[0].content;
  const prompt = typeof c === 'string' ? c : c.find(x => x.type === 'text').text;
  const images = typeof c === 'string' ? 0 : c.filter(x => x.type === 'image').length;
  calls.push({ head: prompt.split('\n')[0], images, prompt });
  let out = '{}';
  if (prompt.startsWith('[품의 넣기]') && images) {
    imageN++;
    out = imageN === 1
      ? JSON.stringify({ items: [{ name: '물티슈', spec: '100매', unit: '팩', qty: 2, price: 3000, vendor: '쿠팡' }, { name: '지퍼백', spec: '대', unit: '박스', qty: 1, price: 4500, vendor: '쿠팡' }],
        shipping: [{ vendor: '쿠팡', fee: 3000 }], fields: { purpose: '교실 환경 정리', buyer: '홍길동', address: '서울시 어딘가 1', phone: '010-1234-5678' } })
      : JSON.stringify({ items: [{ name: '색지', spec: 'A4 10색', unit: '팩', qty: 3, price: 2000, vendor: '학교장터' }], shipping: [{ vendor: '학교장터', fee: 0 }], fields: {} });
  } else if (prompt.startsWith('[품의 넣기]')) {
    out = JSON.stringify({ items: [{ name: '스티커', unit: '장', qty: 30, price: 100 }, { name: '칭찬 도장', unit: '개', qty: 1, price: 8000 }], shipping: [], fields: { purpose: '학급 칭찬 활동', target: '3학년 1반' } });
  }
  await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: [{ type: 'content_block_delta', delta: { type: 'text_delta', text: out } }, { type: 'message_delta', delta: { stop_reason: 'end_turn' } }].map(e => 'data: ' + JSON.stringify(e) + '\n\n').join('') }).catch(() => {});
});
const P = 'section[data-menu="purchase"]';
const form = () => page.evaluate(() => JSON.parse(localStorage.getItem('ssam:purchase:current')).form);
const names = async () => (await form()).items.map(i => i.name).filter(Boolean);
const until = async (fn, ms = 8000) => { const end = Date.now() + ms; while (!(await fn())) { if (Date.now() > end) throw new Error('시간 초과'); await new Promise(r => setTimeout(r, 60)); } };
const pasteImage = () => page.evaluate(async () => {
  const c = document.createElement('canvas'); c.width = 40; c.height = 30; c.getContext('2d').fillRect(0, 0, 20, 20);
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  const dt = new DataTransfer(); dt.items.add(new File([blob], 'image.png', { type: 'image/png' }));
  document.querySelector('#pcIntake').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
});
await page.goto(url);
await page.waitForTimeout(400);
await page.click('nav.app-side [data-menu-go="purchase"]');
await page.waitForSelector(`${P} #pcIntake`);

await run('purchase-intake', [
  ['줄글(규칙으로 다 읽힘) → 품목 4줄·단위, AI 안 부름', async () => {
    await page.fill(`${P} #pcIntake`, 'A4 용지 5박스 2만원\n보드마커 검정 10개 1200원\n풀 3개×500\n가위 4자루 총 1만원');
    await page.click(`${P} [data-pc="intake"]`);
    await until(async () => (await names()).length === 4);
    const f = await form();
    assert(f.items[0].unit === '박스' && f.items[0].price === '20000' && f.items[3].price === '2500', JSON.stringify(f.items));
    assert(await page.inputValue(`${P} [data-item="0"][data-f="unit"]`) === '박스', '단위 칸');
    assert(calls.length === 0, 'AI를 부름');
    assert((await page.inputValue(`${P} #pcIntake`)) === '', '넣기 칸이 비지 않음');
  }],
  ['못 읽는 줄이 있는 줄글 → AI 한 번, 품목이 있으니 묻기 → [바꾸기], 빈 목적·대상만 채움(쓴 사업명 그대로)', async () => {
    await page.fill(`${P} #pcProject`, '내가 쓴 사업명');
    await page.fill(`${P} #pcIntake`, '칭찬 스티커 좀 사고\n도장도 하나');
    await page.click(`${P} [data-pc="intake"]`);
    await page.waitForSelector('#sheetRoot #pcMergeReplace');
    assert((await page.textContent('#sheetRoot')).includes('품목 4개'), await page.textContent('#sheetRoot'));
    await page.click('#sheetRoot #pcMergeReplace');
    await until(async () => (await names()).join() === '스티커,칭찬 도장');
    const f = await form();
    assert(f.purpose === '학급 칭찬 활동' && f.target === '3학년 1반' && f.project === '내가 쓴 사업명', JSON.stringify(f));
    assert(calls.filter(c => c.head === '[품의 넣기]').length === 1 && calls[0].prompt.includes('칭찬 스티커 좀 사고'), '프롬프트');
  }],
  ['장바구니 캡처 붙여넣기 → AI(그림 1장) → [더하기] → 품목·배송비 줄·구입처 열, 주문자·주소는 어디에도 없음', async () => {
    await pasteImage();
    await page.waitForSelector('#sheetRoot #pcMergeAdd');
    await page.click('#sheetRoot #pcMergeAdd');
    await until(async () => (await names()).includes('배송비'));
    const f = await form();
    assert(JSON.stringify((await names())) === JSON.stringify(['스티커', '칭찬 도장', '물티슈', '지퍼백', '배송비']), (await names()).join());
    const ship = f.items.find(i => i.name === '배송비');
    assert(ship.price === '3000' && ship.vendor === '쿠팡' && ship.unit === '건', JSON.stringify(ship));
    assert(calls.at(-1).images === 1, '그림');
    assert(await page.locator(`${P} [data-item="2"][data-f="vendor"]`).count() === 1, '구입처 열');
    const all = JSON.stringify(f);
    assert(!all.includes('홍길동') && !all.includes('서울시') && !all.includes('010-1234'), '개인정보가 들어감');
    assert(f.purpose === '학급 칭찬 활동', '쓴 목적을 덮음');
  }],
  ['구입처가 둘이 되면 묻기 → [구입처별로 나누기] → 지금 품의엔 쿠팡·구입처 없는 품목, 학교장터는 최근 작성에 새 품의', async () => {
    await pasteImage();
    await page.waitForSelector('#sheetRoot #pcMergeAdd');
    await page.click('#sheetRoot #pcMergeAdd');
    await page.waitForSelector('#sheetRoot #pcVendorSplit');
    assert((await page.textContent('#sheetRoot')).includes('2곳'), await page.textContent('#sheetRoot'));
    await page.click('#sheetRoot #pcVendorSplit');
    await until(async () => !(await names()).includes('색지'));
    assert((await names()).join() === '스티커,칭찬 도장,물티슈,지퍼백,배송비', (await names()).join());
    const recent = await page.evaluate(() => JSON.parse(localStorage.getItem('ssam:purchase:recent') || '[]'));
    assert(recent.length === 1 && recent[0].form.items.map(i => i.name).join() === '색지' && recent[0].form.project.includes('(학교장터)') && !recent[0].draft, JSON.stringify(recent));
  }],
  ['CSV 견적서 끌어 놓기 → [바꾸기] → 표에서 품목(AI 안 부름)', async () => {
    const n = calls.length;
    await page.evaluate(() => {
      const dt = new DataTransfer();
      dt.items.add(new File(['품명,규격,수량,단가\n비커,500ml,8,4500\n유리 막대,30cm,8,1200\n합계,,,45600'], '견적서.csv', { type: 'text/csv' }));
      document.querySelector('#pcIntake').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
    });
    await page.waitForSelector('#sheetRoot #pcMergeReplace');
    await page.click('#sheetRoot #pcMergeReplace');
    await until(async () => (await names()).join() === '비커,유리 막대');
    assert(calls.length === n, 'AI를 부름');
  }],
  ['페이지 오류 없음', async () => { assert(errors.length === 0, errors.join(' | ')); }]
]);
await t.close();
