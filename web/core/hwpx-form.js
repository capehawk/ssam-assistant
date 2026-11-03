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
export const _test = { paraText, local };
export async function fillForm() { throw new Error('not yet'); }
export { zipStore };
