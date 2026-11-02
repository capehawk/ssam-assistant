// 한꺼번에 넣기: 문서(학생용+교사용) + 스캔 → 나누기, 스캔 앞뒤 쪽은 AI가 한 번(이름 칸 가린 작은 그림), 확인 카드(쪽 눌러 표시 바꾸기·나누지 않기·취소),
// 학생 스캔만이면 AI·카드 없음
import { open, run, assert } from './helpers.mjs';

const t = await open();
const { page, url, errors } = t;
await page.addInitScript(() => {
  if (!localStorage.getItem('ssam:engine')) localStorage.setItem('ssam:engine', JSON.stringify({ engine: 'claude', keys: { claude: 'sk-test' }, remember: true }));
});
const calls = [];
await page.route('https://api.anthropic.com/**', async route => {
  const body = JSON.parse(route.request().postData());
  const c = body.messages[0].content;
  const prompt = typeof c === 'string' ? c : c.find(x => x.type === 'text').text;
  calls.push({ head: prompt.split('\n')[0], images: typeof c === 'string' ? 0 : c.filter(x => x.type === 'image').length });
  const out = JSON.stringify({ pages: [{ i: 0, role: 'teacher' }] });
  await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: [{ type: 'content_block_delta', delta: { type: 'text_delta', text: out } }, { type: 'message_delta', delta: { stop_reason: 'end_turn' } }].map(e => 'data: ' + JSON.stringify(e) + '\n\n').join('') }).catch(() => {});
});
await page.goto(url);
await page.waitForTimeout(500);
const KOR = ['국어 |  | 2. 마음을 전해요 | 국어책 40~43쪽', ' | [3차시] 편지 쓰기', ' | 학년 반 번 이름:', '1. 고마운 사람을 떠올려 보세요.', '누구? | ',
  '국어 |  | 2. 마음을 전해요 | 국어책 40~43쪽', ' | [3차시] 편지 쓰기', ' | 학년 반 번 이름: 교사용', '1. 고마운 사람을 떠올려 보세요.', '누구? | 할머니'].join('\n');
// 시험 쪽에서 파일을 만들어 readBundle에 넣음 (결과는 window.__b에)
const read = (n, withDoc) => page.evaluate(async ([n, withDoc, KOR]) => {
  const B = await import('./core/bundle.js');
  const png = async k => { const c = document.createElement('canvas'); c.width = 300; c.height = 400; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 300, 400); g.fillStyle = '#000'; g.fillRect(20 + k * 5, 60, 100, 20); const b = await new Promise(r => c.toBlob(r, 'image/png')); return new File([b], `스캔${k + 1}.png`, { type: 'image/png' }); };
  const files = [];
  if (withDoc) files.push(new File([KOR], '편지 쓰기.txt', { type: 'text/plain' }));
  for (let k = 0; k < n; k++) files.push(await png(k));
  window.__b = await B.readBundle(files);
  return { how: window.__b.doc.how, teacher: window.__b.doc.teacher.slice(0, 30), roles: window.__b.roles, need: B.needsCard(window.__b), pages: window.__b.pages.length };
}, [n, withDoc, KOR]);
const card = () => page.evaluate(async () => { const B = await import('./core/bundle.js'); window.__r = 'wait'; B.openBundleCard(window.__b, { what: '활동지' }).then(r => { window.__r = r; }); });

await run('bundle', [
  ['문서(학생용+교사용) + 스캔 4장: 문서는 나누고, 스캔 앞뒤 쪽은 AI 한 번(그림 4장)', async () => {
    const r = await read(4, true);
    assert(r.how === 'marker' && r.teacher.startsWith('국어'), JSON.stringify(r));
    assert(JSON.stringify(r.roles) === JSON.stringify(['teacher', 'student', 'student', 'student']), JSON.stringify(r.roles));
    const q = calls.filter(c => c.head === '[쪽 나누기]');
    assert(q.length === 1 && q[0].images === 4 && r.need, JSON.stringify(q));
  }],
  ['확인 카드: 요약·쪽 띠, 1쪽을 눌러 「빈 활동지」로 → [이대로 넣기] → 바뀐 표시로 돌아옴', async () => {
    await card();
    await page.waitForSelector('#sheetRoot #bundleCard');
    const sum = await page.textContent('#sheetRoot #bundleSum');
    assert(sum.includes('정답·교사용 1쪽') && sum.includes('학생 3쪽') && sum.includes('교사용'), sum);
    await page.click('#sheetRoot [data-bundle-page="0"]');
    assert((await page.textContent('#sheetRoot [data-bundle-page="0"]')).includes('빈 활동지'), '표시');
    await page.click('#sheetRoot #bundleOk');
    await page.waitForFunction(() => window.__r !== 'wait');
    const roles = await page.evaluate(() => window.__r && window.__r.roles);
    assert(JSON.stringify(roles) === JSON.stringify(['blank', 'student', 'student', 'student']), JSON.stringify(roles));
  }],
  ['[나누지 않기] → 교사용 없이 한 덩어리, 취소(바깥 누름) → null', async () => {
    await read(1, true);
    await card();
    await page.waitForSelector('#sheetRoot #bundleNoSplit');
    await page.click('#sheetRoot #bundleNoSplit');
    await page.click('#sheetRoot #bundleOk');
    await page.waitForFunction(() => window.__r !== 'wait');
    const d = await page.evaluate(() => window.__r.doc);
    assert(d.teacher === '' && d.student.includes('할머니') && d.student.includes('누구? |'), JSON.stringify(d).slice(0, 200));
    await card();
    await page.waitForSelector('#sheetRoot #bundleCard');
    await page.mouse.click(5, 5);
    await page.waitForFunction(() => window.__r !== 'wait');
    assert(await page.evaluate(() => window.__r === null), '취소');
  }],
  ['학생 스캔 2장만: AI 요청 없음, 카드 필요 없음', async () => {
    const n0 = calls.length;
    const r = await read(2, false);
    assert(!r.need && calls.length === n0 && r.pages === 2, JSON.stringify(r));
  }],
  ['페이지 오류 없음', async () => { assert(errors.length === 0, errors.join(' | ')); }]
]);
await t.close();
