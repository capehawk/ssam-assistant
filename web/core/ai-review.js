/* 검토 AI 공통: 메인 AI가 쓴 것 중 필요한 곳만 다른 AI가 한 번 더 봄.
   검토 프롬프트·답 읽기·같은지 판정·두 의견 HTML. 검토 AI에도 메인과 같은 것만 보냄(학생은 번호로만) */
import * as ai from './ai.js';
import { pick } from './ai-roles.js';
import { ITEM_TYPES, gradeCell } from '../menus/evaluate/unit/unit-grade.js';
import { makeTitle } from '../menus/evaluate/unit/unit-model.js';

export const REVIEW_FAIL = '검토하지 못했어요';
const TYPE_NAME = Object.fromEntries(ITEM_TYPES);
const listOf = (v, k) => (Array.isArray(v) ? v : (v && Array.isArray(v[k]) ? v[k] : []));
const str = (v, n = 400) => String(v == null ? '' : v).trim().slice(0, n);
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* 그 업무의 검토 AI로 JSON 답 받기. 검토가 꺼졌거나 검토 AI가 없으면 null(부르지 않음), 실패하면 { error } */
export async function reviewJSON(task, prompt, { images, valid, signal } = {}) {
  const use = pick(task, 'review');
  if (!use) return null;
  try { return await ai.generateJSON(prompt, { use, images, valid, signal }); }
  catch (e) { return { error: (e && e.code) || 'upstream_error' }; }
}

/* ---------- 단원평가 채점 ---------- */
/* 검토할 칸: 확신 없음·뜻으로 판단·앱과 다름, 서술형 부분 점수. 손으로 고친 칸·확인한 칸은 빼기 */
export function gradeTargets(test, st) {
  const out = [];
  for (const it of test.key.items) {
    const c = st.items && st.items[it.no];
    if (!c || c.manual || c.ok) continue;
    const full = Number(it.points) || 0;
    if (['low', 'similar', 'differ'].includes(c.flag) || (it.type === 'essay' && c.pts > 0 && c.pts < full)) out.push(it.no);
  }
  return out;
}

export function gradeReviewPrompt(test, no, nos) {
  const set = new Set(nos);
  const key = test.key.items.filter(i => set.has(i.no)).map(i => `${i.no} | ${TYPE_NAME[i.type] || '단답'} | ${i.answer} | ${i.points} | ${i.criteria || ''}`);
  const paper = String((test.paper && test.paper.text) || '').slice(0, 12000);
  return [
    '[채점 검토]',
    '당신은 초등학교 단원평가 채점을 한 번 더 확인하는 교사입니다. 첨부한 이미지는 한 학생이 답을 쓴 평가지입니다. 이름 칸은 가려져 있을 수 있습니다.',
    `[평가] ${makeTitle(test.meta)}`,
    '', '[확인할 문항의 정답표] 번호 | 유형 | 정답 | 배점 | 채점 기준', ...key,
    ...(paper ? ['', '[평가지 글]', paper] : []),
    '', '[할 일]',
    '1. 위 문항만 학생이 쓴 답을 그대로 읽어 read에 적습니다. 비어 있으면 ""로 둡니다. 맞춤법을 고치지 않습니다.',
    '2. 고르기는 고른 번호를 ③처럼, ○표 문항은 (3)처럼, 기호는 ㉯처럼, 선 잇기는 (1)-①, (2)-②처럼 적습니다.',
    '3. points는 정답표와 채점 기준으로 본 점수입니다(0부터 배점까지 정수). 서술형은 채점 기준에 비추어 부분 점수를 줄 수 있습니다.',
    '4. why에는 그렇게 판단한 까닭을 40자 안팎으로 씁니다.',
    '5. 가려진 부분은 무시하고, 학생 이름을 추측하거나 적지 않습니다.',
    '', '[출력] JSON 하나만 출력합니다.',
    '{"items":[{"no":1,"read":"학생이 쓴 답","points":0,"why":"판단 까닭"}]}',
    '', `[학생] ${no}번`
  ].join('\n');
}

export function normGradeReview(v, nos) {
  const set = new Set(nos), out = {};
  for (const x of listOf(v, 'items')) {
    const no = Number(x && x.no), p = Math.round(Number(x && x.points));
    if (!set.has(no) || !Number.isFinite(p) || x.points === '' || x.points == null) continue;
    out[no] = { read: str(x.read, 120), points: p, why: str(x.why, 80) };
  }
  return out;
}

/* 검토 답을 같은 정답 맞추기 규칙으로 채점해 점수가 같으면 같은 판단 */
export const sameGrade = (item, cell, rv) => gradeCell(item, { read: rv.read, points: rv.points }).pts === cell.pts;

