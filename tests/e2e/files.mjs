// 문서 글 읽기: 한글(.hwpx)·CSV(EUC-KR)·글 파일, 못 읽는 형식 안내
import { open, run, assert } from './helpers.mjs';

const t = await open();
const { page, url, errors } = t;
await page.goto(url);
await page.waitForTimeout(500);

// 브라우저 안에서 File을 만들어 readText를 부르고 { text } 또는 { code, msg }를 돌려받음
const read = (kind) => page.evaluate(async kind => {
  const { readText, fileMessage } = await import('./core/files.js');
  let file;
  if (kind === 'hwpx') {
    const { makeHwpx } = await import('./core/hwpx.js');
    file = new File([makeHwpx({ title: '2026 독서교육 계획', blocks: [{ type: 'p', text: '아침 독서 20분' }, { type: 'table', rows: [['월', '내용'], ['3월', '독서 동아리 모집']] }] })], '작년 계획.hwpx');
  } else if (kind === 'csv') file = new File([new Uint8Array([0xc7, 0xb0, 0xb8, 0xed, 0x2c, 0xbc, 0xf6, 0xb7, 0xae, 0x0a, 0x31, 0x2c, 0x32])], '설문.csv');
  else if (kind === 'txt') file = new File(['반성: 저학년 참여가 적었음'], '메모.txt');
  else if (kind === 'docx') file = new File(['PK'], '공문.docx');
  else if (kind === 'pptx') file = new File(['PK'], '발표.pptx');
  else if (kind === 'pdf') file = new File(['%PDF-1.4 쓰레기'], '깨진.pdf');
  try { return { text: await readText(file) }; } catch (e) { return { code: e && e.code, msg: fileMessage(e && e.code) }; }
}, kind);

await run('files', [
  ['한글 파일(.hwpx) → 제목·문단·표 글', async () => {
    const r = await read('hwpx');
    for (const w of ['2026 독서교육 계획', '아침 독서 20분', '독서 동아리 모집']) assert(r.text && r.text.includes(w), `「${w}」 없음: ` + JSON.stringify(r));
  }],
  ['CSV(EUC-KR) → 탭으로 이은 글', async () => {
    const r = await read('csv');
    assert(r.text === '품명\t수량\n1\t2', JSON.stringify(r));
  }],
  ['글 파일 그대로', async () => {
    assert((await read('txt')).text === '반성: 저학년 참여가 적었음');
  }],
  ['파워포인트처럼 못 읽는 형식은 안내(워드는 0.15.0부터 읽음)', async () => {
    const r = await read('pptx');
    assert(r.code === 'UNSUPPORTED' && r.msg.includes('한글(.hwp·.hwpx)·PDF·워드·엑셀·CSV 파일이나 붙여넣기로 넣어 주세요'), JSON.stringify(r));
  }],
  ['깨진 워드 파일은 READ_FAILED', async () => {
    const r = await read('docx');
    assert(r.code === 'READ_FAILED' && r.msg, JSON.stringify(r));
  }],
  ['깨진 PDF는 READ_FAILED', async () => {
    const r = await read('pdf');
    assert(r.code === 'READ_FAILED' && r.msg, JSON.stringify(r));
  }],
  ['페이지 오류 없음', async () => { assert(errors.length === 0, errors.join(' | ')); }]
]);
await t.close();
