/* 계획 초안 검토 (연간·학급운영·행사): 초안이 나온 뒤 검토 AI가 초안 전체를 한 번 봄.
   의견은 계획의 rv = [{ section, problem, fix, done? }]에 두고, 화면은 #…RvBox 칸만 다시 그림(치는 글이 끊기지 않게) */
import { pick } from '../../core/ai-roles.js';
import { reviewJSON, planReviewPrompt, normPlanReview, opinionHTML, reviewBar, REVIEW_FAIL } from '../../core/ai-review.js';

const state = {}; // 계획 id → 'busy' | 'fail'

export { normRv } from './plan-rv.js';
export const openRv = p => (p && Array.isArray(p.rv) ? p.rv.filter(x => !x.done) : []);
export const hasOpen = (p, section) => openRv(p).some(x => x.section === section);

/* 의견 칸: 살펴보는 중·못 함·「검토 의견 N개」·두 의견들. text(section) = 지금 칸 글, label(section) = 칸 이름 */
export function rvBoxHTML(p, { text, label }) {
  if (!p) return '';
  const st = state[p.id], open = openRv(p);
  return (st === 'busy' ? '<p class="muted rv-busy"><span class="spin"></span> 검토 AI가 초안을 살펴보고 있어요. 초안은 그대로 고칠 수 있어요…</p>' : '')
    + (st === 'fail' ? `<p class="rv-fail" role="status">${REVIEW_FAIL} 초안은 그대로 쓸 수 있어요.</p>` : '')
    + reviewBar(open.length, 'data-rv-next')
    + open.map(r => opinionHTML({ title: label(r.section), main: text(r.section), alt: r.fix, why: r.problem, use: r.section, keep: r.section })).join('');
}

/* 검토 부르기. sections: [{ key, label, text }] (보낸 글), save(items): 계획에 rv로 넣기, update(): 의견 칸 다시 그리기.
   검토가 꺼졌거나 검토 AI가 없으면 아무것도 안 함. 검토 중에 손으로 고친 칸의 의견은 버림 */
export async function runPlanReview(id, { title, sections, guide, current, save, update }) {
  const list = sections.filter(s => String(s.text || '').trim());
  if (!list.length || !pick('plan', 'review')) return;
  state[id] = 'busy'; update();
  const v = await reviewJSON('plan', planReviewPrompt(title, list, guide), { valid: x => Array.isArray(x) || !!(x && Array.isArray(x.items)) });
  if (v && v.error) state[id] = 'fail'; else delete state[id];
  if (v && !v.error) {
    const sent = Object.fromEntries(list.map(s => [s.key, s.text]));
    const now = current();
    const items = normPlanReview(v, list.map(s => s.key)).filter(x => now && now[x.section] === sent[x.section]);
    save(items);
  }
  update();
}
export const clearState = id => { delete state[id]; };

/* 의견 칸 클릭: [data-rv-use]·[data-rv-keep]·[data-rv-next]. use(section, fix)·keep(section)은 메뉴가 저장 */
export function onRvClick(e, root, { use, keep }) {
  const u = e.target.closest('[data-rv-use]'), k = e.target.closest('[data-rv-keep]'), n = e.target.closest('[data-rv-next]');
  if (u) { use(u.dataset.rvUse); return true; }
  if (k) { keep(k.dataset.rvKeep); return true; }
  if (n) { const op = root.querySelector('.rv-op'); if (op) { op.scrollIntoView({ block: 'center', behavior: 'smooth' }); const b = op.querySelector('button'); if (b) b.focus({ preventScroll: true }); } return true; }
  return false;
}
/* 고른 의견 표시 */
export const markDone = (rv, section, how) => (rv || []).map(x => (x.section === section && !x.done ? { ...x, done: how } : x));
/* 손으로 고친 칸의 아직 고르지 않은 의견은 지움 */
export const dropOpen = (rv, section) => (rv || []).filter(x => x.section !== section || x.done);