/* ---------- 평어·행특·창체 문장 ---------- */
const KIND = { pyeongeo: '교과 평어', hk: '행동특성 및 종합의견', cc: '창의적 체험활동 특기사항', gr: '수행평가 교과 평어' };
export function textReviewPrompt(kind, info, texts) {
  const list = texts.slice(0, 10);
  return [
    '[문장 검토]',
    `당신은 초등학교 학교생활기록부 ${KIND[kind] || '문장'}을 다른 교사가 쓴 뒤 한 번 더 살펴보는 교사입니다.`,
    ...(info ? ['', '[평가 정보]', String(info).slice(0, 3000)] : []),
    '', '[문장]', ...list.map((t, i) => `${i + 1}. ${String(t).replace(/\s+/g, ' ').trim()}`),
    '', '[살펴볼 것]',
    '- 끝맺음과 말투가 다른 문장과 다름, 너무 짧거나 김, 성취기준·평가 정보와 맞지 않음',
    '- 학생 이름·주어(이 학생은 등)·개인정보가 들어감, 근거 없이 지나치게 칭찬하거나 깎아내림',
    '', '[규칙] 문제가 있는 문장만 고릅니다. 문제가 없으면 빈 목록을 냅니다. fix는 같은 끝맺음·비슷한 분량으로 고친 문장 하나입니다.',
    '', '[출력] JSON 하나만 출력합니다.',
    '{"items":[{"i":1,"problem":"무엇이 문제인지 짧게","fix":"고친 문장"}]}'
  ].join('\n');
}

export function normTextReview(v, n) {
  const seen = new Set(), out = [];
  for (const x of listOf(v, 'items')) {
    const i = Number(x && x.i), problem = str(x && x.problem, 120), fix = str(x && x.fix, 600);
    if (!Number.isInteger(i) || i < 1 || i > n || seen.has(i) || !problem || !fix) continue;
    seen.add(i); out.push({ i, problem, fix });
  }
  return out;
}

/* 문장 여러 개: 10개씩 나눠 검토 AI로. 번호(i)는 전체 차례(1부터). 검토가 꺼지면 null, 실패하면 { error, partial } */
export async function reviewTexts(kind, info, texts, { signal } = {}) {
  if (!pick('writing', 'review')) return null;
  const out = [];
  for (let k = 0; k < texts.length; k += 10) {
    const chunk = texts.slice(k, k + 10);
    const v = await reviewJSON('writing', textReviewPrompt(kind, info, chunk), { signal, valid: x => Array.isArray(x) || !!(x && Array.isArray(x.items)) });
    if (v == null) return out.length ? out : null;
    if (v.error) return { error: v.error, partial: out };
    out.push(...normTextReview(v, chunk.length).map(r => ({ ...r, i: r.i + k })));
  }
  return out;
}

/* ---------- 계획 초안 ---------- */
export function planReviewPrompt(title, sections, guide) {
  return [
    '[계획 검토]',
    '당신은 학교 계획서 초안을 결재 전에 한 번 더 살펴보는 교사입니다.',
    `[계획] ${title}`,
    ...(guide && String(guide).trim() ? ['', '[올해 지침 요약]', String(guide).slice(0, 6000)] : []),
    '', '[초안] 칸마다 [칸 키] 칸 이름 다음 줄부터 글', ...sections.map(s => `[${s.key}] ${s.label}\n${String(s.text || '').slice(0, 4000)}`),
    '', '[살펴볼 것] 지침에서 꼭 넣을 것이 빠짐, 작년 날짜·학년도가 남음, 숫자·이름이 비어 있거나 OO로 남음, 칸끼리 서로 맞지 않음',
    '', '[규칙] 고칠 것이 있는 칸만 고릅니다. fix는 그 칸 글 전체를 고친 것입니다. 문제가 없으면 빈 목록을 냅니다.',
    '', '[출력] JSON 하나만 출력합니다.',
    '{"items":[{"section":"칸 키","problem":"무엇이 문제인지 짧게","fix":"고친 칸 글 전체"}]}'
  ].join('\n');
}

export function normPlanReview(v, keys) {
  const set = new Set(keys), seen = new Set(), out = [];
  for (const x of listOf(v, 'items')) {
    const section = String((x && x.section) || ''), problem = str(x && x.problem, 160), fix = str(x && x.fix, 8000);
    if (!set.has(section) || seen.has(section) || !problem || !fix) continue;
    seen.add(section); out.push({ section, problem, fix });
  }
  return out;
}

/* ---------- 피드백·알림 ---------- */
export function notesReviewPrompt(kind, entries) {
  const who = kind === 'weekly' ? '학부모에게 보내는 주간학습안내 알림' : '학생에게 주는 단원평가 잘한 점·격려 한마디';
  return [
    '[글 검토]',
    `당신은 ${who}을 보내기 전에 한 번 더 살펴보는 교사입니다.`,
    '', '[글] 칸마다 key | field | 설명 다음 줄에 글',
    ...entries.map(e => `${e.key} | ${e.field} | ${e.label || ''}\n${String(e.text || '').replace(/\s+/g, ' ').trim()}`),
    '', `[살펴볼 것] ${kind === 'weekly' ? '날짜·요일·준비물이 서로 맞지 않음, 학생 이름·개인정보, 어색하거나 딱딱한 말' : '점수 숫자·학생 이름이 들어감, 그 학생의 결과와 맞지 않음, 학생에게 상처가 될 말, 학년에 맞지 않는 어려운 말'}`,
    '', '[규칙] 고칠 것이 있는 칸만 고릅니다. fix는 고친 글 전체입니다. 문제가 없으면 빈 목록을 냅니다.',
    '', '[출력] JSON 하나만 출력합니다.',
    '{"items":[{"key":"칸의 key","field":"칸의 field","problem":"무엇이 문제인지 짧게","fix":"고친 글"}]}'
  ].join('\n');
}

