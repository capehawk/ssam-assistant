/* 한글 파일(.hwpx) 만들기: 무압축 zip + 한글 문서 XML(OWPML).
   doc = { title, blocks: [{ type: 'h', text } | { type: 'p', text } | { type: 'c', text, bold? }(가운데 줄) | { type: 'table', rows: string[][], head?: boolean } | { type: 'break' }
     | { type: 'photos', items: [{ bytes: Uint8Array(JPEG), w, h (픽셀), caption }] }] } — 사진은 2열 표, 칸마다 사진과 설명(스펙 2026-11-03 5.4)
   글자 모양 0 보통 10pt · 1 굵게 10pt · 2 제목 굵게 16pt · 3 소제목 굵게 12pt
   문단 모양 0 양쪽 · 1 가운데 · 2 왼쪽(위 여백) / 테두리 1 없음 · 2 없음(글자용) · 3 실선 · 4 실선+회색(머리줄) */
import { zipStore } from './zip.js';

const NS = {
  ha: 'http://www.hancom.co.kr/hwpml/2011/app', hp: 'http://www.hancom.co.kr/hwpml/2011/paragraph',
  hp10: 'http://www.hancom.co.kr/hwpml/2016/paragraph', hs: 'http://www.hancom.co.kr/hwpml/2011/section',
  hc: 'http://www.hancom.co.kr/hwpml/2011/core', hh: 'http://www.hancom.co.kr/hwpml/2011/head',
  hhs: 'http://www.hancom.co.kr/hwpml/2011/history', hm: 'http://www.hancom.co.kr/hwpml/2011/master-page',
  hpf: 'http://www.hancom.co.kr/schema/2011/hpf', dc: 'http://purl.org/dc/elements/1.1/',
  opf: 'http://www.idpf.org/2007/opf/', ooxmlchart: 'http://www.hancom.co.kr/hwpml/2016/ooxmlchart',
  hwpunitchar: 'http://www.hancom.co.kr/hwpml/2016/HwpUnitChar', epub: 'http://www.idpf.org/2007/ops',
  config: 'urn:oasis:names:tc:opendocument:xmlns:config:1.0'
};
const XMLNS = Object.entries(NS).map(([k, v]) => `xmlns:${k}="${v}"`).join(' ');
const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>';

// A4, 여백 20mm (1mm = 283.465 HWPUNIT)
const PAGE_W = 59528, PAGE_H = 84186, MARGIN = 5669, TEXT_W = PAGE_W - MARGIN * 2;

const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
  // XML에 쓸 수 없는 제어 문자는 뺌
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

const LANGS = ['HANGUL', 'LATIN', 'HANJA', 'JAPANESE', 'OTHER', 'SYMBOL', 'USER'];
const per = v => LANGS.map(l => `${l.toLowerCase()}="${v}"`).join(' ');

function fontfaces() {
  const font = (id, face) => `<hh:font id="${id}" face="${face}" type="TTF" isEmbedded="0"><hh:typeInfo familyType="FCAT_GOTHIC" weight="6" proportion="4" contrast="0" strokeVariation="1" armStyle="1" letterform="1" midline="1" xHeight="1"/></hh:font>`;
  return `<hh:fontfaces itemCnt="${LANGS.length}">${LANGS.map(l => `<hh:fontface lang="${l}" fontCnt="2">${font(0, '함초롬바탕')}${font(1, '함초롬돋움')}</hh:fontface>`).join('')}</hh:fontfaces>`;
}

function borderFill(id, line, fill) {
  const b = side => `<hh:${side} type="${line ? 'SOLID' : 'NONE'}" width="0.12 mm" color="#000000"/>`;
  return `<hh:borderFill id="${id}" threeD="0" shadow="0" centerLine="NONE" breakCellSeparateLine="0">`
    + '<hh:slash type="NONE" Crooked="0" isCounter="0"/><hh:backSlash type="NONE" Crooked="0" isCounter="0"/>'
    + b('leftBorder') + b('rightBorder') + b('topBorder') + b('bottomBorder')
    + '<hh:diagonal type="SOLID" width="0.1 mm" color="#000000"/>'
    + (fill ? `<hc:fillBrush><hc:winBrush faceColor="${fill}" hatchColor="#999999" alpha="0"/></hc:fillBrush>` : '')
    + '</hh:borderFill>';
}

