// No tokens/PDFs in localStorage or school-year storage. Pending retries live only in memory.
export function validServerUrl(value) {
  return typeof value === 'string' && /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(value);
}
export async function nativeSend(url, request) {
  if (!validServerUrl(url)) throw Error('올바른 Apps Script /exec 주소를 입력해 주세요.');
  const invoke = globalThis.window?.__TAURI__?.core?.invoke;
  if (!invoke) throw Error('학교 제출은 Windows 설치판에서 지원합니다.');
  const result = await invoke('training_request', { url, body: JSON.stringify(request) });
  try { return JSON.parse(result); } catch { throw Error('서버 응답을 읽지 못했습니다. 같은 요청으로 다시 시도해 주세요.'); }
}
export function createTrainingClient({send = nativeSend, id = () => crypto.randomUUID()} = {}) {
  let url='', token='', running=null, generation=0, readSequence=0;
  const state={records:[],pending:null,fresh:false,connected:false};
  async function request(action,payload={},requestId=id()) {
    const response=await send(url,{action,token,requestId,payload});
    if (!response || response.ok !== true) {
      const error=Error(response?.error?.message || '서버가 요청을 처리하지 못했습니다.');
      error.code=response?.error?.code; throw error;
    }
    return response.data;
  }
  function execute() {
    if(running) return running;
    if(!state.pending) return Promise.reject(Error('재시도할 요청이 없습니다.'));
    const op=state.pending;
    generation++;
    running=request(op.action,op.payload,op.requestId).then(record=>{
      generation++;
      state.records=[record,...state.records.filter(r=>r.submissionId!==record.submissionId)];
      state.pending=null; state.fresh=false; return record;
    }).catch(error=>{
      // A definitive rejection permits editing. Infrastructure failures may have committed.
      if(['VALIDATION','FORBIDDEN','UNAUTHENTICATED','NOT_FOUND','INVALID_STATE','REQUEST_CONFLICT','REVISION_CONFLICT'].includes(error.code)) state.pending=null;
      throw error;
    }).finally(()=>{running=null;});
    return running;
  }
  return {state,
    connect(server,secret) {
      if(running || state.pending) throw Error('처리 결과가 미확인인 요청을 먼저 재시도해 주세요.');
      if(!validServerUrl(server) || !secret.trim()) throw Error('서버 주소와 인증값을 확인해 주세요.');
      generation++; url=server; token=secret.trim(); state.records=[]; state.fresh=false; state.connected=true;
    },
    disconnect() {
      if(running || state.pending) throw Error('미확인 요청을 먼저 재시도해 주세요.');
      generation++; token=''; state.records=[]; state.connected=false; state.fresh=false;
    },
    catalog:()=>request('catalog'),
    async refresh() {
      const epoch=generation, sequence=++readSequence; state.fresh=false;
      const records=await request('mySubmissions');
      if(epoch!==generation || sequence!==readSequence) return;
      if(!Array.isArray(records)) throw Error('제출 목록 형식이 올바르지 않습니다.');
      state.records=records; state.fresh=true; return records;
    },
    mutate(action,payload) {
      if(running) return running;
      if(state.pending) return Promise.reject(Error('미확인 요청을 같은 내용으로 재시도해 주세요.'));
      state.pending={action,payload:structuredClone(payload),requestId:id()}; return execute();
    },
    retry:execute,
  };
}
