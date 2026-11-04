/* 평가 › 활동지 5단계(결과·확정, 스펙 4.5)와 학생별 모아 보기(4.6), 교과 평어에 참고하기(4.7). 표·쪽지·기록은 번호만 */
import { toast, copyText } from '../../../core/ui.js';
import { exportButton, exportDoc, downloadsButton } from '../../../core/doc-export.js';
import { linkHTML, openLinkSheet } from '../../../core/eval-link.js';
import { listActivities, getActivity, records, markCounts } from './activity-model.js';
import { TYPES, MARK, LEVEL } from './activity-ai.js';
import { SUBJECTS } from './activity-read.js';
import { A, registerStep, registerView, curAct, commitAct, render, esc, getBox, visible } from './activity.js';

const TYPE_NAME = Object.fromEntries(TYPES);
const graded = a => a.students.filter(s => !s.skip && s.status === 'done');
const markOf = (s, it) => MARK[(s.marks && s.marks[it.no] && s.marks[it.no].mark) || ''] || '-';
const titleOf = a => a.meta.title || '활동지';

/* ---------- 5단계 ---------- */
export function statsOrder(a) {
  const c = markCounts(a);
  return a.items.map(it => ({ it, ...c[it.no] })).sort((p, q) => (q.x - p.x) || (q.n - p.n) || (q.t - p.t) || (p.it.no - q.it.no));
}
const tableRows = a => [['번호', ...a.items.map(it => `${it.no}번`), '수준', '잘한 점', '더 해 볼 점'],
  ...graded(a).map(s => [`${s.no}번`, ...a.items.map(it => markOf(s, it)), LEVEL[s.level] || '', s.good || '', s.next || ''])];
export const tableDoc = a => ({ title: `${titleOf(a)} 결과`, blocks: [
  { type: 'h', text: `${titleOf(a)} 결과` },
  { type: 'p', text: [a.meta.subject, a.meta.date, a.meta.pages].filter(Boolean).join(' · ') + ' · ○ 잘함 · △ 조금 더 · × 틀림 · 안 함 빈칸' },
  { type: 'table', head: true, rows: tableRows(a) }] });
/* 학생 피드백 쪽지: 한 쪽에 4명 */
export function slipsDoc(a) {
  const blocks = [];
  graded(a).forEach((s, i) => {
    if (i && i % 4 === 0) blocks.push({ type: 'break' });
    blocks.push({ type: 'h', text: `${s.no}번 · ${titleOf(a)}` });
    blocks.push({ type: 'p', text: a.items.map(it => `${it.no}번 ${markOf(s, it)}`).join('  ') + (s.level ? `  · ${LEVEL[s.level]}` : '') });
    blocks.push({ type: 'p', text: `잘한 점: ${s.good || '-'}` });
    blocks.push({ type: 'p', text: `더 해 볼 점: ${s.next || '-'}` });
  });
  return { title: `${titleOf(a)} 피드백`, blocks };
}
function step5HTML(a) {
  const g = graded(a);
  const stats = statsOrder(a).map(r => `<li><b>${r.it.no}번</b> ${esc(TYPE_NAME[r.it.type] || '')} · ${esc(r.it.ask)}: ○ ${r.o} · △ ${r.t} · × ${r.x} · 안 함 ${r.n}</li>`).join('');
  const head = `<tr><th>번호</th>${a.items.map(it => `<th>${it.no}</th>`).join('')}<th>수준</th><th>잘한 점</th></tr>`;
  const rows = g.map(s => `<tr><td>${s.no}번</td>${a.items.map(it => `<td>${markOf(s, it)}</td>`).join('')}<td>${esc(LEVEL[s.level] || '')}</td><td class="ac-good">${esc(s.good)}</td></tr>`).join('');
  return `<div class="yp-card"><h3>문항별</h3><p class="muted" style="margin:0">× · 안 함이 많은 문항 먼저예요.</p><ul class="ac-stats" id="acStats">${stats}</ul></div>
    <div class="yp-card"><h3>반 표 · 학생 ${g.length}명</h3>
      <div class="ac-grid-wrap"><table class="ac-grid" id="acTable"><thead>${head}</thead><tbody>${rows}</tbody></table></div>
      <div class="row">${exportButton('data-ac="exportTable"', { prefix: '반 표 · ' })}<button class="btn text" type="button" data-ac="copyTable">표 복사</button>${exportButton('data-ac="exportSlips"', { prefix: '피드백 쪽지 · ' })}${downloadsButton()}</div>
      <p class="muted" style="margin:0">피드백 쪽지는 한 쪽에 4명, 번호만 적혀요.</p></div>
    <div class="yp-card"><h3>교과 평어</h3>${linkHTML(a.link, a.meta.subject, 'data-ac')}${a.link && !a.done ? '<p class="muted" id="acLinkWait" style="margin:0">[확정]하면 평가지 채점의 참고 목록에 나와요.</p>' : ''}</div>
    <div class="row act-next">${a.done ? '<span class="chip ok">확정함 · 학생별 모아 보기에 남아요</span><button class="btn text" type="button" data-ac="undone">확정 풀기</button>' : `<button class="btn primary" type="button" data-ac="done"${g.length ? '' : ' disabled'}>확정</button>`}</div>`;
}
registerStep(5, { html: step5HTML });