function charPr(id, pt, bold, font) {
  return `<hh:charPr id="${id}" height="${pt * 100}" textColor="#000000" shadeColor="none" useFontSpace="0" useKerning="0" symMark="NONE" borderFillIDRef="2">`
    + `<hh:fontRef ${per(font)}/><hh:ratio ${per(100)}/><hh:spacing ${per(0)}/><hh:relSz ${per(100)}/><hh:offset ${per(0)}/>`
    + (bold ? '<hh:bold/>' : '')
    + '<hh:underline type="NONE" shape="SOLID" color="#000000"/><hh:strikeout shape="NONE" color="#000000"/><hh:outline type="NONE"/><hh:shadow type="NONE" color="#B2B2B2" offsetX="10" offsetY="10"/></hh:charPr>';
}

/* 한글이 만든 파일처럼 여백·줄 간격을 hp:switch(case·default) 안에 둠 */
function paraPr(id, align, prev) {
  const ml = `<hh:margin><hc:intent value="0" unit="HWPUNIT"/><hc:left value="0" unit="HWPUNIT"/><hc:right value="0" unit="HWPUNIT"/><hc:prev value="${prev}" unit="HWPUNIT"/><hc:next value="0" unit="HWPUNIT"/></hh:margin>`
    + '<hh:lineSpacing type="PERCENT" value="160" unit="HWPUNIT"/>';
  return `<hh:paraPr id="${id}" tabPrIDRef="0" condense="0" fontLineHeight="0" snapToGrid="1" suppressLineNumbers="0" checked="0" textDir="LTR">`
    + `<hh:align horizontal="${align}" vertical="BASELINE"/><hh:heading type="NONE" idRef="0" level="0"/>`
    + '<hh:breakSetting breakLatinWord="KEEP_WORD" breakNonLatinWord="BREAK_WORD" widowOrphan="0" keepWithNext="0" keepLines="0" pageBreakBefore="0" lineWrap="BREAK"/>'
    + '<hh:autoSpacing eAsianEng="0" eAsianNum="0"/>'
    + `<hp:switch><hp:case hp:required-namespace="${NS.hwpunitchar}">${ml}</hp:case><hp:default>${ml}</hp:default></hp:switch>`
    + '<hh:border borderFillIDRef="2" offsetLeft="0" offsetRight="0" offsetTop="0" offsetBottom="0" connect="0" ignoreMargin="0"/></hh:paraPr>';
}

function numberings() {
  const fmt = ['DIGIT', 'HANGUL_SYLLABLE', 'DIGIT', 'HANGUL_SYLLABLE', 'DIGIT', 'HANGUL_SYLLABLE', 'CIRCLED_DIGIT'];
  const txt = ['^1.', '^2.', '^3)', '^4)', '(^5)', '(^6)', '^7'];
  return '<hh:numberings itemCnt="1"><hh:numbering id="1" start="0">'
    + fmt.map((f, i) => `<hh:paraHead start="1" level="${i + 1}" align="LEFT" useInstWidth="1" autoIndent="1" widthAdjust="0" textOffsetType="PERCENT" textOffset="50" numFormat="${f}" charPrIDRef="4294967295" checkable="0">${txt[i]}</hh:paraHead>`).join('')
    + '</hh:numbering></hh:numberings>';
}

