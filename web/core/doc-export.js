/* 문서 내보내기: 같은 문서 꼴(core/hwpx.js의 { title, blocks })을 한글(hwpx)·워드(docx)·PDF(인쇄 창의 「PDF로 저장」)로.
   고른 형식은 기억해(학년도와 상관없이) 모든 메뉴의 [○○로 내려받기] 단추가 같이 씀. ▾로 형식을 바꾸면 바로 그 형식으로 내려받음.
   메뉴는 exportButton(속성)으로 단추를 그리고, 그 단추를 누르면 exportDoc(doc, 파일 이름)을 부르면 됨 */
import { makeHwpx } from './hwpx.js';
import { zipStore } from './zip.js';
import { get, set } from './store.js';
import { saveFile } from './ui.js';

export const FORMATS = [['hwpx', '한글'], ['docx', '워드'], ['pdf', 'PDF']];
const KEY = 'export';
const OK = FORMATS.map(f => f[0]);
export const getFormat = () => { const f = (get(KEY, null) || {}).format; return OK.includes(f) ? f : 'hwpx'; };
export function setFormat(f) {
  if (!OK.includes(f)) return getFormat();
  set(KEY, { format: f });
  if (typeof document !== 'undefined') syncButtons();
  return f;
}
const labelOf = f => (FORMATS.find(x => x[0] === f) || FORMATS[0])[1];
export const buttonLabel = (f = getFormat()) => (f === 'pdf' ? 'PDF로 저장' : `${labelOf(f)}로 내려받기`);

