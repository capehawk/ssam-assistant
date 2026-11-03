/* 평가 › 활동지 3단계(학생 활동지 올리기)·4단계(채점·확인) (스펙 4.3·4.4).
   스캔 쪽은 이 화면에만 두고 저장하지 않음. 채점은 시작한 활동지 id를 붙들고, 결과는 그 활동지를 다시 읽어 넣음. 학생은 번호만 */
import * as ai from '../../../core/ai.js';
import * as store from '../../../core/store.js';
import { toast } from '../../../core/ui.js';
import { aiRowHTML, pick } from '../../../core/ai-roles.js';
import { reviewJSON, opinionHTML, REVIEW_FAIL } from '../../../core/ai-review.js';
import { runPool } from '../../../core/ai-pool.js';
import { newMeter, useText } from '../../../core/ai-wire.js';
import { readBundle, openBundleCard, needsCard, bundleBoxHTML, onBundle, bundleMsg } from '../../../core/bundle.js';
import { readNos, openNoCheck, openNoWait, rosterAllowed, byNoOrder } from '../../../core/student-no.js';
import { numbersFor, parseNos, renumber } from '../unit/unit-model.js';
import { arrangePages } from '../unit/unit-pages.js';
import { go } from '../../../core/shell.js';
import { getActivity, getSet, saveSet, listActivities } from './activity-model.js';
import { gradeParts, validGrade, normGrade, judgeCell, reviewParts, normReview, MARK, LEVEL } from './activity-ai.js';
import { A, registerStep, curAct, commitAct, refresh, render, goStep, esc, SS, getBox, visible, openActivity } from './activity.js';

/* 세션 상태: 올린 학생 쪽은 한 활동지에만 붙음. idx[i] = i번째 학생의 쪽 번호들. 채점은 한 번에 한 활동지만 */
/* raw: 올린 학생 쪽(정리 전), pages: 모아찍기·뒷면을 정리한 쪽 */
// usedNow: 이 화면을 켠 뒤 채점한 활동지(사용량 줄 앞에 「지난 채점」을 붙이지 않음)
const G = { id: null, raw: [], pages: [], idx: [], run: null, running: new Map(), nosOk: false, usedNow: new Set() };
const MARKS = Object.keys(MARK);
const rosterExcept = () => (store.get('class', null) || {}).except || [];
const fresh = no => ({ no, skip: false, status: 'idle', marks: {}, good: '', next: '', level: '', levelWhy: '' });
const busy = id => !!G.run && G.run.id === id;
const maskOf = a => { const set = getSet(); return { on: set.maskOn !== false, mask: (a && a.mask && a.mask.length ? a.mask : set.mask) || [], all: a && a.mask && a.mask.length ? !!a.maskAll : !!set.maskAll }; };
const pagesFor = (a, i) => (G.id === a.id && G.idx[i]) || [];

