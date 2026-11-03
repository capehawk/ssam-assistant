/* 문서 글 읽기: 한글(.hwp·.hwpx)·PDF(글자 층)·워드(.docx)·엑셀(.xlsx)·CSV·글(.txt) → 글.
   한글·PDF는 기존 평가 메뉴의 파서(window.SSAM.files)를 씀. 실패하면 { code }를 던짐 */
import { readTable, decodeText } from './sheet.js';
import { unzip } from './zip.js';

const MSG = {
  UNSUPPORTED: '이 형식은 읽지 못해요. 한글(.hwp·.hwpx)·PDF·워드·엑셀·CSV 파일이나 붙여넣기로 넣어 주세요.',
  PDF_NO_TEXT: '글자가 없는 PDF(스캔본)예요. 한글 파일을 넣거나 내용을 붙여넣어 주세요.',
  HWP_PASSWORD: '암호가 걸린 한글 파일이에요. 한글에서 암호를 풀고 다시 저장한 뒤 넣어 주세요.',
  HWP_DISTRIBUTION: '배포용 문서라 내용을 읽을 수 없어요. 한글에서 일반 문서로 다시 저장하거나 내용을 붙여넣어 주세요.',
  READ_FAILED: '파일을 읽지 못했어요. 파일이 손상됐을 수 있어요. 내용을 복사해 붙여넣어 주세요.'
};
export const fileMessage = code => MSG[code] || MSG.READ_FAILED;
export const isFileCode = code => !!MSG[code];

const bridge = () => (window.SSAM && window.SSAM.files) || {};
const tidy = s => String(s || '').replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

/* 워드 본문 XML → 글: 문단마다 줄, 표 칸은 탭(줄 끝 탭은 뺌), 줄바꿈·탭 표시 */
const XENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
function docxText(files) {
  const x = files.get('word/document.xml');
  if (!x) throw { code: 'READ_FAILED' };
  return new TextDecoder().decode(x)
    .replace(/<w:tab\/>/g, '\t').replace(/<w:br[^>]*\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n').replace(/<\/w:tc>/g, '\t').replace(/\n\t/g, '\t').replace(/<\/w:tr>/g, '\n')
    .replace(/<[^>]+>/g, '').replace(/&(amp|lt|gt|quot|apos);/g, (m, k) => XENT[k]).replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n))
    .replace(/\t+\n/g, '\n');
}

/* opts.columns: 2쪽 모아찍기 PDF는 왼쪽 단을 먼저 (단원평가 문제지·정답지) */
export async function readText(file, opts = {}) {
  const name = String(file && file.name || '');
  const ext = (/\.([a-z0-9]+)$/i.exec(name) || [, ''])[1].toLowerCase();
  if (!['hwp', 'hwpx', 'pdf', 'docx', 'csv', 'xlsx', 'txt'].includes(ext)) throw { code: 'UNSUPPORTED' };
  let u8;
  try { u8 = new Uint8Array(await file.arrayBuffer()); } catch (e) { throw { code: 'READ_FAILED' }; }
  try {
    if (ext === 'hwp' || ext === 'hwpx') return tidy(await bridge().readHwpText(u8));
    if (ext === 'pdf') {
      const t = await bridge().pdfText(u8, { columns: !!opts.columns });
      if (String(t).replace(/\s/g, '').length < 20) throw { code: 'PDF_NO_TEXT' };
      return tidy(t);
    }
    if (ext === 'txt') return tidy(decodeText(u8));
    if (ext === 'docx') return tidy(docxText(await unzip(u8)));
    const rows = await readTable(name, u8);
    return rows.map(r => r.join('\t').replace(/\t+$/, '')).join('\n').trim();
  } catch (e) {
    if (e && e.code) throw e;
    const m = String(e && e.message || '');
    throw { code: MSG[m] ? m : 'READ_FAILED' };
  }
}