function headerXml() {
  return `${HEAD}<hh:head ${XMLNS} version="1.4" secCnt="1">`
    + '<hh:beginNum page="1" footnote="1" endnote="1" pic="1" tbl="1" equation="1"/>'
    + '<hh:refList>'
    + fontfaces()
    + `<hh:borderFills itemCnt="4">${borderFill(1, false)}${borderFill(2, false, 'none')}${borderFill(3, true)}${borderFill(4, true, '#E8E8E8')}</hh:borderFills>`
    + `<hh:charProperties itemCnt="4">${charPr(0, 10, false, 0)}${charPr(1, 10, true, 0)}${charPr(2, 16, true, 1)}${charPr(3, 12, true, 1)}</hh:charProperties>`
    + '<hh:tabProperties itemCnt="1"><hh:tabPr id="0" autoTabLeft="0" autoTabRight="0"/></hh:tabProperties>'
    + numberings()
    + `<hh:paraProperties itemCnt="3">${paraPr(0, 'JUSTIFY', 0)}${paraPr(1, 'CENTER', 0)}${paraPr(2, 'LEFT', 800)}</hh:paraProperties>`
    + '<hh:styles itemCnt="1"><hh:style id="0" type="PARA" name="바탕글" engName="Normal" paraPrIDRef="0" charPrIDRef="0" nextStyleIDRef="0" langID="1042" lockForm="0"/></hh:styles>'
    + '</hh:refList>'
    + '<hh:compatibleDocument targetProgram="HWP201X"><hh:layoutCompatibility/></hh:compatibleDocument>'
    + '<hh:docOption><hh:linkinfo path="" pageInherit="0" footnoteInherit="0"/></hh:docOption>'
    + '<hh:metaTag>{"name":""}</hh:metaTag>'
    + '<hh:trackchageConfig flags="56"/>' // 한컴 파일의 철자 그대로
    + '</hh:head>';
}

function secPr() {
  const pbf = t => `<hp:pageBorderFill type="${t}" borderFillIDRef="1" textBorder="PAPER" headerInside="0" footerInside="0" fillArea="PAPER"><hp:offset left="1417" right="1417" top="1417" bottom="1417"/></hp:pageBorderFill>`;
  return '<hp:secPr id="" textDirection="HORIZONTAL" spaceColumns="1134" tabStop="8000" tabStopVal="4000" tabStopUnit="HWPUNIT" outlineShapeIDRef="1" memoShapeIDRef="0" textVerticalWidthHead="0" masterPageCnt="0">'
    + '<hp:grid lineGrid="0" charGrid="0" wonggojiFormat="0"/>'
    + '<hp:startNum pageStartsOn="BOTH" page="0" pic="0" tbl="0" equation="0"/>'
    + '<hp:visibility hideFirstHeader="0" hideFirstFooter="0" hideFirstMasterPage="0" border="SHOW_ALL" fill="SHOW_ALL" hideFirstPageNum="0" hideFirstEmptyLine="0" showLineNumber="0"/>'
    + '<hp:lineNumberShape restartType="0" countBy="0" distance="0" startNumber="0"/>'
    + `<hp:pagePr landscape="WIDELY" width="${PAGE_W}" height="${PAGE_H}" gutterType="LEFT_ONLY"><hp:margin header="4252" footer="4252" gutter="0" left="${MARGIN}" right="${MARGIN}" top="${MARGIN}" bottom="4252"/></hp:pagePr>`
    + '<hp:footNotePr><hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/><hp:noteLine length="-1" type="SOLID" width="0.12 mm" color="#000000"/><hp:noteSpacing betweenNotes="283" belowLine="567" aboveLine="850"/><hp:numbering type="CONTINUOUS" newNum="1"/><hp:placement place="EACH_COLUMN" beneathText="0"/></hp:footNotePr>'
    + '<hp:endNotePr><hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/><hp:noteLine length="14692344" type="SOLID" width="0.12 mm" color="#000000"/><hp:noteSpacing betweenNotes="0" belowLine="567" aboveLine="850"/><hp:numbering type="CONTINUOUS" newNum="1"/><hp:placement place="END_OF_DOCUMENT" beneathText="0"/></hp:endNotePr>'
    + pbf('BOTH') + pbf('EVEN') + pbf('ODD')
    + '</hp:secPr>';
}

/* 사진 블록의 사진들 → [{ id: 'imageN', ...사진 }] (문서 차례대로, 바이트가 있는 것만) */
export function photoList(doc) {
  const out = [];
  for (const b of (doc && doc.blocks) || []) {
    if (b && b.type === 'photos') for (const it of b.items || []) if (it && it.bytes && it.bytes.length) out.push({ ...it, id: `image${out.length + 1}` });
  }
  return out;
}
/* 상자(maxW×maxH) 안에 가로세로 비율 그대로 */
export function fitBox(w, h, maxW, maxH) {
  const W = Math.max(1, +w || 4), H = Math.max(1, +h || 3), k = Math.min(maxW / W, maxH / H);
  return [Math.round(W * k), Math.round(H * k)];
}