/* ---------- 3단계: 올리기 ---------- */
function split(a, n, per) {
  G.idx = Array.from({ length: n }, (_, i) => Array.from({ length: Math.min(per, G.pages.length - i * per) }, (_, j) => i * per + j));
  if (a.students.length !== n) a.students = numbersFor(n, [...rosterExcept(), ...(a.absent || [])]).map(fresh);
}
/* onCancel: 학생 수가 달라 묻는 창을 닫으면(새로 나누지 않음) 부름 */
export function loadPages(id, pages, raw = pages, onCancel = null) {
  const a = id === (curAct() && curAct().id) ? curAct() : getActivity(id);
  if (!a || !pages.length) return;
  if (busy(id)) { toast('채점하는 중이에요. 끝나거나 멈춘 뒤에 다시 올려 주세요.', 5000); return; }
  const per = Math.max(1, getSet().pagesPer | 0), n = Math.ceil(pages.length / per);
  const apply = () => {
    // 정리 전 쪽과 정리한 쪽은 같은 것을 함께 쓸 수 있어, 새로 쓰는 쪽은 남기고 버림
    const keep = new Set([...pages, ...raw]);
    if (G.id && G.pages !== pages) SS().files.freePages([...G.pages, ...G.raw].filter(p => !keep.has(p)));
    G.id = id; G.pages = pages; G.raw = raw; G.nosOk = false;
    split(a, n, per);
    commitAct(a); refresh(id);
  };
  if (a.students.length && a.students.length !== n && a.students.some(s => s.status === 'done')) {
    let ok = false;
    SS().openSheet(`<h3>학생 수가 달라요</h3><p class="muted" style="margin:0">채점한 학생은 ${a.students.length}명인데 새 스캔은 ${n}명이에요. 새로 나누면 채점한 결과가 지워져요.</p>
      <div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-close>취소</button><button class="btn primary" type="button" id="acRedoOk">새로 나누기</button></div>`,
    sh => sh.querySelector('#acRedoOk').addEventListener('click', () => { ok = true; a.students = []; SS().closeSheet(); apply(); }));
    const root = document.getElementById('sheetRoot');
    if (onCancel && root) { const obs = new MutationObserver(() => { if (!root.querySelector('#acRedoOk')) { obs.disconnect(); if (!ok) onCancel(); } }); obs.observe(root, { childList: true, subtree: true }); }
    return;
  }
  apply();
}
/* 모아찍기(한 면에 2쪽)는 왼쪽·오른쪽으로 자르고, 양면 스캔의 거꾸로 나온 뒷면은 돌림(단원평가와 같은 정리) */
const arrange = raw => { const s = getSet(); return arrangePages(raw, { twoUp: !!s.twoUp, flipBack: !!s.flipBack }); };
async function placeScans(id, raw) {
  let pages;
  try { pages = await arrange(raw); } catch (e) { toast('스캔을 나누지 못했어요. 다시 올려 주세요.', 5000); return; }
  loadPages(id, pages, raw);
}
async function putScans(files) {
  const a0 = curAct();
  if (!a0) return;
  const id = a0.id;
  bundleMsg('act3', '읽는 중…');
  let b;
  try { b = await readBundle(files, { say: m => bundleMsg('act3', m), mask: maskOf(a0).mask, expect: 'student' }); }
  catch (e) { bundleMsg('act3', ''); toast(e && e.message === 'PDFJS' ? 'PDF를 읽는 도구를 불러오지 못했어요. 인터넷 연결을 확인하거나 사진으로 올려 주세요.' : '파일을 읽지 못했어요.', 6000); return; }
  bundleMsg('act3', '');
  if (needsCard(b)) { const r = await openBundleCard(b, { what: '학생 활동지' }); if (!r) { SS().files.freePages(b.pages); return; } b = r; }
  const crit = [], stu = [];
  b.pages.forEach((p, i) => (b.roles[i] === 'student' ? stu : crit).push(p));
  if (crit.length) { if (A.critFor !== id) { SS().files.freePages(A.critPages); A.critPages = []; } A.critFor = id; A.critPages = [...A.critPages, ...crit]; }
  if (!stu.length) { toast('학생 쪽이 없어요. 정답·교사용 쪽은 기준 그림으로 넣었어요.', 6000); return; }
  await placeScans(id, stu);
}
onBundle('act3', files => { if (A.view === 'act' && A.step === 3) putScans(files); });
/* 떠 있는 버튼의 학생 답안 스캔 → 「활동지 채점」(단원평가 받는 곳이 SSAM.activityInbox로 부름): 기준을 확정하고 아직 확정(마침)하지 않은 활동지,
   늦은 것 먼저. 예시 활동지는 그것만 있을 때만. 고르면 그 활동지 3단계에 스캔을 넣음(이름 칸·학생 나눔을 보고 채점) */
