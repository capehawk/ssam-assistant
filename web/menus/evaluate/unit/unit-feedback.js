/* 단원평가 4단계 피드백 (스펙 2.2·3.3): 잘한 점·격려(AI, 글만), 학생별 미리 보기, 결과지 한글 파일·인쇄(한 쪽에 2명), 번호별 복사 */
import { toast, copyText } from '../../../core/ui.js';
import * as ai from '../../../core/ai.js';
import { aiRowHTML, pick } from '../../../core/ai-roles.js';
import { reviewJSON, notesReviewPrompt, normNotesReview, opinionHTML, reviewBar, REVIEW_FAIL } from '../../../core/ai-review.js';
import { exportButton, exportDoc } from '../../../core/doc-export.js';
import { getTest, graded, makeTitle, feedbackOf, feedbackText } from './unit-model.js';
import { feedbackDoc } from './unit-docs.js';
import { feedbackPrompt, normFeedback } from './unit-ai.js';
import { esc, AI_KEY, registerStep, inStep, cur, curId, saveOrWarn, refresh, getBox } from './unit.js';

let runId = null; // 잘한 점·격려를 쓰는 중인 평가
const rvState = {}; // 평가 id → 'busy' | 'fail' (검토 AI)
const FIELD = { good: '잘한 점', cheer: '격려 한마디' };
const openRv = s => (Array.isArray(s.rv) ? s.rv.filter(r => !r.done) : []);
const rvOf = (s, f) => openRv(s).find(r => r.field === f);

function wrongTable(t, s) {
  const f = feedbackOf(t, s);
  const rows = [
    ...f.wrong.map(w => ({ no: w.no, html: `<td>${w.no}번</td><td>${esc(w.content)}</td><td>${w.read ? esc(w.read) : '<span class="muted">(빈칸)</span>'}</td><td>${esc(w.answer)}</td><td>${esc(w.pages)}</td>` })),
    ...f.partial.map(p => { const it = t.key.items.find(i => i.no === p.no) || {}; return { no: p.no, html: `<td>${p.no}번</td><td>${esc(p.content)}</td><td>부분 점수 ${p.pts}/${p.points}</td><td>${esc(it.answer || '')}</td><td>${esc(it.pages || '')}</td>` }; })
  ].sort((a, b) => a.no - b.no);
  if (!rows.length) return '<p class="muted" style="margin:0">틀린 문항이 없어요. 모두 맞혔어요!</p>';
  return `<div class="un-fb-wrap"><table class="un-fb-t"><thead><tr><th>문항</th><th>평가 내용</th><th>내 답</th><th>정답</th><th>다시 볼 곳</th></tr></thead><tbody>${rows.map(r => `<tr>${r.html}</tr>`).join('')}</tbody></table></div>`;
}
function card(t, s) {
  const f = feedbackOf(t, s);
  return `<div class="yp-card un-fb" data-fbno="${s.no}">
    <div class="cls-card-h"><h3>${s.no}번 · ${f.score}/${f.total}점</h3><span class="row"><button class="btn text" type="button" data-un="fbRedo" data-no="${s.no}">다시 쓰기</button><button class="btn text" type="button" data-un="fbCopy" data-no="${s.no}">복사</button></span></div>
    ${wrongTable(t, s)}
    ${['good', 'cheer'].map(f => { const r = rvOf(s, f); return `<label class="yp-f"><span class="lab">${FIELD[f]}</span><textarea class="field${r ? ' rv-mark' : ''}" data-fb="${s.no}-${f}" rows="2">${esc(s[f])}</textarea></label>${r ? `<div data-rv-for="${s.no}-${f}">${opinionHTML({ title: `${s.no}번 ${FIELD[f]}`, main: s[f], alt: r.fix, why: r.problem, use: `${s.no}-${f}`, keep: `${s.no}-${f}` })}</div>` : ''}`; }).join('\n    ')}
  </div>`;
}
/* 인쇄 틀: 학생마다 한 칸, 두 명마다 쪽 나눔 (CSS) */
function printHTML(t, list) {
  const title = makeTitle(t.meta);
  return `<div class="un-print">${list.map(s => {
    const f = feedbackOf(t, s);
    return `<section class="un-ps"><h2>${esc(title)} · ${s.no}번</h2><p><b>점수 ${f.score} / ${f.total}점</b></p>${wrongTable(t, s)}
      ${s.good ? `<p>잘한 점: ${esc(s.good)}</p>` : ''}${s.cheer ? `<p>한마디: ${esc(s.cheer)}</p>` : ''}</section>`;
  }).join('')}</div>`;
}
function step4HTML(t) {
  const list = graded(t), run = runId === t.id;
  if (!list.length) return '<div class="yp-card"><p class="muted" style="margin:0">먼저 3단계에서 채점해 주세요.</p></div>';
  const nRv = list.reduce((n, s) => n + openRv(s).length, 0), rs = rvState[t.id];
  return `${aiRowHTML('notes')}${rs === 'busy' ? '<p class="muted rv-busy"><span class="spin"></span> 검토 AI가 잘한 점·격려를 살펴보고 있어요…</p>' : rs === 'fail' ? `<p class="rv-fail" role="status">${REVIEW_FAIL} 쓴 글은 그대로 쓸 수 있어요.</p>` : ''}${reviewBar(nRv, 'data-un="fbNextRv"')}<div class="yp-card">
      <div class="row"><button class="btn primary" type="button" data-un="fbAI"${run ? ' disabled' : ''}>${run ? '<span class="spin"></span>쓰는 중…' : '잘한 점·격려 쓰기'}</button>
        ${exportButton('data-un="fbHwpx"', { prefix: '결과지 · ' })}<button class="btn" type="button" data-un="fbPrint">인쇄</button><button class="btn" type="button" data-un="fbCopyAll">모두 복사</button></div>
      <p class="muted cls-note">AI에는 번호·점수·평가 내용만 보내요. 학생이 쓴 답과 이름은 보내지 않아요. 결과지는 한 쪽에 2명이라 가운데를 잘라 나눠 주면 돼요.</p>
    </div>
    <div class="un-fbs">${list.map(s => card(t, s)).join('')}</div>
    ${printHTML(t, list)}`;
}

