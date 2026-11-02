/* 품의 「아무거나 넣기」: 엑셀·견적서 파일, 장바구니·견적 캡처, 대충 쓴 줄글 → 품목과 빈 칸 (스펙 4.0).
   줄글은 먼저 앱이 규칙으로 읽고, 못 읽은 줄이 있으면 AI가 글 전체를 읽음. 캡처는 AI. 주문자·주소·전화는 받지 않음 */
import * as ai from '../../core/ai.js';
import { emptyItem, findPersonal, toNumber } from './rules.js';
import { readQuote } from './quote.js';
import { findItems } from '../../core/sheet.js';
import { readText } from '../../core/files.js';

const UNITS = '박스|상자|개|권|자루|세트|장|통|묶음|팩|병|봉|EA|ea|Ea|명|시간|식|건|매|롤|켤레|대|부|kg|g|L|ml|m|판|타|다스|캔|포|입';
const QTY = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${UNITS})(?![가-힣A-Za-z])`, 'g');
const blank = v => String(v == null ? '' : v).trim() === '';
const money = (n, man) => Math.round(Number(String(n).replace(/,/g, '')) * (man ? 10000 : 1));
/* 전화번호(휴대전화·지역번호)·이메일 모양 — AI 답에 있으면 그 글은 넣지 않음 */
const CONTACT = /(?:^|[^\d])01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}(?!\d)|(?:^|[^\d])0(?:2|[3-6]\d)[-.)\s]\d{3,4}[-.\s]\d{4}(?!\d)|[\w.+-]+@[\w-]+\.[\w.]+/;
export const hasContact = v => CONTACT.test(String(v == null ? '' : v));

/* 줄 하나 → { it, stated } 또는 null. stated: 「총 N원」으로 적은 금액(수량으로 나눠 단가를 냄) */
const WON = /([\d,]*\d(?:\.\d+)?)\s*(?:(만)\s*원|(만)(?![가-힣])|원)/g;
const MEASURE = /^(g|kg|ml|L|m|매|입)$/; // 규격에 가까운 단위(100매·80g) — 포장 단위가 따로 있으면 수량이 아님
const SHIP = /^(배송비|택배비|운송비|배달비)$/;
function parseLine(raw) {
  let s = String(raw).replace(/^\s*(?:[-•·*▪◦]|\d+[).]|\(\d+\))\s*/, '').trim();
  if (!s) return null;
  let price = null, total = null;
  const tot = /(?:총|합계|전체)\s*(?:금액)?\s*:?\s*([\d,]+(?:\.\d+)?)\s*(만)?\s*원?/.exec(s);
  if (tot) { total = money(tot[1], tot[2]); s = s.replace(tot[0], ' '); }
  let amounts = null;
  if (total == null) {
    const wons = [...s.matchAll(WON)];
    const times = /[×xX*]\s*([\d,]+(?:\.\d+)?)\s*(만)?\s*원?/.exec(s);
    if (wons.length) {
      amounts = wons.map(m => money(m[1], m[2] || m[3]));
      price = amounts[amounts.length - 1];
      for (const m of wons) s = s.replace(m[0], ' ');
    } else if (times) { price = money(times[1], times[2]); s = s.replace(times[0], ' '); }
  }
  const qs = [...s.matchAll(QTY)];
  const pack = qs.filter(m => !MEASURE.test(m[2]));
  const q = (pack.length ? pack : qs).at(-1);
  let qty = 1, unit = '', spec = '';
  if (q) {
    qty = Number(q[1]); unit = q[2];
    if (pack.length) spec = qs.filter(m => MEASURE.test(m[2])).map(m => m[0].replace(/\s+/g, '')).join(' ');
    for (const m of [...qs].reverse()) if (m === q || (pack.length && MEASURE.test(m[2]))) s = s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length);
  }
  if (price == null && total == null) {
    const bare = /(?:^|\s)([\d,]{2,})\s*$/.exec(s);
    if (bare) { price = money(bare[1]); s = s.slice(0, bare.index); }
  }
  if (total != null) price = Math.round(total / (qty || 1));
  // 「1,200원 = 12,000원」처럼 단가와 금액이 같이 있으면 단가
  if (amounts && amounts.length >= 2 && qty > 1) {
    const lo = Math.min(...amounts), hi = Math.max(...amounts);
    if (Math.abs(lo * qty - hi) <= Math.max(1, hi * 0.001)) price = lo;
  }
  const name = s.replace(/[=@×*]|\(\s*\)|\[\s*\]/g, ' ').replace(/(^|\s)(?:x|X|각|개당|단가|금액)(?=\s|$)/g, ' ')
    .replace(/[,:\-–·]+\s*$/, '').replace(/\s+/g, ' ').trim();
  if (!name || price == null || !Number.isFinite(price)) return null;
  if (!unit && SHIP.test(name)) unit = '건';
  return { it: { ...emptyItem(), name, spec, unit, qty: String(qty), price: String(price) }, stated: total };
}

/* 합계만 적은 줄(「합계 36,000원」·「총액 3만원」) → 총액 칸 */
const TOTAL_LINE = /^\s*(?:[-•·*]\s*)?(?:합\s*계|총\s*합\s*계|총\s*액|총\s*금\s*액|총)\s*:?\s*([\d,]+(?:\.\d+)?)\s*(만)?\s*원?\s*$/;
export function parseLines(text) {
  const items = [], missed = [];
  let said = null, sum = 0, inexact = false;
  for (const line of String(text || '').split(/\r?\n/)) {
    if (!line.trim()) continue;
    const t = TOTAL_LINE.exec(line);
    if (t) { said = money(t[1], t[2]); continue; }
    const p = parseLine(line);
    if (!p || findPersonal(p.it.name)) { missed.push(line.trim()); continue; }
    items.push(p.it);
    const q = toNumber(p.it.qty) || 1, amt = Math.round(q * toNumber(p.it.price));
    if (p.stated != null) { sum += p.stated; if (p.stated !== amt) inexact = true; } else sum += amt;
  }
  // 「총 1만원」을 3개로 나누면 9,999원이 되니 적은 총액을 총액 칸에(확인 목록이 다르다고 알려 줌)
  const fields = said != null ? { total: String(said) } : inexact ? { total: String(sum) } : {};
  return { items, fields, missed };
}

/* 엑셀·한글 표에서 복사한 칸(탭으로 나뉜 글): 머리줄이 있으면 그 열대로, 없으면 칸 모양으로(글 = 품명·규격, 단위, 수 = 수량·단가·금액) */
const UNIT_CELL = new RegExp(`^(${UNITS})$`);
const NUM_CELL = /^[₩\s]*\d[\d,]*(?:\.\d+)?\s*원?$/;
function rowItem(cells) {
  const at = cells.findIndex(c => c && !NUM_CELL.test(c) && !UNIT_CELL.test(c));
  if (at < 0) return null;
  const rest = cells.slice(at + 1).filter(Boolean);
  const name = cells[at], texts = rest.filter(c => !NUM_CELL.test(c) && !UNIT_CELL.test(c));
  const unit = rest.find(c => UNIT_CELL.test(c)) || '', nums = rest.filter(c => NUM_CELL.test(c)).map(toNumber);
  if (!nums.length) return null;
  const [qty, price] = nums.length >= 2 ? [nums[0], nums[1]] : [1, nums[0]];
  return { ...emptyItem(), name, spec: texts[0] || '', unit, qty: String(qty > 0 ? qty : 1), price: String(Math.round(price)) };
}
export function tableItems(text) {
  const rows = String(text || '').split(/\r?\n/).filter(l => l.trim()).map(l => l.split('\t').map(c => c.trim()));
  const head = findItems(rows);
  if (head.length) return { items: head.map(it => ({ ...emptyItem(), name: it.name, spec: it.spec || '', unit: it.unit || '', qty: String(it.qty), price: String(it.price) })), fields: {}, missed: [] };
  const items = [], missed = [];
  for (const cells of rows) {
    const it = rowItem(cells);
    if (it && TOTAL.test(it.name)) continue;
    if (it) items.push(it); else missed.push(cells.filter(Boolean).join(' '));
  }
  return { items, fields: {}, missed };
}

export function intakePrompt(kind, text = '') {
  return ['[품의 넣기]',
    kind === 'image' ? '첨부한 이미지는 학교에서 물품을 사려고 찍은 장바구니·견적서·주문서 화면입니다.' : '아래 글은 선생님이 품의(물품 구입)를 쓰려고 대충 적은 메모입니다.',
    '사려는 물품을 줄마다 뽑습니다.',
    '- name: 상품 이름(짧게), spec: 옵션·규격, unit: 수량 단위(개·박스·세트 등), qty: 수량(숫자), price: 1개를 실제로 결제하는 단가(할인 뒤, 숫자·쉼표 없이)',
    '- vendor: 판매처(쇼핑몰·업체 이름). 모르면 빈 글.',
    '- 배송비는 품목에 넣지 말고 shipping에 판매처별로 넣습니다(무료면 0).',
    '- 합계·소계·부가세·공급가액·할인 줄은 품목이 아닙니다.',
    '- fields: 글에 있을 때만 project(사업명)·purpose(목적)·target(대상)·date(일시)·place(장소)·budget(예산 과목). 없으면 빼고, 지어내지 않습니다.',
    '- 주문자·받는 사람 이름, 주소, 전화번호, 이메일, 결제 수단, 주민번호·계좌번호는 절대 쓰지 않습니다.',
    ...(kind === 'text' ? ['', '[메모]', String(text).slice(0, 8000)] : []),
    '', '[출력] JSON 하나만 출력합니다.',
    '{"items":[{"name":"…","spec":"","unit":"개","qty":1,"price":0,"vendor":""}],"shipping":[{"vendor":"","fee":0}],"fields":{"purpose":"…"}}'].join('\n');
}

const FIELDS = ['project', 'purpose', 'target', 'date', 'place', 'budget'];
const TOTAL = /^(합\s*계|소\s*계|부\s*가\s*세|공급\s*가|할인|총\s*(결제|금액))/;
const str = (v, n = 200) => String(v == null ? '' : v).trim().slice(0, n);
const listOf = (v, k) => (v && Array.isArray(v[k]) ? v[k] : []);

/* AI 답 다듬기: 모양 틀린 것·개인정보 모양은 버리고, 칸은 6개만. 전화번호·이메일이 든 글도 버리고 수(dropped)를 셈.
   캡처(kind 'image')의 장소는 받는 곳 주소일 수 있어 받지 않음 */
export function normIntake(v, kind = 'text') {
  let dropped = 0;
  const bad = t => findPersonal(t) || hasContact(t);
  const items = [];
  for (const x of listOf(v, 'items')) {
    if (!(x && typeof x === 'object') || blank(x.name) || TOTAL.test(str(x.name))) continue;
    const it = { name: str(x.name, 120), spec: str(x.spec, 80), unit: str(x.unit, 10), qty: String(toNumber(x.qty) > 0 ? toNumber(x.qty) : 1), price: String(Math.max(0, Math.round(toNumber(x.price)))), vendor: str(x.vendor, 40) };
    if (bad(it.name) || ['spec', 'unit', 'vendor'].some(k => findPersonal(it[k]))) { dropped++; continue; }
    for (const k of ['spec', 'unit', 'vendor']) if (hasContact(it[k])) { it[k] = ''; dropped++; }
    items.push(it);
  }
  const shipping = listOf(v, 'shipping').filter(x => x && typeof x === 'object').map(x => ({ vendor: hasContact(x.vendor) ? '' : str(x.vendor, 40), fee: Math.max(0, Math.round(toNumber(x.fee))) }));
  const fields = {};
  const f = v && v.fields && typeof v.fields === 'object' ? v.fields : {};
  for (const k of FIELDS) {
    const t = str(f[k]);
    if (!t || (k === 'place' && kind === 'image')) continue;
    if (bad(t)) { dropped++; continue; }
    fields[k] = t;
  }
  return { items, shipping, fields, ...(dropped ? { dropped } : {}) };
}

/* 배송비 → 품목 줄(0원·무료는 빼고) */
export const shippingItems = shipping => (shipping || []).filter(s => s && toNumber(s.fee) > 0)
  .map(s => ({ ...emptyItem(), name: '배송비', spec: str(s.vendor, 40), unit: '건', qty: '1', price: String(Math.round(toNumber(s.fee))), vendor: str(s.vendor, 40) }));

/* 빈 칸만 채움 (선생님이 쓴 칸은 그대로). 총액은 줄글의 합계 줄에서만 옴 */
export function fillEmpty(form, fields) {
  const out = { ...form };
  for (const k of [...FIELDS, 'total']) if (fields && !blank(fields[k]) && blank(out[k])) out[k] = fields[k];
  return out;
}

const emptyRow = x => !x || ['name', 'spec', 'qty', 'price'].every(k => blank(x[k]));
export function mergeItems(items, add, how) {
  if (how === 'replace') return add.length ? add.slice() : [emptyItem()];
  const out = (items || []).slice();
  for (const it of add) { const i = out.findIndex(emptyRow); if (i >= 0) out[i] = it; else out.push(it); }
  return out;
}

const vendorOf = it => str(it.vendor) || (str(it.name) === '배송비' ? str(it.spec) : '');
export function vendorsOf(items) {
  const out = [];
  for (const it of items || []) { const v = vendorOf(it); if (v && !out.includes(v)) out.push(v); }
  return out;
}
/* 구입처별로 품의 나누기: 첫 구입처(와 구입처 없는 품목)가 [0] */
export function splitByVendor(form) {
  const vs = vendorsOf(form.items);
  if (vs.length < 2) return [form];
  return vs.map((v, i) => ({ ...form, items: form.items.filter(it => (vendorOf(it) || (i === 0 ? v : '')) === v && !emptyRow(it)) }));
}

/* AI로 보내는 글의 사람 이름: 「김철수 강사」「이영희 선생님」 → 「○○○ 강사」 */
export const maskNames = t => String(t || '').replace(/(^|[^가-힣])[가-힣]{2,4}(\s*)(강사님|강사|선생님|선생|교수님|교수|교사|님|씨)(?=[^가-힣]|$|께|이|가|은|는|을|를|의|과|와)/g, (m, pre, sp, role) => `${pre}○○○${sp || ' '}${role}`);

/* 넣기: { text } | { file } → { items(배송비 줄 포함), fields, by: 'rule'|'table'|'ai', missed }
   noAI: 강사 수당 품의 — 글은 앱 규칙으로만 읽고, 그림·글 없는 PDF는 읽지 않음(강사 이름이 AI로 가지 않게) */
const IMAGE = /\.(png|jpe?g|webp|gif|bmp)$/i;
async function aiRead(kind, { images, text } = {}) {
  const v = await ai.generateJSON(intakePrompt(kind, text), { images, task: 'purchase', valid: x => normIntake(x, kind).items.length > 0 });
  const r = normIntake(v, kind);
  return { items: [...r.items, ...shippingItems(r.shipping)], fields: r.fields, by: 'ai', missed: [], dropped: r.dropped || 0 };
}
export async function readIntake({ text, file, noAI = false } = {}) {
  if (file) {
    // 글 파일은 줄글로(탭으로 나뉜 표면 표로)
    if (/\.txt$/i.test(String(file.name || ''))) return readIntake({ text: await readText(file), noAI });
    const isImage = IMAGE.test(String(file.name || '')) || /^image\//.test(String(file.type || ''));
    if (isImage) {
      if (noAI) throw { code: 'NO_AI_LECTURER' };
      if (!ai.ready()) throw { code: 'NO_AI' };
      return aiRead('image', { images: await window.SSAM.files.toImages(file) });
    }
    const q = await readQuote(file, { aiRead: images => { if (noAI) throw { code: 'NO_AI_LECTURER' }; return aiRead('image', { images }); } });
    if (q.by === 'ai' && q.fields) return q;
    return { items: q.items.map(it => ({ ...emptyItem(), name: it.name, spec: it.spec || '', unit: it.unit || '', qty: String(it.qty), price: String(it.price), vendor: it.vendor || '' })), fields: q.fields || {}, by: q.by, missed: [] };
  }
  // 주민번호·계좌 모양이 있는 줄은 읽지 않고(AI로도 보내지 않음) 수만 알려 줌
  const lines = String(text || '').split(/\r?\n/);
  const personal = lines.filter(l => findPersonal(l)).length;
  const safe = lines.filter(l => !findPersonal(l)).join('\n');
  if (safe.includes('\t')) {
    const t = tableItems(safe);
    if (t.items.length) return { ...t, by: 'table', personal };
  }
  const r = parseLines(safe);
  if (r.missed.length && ai.ready() && !noAI) {
    try { return { ...(await aiRead('text', { text: maskNames(safe) })), personal }; }
    catch (e) { if (!r.items.length) throw e; }
  }
  return { ...r, by: 'rule', personal };
}