function gradable() {
  const l = listActivities().filter(s => !s.done).map(s => getActivity(s.id)).filter(a => a && a.confirmed && a.items.length), real = l.filter(a => !a.meta.sample);
  return real.length ? real : l;
}
SS().activityInbox = {
  list: () => gradable().map(a => [a.id, [a.meta.title || '활동지', a.meta.subject, a.meta.date, a.students.some(s => s.status === 'done') ? `${a.students.filter(s => s.status === 'done').length}명 채점함` : '채점 전'].filter(Boolean).join(' · ')]),
  async put(id, files) {
    if (!getActivity(id)) return '그 활동지를 찾지 못했어요.';
    if (busy(id)) return '그 활동지를 채점하는 중이에요. 끝난 뒤에 다시 넣어 주세요.';
    go('evaluate', 'activity');
    openActivity(id, 3);
    await putScans(files);
    return '';
  }
};

function openMask(a) {
  const shots = a.students.map((s, i) => ({ s, pg: pagesFor(a, i) })).filter(x => !x.s.skip && x.pg.length).map(x => ({ url: G.pages[x.pg[0]].url, label: `${x.s.no}번 첫 쪽` }));
  if (!shots.length || !SS().openMaskEditor) { toast('학생 활동지를 먼저 올려 주세요.'); return; }
  const m = maskOf(a);
  SS().openMaskEditor({ shots, mask: m.mask, all: m.all, what: '활동지', save: (mask, all) => {
    const a2 = getActivity(a.id) || a;
    a2.mask = mask; a2.maskAll = all; commitAct(a2);
    saveSet({ ...getSet(), mask, maskAll: all });
    render();
  } });
}
function openNoBox(a, then) {
  const shots = a.students.map((s, i) => ({ s, pg: pagesFor(a, i) })).filter(x => x.pg.length).map(x => ({ url: G.pages[x.pg[0]].url, label: `${x.s.no}번 첫 쪽` }));
  if (!shots.length || !SS().openMaskEditor) return;
  SS().openMaskEditor({ kind: 'no', shots, mask: a.noBox ? [a.noBox] : [], all: false, what: '활동지', save: mask => {
    const a2 = getActivity(a.id) || a;
    if (mask.length) a2.noBox = mask[mask.length - 1]; else delete a2.noBox;
    commitAct(a2); render();
    if (then && a2.noBox) then();
  } });
}
/* 적힌 번호로 학생 맞추기: 번호 칸만 읽어 확인 표 → 번호 차례로 학생·쪽을 늘어놓음 */
async function matchNos(a, then) {
  if (!a.noBox) { toast('학생이 번호를 쓰는 칸을 먼저 정해 주세요.', 5000); openNoBox(a, () => matchNos(getActivity(a.id), then)); return; }
  const list = a.students.map((s, i) => ({ i, pg: pagesFor(a, i) })).filter(x => x.pg.length && !a.students[x.i].skip);
  if (!list.length) return;
  const pages0 = G.pages, wait = openNoWait();
  let r;
  try { r = await readNos(list.map(x => G.pages[x.pg[0]]), { box: a.noBox, mask: maskOf(a).on ? maskOf(a).mask : [], signal: wait.signal }); }
  catch (e) { if (wait.gone()) return; wait.close(); toast(e && e.code === 'NO_AI' ? '설정 › AI에서 키를 넣어 주세요' : ai.errorMessage(e && e.code, e), 6000); return; }
  if (wait.gone() || G.pages !== pages0) return;
  openNoCheck({ rows: list.map((x, k) => ({ crop: r.crops[k], ...r.nos[k] })), allowed: rosterAllowed(), onOk: nos => {
    const a2 = getActivity(a.id) || a, order = byNoOrder(nos), inList = new Set(list.map(x => x.i));
    const rest = a2.students.map((s, i) => ({ s, i })).filter(x => !inList.has(x.i));
    a2.students = [...order.map(k => ({ ...a2.students[list[k].i], no: nos[k] })), ...rest.map(x => x.s)];
    G.idx = [...order.map(k => G.idx[list[k].i]), ...rest.map(x => G.idx[x.i] || [])];
    G.nosOk = true; commitAct(a2); refresh(a.id); then();
  } });
}