async function writeFeedback(only) {
  const id = curId(), t = getTest(id);
  if (!t || runId) return;
  if (!ai.ready()) { toast(AI_KEY, 5000); return; }
  const list = graded(t).filter(s => (only != null ? s.no === only : !(s.good && s.cheer)));
  if (!list.length) { toast('모두 썼어요. 다시 쓰려면 학생마다 [다시 쓰기]를 눌러요.'); return; }
  runId = id; delete rvState[id]; refresh(id);
  const wrote = [];
  try {
    for (let i = 0; i < list.length; i += 10) {
      const chunk = list.slice(i, i + 10), nos = new Set(chunk.map(s => s.no));
      const res = normFeedback(await ai.generateJSON(feedbackPrompt(t, chunk), { task: 'notes', valid: v => Object.keys(normFeedback(v)).length > 0 }));
      const t2 = getTest(id);
      if (!t2) break;
      // 다시 쓰기(only)는 두 칸 모두, 아니면 빈 칸만 채움 (선생님이 쓴 글은 그대로)
      for (const s of t2.students) if (nos.has(s.no) && res[s.no]) {
        if ((only != null || !s.good) && res[s.no].good) { s.good = res[s.no].good; wrote.push([s.no, 'good', s.good]); }
        if ((only != null || !s.cheer) && res[s.no].cheer) { s.cheer = res[s.no].cheer; wrote.push([s.no, 'cheer', s.cheer]); }
        if (s.rv) s.rv = s.rv.filter(r => r.done || !wrote.some(w => w[0] === s.no && w[1] === r.field));
      }
      saveOrWarn(t2);
    }
  } catch (e) {
    toast(e && e.code === 'bad_json' ? 'AI 답을 읽지 못했어요. 다시 해 보세요.' : ai.errorMessage(e && e.code, e), 6000);
  } finally { runId = null; refresh(id); }
  if (wrote.length) await reviewFeedback(id, wrote);
}
/* 검토 AI: 이번에 쓴 잘한 점·격려를 한 번에 봄 (번호·점수·글만). 고칠 칸만 학생의 rv에 */
async function reviewFeedback(id, wrote) {
  if (!pick('notes', 'review')) return;
  const t = getTest(id);
  if (!t) return;
  const score = no => { const s = t.students.find(x => x.no === no); if (!s) return ''; const f = feedbackOf(t, s); return `점수 ${f.score}/${f.total}`; };
  const entries = wrote.map(([no, field, text]) => ({ key: no, field, label: `${no}번 ${FIELD[field]} (${score(no)})`, text }));
  rvState[id] = 'busy'; refresh(id);
  const v = await reviewJSON('notes', notesReviewPrompt('feedback', entries), { valid: x => Array.isArray(x) || !!(x && Array.isArray(x.items)) });
  if (v && v.error) rvState[id] = 'fail'; else delete rvState[id];
  const t2 = getTest(id);
  if (v && !v.error && t2) {
    const sent = new Map(wrote.map(([no, f, text]) => [`${no}|${f}`, text]));
    for (const r of normNotesReview(v, [...sent.keys()])) {
      const s = t2.students.find(x => String(x.no) === r.key);
      // 검토하는 동안 선생님이 고친 칸은 의견을 버림
      if (!s || s[r.field] !== sent.get(`${r.key}|${r.field}`)) continue;
      s.rv = [...(s.rv || []).filter(x => x.field !== r.field), { field: r.field, problem: r.problem, fix: r.fix }];
    }
    saveOrWarn(t2);
  }
  refresh(id);
}
function chooseRv(key, useRv) {
  const [no, f] = key.split('-'), t = cur(), s = t && t.students.find(x => x.no === Number(no));
  const r = s && rvOf(s, f);
  if (!r) return;
  if (useRv) s[f] = r.fix;
  s.rv = s.rv.map(x => (x === r ? { ...x, done: useRv ? 'review' : 'main' } : x));
  saveOrWarn(t); refresh(t.id);
}
async function saveHwpx(t) {
  try { toast(await exportDoc(feedbackDoc(t, graded(t)), `${makeTitle(t.meta)} 결과지`), 6000); }
  catch (e) { toast('파일을 저장하지 못했어요', 5000); }
}
async function copy(text) { toast((await copyText(text)) === false ? '복사하지 못했어요' : '복사했어요'); }

