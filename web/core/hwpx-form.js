/* 학교 양식(.hwpx) 그대로 채우기 (스펙 2026-11-03 가정통신문 3장): 양식의 줄을 읽어 제목·본문·날짜·학교장·회신서 자리를 찾고,
   머리(표어·「가정통신문」 상자·교장·담당·주소·로고)·학교장 줄은 그대로 두고 제목·본문·날짜만 바꿔 새 .hwpx를 만든다.
   한글이 만든 XML을 통째로 다시 쓰지 않고, 바꿀 문단만 잘라 바꿈(작은 XML 읽개로 요소 위치만 앎). 화면 없이 돌아감(시험) */
import { unzip, zipStore } from './zip.js';

/* ---------- 작은 XML 읽개 ---------- */
/* 요소마다 { name, s(<), oe(여는 태그 끝 다음), cs(닫는 태그 <), e(끝 다음), self, kids, up } */
function tagEnd(xml, i) {
  let q = '';
  for (let k = i + 1; k < xml.length; k++) {
    const c = xml[k];
    if (q) { if (c === q) q = ''; } else if (c === '"' || c === "'") q = c; else if (c === '>') return k;
  }
  throw new Error('XML');
}
export function scanXml(xml, { strict = false } = {}) {
  const root = { name: '#root', s: 0, oe: 0, cs: xml.length, e: xml.length, kids: [], self: false, up: null };
  const stack = [root];
  let i = 0;
  for (;;) {
    const lt = xml.indexOf('<', i);
    if (lt < 0) break;
    if (xml.startsWith('<!--', lt)) { const k = xml.indexOf('-->', lt); if (k < 0) throw new Error('XML'); i = k + 3; continue; }
    if (xml.startsWith('<![CDATA[', lt)) { const k = xml.indexOf(']]>', lt); if (k < 0) throw new Error('XML'); i = k + 3; continue; }
    if (xml.startsWith('<?', lt)) { const k = xml.indexOf('?>', lt); if (k < 0) throw new Error('XML'); i = k + 2; continue; }
    if (xml.startsWith('<!', lt)) { i = tagEnd(xml, lt) + 1; continue; }
    const gt = tagEnd(xml, lt);
    if (xml[lt + 1] === '/') {
      const name = xml.slice(lt + 2, gt).trim();
      const n = stack.pop();
      if (!n || n === root || (strict && n.name !== name)) throw new Error('XML');
      n.cs = lt; n.e = gt + 1;
      i = gt + 1; continue;
    }
    const self = xml[gt - 1] === '/';
    const name = /^<([^\s/>]+)/.exec(xml.slice(lt, gt + 1))[1];
    const up = stack[stack.length - 1];
    const n = { name, s: lt, oe: gt + 1, cs: self ? gt + 1 : -1, e: self ? gt + 1 : -1, self, kids: [], up };
    up.kids.push(n);
    if (!self) stack.push(n);
    i = gt + 1;
  }
  if (strict && stack.length !== 1) throw new Error('XML');
  return root;
}
/* 잘 짜인 XML인지(여닫는 태그 이름·짝) — 아니면 Error('XML') */
export function checkXml(xml) { scanXml(xml, { strict: true }); return true; }

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const unesc = s => s.replace(/&(amp|lt|gt|quot|apos);/g, (m, k) => ENT[k]).replace(/&#(x[0-9a-f]+|\d+);/gi, (m, n) => String.fromCodePoint(n[0] === 'x' ? parseInt(n.slice(1), 16) : +n));
export const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const local = n => n.name.replace(/^.*:/, '');
const kidsNamed = (n, nm) => n.kids.filter(k => local(k) === nm);
function* walk(n) { for (const k of n.kids) { yield k; yield* walk(k); } }
const has = (n, names) => { for (const k of walk(n)) if (names.includes(local(k))) return true; return false; };
/* hp:t 글: 탭·줄바꿈·빈칸 요소는 글자로, 그 밖의 요소는 뺌 */
const tText = (xml, t) => (t.self ? '' : unesc(xml.slice(t.oe, t.cs)
  .replace(/<hp:tab\b[^>]*\/>/g, '\t').replace(/<hp:lineBreak\b[^>]*\/>/g, '\n').replace(/<hp:(fwSpace|nbSpace)\b[^>]*\/>/g, ' ').replace(/<[^>]+>/g, '')));
function paraText(xml, p) {
  let s = '';
  for (const k of walk(p)) if (local(k) === 't' && !inNested(k, p)) s += tText(xml, k);
  return s;
}
/* p 안의 다른 문단(표 칸) 속인지 */
function inNested(k, p) { for (let u = k.up; u && u !== p; u = u.up) if (local(u) === 'p') return true; return false; }

/* ---------- 양식 읽기 ---------- */
/* 줄 = 표를 품지 않은 문단. 표를 품은 문단은 그 표 칸 안 문단들을 그 자리에 줄로 */
function linesOf(xml, container, sec, out, inBox) {
  for (const p of kidsNamed(container, 'p')) {
    const tables = [...walk(p)].filter(k => local(k) === 'tbl' && !inNested(k, p));
    if (tables.length) {
      for (const tb of tables) for (const tr of kidsNamed(tb, 'tr')) for (const tc of kidsNamed(tr, 'tc')) for (const sl of kidsNamed(tc, 'subList')) linesOf(xml, sl, sec, out, true);
      continue;
    }
    out.push({ sec, node: p, box: container, inBox, text: paraText(xml, p), obj: has(p, ['pic', 'rect', 'ellipse', 'line', 'container', 'ole', 'equation']) });
  }
}

/* u8 → { entries: [{ name, data }](차례 그대로), secs: [{ name, xml, root }], lines: [{ sec, text, inBox, obj, ... }] } */
export async function readForm(u8) {
  const files = await unzip(u8);
  const entries = [...files].map(([name, data]) => ({ name, data }));
  const names = entries.map(e => e.name).filter(n => /^Contents\/section\d+\.xml$/i.test(n)).sort((a, b) => +a.match(/(\d+)\.xml$/i)[1] - +b.match(/(\d+)\.xml$/i)[1]);
  if (!names.length) throw new Error('HWPX_EMPTY');
  const dec = new TextDecoder();
  const secs = [], lines = [];
  names.forEach((name, si) => {
    const xml = dec.decode(files.get(name)), root = scanXml(xml);
    const top = root.kids.find(k => local(k) === 'sec');
    if (!top) return;
    secs.push({ name, xml, root, top });
    linesOf(xml, top, si, lines, false);
  });
  return { entries, secs, lines };
}

/* ---------- 자리 찾기 ---------- */
const squash = s => String(s || '').replace(/\s+/g, '');
const DATE = /(\d{4})(\s*)(\.|년)(\s*)(\d{1,2})(\s*)(\.|월)(\s*)(\d{1,2})?(\s*)(\.|일)?/;
const isSign = t => { const q = squash(t); return q.length <= 40 && /(학교장|학교)$/.test(q) && /(초|중|고|학)/.test(q); };
const isDateLine = t => { const m = DATE.exec(t); return !!m && squash(t.replace(m[0], '')).length <= 20; };
const isGreet = t => /안녕하(십니까|세요|신지요)|(학부모|보호자)님/.test(t);
const MARK = { title: '{제목}', body: '{본문}', date: '{날짜}', reply: '{회신서}' };

/* lines → { title, bodyStart, bodyEnd, date, sign, reply } (줄 번호, 없으면 -1) */
export function findRoles(lines) {
  const at = mk => lines.findIndex(l => l.text.includes(mk));
  const r = { title: -1, bodyStart: -1, bodyEnd: -1, date: -1, sign: -1, reply: -1 };
  if ([MARK.title, MARK.body, MARK.date].some(m => at(m) >= 0)) {
    r.title = at(MARK.title); r.bodyStart = r.bodyEnd = at(MARK.body); r.date = at(MARK.date); r.reply = at(MARK.reply);
    r.sign = lines.findIndex((l, i) => i > Math.max(r.date, r.bodyEnd) && isSign(l.text));
    return r;
  }
  // 학교장 줄: 뒤에서부터, 날짜가 같은 줄이거나 바로 위(빈 줄 건너)
  const filled = i => String(lines[i] && lines[i].text || '').trim();
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!isSign(lines[i].text) && !(isDateLine(lines[i].text) && isSign(lines[i].text.replace(DATE, '')))) continue;
    let d = isDateLine(lines[i].text) ? i : -1;
    for (let k = i - 1; d < 0 && k >= 0 && i - k <= 3; k--) { if (!filled(k)) continue; if (isDateLine(lines[k].text)) d = k; break; }
    if (d < 0 && !/학교장$/.test(squash(lines[i].text))) continue;
    r.sign = i; r.date = d; break;
  }
  const end = r.date >= 0 ? r.date : r.sign >= 0 ? r.sign : lines.length;
  const greet = lines.findIndex((l, i) => i < end && isGreet(l.text));
  if (greet >= 0) {
    for (let k = greet - 1; k >= 0; k--) if (filled(k)) { r.title = k; break; }
    r.bodyStart = greet;
  } else {
    // 인사가 없으면: 「가정통신문」 머리 다음의 첫 줄이 제목, 그다음부터 본문
    const head = lines.findIndex(l => /가정통신문|가\s*정\s*통\s*신\s*문/.test(l.text));
    for (let k = head + 1; k < end; k++) if (filled(k) && !/교장|교감|담당|☎|우\)|http/.test(lines[k].text)) { r.title = k; break; }
    for (let k = r.title + 1; r.title >= 0 && k < end; k++) if (filled(k)) { r.bodyStart = k; break; }
  }
  if (r.bodyStart >= 0) {
    for (let k = end - 1; k >= r.bodyStart; k--) if (filled(k) && lines[k].box === lines[r.bodyStart].box) { r.bodyEnd = k; break; }
    if (r.bodyEnd < 0) r.bodyEnd = r.bodyStart;
  }
  if (r.sign >= 0) for (let k = r.sign + 1; k < lines.length; k++) if (filled(k) || lines[k].obj) { r.reply = k; break; }
  return r;
}