function step3HTML(a) {
  const set = getSet(), m = maskOf(a), mine = G.id === a.id && G.pages.length;
  const n = a.students.filter(s => !s.skip).length;
  return `<div class="yp-card"><h3>학생 활동지</h3>
      ${bundleBoxHTML('act3', '반 전체 스캔 PDF·사진을 넣어요. 정답·교사용·빈 활동지 쪽이 섞여 있으면 알아서 나눠요')}
      <div class="act-set">
        <label class="yp-f"><span class="lab">학생당 쪽 수</span><input class="field" type="number" id="acPer" min="1" max="6" value="${Math.max(1, set.pagesPer | 0)}"></label>
        <label class="switch"><input type="checkbox" id="acTwoUp"${set.twoUp ? ' checked' : ''}>모아찍기(한 면에 2쪽)</label>
        <label class="switch"><input type="checkbox" id="acFlipBack"${set.flipBack ? ' checked' : ''}>양면 스캔 뒷면이 거꾸로</label>
        <label class="switch"><input type="checkbox" id="acMaskOn"${m.on ? ' checked' : ''}>이름 칸 가리기</label>
        <button class="btn text" type="button" data-ac="mask">이름 칸 정하기</button><span class="muted">${m.mask.length ? '정해 둠' : '아직 정하지 않음'}</span>
        <label class="switch"><input type="checkbox" id="acByNo"${a.byNo ? ' checked' : ''}>적힌 번호로 학생 맞추기</label>
        ${a.byNo ? `<button class="btn text" type="button" data-ac="noBox">번호 칸 정하기</button>` : ''}
      </div>
      ${a.byNo ? '' : `<div class="row"><label class="cls-inline">결석 번호 <input class="field" id="acAbsent" value="${esc((a.absent || []).join(', '))}" placeholder="예: 5, 12" aria-describedby="acAbsentNote"></label>
        <span class="muted" id="acAbsentNote">활동지를 내지 않은 학생 번호를 적으면 그 번호를 건너뛰고 뒤 번호가 한 칸씩 밀려요.</span></div>`}
      <p class="muted" id="acStus">${mine ? `쪽 ${G.pages.length}장 · 학생 ${n}명` : a.students.length ? `학생 ${n}명 · 스캔은 이 화면에만 있어서, 채점하려면 다시 올려 주세요` : '아직 올린 학생 활동지가 없어요.'}</p>
      ${a.students.length ? `<ul class="ac-stus">${a.students.map((s, i) => `<li><label><input type="checkbox" data-skip="${i}"${s.skip ? '' : ' checked'}> ${s.no}번</label></li>`).join('')}</ul>` : ''}
    </div>
    <div class="row act-next"><button class="btn primary" type="button" data-ac="toGrade"${a.students.length ? '' : ' disabled'}>다음: 채점</button></div>`;
}
registerStep(3, {
  html: step3HTML,
  bind: (box, a) => { if (A.pending && A.pending.id === a.id) { const p = A.pending.pages; A.pending = null; setTimeout(() => placeScans(a.id, p), 0); } }
});

