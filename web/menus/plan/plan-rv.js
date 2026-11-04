/* 계획의 검토 의견 rv = [{ section, problem, fix, done? }] 다듬기 (화면 없음 — 모델·Node 시험에서 씀) */
export function normRv(v) {
  return (Array.isArray(v) ? v : []).filter(x => x && typeof x === 'object' && typeof x.section === 'string' && x.section && typeof x.fix === 'string' && x.problem)
    .slice(0, 30).map(x => ({ section: x.section, problem: String(x.problem).slice(0, 160), fix: x.fix.slice(0, 8000), ...(x.done === 'review' || x.done === 'main' ? { done: x.done } : {}) }));
}
