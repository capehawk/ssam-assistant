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
  const prompt = typeof c === 'string' ? c : c.filter(x => x.type === 'text').map(x => x.text).join('\n');
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
// 글자층 PDF 만들기(복사기 글자 인식·인쇄본): 쪽마다 html, img가 있으면 그림만 있는 쪽
const pdfOf = async pagesHtml => {
  const pg = await t.ctx.newPage();
  await pg.setContent(`<!doctype html><meta charset="utf-8"><style>section{page-break-after:always;height:900px;font:16px sans-serif}</style>${pagesHtml.map(h => `<section>${h}</section>`).join('')}`);
  const b = await pg.pdf({ format: 'A4' }); await pg.close(); return [...b];
};
const readFiles = (files, opts = {}) => page.evaluate(async ([files, opts]) => {
  const B = await import('./core/bundle.js');
  const fs = files.map(f => new File([f.bytes ? new Uint8Array(f.bytes) : f.text], f.name, { type: f.bytes ? 'application/pdf' : 'text/plain' }));
  window.__b = await B.readBundle(fs, opts);
  return { student: window.__b.doc.student, teacher: window.__b.doc.teacher, how: window.__b.doc.how, roles: window.__b.roles, need: B.needsCard(window.__b), pages: window.__b.pages.length };
}, [files, opts]);
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
  ['교사용 파일만 따로 넣으면 통째로 교사용(학생용 칸을 머리 줄로 덮지 않음), 「정답」 파일도, 이름에 정답이 든 합본은 나눔', async () => {
    const T = ['[과학] 3-2-4-03 물은 어디로 갈까? (50~51쪽)', '물의 여행', '반 번 이름: 교사용', '1. 바다 → 구름 → 비'].join('\n');
    let r = await readFiles([{ name: '물의 여행(교사용).txt', text: T }]);
    assert(r.student === '' && r.teacher.includes('바다 → 구름') && r.teacher.includes('물의 여행'), JSON.stringify(r));
    r = await readFiles([{ name: '물의여행_정답.txt', text: '물의 여행 정답\n1. 수증기\n2. 구름\n3. 비' }]);
    assert(r.student === '' && r.teacher.includes('수증기'), JSON.stringify(r));
    const C = ['과학 1단원 평가', ...Array.from({ length: 10 }, (_, i) => `${i + 1}. 문제 ${i + 1}을 풀어 보세요.`), '정답 및 해설', '1. ①', '2. ②'].join('\n');
    r = await readFiles([{ name: '과학 평가(정답 포함).txt', text: C }]);
    assert(r.student.includes('10. 문제 10') && r.teacher.startsWith('정답 및 해설'), JSON.stringify(r).slice(0, 200));
  }],
  ['글자 인식된 학생 스캔 PDF(쪽마다 이름이 적힘)는 문서가 아니라 학생 쪽, 학생 스캔을 받는 곳(expect)이면 2쪽이어도 학생 쪽, 인쇄본 활동지 PDF는 문서', async () => {
    const stu = ['김하늘', '이바다', '박구름'].map((n, i) => `<p>물의 여행 그리기</p><p>3학년 2반 ${i + 1}번 이름: ${n}</p><p>1. 바다에서 증발해 구름이 됩니다 그리고 비가 내려요</p>`);
    let r = await readFiles([{ name: '스캔.pdf', bytes: await pdfOf(stu) }]);
    assert(r.pages === 3 && r.roles.every(x => x === 'student') && !r.student && !r.teacher && !r.need, JSON.stringify(r).slice(0, 300));
    const two = ['<p>물의 여행 그리기</p><p>1. 바다에서 증발해 구름이 됩니다 그리고 비가 내려요 많이</p>', '<p>물의 여행 그리기</p><p>1. 구름이 되어 비로 내려 바다로 돌아갑니다 다시 또</p>'];
    r = await readFiles([{ name: '스캔.pdf', bytes: await pdfOf(two) }], { expect: 'student' });
    assert(r.pages === 2 && r.roles.every(x => x === 'student') && !r.teacher, JSON.stringify(r).slice(0, 300));
    const printed = ['<p>물의 여행 그리기 (12~13쪽)</p><p>반 번 이름:</p><p>1. 물이 여행하는 길을 그려 봅시다.</p>', '<p>물의 여행 그리기 (12~13쪽)</p><p>반 번 이름: 교사용</p><p>1. 바다 구름 비를 화살표로 이은 그림</p>'];
    r = await readFiles([{ name: '물의 여행.pdf', bytes: await pdfOf(printed) }]);
    assert(r.pages === 0 && r.student.includes('그려 봅시다') && r.teacher.includes('화살표'), JSON.stringify(r).slice(0, 300));
  }],
  ['스캔 사이 글자층 쪽을 카드에서 학생으로 바꾸면 그 쪽 글은 교사용 글에서 빠짐', async () => {
    const dot = 'data:image/png;base64,' + (await page.screenshot({ clip: { x: 0, y: 0, width: 120, height: 160 } })).toString('base64');
    const r = await readFiles([{ name: '묶음.pdf', bytes: await pdfOf(['<p>교사용 예시 답: 바다에서 증발한 물이 햇볕을 받아 구름이 되고 다시 비로 내려 바다로 갑니다.</p>', `<img src="${dot}" width="300">`, `<img src="${dot}" width="320">`]) }]);
    assert(r.pages === 3 && r.roles[0] === 'teacher' && r.teacher.includes('예시 답'), JSON.stringify(r).slice(0, 300));
    await card();
    await page.waitForSelector('#sheetRoot #bundleCard');
    await page.click('#sheetRoot [data-bundle-page="0"]'); await page.click('#sheetRoot [data-bundle-page="0"]');
    await page.click('#sheetRoot #bundleOk');
    await page.waitForFunction(() => window.__r && window.__r !== 'wait');
    const v = await page.evaluate(() => ({ roles: window.__r.roles, teacher: window.__r.doc.teacher }));
    assert(v.roles[0] === 'student' && !v.teacher.includes('예시 답'), JSON.stringify(v));
  }],
  ['페이지 오류 없음', async () => { assert(errors.length === 0, errors.join(' | ')); }]
]);
await t.close();