/* 본문 XML을 만드는 도구 (문단·표 id를 차례로 매김) */
function sectionXml(doc, photos = photoList(doc)) {
  let pid = 0, tid = 0, ph = 0;
  const para = (pr, runs, pb) => `<hp:p id="${pid++}" paraPrIDRef="${pr}" styleIDRef="0" pageBreak="${pb ? 1 : 0}" columnBreak="0" merged="0">${runs}</hp:p>`;
  const run = (cpr, text) => `<hp:run charPrIDRef="${cpr}"><hp:t>${esc(text)}</hp:t></hp:run>`;
  // pb: 첫 줄을 새 쪽에서 시작
  const lines = (pr, cpr, text, pb) => String(text == null ? '' : text).split('\n').map((l, i) => para(pr, run(cpr, l), pb && !i)).join('');

  function table(rows, head, pb) {
    const cols = Math.max(1, ...rows.map(r => r.length));
    const w = Math.floor(TEXT_W / cols), rowH = 1000;
    const tr = (r, ri) => '<hp:tr>' + Array.from({ length: cols }, (_, ci) => {
      const isHead = head && ri === 0;
      return `<hp:tc name="" header="${isHead ? 1 : 0}" hasMargin="0" protect="0" editable="0" dirty="0" borderFillIDRef="${isHead ? 4 : 3}">`
        + '<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">'
        + lines(isHead ? 1 : 0, isHead ? 1 : 0, r[ci] == null ? '' : r[ci])
        + '</hp:subList>'
        + `<hp:cellAddr colAddr="${ci}" rowAddr="${ri}"/><hp:cellSpan colSpan="1" rowSpan="1"/><hp:cellSz width="${w}" height="${rowH}"/><hp:cellMargin left="510" right="510" top="141" bottom="141"/></hp:tc>`;
    }).join('') + '</hp:tr>';
    const tbl = `<hp:tbl id="${1000 + tid++}" zOrder="0" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" pageBreak="CELL" repeatHeader="${head ? 1 : 0}" rowCnt="${rows.length}" colCnt="${cols}" cellSpacing="0" borderFillIDRef="3" noAdjust="0">`
      + `<hp:sz width="${w * cols}" widthRelTo="ABSOLUTE" height="${rowH * rows.length}" heightRelTo="ABSOLUTE" protect="0"/>`
      + '<hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>'
      + '<hp:outMargin left="0" right="0" top="0" bottom="0"/><hp:inMargin left="510" right="510" top="141" bottom="141"/>'
      + rows.map(tr).join('') + '</hp:tbl>';
    return para(0, `<hp:run charPrIDRef="0">${tbl}<hp:t/></hp:run>`, pb);
  }

  // 사진 하나: 글자처럼 취급하는 그림(hp:pic). 원래 크기(imgDim)는 픽셀 × 75(96dpi)
  function pic(p, W, H) {
    const id = 2000 + tid++, ow = Math.max(1, Math.round((+p.w || 4) * 75)), oh = Math.max(1, Math.round((+p.h || 3) * 75));
    const m = 'e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"';
    return `<hp:pic id="${id}" zOrder="${id}" numberingType="PICTURE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" href="" groupLevel="0" instid="${id}" reverse="0">`
      + `<hp:offset x="0" y="0"/><hp:orgSz width="${W}" height="${H}"/><hp:curSz width="${W}" height="${H}"/><hp:flip horizontal="0" vertical="0"/>`
      + `<hp:rotationInfo angle="0" centerX="${Math.round(W / 2)}" centerY="${Math.round(H / 2)}" rotateimage="1"/>`
      + `<hp:renderingInfo><hc:transMatrix ${m}/><hc:scaMatrix ${m}/><hc:rotMatrix ${m}/></hp:renderingInfo>`
      + `<hp:imgRect><hc:pt0 x="0" y="0"/><hc:pt1 x="${W}" y="0"/><hc:pt2 x="${W}" y="${H}"/><hc:pt3 x="0" y="${H}"/></hp:imgRect>`
      + `<hp:imgClip left="0" right="${ow}" top="0" bottom="${oh}"/><hp:inMargin left="0" right="0" top="0" bottom="0"/><hp:imgDim dimwidth="${ow}" dimheight="${oh}"/>`
      + `<hc:img binaryItemIDRef="${p.id}" bright="0" contrast="0" effect="REAL_PIC" alpha="0"/><hp:effects/>`
      + `<hp:sz width="${W}" widthRelTo="ABSOLUTE" height="${H}" heightRelTo="ABSOLUTE" protect="0"/>`
      + '<hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>'
      + '<hp:outMargin left="0" right="0" top="0" bottom="0"/></hp:pic>';
  }
  // 사진 블록: 2열 표, 칸마다 사진(가운데) + 설명. 칸 너비 안에서 높이는 6cm쯤까지
  function photosTable(items, pb) {
    const list = items.map(() => photos[ph++]).filter(Boolean);
    if (!list.length) return '';
    const w = Math.floor(TEXT_W / 2), maxW = w - 1020 - 400, maxH = 17000;
    const rows = [];
    for (let i = 0; i < list.length; i += 2) rows.push(list.slice(i, i + 2));
    const sized = rows.map(r => r.map(p => ({ p, sz: fitBox(p.w, p.h, maxW, maxH) })));
    const rowH = sized.map(r => Math.max(...r.map(x => x.sz[1])) + 2600);
    const cell = (x, ri, ci) => `<hp:tc name="" header="0" hasMargin="0" protect="0" editable="0" dirty="0" borderFillIDRef="3">`
      + '<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">'
      + (x ? para(1, `<hp:run charPrIDRef="0">${pic(x.p, x.sz[0], x.sz[1])}<hp:t/></hp:run>`) + lines(1, 0, x.p.caption || '') : para(1, run(0, '')))
      + '</hp:subList>'
      + `<hp:cellAddr colAddr="${ci}" rowAddr="${ri}"/><hp:cellSpan colSpan="1" rowSpan="1"/><hp:cellSz width="${w}" height="${rowH[ri]}"/><hp:cellMargin left="510" right="510" top="141" bottom="141"/></hp:tc>`;
    const tbl = `<hp:tbl id="${1000 + tid++}" zOrder="0" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" pageBreak="CELL" repeatHeader="0" rowCnt="${rows.length}" colCnt="2" cellSpacing="0" borderFillIDRef="3" noAdjust="0">`
      + `<hp:sz width="${w * 2}" widthRelTo="ABSOLUTE" height="${rowH.reduce((a, b) => a + b, 0)}" heightRelTo="ABSOLUTE" protect="0"/>`
      + '<hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>'
      + '<hp:outMargin left="0" right="0" top="0" bottom="0"/><hp:inMargin left="510" right="510" top="141" bottom="141"/>'
      + sized.map((r, ri) => '<hp:tr>' + [0, 1].map(ci => cell(r[ci], ri, ci)).join('') + '</hp:tr>').join('') + '</hp:tbl>';
    return para(0, `<hp:run charPrIDRef="0">${tbl}<hp:t/></hp:run>`, pb);
  }

  // 첫 문단: 구역 설정 + 제목
  let body = para(1, `<hp:run charPrIDRef="2">${secPr()}<hp:ctrl><hp:colPr id="" type="NEWSPAPER" layout="LEFT" colCount="1" sameSz="1" sameGap="0"/></hp:ctrl></hp:run>${run(2, doc.title || '')}`);
  // { type: 'break' }: 다음 블록을 새 쪽에서 시작
  let brk = false;
  for (const b of doc.blocks || []) {
    if (!b) continue;
    if (b.type === 'break') { brk = true; continue; }
    const pb = brk; brk = false;
    if (b.type === 'h') body += lines(2, 3, b.text, pb);
    else if (b.type === 'table') { const rows = (b.rows || []).filter(Array.isArray); if (rows.length) body += table(rows, !!b.head, pb); else brk = pb; }
    else if (b.type === 'c') body += lines(1, b.bold ? 1 : 0, b.text, pb); // 가운데 줄(굵게 고를 수 있음)
    else if (b.type === 'photos') { const x = photosTable((b.items || []).filter(it => it && it.bytes && it.bytes.length), pb); if (x) body += x; else brk = pb; }
    else body += lines(0, 0, b.text, pb);
  }
  return `${HEAD}<hs:sec ${XMLNS}>${body}</hs:sec>`;
}

