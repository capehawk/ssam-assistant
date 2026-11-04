/* 단원평가 결과 모아 보기 (스펙 2.3·3.4): 성적 일람표 · 학생별 누적 · 반 약한 부분 · 교과 평어로 넘기기.
   채점을 마친 평가만 모음 */
import { toast, copyText, saveFile } from '../../../core/ui.js';
import * as ai from '../../../core/ai.js';
import { aiRowHTML } from '../../../core/ai-roles.js';
import { exportButton, exportDoc, downloadsButton } from '../../../core/doc-export.js';
import { studentTotal } from './unit-grade.js';
import {
  listTests, loadTests, graded, makeTitle, filterTests, summaryTable, studentHistory, itemStats, domainStats, reteach,
  levelOf, LEVEL_NAME, getPyeongeo, savePyeongeo
} from './unit-model.js';
import { tableDoc, tableCsv } from './unit-docs.js';
import { pyeongeoPrompt, normPyeongeo } from './unit-ai.js';
import { U, esc, AI_KEY, registerResults, visible, render, getBox } from './unit.js';

const R = { rv: 'table', subject: '', term: 0, stuNo: null, weakId: null, pySubject: null, pyRun: null };
const pct = r => `${Math.round(r * 100)}%`;
const doneTests = () => listTests().filter(s => s.done);
const loaded = list => loadTests(list);
const inView = () => visible() && U.view === 'results';
const fileName = s => s.replace(/[\\/:*?"<>|]/g, '_');
const copy = async text => toast((await copyText(text)) === false ? '복사하지 못했어요' : '복사했어요');

function filtersHTML(all) {
  const subs = [...new Set(all.map(s => s.subject).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'));
  const o = (v, l, cur) => `<option value="${esc(v)}"${String(cur) === String(v) ? ' selected' : ''}>${esc(l)}</option>`;
  return `<div class="row un-filters">
    <label class="cls-inline">교과 <select class="field" id="unFSubject">${o('', '전체', R.subject)}${subs.map(s => o(s, s, R.subject)).join('')}</select></label>
    <label class="cls-inline">학기 <select class="field" id="unFTerm">${o(0, '전체', R.term)}${o(1, '1학기', R.term)}${o(2, '2학기', R.term)}</select></label>
  </div>`;
}

/* ---------- 성적 일람표 ---------- */
function tableHTML(tests) {
  const tb = summaryTable(tests);
  const cell = v => (v == null ? '<td class="muted">-</td>' : `<td class="num">${v}</td>`);
  return `<div class="yp-card">
    <div class="row"><b>성적 일람표</b><span class="muted">100점으로 바꾼 점수</span><span class="grow"></span><button class="btn" type="button" data-un="csv">엑셀(CSV)</button>${exportButton('data-un="tableHwpx"')}${downloadsButton()}</div>
    <div class="un-grid-wrap"><table class="un-sumt"><thead><tr><th>번호</th>${tb.cols.map(c => `<th data-col="${esc(c.id)}" title="${esc(c.title)}">${esc(c.title)}</th>`).join('')}<th>평균</th></tr></thead>
    <tbody>${tb.rows.map(r => `<tr data-no="${r.no}"><th>${r.no}번</th>${tb.cols.map(c => cell(r.cells[c.id])).join('')}${cell(r.avg)}</tr>`).join('')}
    <tr class="avg"><th>반 평균</th>${tb.cols.map(c => cell(tb.colAvg[c.id])).join('')}<td></td></tr></tbody></table></div></div>`;
}

/* ---------- 학생별 누적 ---------- */
function studentText(no, h) {
  return [`[단원평가 누적] ${no}번`,
    ...h.rows.map(r => `- ${r.date} ${r.title}: ${r.score}/${r.total} (${r.pct}점, 반 평균 ${r.classAvg}점)`),
    `영역별 정답률: ${h.domains.map(d => `${d.name} ${pct(d.rate)}`).join(', ') || '없음'}`,
    `자주 틀린 평가 내용: ${h.weak.map(w => `${w.content}${w.pages ? `(${w.pages})` : ''}`).join(', ') || '없음'}`].join('\n');
}
function studentHTML(tests) {
  const nos = summaryTable(tests).rows.map(r => r.no);
  if (!nos.includes(R.stuNo)) R.stuNo = nos[0];
  const h = studentHistory(tests, R.stuNo);
  return `<div class="yp-card">
    <div class="row"><label class="cls-inline">학생 <select class="field" id="unStuNo">${nos.map(n => `<option value="${n}"${n === R.stuNo ? ' selected' : ''}>${n}번</option>`).join('')}</select></label><span class="grow"></span><button class="btn" type="button" data-un="stuCopy">복사</button></div>
    <div class="un-grid-wrap"><table class="un-hist cls-sum"><thead><tr><th>날짜</th><th>평가</th><th>점수</th><th>100점으로</th><th>반 평균</th></tr></thead>
    <tbody>${h.rows.map(r => `<tr><td>${esc(r.date)}</td><td>${esc(r.title)}</td><td class="num">${r.score}/${r.total}</td><td class="num">${r.pct}</td><td class="num">${r.classAvg ?? '-'}</td></tr>`).join('')}</tbody></table></div>
    <h3>영역별 정답률</h3><p style="margin:0">${h.domains.map(d => `<span class="chip">${esc(d.name)} ${pct(d.rate)}</span>`).join(' ') || '<span class="muted">없음</span>'}</p>
    <h3>자주 틀린 평가 내용</h3>${h.weak.length ? `<ol class="un-weaklist">${h.weak.map(w => `<li>${esc(w.content)} <span class="muted">잃은 점수 ${w.lost}${w.pages ? ` · ${esc(w.pages)}` : ''}</span></li>`).join('')}</ol>` : '<p class="muted" style="margin:0">없어요</p>'}
  </div>`;
}

/* ---------- 반 약한 부분 ---------- */
function weakHTML(tests) {
  const byDate = tests.slice().sort((a, b) => String(b.meta.date).localeCompare(String(a.meta.date)));
  if (!byDate.some(t => t.id === R.weakId)) R.weakId = byDate[0].id;
  const t = byDate.find(x => x.id === R.weakId);
  const stats = itemStats(t).sort((a, b) => a.rate - b.rate), re = reteach(t);
  return `<div class="yp-card">
    <label class="cls-inline">평가 <select class="field" id="unWeakTest">${byDate.map(x => `<option value="${esc(x.id)}"${x.id === t.id ? ' selected' : ''}>${esc(makeTitle(x.meta))}</option>`).join('')}</select></label>
    <h3>다시 가르칠 내용</h3>${re.length ? `<ul class="un-weaklist">${re.map(x => `<li><b>${x.no}번</b> ${esc(x.content)} <span class="muted">정답률 ${pct(x.rate)}${x.pages ? ` · ${esc(x.pages)}` : ''}</span></li>`).join('')}</ul>` : '<p class="muted" style="margin:0">정답률이 60%보다 낮은 문항이 없어요.</p>'}
    <h3>영역별 정답률</h3><p style="margin:0">${domainStats([t]).map(d => `<span class="chip">${esc(d.name)} ${pct(d.rate)}</span>`).join(' ') || '<span class="muted">없음</span>'}</p>
    <h3>문항별 정답률</h3>
    <div class="un-grid-wrap"><table class="un-weak cls-sum"><thead><tr><th>문항</th><th>평가 내용</th><th>영역</th><th>정답률</th><th>많이 쓴 오답</th></tr></thead>
    <tbody>${stats.map(x => `<tr data-rate="${x.rate.toFixed(4)}"><td>${x.no}번</td><td>${esc(x.content)}</td><td>${esc(x.domain)}</td><td class="num">${pct(x.rate)}</td><td>${x.wrong.map(w => `${esc(w.answer)} (${w.count}명)`).join(', ')}</td></tr>`).join('')}</tbody></table></div>
  </div>`;
}

/* ---------- 교과 평어로 넘기기 ---------- */
function pyState(all) {
  const subs = [...new Set(all.map(t => t.meta.subject).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'));
  if (!subs.includes(R.pySubject)) R.pySubject = subs[0] || null;
  const mine = all.filter(t => t.meta.subject === R.pySubject);
  const saved = R.pySubject ? getPyeongeo(R.pySubject) : null;
  const ids = mine.map(t => t.id).filter(id => !(saved && saved.off.includes(id)));
  const chosen = mine.filter(t => ids.includes(t.id));
  const nos = [...new Set(chosen.flatMap(t => graded(t).map(s => s.no)))].sort((a, b) => a - b);
  const students = nos.map(no => {
    const ps = chosen.map(t => { const s = graded(t).find(x => x.no === no); return s ? studentTotal(t, s).pct : null; }).filter(v => v != null);
    const avg = ps.length ? Math.round(ps.reduce((a, b) => a + b, 0) / ps.length * 10) / 10 : 0;
    const sv = (saved && saved.students[no]) || {};
    return { no, avg, level: sv.manual ? sv.level : levelOf(avg, saved ? saved.cuts : undefined), manual: !!sv.manual, text: sv.text || '' };
  });
  return { subs, mine, saved, ids, chosen, students };
}
function savePy(st, patch = {}) {
  const v = { off: st.mine.map(t => t.id).filter(id => !st.ids.includes(id)), cuts: st.saved.cuts, students: Object.fromEntries(st.students.map(s => [s.no, { level: s.level, text: s.text, manual: s.manual }])), ...patch };
  savePyeongeo(R.pySubject, v);
}
function pyHTML(all) {
  const st = pyState(all);
  if (!st.subs.length) return '';
  const c = st.saved.cuts;
  const lvSel = s => `<select class="field" data-pylv="${s.no}" aria-label="${s.no}번 수준">${Object.entries(LEVEL_NAME).map(([k, l]) => `<option value="${k}"${k === s.level ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
  return `<div class="yp-card">
    <div class="row"><label class="cls-inline">교과 <select class="field" id="unPySubject">${st.subs.map(s => `<option value="${esc(s)}"${s === R.pySubject ? ' selected' : ''}>${esc(s)}</option>`).join('')}</select></label></div>
    <div class="un-pytests">${st.mine.map(t => `<label class="cls-inline"><input type="checkbox" data-pytest="${esc(t.id)}"${st.ids.includes(t.id) ? ' checked' : ''}>${esc(makeTitle(t.meta))}</label>`).join('')}</div>
    <div class="row"><span class="muted">수준 기준(평균 점수)</span>
      <label class="cls-inline">최상 <input class="field num" type="number" id="unCutTop" min="0" max="100" value="${c.top}"></label>
      <label class="cls-inline">상 <input class="field num" type="number" id="unCutHigh" min="0" max="100" value="${c.high}"></label>
      <label class="cls-inline">중 <input class="field num" type="number" id="unCutMid" min="0" max="100" value="${c.mid}"></label><span class="muted">이상</span></div>
    ${aiRowHTML('writing')}
    <div class="row"><button class="btn primary" type="button" data-un="pyAI"${R.pyRun ? ' disabled' : ''}>${R.pyRun ? '<span class="spin"></span>쓰는 중…' : '평어 쓰기'}</button><button class="btn" type="button" data-un="pyCopyAll">모두 복사</button>
      <span class="muted">AI에는 번호·수준·평가 내용만 보내요. 점수와 이름은 보내지 않아요.</span></div>
    <ul class="un-pys">${st.students.map(s => `<li class="un-py"><div class="row"><b>${s.no}번</b><span class="muted">평균 ${s.avg}점</span>${lvSel(s)}<span class="grow"></span><button class="btn text" type="button" data-un="pyCopy" data-no="${s.no}">복사</button></div>
      <textarea class="field" data-py="${s.no}" rows="2" placeholder="[평어 쓰기]를 누르거나 직접 써요">${esc(s.text)}</textarea></li>`).join('')}</ul>
  </div>`;
}
/* 잘한·보완할 평가 내용: 고른 평가의 문항을 평가 내용으로 묶어 정답률 */
function contentRates(tests, no) {
  const m = new Map();
  for (const t of tests) {
    const s = graded(t).find(x => x.no === no);
    if (!s) continue;
    for (const it of t.key.items) {
      const v = m.get(it.content) || [0, 0];
      v[0] += Number(s.items[it.no] && s.items[it.no].pts) || 0; v[1] += Number(it.points) || 0;
      m.set(it.content, v);
    }
  }
  return [...m].filter(([, v]) => v[1]).map(([content, v]) => ({ content, rate: v[0] / v[1] }));
}
async function writePyeongeo() {
  if (R.pyRun) return;
  if (!ai.ready()) { toast(AI_KEY, 5000); return; }
  const subject = R.pySubject, st = pyState(loaded(doneTests()));
  const todo = st.students.filter(s => !s.text);
  if (!todo.length) { toast('모두 썼어요. 다시 쓰려면 칸을 비우고 눌러요.'); return; }
  R.pyRun = subject; refreshView();
  try {
    for (let i = 0; i < todo.length; i += 10) {
      const chunk = todo.slice(i, i + 10).map(s => {
        const rates = contentRates(st.chosen, s.no);
        return { no: s.no, level: s.level, good: rates.filter(r => r.rate >= 0.8).sort((a, b) => b.rate - a.rate).slice(0, 3).map(r => r.content), weak: rates.filter(r => r.rate < 0.6).sort((a, b) => a.rate - b.rate).slice(0, 3).map(r => r.content) };
      });
      const res = normPyeongeo(await ai.generateJSON(pyeongeoPrompt(subject, chunk), { task: 'writing', valid: v => Object.keys(normPyeongeo(v)).length > 0 }));
      const cur = getPyeongeo(subject), now = pyStateFor(subject);
      for (const s of now.students) if (res[s.no] && !s.text) s.text = res[s.no];
      savePyeongeo(subject, { off: now.mine.map(t => t.id).filter(id => !now.ids.includes(id)), cuts: cur.cuts, students: Object.fromEntries(now.students.map(s => [s.no, { level: s.level, text: s.text, manual: s.manual }])) });
    }
  } catch (e) {
    toast(e && e.code === 'bad_json' ? 'AI 답을 읽지 못했어요. 다시 해 보세요.' : ai.errorMessage(e && e.code, e), 6000);
  } finally { R.pyRun = null; refreshView(); }
}
/* AI가 끝났을 때: 그사이 다른 교과를 봐도 시작한 교과의 상태로 저장 */
function pyStateFor(subject) { const keep = R.pySubject; R.pySubject = subject; const st = pyState(loaded(doneTests())); R.pySubject = keep; return st; }
const refreshView = () => { if (inView()) render(); };

function html() {
  const all = doneTests(), list = filterTests(all, { subject: R.subject, term: R.term }), tests = loaded(list);
  const seg = `<div class="seg un-rseg" role="group" aria-label="결과 보기">${[['table', '성적 일람표'], ['student', '학생별 누적'], ['weak', '반 약한 부분'], ['pyeongeo', '교과 평어로 넘기기']].map(([k, l]) => `<button type="button" data-rv="${k}" aria-pressed="${R.rv === k}">${l}</button>`).join('')}</div>`;
  let body;
  if (R.rv === 'pyeongeo') body = all.length ? pyHTML(loaded(all)) : '';
  else if (!tests.length) body = '';
  else body = R.rv === 'student' ? studentHTML(tests) : R.rv === 'weak' ? weakHTML(tests) : tableHTML(tests);
  if (!body) body = '<div class="yp-card"><p class="muted" style="margin:0">마친 단원평가가 없어요. 평가 목록에서 채점을 마치면 여기에 모여요. 바로 보려면 [예시로 채우기].</p></div>';
  return `<div class="un-results">${R.rv === 'pyeongeo' ? '' : filtersHTML(all)}${seg}${body}</div>`;
}
registerResults({ html });

async function download(kind) {
  const tests = loaded(filterTests(doneTests(), { subject: R.subject, term: R.term }));
  const tb = summaryTable(tests), base = fileName(`${R.subject || '전체'} 단원평가 성적 일람표`);
  try {
    if (kind !== 'csv') { toast(await exportDoc(tableDoc(base, tb), base), 6000); return; }
    toast(`저장했어요: ${await saveFile(base + '.csv', new TextEncoder().encode(tableCsv(tb)), 'text/csv')}`);
  } catch (e) { toast('파일을 저장하지 못했어요', 5000); }
}

document.addEventListener('click', e => {
  const box = getBox();
  if (!box || !box.contains(e.target) || !inView()) return;
  const v = e.target.closest('[data-rv]');
  if (v) { R.rv = v.dataset.rv; render(); return; }
  const b = e.target.closest('[data-un]'), a = b && b.dataset.un;
  if (a === 'csv' || a === 'tableHwpx') download(a === 'csv' ? 'csv' : 'hwpx');
  else if (a === 'stuCopy') copy(studentText(R.stuNo, studentHistory(loaded(filterTests(doneTests(), { subject: R.subject, term: R.term })), R.stuNo)));
  else if (a === 'pyAI') writePyeongeo();
  else if (a === 'pyCopy') { const s = pyState(loaded(doneTests())).students.find(x => x.no === Number(b.dataset.no)); if (s) copy(s.text); }
  else if (a === 'pyCopyAll') copy(pyState(loaded(doneTests())).students.filter(s => s.text).map(s => `${s.no}번\t${s.text}`).join('\n'));
});
document.addEventListener('change', e => {
  const box = getBox();
  if (!box || !box.contains(e.target) || !inView()) return;
  const el = e.target;
  if (el.id === 'unFSubject') { R.subject = el.value; render(); }
  else if (el.id === 'unFTerm') { R.term = Number(el.value); render(); }
  else if (el.id === 'unStuNo') { R.stuNo = Number(el.value); render(); }
  else if (el.id === 'unWeakTest') { R.weakId = el.value; render(); }
  else if (el.id === 'unPySubject') { R.pySubject = el.value; render(); }
  else {
    const st = pyState(loaded(doneTests()));
    if (!R.pySubject) return;
    if (el.dataset.pytest) {
      const ids = new Set(st.ids); if (el.checked) ids.add(el.dataset.pytest); else ids.delete(el.dataset.pytest);
      savePy({ ...st, ids: st.mine.map(t => t.id).filter(id => ids.has(id)) }); render();
    } else if (['unCutTop', 'unCutHigh', 'unCutMid'].includes(el.id)) {
      const k = { unCutTop: 'top', unCutHigh: 'high', unCutMid: 'mid' }[el.id];
      const cuts = { ...st.saved.cuts, [k]: Math.max(0, Math.min(100, Number(el.value) || 0)) };
      savePy({ ...st, students: st.students.map(s => (s.manual ? s : { ...s, level: levelOf(s.avg, cuts) })) }, { cuts }); render();
    } else if (el.dataset.pylv) {
      const s = st.students.find(x => x.no === Number(el.dataset.pylv)); if (s) { s.level = el.value; s.manual = true; savePy(st); }
    } else if (el.dataset.py) {
      const s = st.students.find(x => x.no === Number(el.dataset.py)); if (s) { s.text = el.value.trim(); savePy(st); }
    }
  }
});
