/* 견적서 읽기: 엑셀·CSV·한글·글은 표에서 품목을 찾고(AI 없음), 사진·글 없는 PDF는 AI가 읽음 → { items, by: 'table'|'ai' }
   items: [{ name, spec, qty, price }] (수는 숫자). 합계·소계·부가세·공급가액 줄은 뺌 */
import { readTable, findItems } from '../../core/sheet.js';
import { readText } from '../../core/files.js';
import * as ai from '../../core/ai.js';

const TOTAL = /합\s*계|소\s*계|부\s*가\s*세|공급\s*가/;
const num = v => { const n = Number(String(v == null ? '' : v).replace(/[^\d.-]/g, '')); return Number.isFinite(n) ? n : 0; };

export function quotePrompt() {
  return ['[견적서 읽기]', '첨부한 이미지는 견적서입니다. 품목 표에서 품명·규격·수량·단가를 줄마다 뽑습니다.',
    '- 합계·소계·부가세·공급가액 줄은 빼고, 모르는 칸은 빈 글.', '- 수량·단가는 숫자(쉼표 없이).', '',
    '[출력] JSON 하나만: {"items":[{"name":"…","spec":"…","qty":1,"price":0}]}'].join('\n');
}
export function normQuoteItems(v) {
  const list = Array.isArray(v) ? v : v && Array.isArray(v.items) ? v.items : [];
  return list.filter(x => x && String(x.name || '').trim() && !TOTAL.test(String(x.name)))
    .map(x => ({ name: String(x.name).trim(), spec: String(x.spec || '').trim(), qty: num(x.qty) || 1, price: num(x.price) }));
}
const fromRows = rows => normQuoteItems(findItems(rows));
const rowsOf = text => String(text || '').split('\n').map(l => l.split(/\t|\s*\|\s*/));

/* aiRead(images): 사진·글 없는 PDF를 다른 프롬프트로 읽고 싶을 때(아무거나 넣기) */
export async function readQuote(file, { aiRead } = {}) {
  const name = String(file.name || '');
  if (/\.(xlsx|csv)$/i.test(name)) return { items: fromRows(await readTable(name, new Uint8Array(await file.arrayBuffer()))), by: 'table' };
  if (/\.(hwpx?|txt|pdf)$/i.test(name)) {
    let text = '';
    try { text = await readText(file); } catch (e) { if (!(e && e.code === 'PDF_NO_TEXT')) throw e; }
    const items = fromRows(rowsOf(text));
    if (items.length || !/\.pdf$/i.test(name)) return { items, by: 'table' };
  }
  // 사진·글 없는 PDF: AI가 읽음 (키가 없으면 NO_AI)
  if (!ai.ready()) throw { code: 'NO_AI' };
  const images = await window.SSAM.files.toImages(file);
  if (aiRead) return aiRead(images);
  const v = await ai.generateJSON(quotePrompt(), { images, task: 'purchase', valid: x => normQuoteItems(x).length > 0 });
  return { items: normQuoteItems(v), by: 'ai' };
}