registerStep(4, { html: step4HTML });

document.addEventListener('click', e => {
  const box = getBox();
  if (!box || !box.contains(e.target) || !inStep(4)) return;
  const u = e.target.closest('[data-rv-use]'), k = e.target.closest('[data-rv-keep]');
  if (u || k) { chooseRv((u || k).dataset[u ? 'rvUse' : 'rvKeep'], !!u); return; }
  const b = e.target.closest('[data-un]'), a = b && b.dataset.un;
  if (!a) return;
  const t = cur();
  if (a === 'fbNextRv') { const op = box.querySelector('.un-fbs .rv-op'); if (op) { op.scrollIntoView({ block: 'center', behavior: 'smooth' }); const x = op.querySelector('button'); if (x) x.focus({ preventScroll: true }); } }
  else if (a === 'fbAI') writeFeedback();
  else if (a === 'fbRedo') writeFeedback(Number(b.dataset.no));
  else if (a === 'fbHwpx') saveHwpx(t);
  else if (a === 'fbPrint') window.print();
  else if (a === 'fbCopy') { const s = t.students.find(x => x.no === Number(b.dataset.no)); if (s) copy(feedbackText(t, s)); }
  else if (a === 'fbCopyAll') copy(graded(t).map(s => feedbackText(t, s)).join('\n\n'));
});
document.addEventListener('change', e => {
  const box = getBox();
  if (!box || !box.contains(e.target) || !inStep(4) || !e.target.dataset.fb) return;
  const [no, k] = e.target.dataset.fb.split('-'), t = cur();
  const s = t.students.find(x => x.no === Number(no));
  if (!s) return;
  s[k] = e.target.value.trim();
  // 손으로 고친 칸의 검토 의견은 사라짐
  const had = !!rvOf(s, k);
  if (had) s.rv = s.rv.filter(r => r.done || r.field !== k);
  saveOrWarn(t);
  if (had) {
    // 글을 치는 중이면 화면 전체는 나중에 그리므로 그 의견만 바로 지움
    const op = box.querySelector(`[data-rv-for="${no}-${k}"]`); if (op) op.remove();
    e.target.classList.remove('rv-mark');
    refresh(t.id);
  }
});