export { DATE, isSign, isDateLine };

/* ---------- 날짜 ---------- */
/* 양식 줄의 날짜를 발행일(iso)로 — 꼴(「2026 . 3 . 3 .」·「2025년 12월 12일」·「2026. 3. 3.」)과 같은 줄의 다른 글은 그대로. {날짜}는 「YYYY. M. D.」 */
export function swapDate(text, iso) {
  const m0 = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m0) return String(text || '');
  const [y, mo, d] = [+m0[1], +m0[2], +m0[3]];
  const t = String(text || '');
  if (t.includes(MARK.date)) return t.replace(MARK.date, `${y}. ${mo}. ${d}.`);
  const m = DATE.exec(t);
  if (!m) return `${y}. ${mo}. ${d}.`;
  const [, , s1, p1, s2, , s3, p2, s4, , s5, p3] = m;
  const tail = p3 ? s5 + p3 : p1 === '년' ? '일' : '.';
  return t.slice(0, m.index) + `${y}${s1}${p1}${s2}${mo}${s3}${p2}${s4}${d}${tail}` + t.slice(m.index + m[0].length);
}

/* ---------- 문단 만들기 ---------- */
const attr = (tag, a) => { const m = new RegExp(`\\b${a}="([^"]*)"`).exec(tag); return m ? m[1] : ''; };
const openTag = (xml, p) => (p.self ? xml.slice(p.s, p.e).replace(/\s*\/>$/, '>') : xml.slice(p.s, p.oe));
const pureText = run => run.kids.every(c => local(c) === 't');
function charPrOf(xml, p) {
  const runs = kidsNamed(p, 'run');
  const tr = runs.find(r => r.kids.some(c => local(c) === 't' && !c.self && c.cs > c.oe)) || runs.find(pureText) || runs[0];
  return tr ? attr(xml.slice(tr.s, tr.oe), 'charPrIDRef') || '0' : '0';
}
const textRun = (charPr, text) => `<hp:run charPrIDRef="${charPr}"><hp:t>${esc(text)}</hp:t></hp:run>`;
/* 개체 조각(구역 설정·표·그림)에서 글자만 뺌(빈 <hp:t/>는 남김) */
function stripT(xml, run) {
  let s = xml.slice(run.s, run.e);
  for (const t of [...run.kids].reverse()) if (local(t) === 't' && !t.self) s = s.slice(0, t.s - run.s) + s.slice(t.e - run.s);
  return s;
}
/* 문단의 글만 바꿈: 첫 글 조각 자리에 새 글(그 글자 모양), 개체 조각은 그대로, 줄 배치 기억은 지움 */
function setText(xml, p, text) {
  let out = openTag(xml, p), placed = false;
  const cp = charPrOf(xml, p);
  for (const k of p.kids) {
    const n = local(k);
    if (n === 'linesegarray') continue;
    if (n !== 'run') { out += xml.slice(k.s, k.e); continue; }
    if (pureText(k)) { if (!placed) { out += textRun(attr(xml.slice(k.s, k.oe), 'charPrIDRef') || cp, text); placed = true; } continue; }
    out += stripT(xml, k);
  }
  if (!placed) out += textRun(cp, text);
  return out + '</hp:p>';
}
/* 본문 줄 단계: 0 보통 · 1 「1.」 · 2 「가.」 · 3 「1)」 · 4 「가)」·「①」 · 5 「-·○·□·※」 */
export function levelOf(text) {
  const t = String(text || '').trim();
  if (/^\d{1,2}\.(\s|$)/.test(t)) return 1;
  if (/^[가-하]\.(\s|$)/.test(t)) return 2;
  if (/^\d{1,2}\)(\s|$)/.test(t)) return 3;
  if (/^([가-하]\)|[①-⑳])/.test(t)) return 4;
  if (/^[-·∙•○◦□■※▶▷*]/.test(t)) return 5;
  return 0;
}
const FALL = { 0: [0], 1: [1, 0], 2: [2, 1, 0], 3: [3, 2, 1, 0], 4: [4, 3, 2, 1, 0], 5: [5, 0] };
/* 옛 본문 문단 → 단계마다 본(문단 여는 태그·글자 모양·앞 공백) */
function protosOf(xml, paras) {
  const by = {};
  for (const p of paras) {
    const t = paraText(xml, p);
    if (!t.trim() && by[0]) continue;
    const lv = t.trim() ? levelOf(t) : 0;
    if (!by[lv]) by[lv] = { open: openTag(xml, p), charPr: charPrOf(xml, p), lead: (/^[ 　]*/.exec(t) || [''])[0] };
  }
  if (!by[0]) by[0] = Object.values(by)[0] || { open: '<hp:p id="0" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">', charPr: '0', lead: '' };
  return by;
}
function paraFrom(proto, text, id, { keepLead = true } = {}) {
  const open = proto.open.replace(/\bid="[^"]*"/, `id="${id}"`).replace(/pageBreak="1"/, 'pageBreak="0"').replace(/columnBreak="1"/, 'columnBreak="0"');
  const body = String(text || '').trim();
  return `${open}${textRun(proto.charPr, body ? (keepLead ? proto.lead : '') + body : '')}</hp:p>`;
}
const pick = (protos, lv) => protos[FALL[lv].find(k => protos[k])];

