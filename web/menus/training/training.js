import {onEnter} from '../../core/shell.js';
import {generateJSON, ready} from '../../core/ai.js';
import {createTrainingClient, validServerUrl} from './client.js';
import {pdfEvidence, extractCertificate} from './certificate.js';

const client=createTrainingClient();
const labels={submitted:'확인대기',approved:'확인완료',needs_changes:'보완요청'};
let root, catalog=[], revising=null, busy=false;
const $=s=>root.querySelector(s);
function message(text) { $('#tr-message').textContent=text; }
function clearDraft() {
  revising=null; catalog=[]; $('#tr-form').reset(); $('#tr-text').textContent='';
  $('#tr-mode').textContent='새 연수 제출'; $('#tr-catalog').replaceChildren();
}
function lock(value) {
  busy=value;
  root.querySelectorAll('button,input,select').forEach(el=>el.disabled=value);
  $('#tr-send').disabled=value || !!client.state.pending || !client.state.connected;
  $('#tr-retry').hidden=!client.state.pending;
  $('#tr-retry').disabled=value;
}
async function task(fn) {
  if(busy) return;
  lock(true);
  try { await fn(); }
  catch(e) { message(e.message || '처리하지 못했습니다. 다시 시도해 주세요.'); }
  finally { lock(false); renderRecords(); }
}
function renderRecords() {
  const list=$('#tr-records'); list.replaceChildren();
  $('#tr-fresh').textContent=client.state.fresh?'서버에서 방금 확인한 결과':'마지막 확인 결과 · 새로고침 전에는 최신 상태가 아닐 수 있습니다.';
  for(const record of client.state.records) {
    const card=document.createElement('article'); card.className='tr-record';
    const heading=document.createElement('h3'); heading.textContent=record.items.map(i=>i.title).join(' / '); card.append(heading);
    const status=document.createElement('p'); status.textContent=`${labels[record.status] || record.status} · 버전 ${record.revision} · ${record.updatedAt}`; card.append(status);
    const comment=document.createElement('p'); comment.textContent=record.comment || '담당자 의견 없음'; card.append(comment);
    const details=document.createElement('details'), summary=document.createElement('summary'); summary.textContent='제출 정보와 검토 이력'; details.append(summary);
    const info=document.createElement('pre'); info.textContent=JSON.stringify({submissionId:record.submissionId,items:record.items,history:record.history},null,2); details.append(info); card.append(details);
    if(record.status==='needs_changes') {
      const revise=document.createElement('button'); revise.type='button'; revise.textContent='보완 작성'; revise.disabled=busy || !!client.state.pending;
      revise.onclick=()=>{
        revising=record; const i=record.items[0];
        for(const key of ['title','provider','completedOn','hours']) $('#tr-'+key).value=i[key];
        $('#tr-catalog').value=i.catalogId; $('#tr-pdf').value=''; $('#tr-confirm').checked=false;
        $('#tr-mode').textContent=`보완 작성 · ${record.submissionId} (버전 ${record.revision})`;
        message('새 증빙 PDF와 수정 내용을 확인한 뒤 재제출해 주세요.'); $('#tr-title').focus();
      }; card.append(revise);
    }
    list.append(card);
  }
  if(!client.state.records.length) list.textContent='확인된 제출 내역이 없습니다. 연결 후 결과를 새로고침해 주세요.';
}
function mount(section) {
  root=section; root.classList.add('training-page');
  root.innerHTML=`<h2>연수 제출과 확인</h2><p>합성 자료 시연용 · 이수증 정보를 확인해 제출하고 담당자 결과를 조회합니다.</p>
    <fieldset class="tr-connection"><legend>학교 제출 서버 연결</legend>
      <label>Apps Script 서버 주소<input id="tr-url" type="url" placeholder="https://script.google.com/macros/s/…/exec" autocomplete="off"></label>
      <label>개인 시연 인증값<input id="tr-token" type="password" autocomplete="off"></label>
      <div class="tr-actions"><button id="tr-connect" type="button">연결</button><button id="tr-disconnect" type="button">인증 지우기</button><button id="tr-refresh" type="button">결과 새로고침</button></div>
      <p>인증값과 PDF는 이 창의 메모리에만 유지됩니다. 결과가 미확인인 동안 창을 닫거나 새로고침하지 마세요.</p>
    </fieldset>
    <p id="tr-message" role="status" aria-live="polite"></p><button id="tr-retry" type="button" hidden>미확인 요청 그대로 재시도</button>
    <div id="tr-mine"><form id="tr-form"><h3 id="tr-mode">새 연수 제출</h3>
      <label>제출 기준<select id="tr-catalog" required><option value="">서버 연결 후 선택</option></select></label>
      <label>증빙 PDF (최대 5MB)<input id="tr-pdf" type="file" accept=".pdf,application/pdf" required></label>
      <button id="tr-extract" type="button">PDF 내용 읽기</button><p>AI 설정이 있으면 과정 정보 초안을 만듭니다. 없거나 읽기 실패 시 직접 입력할 수 있습니다.</p>
      <details><summary>PDF에서 읽은 내용</summary><pre id="tr-text"></pre></details>
      <div class="tr-fields"><label>과정명<input id="tr-title" maxlength="200" required></label><label>연수기관<input id="tr-provider" maxlength="200" required></label>
      <label>이수일<input id="tr-completedOn" type="date" required></label><label>이수시간<input id="tr-hours" type="number" min="0.1" max="1000" step="0.1" required></label></div>
      <label class="tr-check"><input id="tr-confirm" type="checkbox" required>PDF와 과정 정보가 맞는지 확인했습니다.</label>
      <div class="tr-actions"><button id="tr-send" type="submit">학교에 제출</button><button id="tr-new" type="button">새 제출 작성</button></div>
    </form></div>
    <div id="tr-board" hidden><h3>담당자 확인 화면</h3><p>담당자는 서버 주소를 브라우저에서 열고 별도의 담당자 인증값으로 접속합니다. 개인 인증으로 다른 사람의 자료를 볼 수 없습니다.</p><a id="tr-review-link" target="_blank" rel="noopener noreferrer" hidden>담당자 웹 화면 열기</a></div>
    <h3>내 제출 결과 · 전체 이수연도</h3><p id="tr-fresh"></p><div id="tr-records"></div>`;
  try { const saved=localStorage.getItem('training-submission-server'); if(validServerUrl(saved)) $('#tr-url').value=saved; } catch {}
  if(!window.__TAURI__?.core?.invoke) message('웹판은 직접 제출을 지원하지 않습니다. Windows 설치판을 이용하거나 담당자 웹 화면을 여세요.');
  const updateLink=()=>{ const url=$('#tr-url').value.trim(); const a=$('#tr-review-link'); a.hidden=!validServerUrl(url); if(!a.hidden) a.href=url; else a.removeAttribute('href'); };
  $('#tr-url').addEventListener('input',updateLink); updateLink();
  $('#tr-connect').onclick=()=>task(async()=>{
    client.connect($('#tr-url').value.trim(),$('#tr-token').value); clearDraft(); catalog=await client.catalog();
    $('#tr-catalog').replaceChildren(...catalog.map(c=>{const o=document.createElement('option'); o.value=c.id; o.textContent=c.title; return o;}));
    try { localStorage.setItem('training-submission-server',$('#tr-url').value.trim()); } catch {}
    await client.refresh(); message('연결했습니다. 제출 기준과 PDF를 선택해 주세요.');
  });
  $('#tr-disconnect').onclick=()=>task(async()=>{client.disconnect(); clearDraft(); $('#tr-token').value=''; message('이 창의 인증과 조회 결과를 지웠습니다.');});
  $('#tr-refresh').onclick=()=>task(async()=>{await client.refresh(); message('서버 결과를 새로 확인했습니다.');});
  $('#tr-extract').onclick=()=>task(async()=>{
    message('PDF를 읽는 중입니다.');
    const result=await extractCertificate($('#tr-pdf').files[0],{readText:bytes=>window.SSAM.files.pdfText(bytes),generateJSON:ready()?generateJSON:undefined,toImages:file=>window.SSAM.files.toImages(file)});
    $('#tr-text').textContent=result.text || '글자층이 없습니다. 직접 입력하거나 AI 설정 후 다시 읽어 주세요.';
    if(result.item) for(const key of ['title','provider','completedOn','hours']) $('#tr-'+key).value=result.item[key];
    $('#tr-confirm').checked=false; message('읽기를 마쳤습니다. 제출 전에 정보를 직접 확인해 주세요.');
  });
  $('#tr-pdf').onchange=()=>{$('#tr-confirm').checked=false; $('#tr-text').textContent='';};
  $('#tr-new').onclick=()=>{ if(client.state.pending) return message('미확인 요청을 먼저 재시도해 주세요.'); revising=null; $('#tr-form').reset(); $('#tr-mode').textContent='새 연수 제출'; $('#tr-text').textContent=''; };
  $('#tr-form').onsubmit=e=>{
    e.preventDefault(); task(async()=>{
      const evidence=await pdfEvidence($('#tr-pdf').files[0]);
      const item={catalogId:$('#tr-catalog').value}; for(const key of ['title','provider','completedOn']) item[key]=$('#tr-'+key).value.trim(); item.hours=Number($('#tr-hours').value);
      // The UI creates one course or one bundle per submission. Preserve any other items on imported records.
      const items=revising?[item,...revising.items.slice(1)]:[item];
      const payload={items,evidence}; if(revising) Object.assign(payload,{submissionId:revising.submissionId,expectedRevision:revising.revision});
      message('접수 결과를 기다리고 있습니다.'); await client.mutate(revising?'revise':'submit',payload);
      revising=null; $('#tr-form').reset(); $('#tr-mode').textContent='새 연수 제출'; message('서버가 접수했습니다. 담당자 확인 후 결과를 새로고침해 주세요.');
    });
  };
  $('#tr-retry').onclick=()=>task(async()=>{await client.retry(); revising=null; $('#tr-form').reset(); $('#tr-mode').textContent='새 연수 제출'; message('요청의 접수를 확인했습니다. 결과를 새로고침해 주세요.');});
  window.addEventListener('beforeunload',e=>{if(client.state.pending){e.preventDefault();e.returnValue='';}});
  lock(false); renderRecords();
}
onEnter('training',(tab,section)=>{if(!root) mount(section); $('#tr-mine').hidden=tab==='board'; $('#tr-board').hidden=tab!=='board';});