/* ---------- 4단계: 채점 ---------- */
async function imagesFor(a, i) {
  const m = maskOf(a), pg = pagesFor(a, i), out = [];
  for (let j = 0; j < pg.length; j++) out.push(await SS().files.pageImage(G.pages[pg[j]], m.on && m.mask.length && (m.all || j === 0) ? m.mask : null));
  return out;
}
const STOP = ['auth', 'quota'];
async function gradeOne(id, i, meter) {
  const a0 = getActivity(id), no = a0 && a0.students[i] && a0.students[i].no;
  if (no == null) return;
  const ctrl = new AbortController();
  G.running.set(i, ctrl); refresh(id);
  try {
    const images = await imagesFor(a0, i);
    if (!images.length) throw { code: 'no_scan' };
    // 공통(지시·문항과 기준)을 앞에 두어 학생마다 캐시 → 학생 그림 → 학생 글
    const parts = gradeParts(a0, images.length);
    const v = await ai.generateJSON(parts.own, { shared: { text: parts.shared }, images, signal: ctrl.signal, valid: validGrade, task: 'grade', meter });
    const r = normGrade(v, a0.items);
    const a = getActivity(id), s = a && a.students[i];
    if (!s || s.no !== no) return;
    // 선생님이 고친 칸은 그대로
    s.marks = Object.fromEntries(a.items.map(it => { const old = s.marks && s.marks[it.no]; return [it.no, old && old.manual ? old : judgeCell(it, r.marks[it.no])]; }));
    s.good = r.good; s.next = r.next;
    if (!s.levelManual) { s.level = r.level; s.levelWhy = r.levelWhy; }
    s.status = 'done'; s.stale = false; s.err = ''; delete s.rvErr;
    commitAct(a); refresh(id);
    await reviewOne(id, i, no, images, ctrl.signal, meter);
  } catch (e) {
    if (ctrl.signal.aborted) return;
    // AI 한도: 실패로 두지 않고 풀이 다시 줄에 넣고 쉬었다가 이어 감
    if (e && e.code === 'rate_limited' && G.run && G.run.id === id && !G.run.stop) return 'rate';
    const a = getActivity(id), s = a && a.students[i];
    const why = e && e.code === 'no_scan' ? '스캔이 없어요. 3단계에서 다시 올려 주세요' : e && e.code === 'bad_json' ? 'AI 답을 읽지 못했어요' : ai.errorMessage(e && e.code, e);
    if (s && s.no === no) { s.status = 'error'; s.err = why; commitAct(a); }
    if (e && STOP.includes(e.code) && G.run && G.run.id === id && !G.run.stop) {
      G.run.stop = true; G.run.queue = [];
      toast(`채점을 멈췄어요. ${why} 남은 학생은 [채점 시작]으로 이어서 해요.`, 9000);
    }
  } finally { if (G.running.get(i) === ctrl) G.running.delete(i); refresh(id); }
}
/* 검토 AI(업무별 AI 「채점」 검토): 노란 칸만 같은 그림으로 다시 봄. 다르면 칸에 rv(두 의견) */
async function reviewOne(id, i, no, images, signal, meter) {
  if (!pick('grade', 'review')) return;
  const a = getActivity(id), s = a && a.students[i];
  if (!s) return;
  const cells = a.items.filter(it => s.marks[it.no] && s.marks[it.no].chk && !s.marks[it.no].manual).map(it => ({ no: it.no, ...s.marks[it.no] }));
  if (!cells.length) return;
  const parts = reviewParts(a, cells);
  const v = await reviewJSON('grade', parts.own, { shared: { text: parts.shared }, images, signal, valid: x => Array.isArray(x) || !!(x && Array.isArray(x.items)), meter });
  if (!v) return;
  const a2 = getActivity(id), s2 = a2 && a2.students[i];
  if (!s2 || s2.no !== no) return;
  if (v.error) { s2.rvErr = 1; commitAct(a2); refresh(id); return; }
  for (const r of normReview(v, cells.map(c => c.no))) { const c = s2.marks[r.no]; if (c && r.mark !== c.mark) c.rv = { mark: r.mark, why: r.why }; }
  commitAct(a2); refresh(id);
}
async function gradeAll(id) {
  const a = getActivity(id);
  if (!a || busy(id)) return;
  if (G.id !== id || !G.pages.length) { toast('스캔이 없어요. 3단계에서 학생 활동지를 올려 주세요.', 5000); return; }
  if (!ai.ready()) { toast('설정 › AI에서 키를 넣어 주세요', 5000); return; }
  const m = maskOf(a);
  if (m.on && !m.mask.length) { toast('이름 칸을 먼저 정해 주세요(가리지 않으려면 3단계에서 「이름 칸 가리기」를 꺼요).', 6000); openMask(a); return; }
  if (a.byNo && !G.nosOk) { matchNos(a, () => gradeAll(id)); return; }
  const queue = a.students.map((s, i) => ({ s, i })).filter(x => !x.s.skip && (x.s.status !== 'done' || x.s.stale)).map(x => x.i);
  if (!queue.length) { toast('채점할 학생이 없어요. 고칠 칸을 눌러 바꿀 수 있어요.', 5000); return; }
  // 이 채점만의 표: 멈춘 앞 채점의 일꾼이 늦게 돌아와도 새 채점의 학생을 가져가거나 새 채점을 끝내지 않게
  const run = G.run = { id, queue, stop: false, wait: false }, meter = newMeter(), acc = ai.isAccount();
  refresh(id);
  // 처음 3명(Claude 계정은 2명), 잘되면 4명까지, 한도면 줄이고 20초 쉬었다가 이어 감(스펙 2026-11-03 4장)
  const r = await runPool(run, i => (G.run === run ? gradeOne(id, i, meter) : null), { start: acc ? 2 : 3, max: acc ? 2 : 4, onWait: on => { run.wait = on; refresh(id); } });
  if (r.gaveUp && G.run === run) toast(`채점을 멈췄어요. ${ai.errorMessage('rate_limited')} 남은 학생은 [채점 시작]으로 이어서 해요.`, 9000);
  const tot = meter.total(), a2 = getActivity(id);
  if (a2 && (tot.sent || tot.out)) { a2.aiUse = { at: Date.now(), ...tot }; G.usedNow.add(id); commitAct(a2); }
  if (G.run === run) G.run = null;
  refresh(id);
}
function stopGrading() {
  if (!G.run) return;
  G.run.stop = true; G.run.queue = [];
  for (const c of G.running.values()) c.abort();
  G.running.clear(); G.run = null; render();
}