/* ---------- 회신서 ---------- */
const solidFill = id => `<hh:borderFill id="${id}" threeD="0" shadow="0" centerLine="NONE" breakCellSeparateLine="0"><hh:slash type="NONE" Crooked="0" isCounter="0"/><hh:backSlash type="NONE" Crooked="0" isCounter="0"/>`
  + ['leftBorder', 'rightBorder', 'topBorder', 'bottomBorder'].map(s => `<hh:${s} type="SOLID" width="0.12 mm" color="#000000"/>`).join('')
  + '<hh:diagonal type="SOLID" width="0.1 mm" color="#000000"/></hh:borderFill>';
/* header.xml에 실선 테두리 하나를 더하고 그 번호를 돌려줌 */
function addBorder(header) {
  const ids = [...header.matchAll(/<hh:borderFill id="(\d+)"/g)].map(m => +m[1]);
  const id = (ids.length ? Math.max(...ids) : 0) + 1;
  const m = /<hh:borderFills itemCnt="(\d+)">/.exec(header);
  if (!m || header.indexOf('</hh:borderFills>') < 0) return null;
  return { id, xml: header.replace(m[0], `<hh:borderFills itemCnt="${+m[1] + 1}">`).replace('</hh:borderFills>', solidFill(id) + '</hh:borderFills>') };
}
function textWidth(secXml) {
  const pw = /<hp:pagePr\b[^>]*\bwidth="(\d+)"/.exec(secXml), mg = /<hp:margin\b[^>]*\bleft="(\d+)"[^>]*\bright="(\d+)"/.exec(secXml);
  const w = pw ? +pw[1] - (mg ? +mg[1] + +mg[2] : 11338) : 48190;
  return w > 5000 ? w : 48190;
}
function replyXml(reply, { normal, center, head, bold, border, width, nid, year }) {
  const cellW = [Math.round(width * 0.3), width - Math.round(width * 0.3)], rowH = 1800;
  const fields = (reply.fields || []).map(f => String(f || '').trim()).filter(Boolean);
  const rows = [['학년 반 번호', '      학년        반        번'], ['학생 이름', ''], ...fields.map(f => { const i = f.indexOf(':'); return i > 0 ? [f.slice(0, i).trim(), f.slice(i + 1).trim()] : [f, '']; })];
  const cell = (txt, ci, ri, proto) => `<hp:tc name="" header="0" hasMargin="0" protect="0" editable="0" dirty="0" borderFillIDRef="${border}">`
    + '<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">'
    + paraFrom(proto, txt, nid(), { keepLead: false }) + '</hp:subList>'
    + `<hp:cellAddr colAddr="${ci}" rowAddr="${ri}"/><hp:cellSpan colSpan="1" rowSpan="1"/><hp:cellSz width="${cellW[ci]}" height="${rowH}"/><hp:cellMargin left="510" right="510" top="141" bottom="141"/></hp:tc>`;
  const tbl = `<hp:tbl id="${nid()}" zOrder="0" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" pageBreak="CELL" repeatHeader="0" rowCnt="${rows.length}" colCnt="2" cellSpacing="0" borderFillIDRef="${border}" noAdjust="0">`
    + `<hp:sz width="${width}" widthRelTo="ABSOLUTE" height="${rowH * rows.length}" heightRelTo="ABSOLUTE" protect="0"/>`
    + '<hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="COLUMN" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>'
    + '<hp:outMargin left="0" right="0" top="0" bottom="0"/><hp:inMargin left="510" right="510" top="141" bottom="141"/>'
    + rows.map((r, ri) => `<hp:tr>${cell(r[0], 0, ri, bold)}${cell(r[1], 1, ri, normal)}</hp:tr>`).join('') + '</hp:tbl>';
  const tblPara = normal.open.replace(/\bid="[^"]*"/, `id="${nid()}"`).replace(/pageBreak="1"/, 'pageBreak="0"') + `<hp:run charPrIDRef="${normal.charPr}">${tbl}<hp:t/></hp:run></hp:p>`;
  return [paraFrom(normal, '', nid()), paraFrom(center, '✂ - - - - - - - - - - - 자 르 는 선 - - - - - - - - - - -', nid(), { keepLead: false }),
    paraFrom(head, reply.title || '회신서', nid(), { keepLead: false }), tblPara,
    ...(String(reply.due || '').trim() ? [paraFrom(normal, reply.due, nid(), { keepLead: false })] : []),
    paraFrom(center, `${year} .     .     .          보호자 :                (서명)`, nid(), { keepLead: false })].join('');
}