/* allowed: ['key|field'] 이 칸들만 (없으면 모두) */
export function normNotesReview(v, allowed) {
  const set = allowed ? new Set(allowed.map(String)) : null, seen = new Set(), out = [];
  for (const x of listOf(v, 'items')) {
    const key = String(x && x.key != null ? x.key : ''), field = String((x && x.field) || ''), problem = str(x && x.problem, 120), fix = str(x && x.fix, 600);
    const id = `${key}|${field}`;
    if (!key || !field || (set && !set.has(id)) || seen.has(id) || !problem || !fix) continue;
    seen.add(id); out.push({ key, field, problem, fix });
  }
  return out;
}

/* ---------- 평가지 채점(옛 화면) ---------- */
const LV_ORDER = ['top', 'high', 'mid', 'low'];
/* 「읽기 어려움」 학생 + 나눈 수준이 바뀌는 바로 위·아래 학생 */
export function grReviewNeeded(students) {
  const done = students.filter(s => s && !s.skip && s.status === 'done');
  const out = new Set(done.filter(s => s.unreadable).map(s => s.id));
  const sorted = done.filter(s => s.level).sort((a, b) => (b.score - a.score) || (a.no - b.no));
  for (let i = 1; i < sorted.length; i++) {
    if (LV_ORDER.indexOf(sorted[i].level) !== LV_ORDER.indexOf(sorted[i - 1].level)) { out.add(sorted[i - 1].id); out.add(sorted[i].id); }
  }
  return [...out];
}
export const grDiffers = (a, b) => Math.abs(Number(a) - Number(b)) >= 10;

/* ---------- 두 의견 보여 주기 ---------- */
export function opinionHTML({ title, main, alt, why, use, keep, useLabel = '검토 안 쓰기' }) {
  return `<div class="rv-op">
    <p class="rv-h"><span class="rv-tag">검토 의견</span>${title ? ` <b>${esc(title)}</b>` : ''}</p>
    <div class="rv-two"><div class="rv-col"><span class="lab">메인 안</span><p>${esc(main)}</p></div><div class="rv-col alt"><span class="lab">검토 안</span><p>${esc(alt)}</p></div></div>
    ${why ? `<p class="muted rv-why">까닭: ${esc(why)}</p>` : ''}
    <div class="row rv-acts"><button class="btn primary" type="button" data-rv-use="${esc(use)}">${esc(useLabel)}</button><button class="btn" type="button" data-rv-keep="${esc(keep)}">그대로 두기</button></div>
  </div>`;
}
export const reviewBar = (n, nextAttr) => (n > 0 ? `<div class="rv-bar" role="status"><b>검토 의견 ${n}개</b><button class="btn text" type="button" ${nextAttr}>다음 의견</button></div>` : '');

const CSS = `.rv-op{display:flex;flex-direction:column;gap:8px;border:1px solid #e0b400;background:#fffbe8;border-radius:10px;padding:10px 12px;margin:6px 0}
.rv-h{margin:0;display:flex;gap:6px;align-items:center}.rv-tag{background:#fff4c2;color:#5c4700;border:1px solid #e0b400;border-radius:999px;font-size:12px;padding:1px 8px;font-weight:600}
.rv-two{display:grid;grid-template-columns:1fr 1fr;gap:8px}.rv-col{background:var(--surface,#fff);border:1px solid var(--line,#e4e6eb);border-radius:8px;padding:8px}.rv-col p{margin:4px 0 0;white-space:pre-wrap}
.rv-col.alt{border-color:#e0b400}.rv-why{margin:0}.rv-acts{margin:0}
.rv-bar{display:flex;align-items:center;gap:8px;background:#fff4c2;color:#5c4700;border:1px solid #e0b400;border-radius:8px;padding:6px 10px;margin:6px 0}
.rv-mark{background:#fff4c2 !important;border-color:#e0b400 !important}.rv-fail{color:var(--warn,#8c4a00);font-size:12.5px}
@media (max-width:640px){.rv-two{grid-template-columns:1fr}}`;

if (globalThis.window && globalThis.document) {
  window.SSAM = window.SSAM || {};
  window.SSAM.review = { ...(window.SSAM.review || {}), texts: reviewTexts, reviewJSON, textReviewPrompt, normTextReview, grReviewNeeded, grDiffers, opinionHTML, reviewBar, REVIEW_FAIL, pick };
  if (!document.getElementById('aiReviewCss')) { const st = document.createElement('style'); st.id = 'aiReviewCss'; st.textContent = CSS; document.head.appendChild(st); }
}