const cellBtn = (s, it) => {
  if (s.status !== 'done') return '<td class="ac-c">-</td>';
  const c = (s.marks && s.marks[it.no]) || {};
  return `<td class="ac-c"><button type="button" class="ac-cell mark-${c.mark || 'none'}${c.chk ? ' chk' : ''}${c.rv ? ' rv' : ''}${c.manual ? ' manual' : ''}" data-cell="${s.no}|${it.no}" title="${esc([c.read, c.why].filter(Boolean).join(' · '))}" aria-label="${s.no}번 ${it.no}번 ${MARK[c.mark] || '표시 없음'}">${MARK[c.mark] || '?'}</button></td>`;
};
function step4HTML(a) {
  const running = busy(a.id), ready = G.id === a.id && G.pages.length > 0;
  const done = a.students.filter(s => s.status === 'done').length, todo = a.students.filter(s => !s.skip && (s.status !== 'done' || s.stale)).length;
  const chk = a.students.reduce((n, s) => n + Object.values(s.marks || {}).filter(c => c.chk).length, 0);
  const rows = a.students.filter(s => !s.skip).map(s => {
    const i = a.students.indexOf(s), st = G.running.has(i) && busy(a.id) ? '<span class="spin"></span>' : s.status === 'error' ? `<span class="act-warn">${esc(s.err)}</span>` : '';
    return `<tr><td class="ac-no">${s.no}번${s.stale ? ' <span class="chip ac-stale">다시 채점</span>' : ''}${st}${s.rvErr ? `<span class="rv-fail">${REVIEW_FAIL}</span>` : ''}</td>${a.items.map(it => cellBtn(s, it)).join('')}
      <td><select class="field" data-level="${s.no}" aria-label="${s.no}번 수준"><option value="">-</option>${Object.entries(LEVEL).map(([k, l]) => `<option value="${k}"${s.level === k ? ' selected' : ''}>${l}</option>`).join('')}</select></td>
      <td><input class="field" data-good="${s.no}" value="${esc(s.good)}" aria-label="${s.no}번 잘한 점"></td><td><input class="field" data-next="${s.no}" value="${esc(s.next)}" aria-label="${s.no}번 더 해 볼 점"></td></tr>`;
  }).join('');
  return `<div class="yp-card"><h3>채점·확인</h3>${aiRowHTML('grade')}
      <div class="row"><button class="btn primary" type="button" data-ac="grade"${running || !ready ? ' disabled' : ''}>${done ? `남은 학생·다시 채점 (${todo}명)` : '채점 시작'}</button>${running ? `<button class="btn" type="button" data-ac="stop">멈추기</button><span class="muted"><span class="spin"></span> 채점하는 중…</span>${G.run && G.run.id === a.id && G.run.wait ? '<b class="warn">AI 한도에 걸려 잠깐 쉬어요</b>' : ''}` : ''}</div>
      ${a.aiUse && useText(a.aiUse) ? `<p class="muted" id="acAiUse">${G.usedNow.has(a.id) ? '' : '지난 채점 '}${esc(useText(a.aiUse))}</p>` : ''}
      ${!ready ? '<p class="muted">스캔이 이 화면에 없어요. 3단계에서 학생 활동지를 올리면 채점할 수 있어요. 채점한 결과는 그대로 고칠 수 있어요.</p>' : ''}
      ${chk ? `<p class="muted">노란 칸 ${chk}개는 AI가 확신하지 못했거나 앱 판정과 달라요. 눌러서 확인해 주세요.</p>` : ''}
      <div class="ac-grid-wrap"><table class="ac-grid" id="acGrid"><thead><tr><th>번호</th>${a.items.map(it => `<th title="${esc(it.ask)}">${it.no}</th>`).join('')}<th>수준</th><th>잘한 점</th><th>더 해 볼 점</th></tr></thead><tbody>${rows}</tbody></table></div>
    </div>
    <div class="row act-next"><button class="btn primary" type="button" data-ac="toResults"${done ? '' : ' disabled'}>다음: 결과</button></div>`;
}
registerStep(4, { html: step4HTML });

