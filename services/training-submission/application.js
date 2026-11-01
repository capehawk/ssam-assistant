const appError = (code, message) => Object.assign(new Error(message), { code });
const ERROR_MESSAGES = {
  UNAUTHENTICATED: '인증값이 없거나 만료·폐기되었습니다.', FORBIDDEN: '이 작업의 권한이 없습니다.',
  VALIDATION: '입력 형식과 파일을 확인해 주세요.', NOT_FOUND: '제출을 찾을 수 없습니다.',
  INVALID_STATE: '현재 상태에서 할 수 없는 작업입니다.', REQUEST_CONFLICT: '같은 요청 ID에 다른 내용이 사용되었습니다.',
  REVISION_CONFLICT: '내용이 변경되었습니다. 새로고침 후 다시 시도하세요.',
  STORAGE_ERROR: '저장 결과를 확인할 수 없습니다. 같은 요청으로 재시도하세요.',
  BUSY: '다른 요청을 처리 중입니다. 같은 요청으로 재시도하세요.', INTERNAL: '서버 처리에 실패했습니다.'
};

export function createTokenAuthenticator({ hash, credentials, actors, clock }) {
  return token => {
    if (typeof token !== 'string' || token.length < 1 || token.length > 256) throw appError('UNAUTHENTICATED');
    const digest = hash(token);
    const credential = credentials().find(x => x.tokenHash === digest);
    const now = Date.parse(clock());
    if (!credential || credential.revoked || !Number.isFinite(Date.parse(credential.expiresAt)) || Date.parse(credential.expiresAt) <= now) throw appError('UNAUTHENTICATED');
    const actor = actors().find(x => x.actorId === credential.actorId && !x.disabled);
    if (!actor || !['teacher', 'reviewer'].includes(actor.role)) throw appError('UNAUTHENTICATED');
    return { actorId: actor.actorId, role: actor.role };
  };
}

export function createApplication({ authenticate, service, withLock }) {
  return request => {
    const requestId = typeof request?.requestId === 'string' && /^[A-Za-z0-9_-]{8,100}$/.test(request.requestId) ? request.requestId : null;
    try {
      if (!request || typeof request !== 'object' || Array.isArray(request)) throw appError('VALIDATION');
      const data = withLock(() => {
        const principal = authenticate(request.token);
        return service.execute(request.action, request.payload || {}, principal, request.requestId);
      });
      return { ok: true, data, error: null, requestId };
    } catch (error) {
      const code = Object.prototype.hasOwnProperty.call(ERROR_MESSAGES, error?.code) ? error.code : 'INTERNAL';
      return { ok: false, data: null, error: { code, message: ERROR_MESSAGES[code] }, requestId };
    }
  };
}