/* ---------- 학생별 모아 보기 ---------- */
const R = { no: null, subject: '', term: '' };
function allNos() {
  const set = new Set();
  for (const s of listActivities()) { if (!s.done) continue; const a = getActivity(s.id); if (a) graded(a).forEach(x => set.add(x.no)); }
  return [...set].sort((a, b) => a - b);
}
function recList() { return R.no == null ? [] : records(R.no, { subject: R.subject, term: R.term ? Number(R.term) : null }); }
function recordsHTML() {
  const nos = allNos();
  if (R.no == null || !nos.includes(R.no)) R.no = nos[0] == null ? null : nos[0];
  const subs = [...new Set([...SUBJECTS, ...listActivities().map(s => s.subject).filter(Boolean)])];
  const list = recList();
  const body = !nos.length ? '<p class="muted" style="margin:0">아직 확정한 활동지가 없어요. 5단계에서 [확정]을 누르면 여기에 남아요.</p>'
    : list.length ? `<table class="ac-grid" id="recTable"><thead><tr><th>날짜</th><th>교과</th><th>활동</th><th>수준</th><th>잘한 점</th><th>더 해 볼 점</th></tr></thead><tbody>${list.map(r => `<tr><td>${esc(r.date)}</td><td>${esc(r.subject)}</td><td>${esc(r.title)}</td><td>${esc(LEVEL[r.level] || '')}</td><td class="ac-good">${esc(r.good)}</td><td class="ac-good">${esc(r.next)}</td></tr>`).join('')}</tbody></table>`
    : '<p class="muted" style="margin:0">고른 조건의 기록이 없어요.</p>';
  return `<div class="un-top"><button class="btn text" type="button" data-ac="back">‹ 목록</button><b class="un-title">학생별 모아 보기</b></div>
    <div class="yp-card"><div class="act-set">
      <label class="yp-f"><span class="lab">번호</span><select class="field" id="recNo">${nos.map(n => `<option value="${n}"${n === R.no ? ' selected' : ''}>${n}번</option>`).join('')}</select></label>
      <label class="yp-f"><span class="lab">교과</span><select class="field" id="recSubject"><option value="">모든 교과</option>${subs.map(s => `<option${s === R.subject ? ' selected' : ''}>${esc(s)}</option>`).join('')}</select></label>
      <label class="yp-f"><span class="lab">학기</span><select class="field" id="recTerm"><option value="">모두</option><option value="1"${R.term === '1' ? ' selected' : ''}>1학기</option><option value="2"${R.term === '2' ? ' selected' : ''}>2학기</option></select></label>
      <button class="btn text" type="button" data-ac="recCopy"${list.length ? '' : ' disabled'}>복사</button></div>
      <div id="recBody">${body}</div></div>`;
}
registerView('records', { html: recordsHTML });

/* ---------- 누르기 ---------- */
const mine = e => { const box = getBox(); return box && box.contains(e.target) && visible(); };
document.addEventListener('click', async e => {
  if (!mine(e)) return;
  const b = e.target.closest('[data-ac]');
  if (!b) return;
  const act = b.dataset.ac, a = A.view === 'act' && A.step === 5 ? curAct() : null;
  if (act === 'recCopy') {
    const text = recList().map(r => `${r.date} ${r.subject} 「${r.title}」 ${LEVEL[r.level] || ''} · 잘한 점: ${r.good} · 더 해 볼 점: ${r.next}`).join('\n');
    copyText(`${R.no}번 활동지 기록\n${text}`).then(ok => toast(ok ? '복사했어요' : '복사하지 못했어요'));
    return;
  }
  if (!a) return;
  if (act === 'exportTable') { try { toast(await exportDoc(tableDoc(a), `${titleOf(a)} 결과`), 6000); } catch (er) { toast('파일을 저장하지 못했어요'); } }
  else if (act === 'exportSlips') { try { toast(await exportDoc(slipsDoc(a), `${titleOf(a)} 피드백 쪽지`), 6000); } catch (er) { toast('파일을 저장하지 못했어요'); } }
  else if (act === 'copyTable') copyText(tableRows(a).map(r => r.join('\t')).join('\n')).then(ok => toast(ok ? '표를 복사했어요. 한글·엑셀에 붙여넣으세요' : '복사하지 못했어요'));
  else if (act === 'done') { a.done = true; commitAct(a); render(); toast('확정했어요. 학생별 모아 보기에 남아요'); }
  else if (act === 'undone') { a.done = false; commitAct(a); render(); }
  else if (act === 'linkEdit') openLinkSheet({ subject: a.meta.subject, link: a.link, save: l => { const a2 = curAct(); a2.link = l; commitAct(a2); render(); } });
});
document.addEventListener('change', e => {
  if (!mine(e)) return;
  const el = e.target;
  if (el.id === 'recNo') { R.no = Number(el.value); render(); return; }
  if (el.id === 'recSubject') { R.subject = el.value; render(); return; }
  if (el.id === 'recTerm') { R.term = el.value; render(); return; }
  if (el.dataset.ac === 'link' && A.view === 'act' && A.step === 5) {
    const a = curAct();
    if (!a) return;
    if (!el.checked) { a.link = null; commitAct(a); render(); return; }
    openLinkSheet({ subject: a.meta.subject, link: a.link, save: l => { const a2 = curAct(); a2.link = l; commitAct(a2); render(); }, cancel: () => render() });
  }
});
