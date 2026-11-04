// 지어낸 학교 가정통신문 양식(.hwpx) 만들기 — 「새싹초등학교」, 실제 학교 파일이 아님.
// 한글이 만든 파일처럼: 첫 문단에 구역 설정 + 머리 표(로고 그림·「가 정 통 신 문」·교장·교감·담당·주소), 문단마다 줄 배치(linesegarray),
// 본문 단계마다 다른 문단 모양(1. 3번 · 가. 4번 · 1) 5번), 날짜·학교장 줄, 자르는 선 아래 회신서 표.
// opts.marker: 제목·본문·날짜 자리에 {제목}·{본문}·{날짜}를 적은 양식, opts.box: 머리 아래 모두를 큰 표 한 칸 안에 둔 양식
import { makeHwpx } from '../web/core/hwpx.js';
import { unzip, zipStore } from '../web/core/zip.js';

const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), c => c.charCodeAt(0));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const LSA = '<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="48188" flags="393216"/></hp:linesegarray>';
let pid = 100;
const P = (pr, cpr, text) => `<hp:p id="${pid++}" paraPrIDRef="${pr}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="${cpr}"><hp:t>${esc(text)}</hp:t></hp:run>${LSA}</hp:p>`;
const cell = (c, r, inner, w = 16000) => `<hp:tc name="" header="0" hasMargin="0" protect="0" editable="0" dirty="0" borderFillIDRef="3"><hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">${inner}</hp:subList><hp:cellAddr colAddr="${c}" rowAddr="${r}"/><hp:cellSpan colSpan="1" rowSpan="1"/><hp:cellSz width="${w}" height="1500"/><hp:cellMargin left="510" right="510" top="141" bottom="141"/></hp:tc>`;
const table = (rows, w = 16000) => `<hp:tbl id="${pid++}" zOrder="0" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" pageBreak="CELL" repeatHeader="0" rowCnt="${rows.length}" colCnt="${rows[0].length}" cellSpacing="0" borderFillIDRef="3" noAdjust="0">`
  + `<hp:sz width="${w * rows[0].length}" widthRelTo="ABSOLUTE" height="${1500 * rows.length}" heightRelTo="ABSOLUTE" protect="0"/>`
  + '<hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>'
  + '<hp:outMargin left="0" right="0" top="0" bottom="0"/><hp:inMargin left="510" right="510" top="141" bottom="141"/>'
  + rows.map((r, ri) => `<hp:tr>${r.map((inner, ci) => cell(ci, ri, inner, w)).join('')}</hp:tr>`).join('') + '</hp:tbl>';
const pic = `<hp:pic id="${pid++}" zOrder="1" numberingType="PICTURE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" href="" groupLevel="0" instid="1" reverse="0"><hp:offset x="0" y="0"/><hp:orgSz width="3000" height="3000"/><hp:curSz width="3000" height="3000"/><hp:flip horizontal="0" vertical="0"/><hp:rotationInfo angle="0" centerX="1500" centerY="1500" rotateimage="1"/><hp:renderingInfo><hc:transMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/><hc:scaMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/><hc:rotMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/></hp:renderingInfo><hp:imgRect><hc:pt0 x="0" y="0"/><hc:pt1 x="3000" y="0"/><hc:pt2 x="3000" y="3000"/><hc:pt3 x="0" y="3000"/></hp:imgRect><hp:imgClip left="0" right="75" top="0" bottom="75"/><hp:inMargin left="0" right="0" top="0" bottom="0"/><hp:imgDim dimwidth="75" dimheight="75"/><hc:img binaryItemIDRef="image1" bright="0" contrast="0" effect="REAL_PIC" alpha="0"/><hp:effects/><hp:sz width="3000" widthRelTo="ABSOLUTE" height="3000" heightRelTo="ABSOLUTE" protect="0"/><hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/><hp:outMargin left="0" right="0" top="0" bottom="0"/></hp:pic>`;

