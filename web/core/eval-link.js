/* 평가 영역 이음 (스펙 4.7): 단원평가·활동지를 평가계획의 평가 영역(평가요소)에 이어 두면, 평가지 채점(수행평가)이 그 영역 평어를 쓸 때 참고함.
   평가계획은 평가 › 교과 평어가 넣은 것(window.SSAM.planUnits). 저장은 이음만: { unitId, subject, label } */
const SS = () => (globalThis.window && window.SSAM) || {};
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* 지금 평가계획의 영역들 [{ id, subject, label }] (없으면 빈 목록) */
export function planUnits() {
  try { const f = SS().planUnits; const v = typeof f === 'function' ? f() : []; return Array.isArray(v) ? v : []; } catch (e) { return []; }
}
/* 이어 둔 영역 찾기: id가 같으면 그것, 평가계획을 다시 넣어 id가 바뀌었으면 교과·영역 이름이 같은 것 */
export function findUnit(link, units = planUnits()) {
  if (!link) return null;
  return units.find(u => u.id === link.unitId) || units.find(u => u.subject === link.subject && u.label === link.label) || null;
}
/* 「교과 평어에 참고하기」 스위치(기본 꺼짐). attr: 그 화면의 단추 속성 이름(data-ac·data-un) */
export function linkHTML(link, subject, attr) {
  const units = planUnits(), u = link ? findUnit(link, units) : null;
  const what = !link ? `<span class="muted">켜면 평가 › 평가지 채점(수행평가)에서 ${subject ? esc(subject) + ' ' : ''}그 영역 평어를 쓸 때 이 결과를 참고할 수 있어요.</span>`
    : u ? `<b>${esc(link.subject)} · ${esc(u.label)}</b>`
    : units.length ? '<span class="act-warn">이어 둔 영역을 찾지 못했어요 · 평가계획이 바뀌었으면 [바꾸기]로 다시 골라 주세요</span>'
    : `<b>${esc(link.subject)} · ${esc(link.label)}</b>`;
  return `<div class="el-box"><label class="switch"><input type="checkbox" ${attr}="link"${link ? ' checked' : ''}>교과 평어에 참고하기</label>${what}${link ? `<button class="btn text tiny" type="button" ${attr}="linkEdit">바꾸기</button>` : ''}</div>`;
}
/* 영역 고르기 창. 교과는 그 평가의 교과로 먼저 고름. save(link) — 취소하면 cancel() */
export function openLinkSheet({ subject = '', link = null, save, cancel = () => {} }) {
  const units = planUnits();
  if (!units.length) {
    SS().openSheet(`<div id="elSheet"><h3>평가계획이 없어요</h3><p class="muted" style="margin:0">평가 › 교과 평어에서 평가계획을 먼저 넣어 주세요. 그 평가 영역에 이어 둘 수 있어요.</p>
      <div class="row" style="justify-content:flex-end"><button class="btn primary" type="button" data-close>닫기</button></div></div>`);
    watchClose(cancel);
    return;
  }
  const subs = [...new Set(units.map(u => u.subject))];
  const cur = findUnit(link, units);
  let sub = (cur && cur.subject) || (subs.includes(subject) ? subject : subs[0]);
  const unitOpts = () => units.filter(u => u.subject === sub).map(u => `<option value="${esc(u.id)}"${cur && cur.id === u.id ? ' selected' : ''}>${esc(u.label)}</option>`).join('');
  let done = false;
  SS().openSheet(`<div id="elSheet" class="el-sheet"><h3>교과 평어에 참고하기</h3>
      <p class="muted" style="margin:0">이 결과를 참고할 평가 영역을 골라요. 평가지 채점에서 그 영역을 고르면 목록에 나와요(체크해야 평어에 써요).</p>
      <label class="yp-f"><span class="lab">교과</span><select class="field" id="elSubject">${subs.map(s => `<option${s === sub ? ' selected' : ''}>${esc(s)}</option>`).join('')}</select></label>
      <label class="yp-f"><span class="lab">평가 영역</span><select class="field" id="elUnit">${unitOpts()}</select></label>
      <div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-close>취소</button><button class="btn primary" type="button" id="elOk">이어 두기</button></div></div>`, sh => {
    sh.querySelector('#elSubject').addEventListener('change', e => { sub = e.target.value; sh.querySelector('#elUnit').innerHTML = unitOpts(); });
    sh.querySelector('#elOk').addEventListener('click', () => {
      const u = units.find(x => x.id === sh.querySelector('#elUnit').value);
      if (!u) return;
      done = true; SS().closeSheet();
      save({ unitId: u.id, subject: u.subject, label: u.label });
    });
  });
  watchClose(() => { if (!done) cancel(); });
}
function watchClose(fn) {
  const root = globalThis.document && document.getElementById('sheetRoot');
  if (!root) return;
  const obs = new MutationObserver(() => { if (!root.querySelector('#elSheet')) { obs.disconnect(); fn(); } });
  obs.observe(root, { childList: true, subtree: true });
}