/* 이름 → 형식에 맞는 확장자, 파일 이름에 쓸 수 없는 글자는 _ */
export function fileName(name, f) {
  const base = String(name || '문서').replace(/\.(hwpx|docx|pdf)$/i, '').replace(/[\\/:*?"<>|]/g, '_');
  return `${base}.${f}`;
}

const xesc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const linesOf = t => String(t == null ? '' : t).split('\n');
const rowsOf = b => (b.rows || []).filter(Array.isArray);

/* ---------- 워드(docx) ---------- */
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const XH = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
// A4(11906×16838 twip), 여백 20mm(1134 twip) → 글 너비 9638
const TEXT_W = 11906 - 1134 * 2;

function docxBody(doc) {
  let out = '', brk = false;
  const para = (text, { style, bold, pb, keep } = {}) => `<w:p><w:pPr>${style ? `<w:pStyle w:val="${style}"/>` : ''}${keep ? '<w:keepNext/>' : ''}${pb ? '<w:pageBreakBefore/>' : ''}</w:pPr>`
    + `<w:r>${bold ? '<w:rPr><w:b/></w:rPr>' : ''}<w:t xml:space="preserve">${xesc(text)}</w:t></w:r></w:p>`;
  const lines = (text, opt) => linesOf(text).map((l, i) => para(l, { ...opt, pb: opt.pb && !i })).join('');
  out += para(doc.title || '', { style: 'Title' });
  for (const b of doc.blocks || []) {
    if (!b) continue;
    if (b.type === 'break') { brk = true; continue; }
    const pb = brk; brk = false;
    if (b.type === 'h') out += lines(b.text, { style: 'Heading1', pb, keep: true });
    else if (b.type === 'table') {
      const rows = rowsOf(b);
      if (!rows.length) { brk = pb; continue; }
      const cols = Math.max(1, ...rows.map(r => r.length)), cw = Math.floor(TEXT_W / cols);
      if (pb) out += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
      out += '<w:tbl><w:tblPr><w:tblStyle w:val="Grid"/><w:tblW w:w="5000" w:type="pct"/><w:tblLayout w:type="fixed"/></w:tblPr>'
        + `<w:tblGrid>${Array.from({ length: cols }, () => `<w:gridCol w:w="${cw}"/>`).join('')}</w:tblGrid>`
        + rows.map((r, ri) => {
          const head = !!b.head && ri === 0;
          return `<w:tr>${head ? '<w:trPr><w:tblHeader/></w:trPr>' : ''}` + Array.from({ length: cols }, (_, ci) =>
            `<w:tc><w:tcPr><w:tcW w:w="${cw}" w:type="dxa"/>${head ? '<w:shd w:val="clear" w:color="auto" w:fill="E6E6E6"/>' : ''}</w:tcPr>`
            + linesOf(r[ci]).map(l => para(l, { bold: head })).join('') + '</w:tc>').join('') + '</w:tr>';
        }).join('') + '</w:tbl><w:p/>';
    } else out += lines(b.text, { pb });
  }
  return out;
}

function stylesXml() {
  const font = '<w:rFonts w:ascii="맑은 고딕" w:hAnsi="맑은 고딕" w:eastAsia="맑은 고딕" w:cs="맑은 고딕"/>';
  const border = side => `<w:${side} w:val="single" w:sz="4" w:space="0" w:color="000000"/>`;
  return `${XH}<w:styles ${W}>`
    + `<w:docDefaults><w:rPrDefault><w:rPr>${font}<w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:val="ko-KR" w:eastAsia="ko-KR"/></w:rPr></w:rPrDefault>`
    + '<w:pPrDefault><w:pPr><w:spacing w:after="60" w:line="300" w:lineRule="auto"/><w:jc w:val="both"/></w:pPr></w:pPrDefault></w:docDefaults>'
    + '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>'
    + '<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="center"/><w:spacing w:after="240"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr></w:style>'
    + '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="200" w:after="80"/><w:jc w:val="left"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:style>'
    + `<w:style w:type="table" w:styleId="Grid"><w:name w:val="Table Grid"/><w:tblPr><w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(border).join('')}</w:tblBorders><w:tblCellMar><w:left w:w="85" w:type="dxa"/><w:right w:w="85" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>`
    + '</w:styles>';
}

export function makeDocx(doc) {
  const d = doc || {};
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  return zipStore([
    { name: '[Content_Types].xml', data: `${XH}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>` },
    { name: '_rels/.rels', data: `${XH}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>` },
    { name: 'docProps/core.xml', data: `${XH}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xesc(d.title || '')}</dc:title><dc:creator>쌤비서</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created></cp:coreProperties>` },
    { name: 'docProps/app.xml', data: `${XH}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>쌤비서</Application></Properties>` },
    { name: 'word/_rels/document.xml.rels', data: `${XH}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: 'word/styles.xml', data: stylesXml() },
    { name: 'word/document.xml', data: `${XH}<w:document ${W}><w:body>${docxBody(d)}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>` }
  ]);
}

/* ---------- PDF: 인쇄용 HTML을 A4로 띄워 인쇄 창의 「PDF로 저장」 ---------- */
const hesc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function docHtml(doc) {
  const d = doc || {};
  let out = `<h1>${hesc(d.title || '')}</h1>`;
  for (const b of d.blocks || []) {
    if (!b) continue;
    if (b.type === 'break') { out += '<div class="pd-break"></div>'; continue; }
    if (b.type === 'h') out += linesOf(b.text).map(l => `<h2>${hesc(l)}</h2>`).join('');
    else if (b.type === 'table') {
      const rows = rowsOf(b);
      if (!rows.length) continue;
      const cols = Math.max(1, ...rows.map(r => r.length));
      // 칸 글이 모두 짧은 열(교시·월·구분 등)은 줄을 바꾸지 않음 (좁은 열에서 「1교/시」처럼 잘리지 않게)
      const short = Array.from({ length: cols }, (_, ci) => rows.every(r => linesOf(r[ci]).every(l => l.length <= 6)));
      out += '<table>' + rows.map((r, ri) => '<tr>' + Array.from({ length: cols }, (_, ci) => {
        const tag = b.head && ri === 0 ? 'th' : 'td';
        return `<${tag}${short[ci] ? ' class="nw"' : ''}>${linesOf(r[ci]).map(hesc).join('<br>')}</${tag}>`;
      }).join('') + '</tr>').join('') + '</table>';
    } else out += linesOf(b.text).map(l => `<p>${hesc(l)}</p>`).join('');
  }
  return out;
}
const PRINT_CSS = `#printDoc{display:none}
@media print{
  @page{size:A4;margin:20mm}
  body.printing-doc>*:not(#printDoc){display:none!important}
  body.printing-doc #printDoc{display:block!important;position:static;color:#000;background:#fff;font:10pt/1.6 'Malgun Gothic','맑은 고딕','Noto Sans KR',sans-serif;word-break:keep-all}
  body.printing-doc #printDoc,body.printing-doc #printDoc *{visibility:visible!important}
  #printDoc h1{font-size:16pt;text-align:center;margin:0 0 12pt}
  #printDoc h2{font-size:12pt;margin:10pt 0 4pt;break-after:avoid}
  #printDoc p{margin:0 0 3pt;white-space:pre-wrap;text-align:justify}
  #printDoc table{width:100%;border-collapse:collapse;margin:4pt 0 8pt}
  #printDoc th,#printDoc td{border:.5pt solid #000;padding:3pt 5pt;vertical-align:top;text-align:left}
  #printDoc th{background:#e6e6e6;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  #printDoc tr{break-inside:avoid}
  #printDoc .nw{white-space:nowrap}
  #printDoc .pd-break{break-before:page}
}`;
export function printDoc(doc) {
  if (!document.getElementById('printDocCss')) document.head.append(Object.assign(document.createElement('style'), { id: 'printDocCss', textContent: PRINT_CSS }));
  let box = document.getElementById('printDoc');
  if (!box) { box = Object.assign(document.createElement('div'), { id: 'printDoc' }); document.body.append(box); }
  box.innerHTML = docHtml(doc);
  document.body.classList.add('printing-doc');
  const done = () => { document.body.classList.remove('printing-doc'); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  window.print();
}

/* 고른 형식(없으면 기억한 형식)으로 내보내고 알릴 말을 돌려줌 */
export async function exportDoc(doc, name, f = getFormat()) {
  if (f === 'pdf') { printDoc(doc); return '인쇄 창에서 「PDF로 저장」을 골라 저장해 주세요.'; }
  const where = f === 'docx'
    ? await saveFile(fileName(name, 'docx'), makeDocx(doc), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    : await saveFile(fileName(name, 'hwpx'), makeHwpx(doc), 'application/hwp+zip');
  return window.__TAURI__ ? `다운로드 폴더에 저장했어요: ${String(where).split(/[\\/]/).pop()}` : `${labelOf(f)} 파일을 내려받았어요`;
}

/* ---------- 나뉜 단추: [○○로 내려받기][▾] ---------- */
// attrs: 메뉴가 원래 단추에 달던 속성(예: 'data-y="hwpx"'). 메뉴의 클릭 처리는 그대로 두고 exportDoc만 부르면 됨
// cls: 'primary' 등 단추 모양, prefix: 앞에 붙일 말(예: '결과지 · ')
export function exportButton(attrs, { disabled = false, cls = '', prefix = '' } = {}) {
  const pre = prefix ? ` data-exp-prefix="${hesc(prefix)}"` : '';
  return `<span class="exp-split"><button class="btn${cls ? ' ' + cls : ''}" type="button" ${attrs} data-exp-main${pre}${disabled ? ' disabled' : ''}>${hesc(prefix)}${buttonLabel()}</button>`
    + `<button class="btn${cls ? ' ' + cls : ''} exp-more" type="button" data-exp-menu aria-haspopup="menu" aria-label="파일 형식 고르기" title="파일 형식 고르기"${disabled ? ' disabled' : ''}>▾</button></span>`;
}
function syncButtons() { document.querySelectorAll('[data-exp-main]').forEach(b => { b.textContent = (b.dataset.expPrefix || '') + buttonLabel(); }); }
function closeMenu() { const m = document.getElementById('expMenu'); if (m) m.remove(); }
function openMenu(more) {
  closeMenu();
  const main = more.parentElement && more.parentElement.querySelector('[data-exp-main]');
  if (!main) return;
  const cur = getFormat(), r = more.getBoundingClientRect();
  const m = Object.assign(document.createElement('div'), { id: 'expMenu', className: 'exp-menu' });
  m.setAttribute('role', 'menu');
  m.innerHTML = FORMATS.map(([f, l]) => `<button type="button" role="menuitemradio" aria-checked="${f === cur}" data-exp-fmt="${f}">${f === cur ? '✓ ' : ''}${l}${f === 'pdf' ? ' (인쇄 창에서 저장)' : f === 'hwpx' ? ' (.hwpx)' : ' (.docx)'}</button>`).join('');
  m.style.left = `${Math.max(8, Math.min(window.innerWidth - 228, r.right - 220))}px`;
  m.style.top = `${r.bottom + 4}px`;
  document.body.append(m);
  m.addEventListener('click', e => {
    const b = e.target.closest('[data-exp-fmt]');
    if (!b) return;
    setFormat(b.dataset.expFmt);
    closeMenu();
    main.click(); // 고른 형식으로 바로 내려받기
  });
  const first = m.querySelector('[aria-checked="true"]') || m.querySelector('button');
  first && first.focus();
}
if (typeof document !== 'undefined') {
  if (!document.getElementById('expCss')) document.head.append(Object.assign(document.createElement('style'), { id: 'expCss', textContent:
    '.exp-split{display:inline-flex}.exp-split>[data-exp-main]{border-top-right-radius:0;border-bottom-right-radius:0}'
    + '.exp-split>.exp-more{border-top-left-radius:0;border-bottom-left-radius:0;border-left:1px solid var(--line,#e4e6eb);padding-left:10px;padding-right:10px;min-width:0}'
    + '.exp-menu{position:fixed;z-index:80;width:220px;display:flex;flex-direction:column;padding:6px;border-radius:12px;background:var(--surface,#fff);border:1px solid var(--line,#e4e6eb);box-shadow:0 12px 32px rgba(0,0,0,.18)}'
    + '.exp-menu button{all:unset;cursor:pointer;padding:9px 12px;border-radius:8px;font:inherit;color:var(--ink,#16181d)}'
    + '.exp-menu button:hover,.exp-menu button:focus-visible{background:var(--accent-soft,#eef0ff)}'
    + '.exp-menu button[aria-checked="true"]{font-weight:700;color:var(--accent-ink,#3730a3)}' }));
  document.addEventListener('click', e => {
    const more = e.target.closest && e.target.closest('[data-exp-menu]');
    if (more) { e.preventDefault(); e.stopPropagation(); openMenu(more); return; }
    if (!e.target.closest || !e.target.closest('#expMenu')) closeMenu();
  }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
}