const PKG = 'http://www.hancom.co.kr/hwpml/2016/meta/pkg#';
const part = (file, type) => `<rdf:Description rdf:about=""><ns0:hasPart xmlns:ns0="${PKG}" rdf:resource="${file}"/></rdf:Description><rdf:Description rdf:about="${file}"><rdf:type rdf:resource="${PKG}${type}"/></rdf:Description>`;
const CONTAINER_RDF = `${HEAD}<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">${part('Contents/header.xml', 'HeaderFile')}${part('Contents/section0.xml', 'SectionFile')}<rdf:Description rdf:about=""><rdf:type rdf:resource="${PKG}Document"/></rdf:Description></rdf:RDF>`;

function previewText(doc) {
  const out = [doc.title || ''];
  for (const b of doc.blocks || []) {
    if (!b) continue;
    if (b.type === 'table') (b.rows || []).forEach(r => out.push((r || []).join('\t')));
    else if (b.type === 'photos') (b.items || []).forEach(it => out.push(String((it && it.caption) || '')));
    else out.push(String(b.text == null ? '' : b.text));
  }
  return out.join('\r\n');
}

export function makeHwpx(doc) {
  const d = doc || {}, photos = photoList(d);
  const items = photos.map(p => `<opf:item id="${p.id}" href="BinData/${p.id}.jpg" media-type="image/jpg" isEmbeded="1"/>`).join('');
  return zipStore([
    { name: 'mimetype', data: 'application/hwp+zip' },
    { name: 'version.xml', data: `${HEAD}<hv:HCFVersion xmlns:hv="http://www.hancom.co.kr/hwpml/2011/version" tagetApplication="WORDPROCESSOR" major="5" minor="1" micro="1" buildNumber="0" os="1" xmlVersion="1.4" application="Hancom Office Hangul" appVersion="12, 0, 0, 0"/>` },
    { name: 'META-INF/container.xml', data: `${HEAD}<ocf:container xmlns:ocf="urn:oasis:names:tc:opendocument:xmlns:container" xmlns:hpf="${NS.hpf}"><ocf:rootfiles><ocf:rootfile full-path="Contents/content.hpf" media-type="application/hwpml-package+xml"/><ocf:rootfile full-path="Preview/PrvText.txt" media-type="text/plain"/><ocf:rootfile full-path="META-INF/container.rdf" media-type="application/rdf+xml"/></ocf:rootfiles></ocf:container>` },
    { name: 'META-INF/container.rdf', data: CONTAINER_RDF },
    { name: 'META-INF/manifest.xml', data: `${HEAD}<odf:manifest xmlns:odf="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"/>` },
    { name: 'Contents/content.hpf', data: `${HEAD}<opf:package ${XMLNS} version="" unique-identifier="" id=""><opf:metadata><opf:title>${esc(d.title || '')}</opf:title><opf:language>ko</opf:language><opf:meta name="creator" content="text">쌤비서</opf:meta></opf:metadata><opf:manifest><opf:item id="header" href="Contents/header.xml" media-type="application/xml"/><opf:item id="section0" href="Contents/section0.xml" media-type="application/xml"/><opf:item id="settings" href="settings.xml" media-type="application/xml"/>${items}</opf:manifest><opf:spine><opf:itemref idref="header" linear="yes"/><opf:itemref idref="section0" linear="yes"/></opf:spine></opf:package>` },
    { name: 'Contents/header.xml', data: headerXml() },
    { name: 'Contents/section0.xml', data: sectionXml(d, photos) },
    ...photos.map(p => ({ name: `BinData/${p.id}.jpg`, data: p.bytes })),
    { name: 'settings.xml', data: `${HEAD}<ha:HWPApplicationSetting xmlns:ha="${NS.ha}" xmlns:config="${NS.config}"><ha:CaretPosition listIDRef="0" paraIDRef="0" pos="0"/></ha:HWPApplicationSetting>` },
    { name: 'Preview/PrvText.txt', data: previewText(d) }
  ]);
}