/* ---------- 채우기 ---------- */
/* form(readForm 결과, 바꾸지 않음) + roles + letter { title, date(YYYY-MM-DD), body: [줄], reply: null | { title, fields, due } } → { bytes, warn } */
export async function fillForm(form, roles, letter) {
  const L = form.lines, warn = [], x = letter || {};
  const secXml = form.secs.map(s => s.xml);
  const edits = form.secs.map(() => []);
  const add = (si, s, e, text) => edits[si].push({ s, e, text });
  let maxId = 0;
  for (const xml of secXml) for (const m of xml.matchAll(/<hp:p id="(\d+)"/g)) maxId = Math.max(maxId, +m[1]);
  let next = Math.min(maxId, 2000000000) + 1;
  const nid = () => next++;
  const line = i => (i >= 0 && i < L.length ? L[i] : null);
  const topOf = (l, n = l.node) => { const top = form.secs[l.sec].top; let u = n; while (u.up && u.up !== top) u = u.up; return u; };

  const tl = line(roles.title), dl = line(roles.date), b0 = line(roles.bodyStart);
  if (tl) add(tl.sec, tl.node.s, tl.node.e, setText(secXml[tl.sec], tl.node, x.title || ''));
  if (dl) add(dl.sec, dl.node.s, dl.node.e, setText(secXml[dl.sec], dl.node, swapDate(dl.text, x.date)));
  let protos = null;
  if (b0) {
    const xml = secXml[b0.sec], box = b0.box, ps = kidsNamed(box, 'p');
    let last = b0;
    for (let k = roles.bodyStart; k <= Math.max(roles.bodyStart, roles.bodyEnd); k++) if (L[k] && L[k].box === box) last = L[k];
    const i0 = ps.indexOf(b0.node), i1 = ps.indexOf(last.node);
    const range = ps.slice(i0, i1 + 1);
    protos = protosOf(xml, range.filter(p => L.some(l => l.node === p)));
    const keep = range.filter(p => has(p, ['secPr'])).map(p => setText(xml, p, ''));
    add(b0.sec, ps[i0].s, ps[i1].e, keep.join('') + (x.body || []).map(t => paraFrom(pick(protos, levelOf(t)), t, nid())).join(''));
  }
  // 회신서: 옛 회신서(시작 줄이 든 구역 맨 위 문단부터 구역 끝까지)를 지우고, 켰으면 새로
  const rl = line(roles.reply), sl = line(roles.sign);
  let header = null, headerName = form.entries.find(e => /^Contents\/header\.xml$/i.test(e.name));
  const inBox = rl && ((sl && topOf(rl) === topOf(sl)) || (b0 && topOf(rl) === topOf(b0)));
  if (inBox) warn.push('reply-in-box');
  let at = null; // 새 회신서를 넣을 { sec, s, e }
  if (rl && !inBox) {
    const tops = kidsNamed(form.secs[rl.sec].top, 'p'), from = tops.indexOf(topOf(rl));
    at = { sec: rl.sec, s: tops[from].s, e: tops[tops.length - 1].e };
  } else if (!inBox) {
    const si = sl ? sl.sec : form.secs.length - 1, top = form.secs[si].top;
    at = { sec: si, s: top.cs, e: top.cs };
  }
  if (at) {
    let text = '';
    if (x.reply && headerName) {
      const added = addBorder(new TextDecoder().decode(headerName.data));
      if (added) {
        header = added.xml;
        const pr = protos || protosOf(secXml[at.sec], []);
        const center = dl ? { open: openTag(secXml[dl.sec], dl.node), charPr: charPrOf(secXml[dl.sec], dl.node), lead: '' } : pr[0];
        const head = tl ? { open: openTag(secXml[tl.sec], tl.node), charPr: charPrOf(secXml[tl.sec], tl.node), lead: '' } : pr[0];
        text = replyXml(x.reply, { normal: pr[0], center, head, bold: pr[1] || pr[0], border: added.id, width: textWidth(secXml[at.sec]), nid, year: String(x.date || '').slice(0, 4) || String(new Date().getFullYear()) });
      }
    }
    if (text || at.s !== at.e) add(at.sec, at.s, at.e, text);
  }
  // 바꾸기(뒤에서부터). 다른 바꿀 곳 안에 든 것은 건너뜀
  const outXml = secXml.map((xml, si) => {
    const list = edits[si].sort((a, b) => a.s - b.s || a.e - b.e);
    const ok = [];
    for (const ed of list) { const prev = ok[ok.length - 1]; if (prev && ed.s < prev.e) { warn.push('overlap'); continue; } ok.push(ed); }
    let out = xml;
    for (const ed of ok.reverse()) out = out.slice(0, ed.s) + ed.text + out.slice(ed.e);
    return out;
  });
  const prv = [x.title || '', ...(x.body || []), swapDate(dl ? dl.text : '', x.date)].join('\r\n');
  const files = form.entries.map(e => {
    const si = form.secs.findIndex(s => s.name === e.name);
    if (si >= 0) return { name: e.name, data: outXml[si] };
    if (header && headerName && e.name === headerName.name) return { name: e.name, data: header };
    if (/^Preview\/PrvText\.txt$/i.test(e.name)) return { name: e.name, data: prv };
    return { name: e.name, data: e.data };
  });
  return { bytes: zipStore(files), warn };
}
export const _test = { paraText, local, setText };
