/* 견적서 표 읽기: CSV·엑셀(.xlsx) → 줄×칸 글, 그리고 품명·규격·수량·단가 찾기.
   DOMParser 없이 정규식으로 XML을 읽음 (Node 시험에서도 돎) */
import { unzip } from './zip.js';
import { toNumber } from '../menus/purchase/rules.js';

/* UTF-8(BOM 포함)이 아니면 EUC-KR(엑셀이 저장한 CSV) */
export function decodeText(u8) {
  try { return new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(u8); }
  catch (e) { return new TextDecoder('euc-kr').decode(u8); }
}

export function readCsv(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  const s = String(text || '');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const unxml = s => String(s).replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, e) => {
  const k = e.toLowerCase();
  if (k[0] === '#') return String.fromCodePoint(k[1] === 'x' ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10));
  return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[k];
});
const attr = (attrs, name) => { const m = new RegExp(`\\b${name}="([^"]*)"`).exec(attrs); return m ? m[1] : null; };
/* <t>…</t>들을 이어 붙임 (일본어 읽기 rPh는 뺌) */
const texts = xml => [...String(xml).replace(/<rPh\b[\s\S]*?<\/rPh>/g, '').matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(m => unxml(m[1])).join('');
const colIndex = ref => { let n = 0; for (const ch of String(ref).replace(/\d+/g, '').toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };

/* 첫 시트를 줄×칸 글로 */
export async function readXlsx(u8) {
  const files = await unzip(u8);
  const text = name => { const f = files.get(name); return f ? new TextDecoder().decode(f) : ''; };
  const shared = [...text('xl/sharedStrings.xml').matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map(m => texts(m[1]));
  // 첫 시트의 파일: workbook.xml의 첫 sheet → 관계 파일의 Target
  let sheetPath = 'xl/worksheets/sheet1.xml';
  const first = /<sheet\b([^>]*)\/?>/.exec(text('xl/workbook.xml'));
  const rid = first && attr(first[1], 'r:id');
  if (rid) {
    const rel = [...text('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\b([^>]*)\/?>/g)].map(m => m[1]).find(a => attr(a, 'Id') === rid);
    const target = rel && attr(rel, 'Target');
    if (target) sheetPath = target.startsWith('/') ? target.slice(1) : 'xl/' + target.replace(/^\.\//, '');
  }
  const xml = text(sheetPath) || text('xl/worksheets/sheet1.xml');
  if (!xml) throw new Error('NO_SHEET');
  const rows = [];
  let next = 0;
  for (const m of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const r = attr(m[1], 'r');
    const ri = r ? +r - 1 : next;
    next = ri + 1;
    const cells = [];
    let ci = 0;
    for (const c of (m[2] || '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = attr(c[1], 'r'), t = attr(c[1], 't'), inner = c[2] || '';
      if (ref) ci = colIndex(ref);
      const v = /<v>([\s\S]*?)<\/v>/.exec(inner);
      let val = v ? unxml(v[1]) : '';
      if (t === 's') val = shared[+val] || '';
      else if (t === 'inlineStr') val = texts(inner);
      else if (t === 'b') val = val === '1' ? 'TRUE' : 'FALSE';
      while (cells.length < ci) cells.push('');
      cells[ci] = val;
      ci++;
    }
    while (rows.length < ri) rows.push([]);
    rows[ri] = cells;
  }
  return rows;
}

export async function readTable(name, u8) {
  if (/\.xlsx$/i.test(name)) return readXlsx(u8);
  if (/\.csv$/i.test(name)) return readCsv(decodeText(u8));
  throw new Error('UNSUPPORTED');
}

const HEAD = {
  name: /^(품명|품목|품목명|물품명|상품명|제품명|내역|항목)$/,
  spec: /^(규격|사양|모델|모델명|규격\/사양)$/,
  unit: /^(단위)$/,
  qty: /^(수량|개수)$/,
  price: /^(단가|개당가격|가격)$/,
  amount: /^(금액|공급가액|합계금액)$/
};
const SKIP = /합계|소계|총계|부가세|VAT/i;
const normHead = v => String(v == null ? '' : v).replace(/\s|\(원\)|\(₩\)/g, '');

/* 머리줄(위 15줄 안, 품명 열 + 단가나 금액 열)을 찾아 품목만 뽑음 */
export function findItems(rows) {
  const list = Array.isArray(rows) ? rows : [];
  for (let h = 0; h < Math.min(15, list.length); h++) {
    const cols = {};
    (list[h] || []).forEach((c, i) => { const n = normHead(c); for (const k in HEAD) if (cols[k] == null && HEAD[k].test(n)) cols[k] = i; });
    if (cols.name == null || (cols.price == null && cols.amount == null)) continue;
    const out = [];
    for (const r of list.slice(h + 1)) {
      const cell = k => (cols[k] == null || !r ? '' : String(r[cols[k]] == null ? '' : r[cols[k]]).trim());
      const name = cell('name');
      if (!name || SKIP.test(name)) continue;
      const q = toNumber(cell('qty'));
      const qty = q > 0 ? q : 1;
      const price = cell('price') !== '' ? toNumber(cell('price')) : Math.round(toNumber(cell('amount')) / qty);
      out.push({ name, spec: cell('spec'), ...(cols.unit != null ? { unit: cell('unit') } : {}), qty, price });
    }
    return out;
  }
  return [];
}