/* 칸 고치기: ○·△·×·안 함, 읽은 답. 검토 의견이 있으면 두 의견 */
function openCell(no, itemNo) {
  const a = curAct(), s = a && a.students.find(x => x.no === no), it = a && a.items.find(x => x.no === itemNo);
  if (!s || !it) return;
  const c = (s.marks && s.marks[itemNo]) || {};
  let sel = c.mark || '', rv = c.rv || null;
  SS().openSheet(`<div id="acCellSheet" class="ac-cell-sheet"><h3>${no}번 · ${itemNo}번 문항</h3>
      <p class="muted" style="margin:0">${esc(it.ask)} · ${['choice', 'match', 'short'].includes(it.type) ? '정답' : '예시'}: ${esc(it.answer || '-')}${it.ok ? ` · ○ 기준: ${esc(it.ok)}` : ''}</p>
      <label class="yp-f"><span class="lab">읽은 답</span><input class="field" id="acCellRead" value="${esc(c.read)}" autocomplete="off"></label>
      ${c.why ? `<p class="muted" style="margin:0">AI 까닭: ${esc(c.why)}</p>` : ''}
      <div id="acCellRv">${rv ? opinionHTML({ title: '검토 AI', main: MARK[c.mark] || '-', alt: MARK[rv.mark], why: rv.why, use: 'rv', keep: 'rv' }) : ''}</div>
      <div class="seg ac-marks" role="group" aria-label="표시">${MARKS.map(m => `<button type="button" data-set-mark="${m}" aria-pressed="${m === sel}">${MARK[m]}</button>`).join('')}</div>
      <div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-close>취소</button><button class="btn primary" type="button" id="acCellOk">저장</button></div></div>`, sh => {
    const press = () => sh.querySelectorAll('[data-set-mark]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.setMark === sel)));
    sh.addEventListener('click', e => {
      const b = e.target.closest('[data-set-mark]');
      if (b) { sel = b.dataset.setMark; press(); return; }
      if (e.target.closest('[data-rv-use]') && rv) { sel = rv.mark; rv = null; press(); sh.querySelector('#acCellRv').innerHTML = ''; return; }
      if (e.target.closest('[data-rv-keep]')) { rv = null; sh.querySelector('#acCellRv').innerHTML = ''; }
    });
    sh.querySelector('#acCellOk').addEventListener('click', () => {
      const a2 = curAct(), s2 = a2 && a2.students.find(x => x.no === no);
      if (!s2) return;
      const nc = { ...c, read: sh.querySelector('#acCellRead').value.trim().slice(0, 120), mark: sel, manual: true, chk: false };
      delete nc.rv;
      s2.marks = { ...s2.marks, [itemNo]: nc };
      commitAct(a2); SS().closeSheet(); render();
    });
  });
}

/* ---------- 누르기·입력 ---------- */
const mine = e => { const box = getBox(); return box && box.contains(e.target) && visible() && A.view === 'act' && (A.step === 3 || A.step === 4); };
document.addEventListener('click', e => {
  if (!mine(e)) return;
  const a = curAct();
  if (!a) return;
  const cell = e.target.closest('[data-cell]');
  if (cell) { const [no, it] = cell.dataset.cell.split('|').map(Number); openCell(no, it); return; }
  const b = e.target.closest('[data-ac]');
  if (!b) return;
  const act = b.dataset.ac;
  if (act === 'toGrade') goStep(4);
  else if (act === 'toResults') goStep(5);
  else if (act === 'mask') openMask(a);
  else if (act === 'noBox') openNoBox(a);
  else if (act === 'grade') gradeAll(a.id);
  else if (act === 'stop') stopGrading();
});
document.addEventListener('change', e => {
  if (!mine(e)) return;
  const a = curAct(), el = e.target;
  if (!a) return;
  if (el.id === 'acPer') {
    const prev = getSet().pagesPer;
    saveSet({ ...getSet(), pagesPer: Math.max(1, Math.min(6, Number(el.value) || 1)) });
    // 학생 수가 달라져 묻는 창을 닫으면 쪽 수도 그대로
    if (G.id === a.id && G.pages.length) loadPages(a.id, G.pages, G.raw, () => { saveSet({ ...getSet(), pagesPer: prev }); render(); });
  }
  else if (el.id === 'acTwoUp' || el.id === 'acFlipBack') {
    if (busy(a.id)) { toast('채점하는 중에는 바꿀 수 없어요.', 4000); render(); return; }
    // 쪽 모양·방향이 바뀌면 정해 둔 이름 칸 자리가 맞지 않아 이름이 AI로 갈 수 있음: 정한 칸(이 활동지·기본)은 지우고 다시 정하게
    const had = maskOf(a).mask.length;
    saveSet({ ...getSet(), [el.id === 'acTwoUp' ? 'twoUp' : 'flipBack']: el.checked, mask: [], maskAll: false });
    delete a.mask; delete a.maskAll;
    if (had) toast('쪽 모양이 바뀌어 이름 칸을 지웠어요. [이름 칸 정하기]로 다시 정해 주세요.', 6000);
    if (a.noBox) delete a.noBox;
    commitAct(a);
    if (G.id === a.id && G.raw.length) placeScans(a.id, G.raw); else render();
  }
  else if (el.id === 'acMaskOn') { saveSet({ ...getSet(), maskOn: el.checked }); render(); }
  else if (el.id === 'acByNo') { a.byNo = el.checked; G.nosOk = false; commitAct(a); render(); }
  else if (el.id === 'acAbsent') {
    // 쪽 차례(채점 결과)는 그대로 두고 번호만 다시 매김
    if (busy(a.id)) { toast('채점하는 중에는 바꿀 수 없어요.', 4000); render(); return; }
    a.absent = parseNos(el.value);
    if (a.students.length) renumber(a, rosterExcept());
    commitAct(a); render();
  }
  else if (el.dataset.skip != null) { const s = a.students[+el.dataset.skip]; if (s) { s.skip = !el.checked; commitAct(a); render(); } }
  else if (el.dataset.level) { const s = a.students.find(x => x.no === +el.dataset.level); if (s) { s.level = el.value; s.levelManual = true; commitAct(a); } }
});
document.addEventListener('input', e => {
  if (!mine(e)) return;
  const a = curAct(), el = e.target;
  if (!a) return;
  const no = +(el.dataset.good || el.dataset.next || 0);
  if (!no) return;
  const s = a.students.find(x => x.no === no);
  if (!s) return;
  if (el.dataset.good) s.good = el.value; else s.next = el.value;
  commitAct(a);
});
