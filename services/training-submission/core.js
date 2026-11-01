export class TrainingError extends Error {
  constructor(code, message) { super(message); this.name = 'TrainingError'; this.code = code; }
}
const MAX_PDF = 5 * 1024 * 1024;
const MAX_MUTATIONS = 50;
const copy = value => JSON.parse(JSON.stringify(value));
const reject = (code, message) => { throw new TrainingError(code, message); };
function text(value, max, optional = false) {
  if (typeof value !== 'string' || value.length > max || (!optional && !value.trim())) reject('VALIDATION', '입력 길이 또는 필수 항목을 확인하세요.');
  return value.trim();
}
function stable(value) {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + stable(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
function publicRecord(record) {
  const { submissionId, actorId, items, status, revision, comment, createdAt, updatedAt, history } = record;
  const { name, mimeType, size } = record.evidence;
  return copy({ submissionId, actorId, items, evidence: { name, mimeType, size }, status, revision, comment, createdAt, updatedAt, history });
}
function storage(fn) {
  try { return fn(); } catch (e) {
    if (e instanceof TrainingError) throw e;
    reject('STORAGE_ERROR', '저장소 응답을 확인하지 못했습니다. 같은 요청으로 다시 시도하세요.');
  }
}
export function createTrainingService({ repository, evidenceStore, clock, idGenerator, hash, decodeBase64, catalog }) {
  function items(input) {
    if (!Array.isArray(input) || input.length < 1 || input.length > 10) reject('VALIDATION', '연수는 1–10개를 입력하세요.');
    const seen = new Set();
    return input.map(item => {
      if (!item || typeof item !== 'object') reject('VALIDATION', '연수 내용을 확인하세요.');
      const entry = catalog.find(c => c.id === item.catalogId);
      if (!entry || seen.has(entry.id)) reject('VALIDATION', '연수 기준을 확인하세요.');
      seen.add(entry.id);
      const completedOn = text(item.completedOn, 10);
      const date = new Date(completedOn + 'T00:00:00.000Z');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(completedOn) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== completedOn) reject('VALIDATION', '이수일을 확인하세요.');
      if (typeof item.hours !== 'number' || !Number.isFinite(item.hours) || item.hours <= 0 || item.hours > 10000) reject('VALIDATION', '이수 시간을 확인하세요.');
      return { catalogId: entry.id, title: text(item.title, 300), provider: text(item.provider, 300), completedOn, hours: item.hours, ...(entry.itemIds ? { itemIds: [...entry.itemIds] } : {}) };
    });
  }
  function evidence(input) {
    if (!input || typeof input !== 'object') reject('VALIDATION', 'PDF 증빙을 선택하세요.');
    const name = text(input.name, 200);
    if (/[\x00-\x1f\\/]/.test(name) || !/\.pdf$/i.test(name) || input.mimeType !== 'application/pdf') reject('VALIDATION', 'PDF 증빙만 제출할 수 있습니다.');
    const b64 = input.base64;
    if (typeof b64 !== 'string' || !b64.length || b64.length > 4 * Math.ceil(MAX_PDF / 3) || b64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(b64)) reject('VALIDATION', 'PDF 인코딩 또는 크기를 확인하세요.');
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    if ((b64.endsWith('==') && (alphabet.indexOf(b64[b64.length - 3]) & 15)) || (b64.endsWith('=') && !b64.endsWith('==') && (alphabet.indexOf(b64[b64.length - 2]) & 3))) reject('VALIDATION', 'PDF 인코딩을 확인하세요.');
    let bytes;
    try { bytes = decodeBase64(b64); } catch { reject('VALIDATION', 'PDF 인코딩을 확인하세요.'); }
    if (!bytes || bytes.length < 8 || bytes.length > MAX_PDF || [37, 80, 68, 70, 45].some((b, i) => (bytes[i] & 255) !== b)) reject('VALIDATION', '5 MiB 이하 PDF를 선택하세요.');
    return { name, mimeType: 'application/pdf', base64: b64, size: bytes.length };
  }
  function target(payload, principal, action) {
    const id = text(payload.submissionId, 100);
    const record = storage(() => repository.get(id));
    if (!record) reject('NOT_FOUND', '제출을 찾을 수 없습니다.');
    if (action === 'review') {
      if (principal.role !== 'reviewer' || record.actorId === principal.actorId) reject('FORBIDDEN', '이 제출을 검토할 권한이 없습니다.');
    } else if (record.actorId !== principal.actorId && !(action === 'evidence' && principal.role === 'reviewer')) reject('FORBIDDEN', '본인 제출만 접근할 수 있습니다.');
    return record;
  }
  function execute(action, payload = {}, principal, requestId) {
    if (!principal || typeof principal.actorId !== 'string' || !principal.actorId.trim()) reject('UNAUTHENTICATED', '인증이 필요합니다.');
    if (!['teacher', 'reviewer'].includes(principal.role)) reject('FORBIDDEN', '허용된 역할이 아닙니다.');
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) reject('VALIDATION', '요청 내용을 확인하세요.');
    if (action === 'catalog') return copy(catalog);
    if (action === 'mySubmissions') return storage(() => repository.list()).filter(r => r.actorId === principal.actorId).map(publicRecord);
    if (action === 'reviewQueue') {
      if (principal.role !== 'reviewer') reject('FORBIDDEN', '담당자만 조회할 수 있습니다.');
      return storage(() => repository.list()).filter(r => r.actorId !== principal.actorId).map(publicRecord);
    }
    if (action === 'evidence') return storage(() => evidenceStore.read(target(payload, principal, action).evidence.id));
    if (!['submit', 'revise', 'review'].includes(action)) reject('VALIDATION', '지원하지 않는 요청입니다.');
    if (typeof requestId !== 'string' || !/^[A-Za-z0-9_-]{8,100}$/.test(requestId)) reject('VALIDATION', '요청 ID를 확인하세요.');
    if (action === 'review' && principal.role !== 'reviewer') reject('FORBIDDEN', '담당자만 검토할 수 있습니다.');
    // Resolve access before reading a receipt, including retries of old revisions.
    let record = action === 'submit' ? null : target(payload, principal, action);
    const payloadHash = hash(stable({ action, payload }));
    const duplicate = storage(() => repository.findRequest(principal.actorId, requestId));
    if (duplicate) {
      if (duplicate.hash !== payloadHash) reject('REQUEST_CONFLICT', '같은 요청 ID의 내용이 다릅니다.');
      // A submission receipt can survive ownership changes: recheck its current target.
      target({ submissionId: duplicate.result.submissionId }, principal, action === 'review' ? 'review' : 'revise');
      return copy(duplicate.result);
    }
    if (record) {
      if (!Number.isSafeInteger(payload.expectedRevision) || record.revision !== payload.expectedRevision) reject('REVISION_CONFLICT', '새로고침 후 최신 버전으로 다시 시도하세요.');
      if ((action === 'review' && record.status !== 'submitted') || (action === 'revise' && record.status !== 'needs_changes')) reject('INVALID_STATE', '현재 상태에서는 처리할 수 없습니다.');
      if (record.history.length >= MAX_MUTATIONS || record.requests.length >= MAX_MUTATIONS) reject('VALIDATION', '시연 제출의 변경 횟수 한도에 도달했습니다.');
    }
    const at = clock();
    if (action === 'submit' || action === 'revise') {
      const checkedItems = items(payload.items), checkedEvidence = evidence(payload.evidence);
      const key = hash(stable({ actorId: principal.actorId, requestId, payloadHash }));
      const storedEvidence = storage(() => evidenceStore.put(key, checkedEvidence));
      if (!record) record = { submissionId: idGenerator(), actorId: principal.actorId, revision: 0, createdAt: at, history: [], requests: [], evidenceHistory: [] };
      else record.evidenceHistory = [...(record.evidenceHistory || []), record.evidence.id];
      record.items = checkedItems; record.evidence = storedEvidence; record.status = 'submitted'; record.comment = '';
    } else {
      if (!['approved', 'needs_changes'].includes(payload.decision)) reject('VALIDATION', '검토 결정을 확인하세요.');
      record.comment = text(payload.comment ?? '', 2000, payload.decision === 'approved');
      record.status = payload.decision;
    }
    record.revision++; record.updatedAt = at;
    record.history.push({ action: action === 'review' ? payload.decision : action, actorId: principal.actorId, at, revision: record.revision, comment: record.comment });
    const result = publicRecord(record);
    record.requests.push({ actorId: principal.actorId, requestId, hash: payloadHash, result });
    if (JSON.stringify(record).length > 1000000) reject('VALIDATION', '시연 제출의 저장 한도에 도달했습니다. 새 제출을 이용하세요.');
    storage(() => repository.save(record));
    return copy(result);
  }
  return { execute };
}