/* 단계마다 왼쪽 여백이 다른 문단 모양 3·4·5번을 머리에 더함 */
function moreParaPr(header) {
  const m = /<hh:paraPr id="0"[\s\S]*?<\/hh:paraPr>/.exec(header);
  const add = [3, 4, 5].map((id, k) => m[0].replace('id="0"', `id="${id}"`).replace(/<hc:left value="0"/g, `<hc:left value="${(k + 1) * 1000}"`)).join('');
  return header.replace('<hh:paraProperties itemCnt="3">', '<hh:paraProperties itemCnt="6">').replace('</hh:paraProperties>', add + '</hh:paraProperties>');
}

/* 더 다양한 양식(검토 시험용): sign 학교장 줄 글, dateSign 날짜·학교장 한 문단(두 조각·탭), noGreet 인사 없음, title 제목 글,
   anchors 인사 문단에 꼬리말 조절자·떠 있는 그림, twoSections 회신서를 둘째 구역(구역 설정 문단부터), contacts 머리 표에 주소·전화·누리집만, markerReply {표시} 양식에 옛 회신서 */
export async function letterFormHwpx({ marker = false, box = false, sign = '새 싹 초 등 학 교 장', dateSign = false, noGreet = false, title = '2026학년도 학부모 상담 주간 안내', anchors = false, twoSections = false, contacts = false, markerReply = false } = {}) {
  pid = 100;
  const base = await unzip(makeHwpx({ title: 'x', blocks: [] }));
  const dec = new TextDecoder();
  const sec0 = dec.decode(base.get('Contents/section0.xml'));
  const secPr = /<hp:secPr[\s\S]*?<\/hp:secPr><hp:ctrl>[\s\S]*?<\/hp:ctrl>/.exec(sec0)[0];
  const head = contacts ? table([[P(1, 0, '주소: ○○시 새싹로 1')], [P(1, 0, '전화 000-000-0000')], [P(1, 0, '누리집 saessak.example')]]) : table([
    [P(1, 0, '') .replace('<hp:t></hp:t>', '<hp:t/>').replace('<hp:run charPrIDRef="0">', `<hp:run charPrIDRef="0">${pic}`), P(1, 2, '가 정 통 신 문'), P(0, 0, '교장 : 김새싹') + P(0, 0, '교감 : 이나무') + P(0, 0, '담당 : 박햇살')],
    [P(1, 0, '꿈을 키우는 새싹 교육'), P(1, 0, ''), P(1, 0, '')],
    [P(1, 0, '우)00000 ○○시 새싹로 1 (☎ 000-000-0000) http://saessak.example'), P(1, 0, ''), P(1, 0, '')]]);
  const first = `<hp:p id="${pid++}" paraPrIDRef="1" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="0">${secPr}</hp:run><hp:run charPrIDRef="0">${head}<hp:t/></hp:run>${LSA}</hp:p>`;
  const FOOT = '<hp:run charPrIDRef="0"><hp:ctrl><hp:footer id="1" applyPageType="BOTH"><hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="BOTTOM" linkListIDRef="0" linkListNextIDRef="0" textWidth="48188" textHeight="4252" hasTextRef="0" hasNumRef="0">'
    + `<hp:p id="${pid++}" paraPrIDRef="1" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="0"><hp:t>새싹초등학교 꼬리말</hp:t></hp:run></hp:p></hp:subList></hp:footer></hp:ctrl></hp:run>`;
  const FLOAT = `<hp:run charPrIDRef="0">${pic.replace('treatAsChar="1"', 'treatAsChar="0"').replace('id="', 'id="9').replace('instid="1"', 'instid="2"')}</hp:run>`;
  const greet = anchors ? P(0, 0, '안녕하십니까?').replace('<hp:linesegarray>', FOOT + FLOAT + '<hp:linesegarray>') : P(0, 0, '안녕하십니까?');
  const dateP = dateSign
    ? `<hp:p id="${pid++}" paraPrIDRef="1" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="0"><hp:t>2026. 3. 3.(화)<hp:tab width="4000" leader="0" type="1"/></hp:t></hp:run><hp:run charPrIDRef="2"><hp:t>${esc(sign)}</hp:t></hp:run>${LSA}</hp:p>`
    : P(1, 0, '2026 . 3 . 3 .') + P(1, 2, sign);
  const body = marker
    ? [P(1, 2, '{제목}'), P(0, 0, ''), P(0, 0, '{본문}'), P(0, 0, ''), P(1, 0, '{날짜}'), P(1, 2, '새 싹 초 등 학 교 장')]
    : [P(1, 2, title), P(0, 0, ''),
      ...(noGreet ? [] : [greet, P(0, 0, '항상 본교 교육 활동에 관심을 가져 주시는 보호자님께 감사드립니다.')]),
      P(0, 0, '학생의 학교생활을 함께 살피기 위하여 학부모 상담 주간을 운영합니다.'),
      P(3, 1, '1. 기간: 2026. 3. 16.(월) ~ 3. 20.(금)'), P(4, 0, '  가. 대면 상담: 15:00~17:00'), P(4, 0, '  나. 전화 상담: 16:00~18:00'),
      P(5, 0, '    1) 상담 시간은 20분입니다.'), P(3, 1, '2. 신청 방법: 아래 신청서를 3. 11.(수)까지 제출'),
      P(0, 0, '붙임  상담 신청서 1부.'), P(0, 0, ''), dateP];
  const reply = marker && !markerReply ? [] : [P(0, 0, ''), P(1, 0, '✂ - - - - - - 자 르 는 선 - - - - - -'), P(1, 3, '학부모 상담 신청서'),
    `<hp:p id="${pid++}" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="0">${table([[P(1, 1, '학년 반 번호'), P(0, 0, '   학년    반    번')], [P(1, 1, '상담 희망'), P(0, 0, '□ 대면  □ 전화')]], 24000)}<hp:t/></hp:run>${LSA}</hp:p>`,
    P(1, 0, '2026 .  3 .    .   보호자 :          (서명)')];
  let rest = [...body, ...(twoSections ? [] : reply)].join('');
  if (box) rest = `<hp:p id="${pid++}" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="0">${table([[rest]], 48000)}<hp:t/></hp:run>${LSA}</hp:p>`;
  const NS = sec0.slice(0, sec0.indexOf('>', sec0.indexOf('<hs:sec')) + 1);
  const section = `${NS}${first}${rest}</hs:sec>`;
  // 둘째 구역: 첫 문단이 구역 설정 + 자르는 선
  const sec1 = twoSections ? `${NS}<hp:p id="${pid++}" paraPrIDRef="1" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="0">${secPr}</hp:run><hp:run charPrIDRef="0"><hp:t>✂ - - - - - - 자 르 는 선 - - - - - -</hp:t></hp:run>${LSA}</hp:p>${reply.slice(2).join('')}</hs:sec>` : null;
  const files = [];
  for (const [name, data] of base) {
    if (name === 'Contents/section0.xml') files.push({ name, data: section });
    else if (name === 'Contents/header.xml') files.push({ name, data: moreParaPr(dec.decode(data)).replace('secCnt="1"', `secCnt="${sec1 ? 2 : 1}"`) });
    else if (name === 'Contents/content.hpf') files.push({ name, data: dec.decode(data).replace('</opf:manifest>', `<opf:item id="image1" href="BinData/image1.png" media-type="image/png" isEmbeded="1"/>${sec1 ? '<opf:item id="section1" href="Contents/section1.xml" media-type="application/xml"/>' : ''}</opf:manifest>`).replace('<opf:itemref idref="section0" linear="yes"/>', `<opf:itemref idref="section0" linear="yes"/>${sec1 ? '<opf:itemref idref="section1" linear="yes"/>' : ''}`) });
    else files.push({ name, data });
    if (name === 'Contents/section0.xml') { if (sec1) files.push({ name: 'Contents/section1.xml', data: sec1 }); files.push({ name: 'BinData/image1.png', data: PNG }); }
  }
  return zipStore(files);
}
export const SAMPLE_PNG = PNG;
