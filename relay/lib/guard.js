/* 쌤비서 시험용 업스테이지 중계 — 공통 검사 (Vercel 함수, 키는 환경 변수 UPSTAGE_TEST_KEY에만).
   기한: 2027-03-31 23:59:59 한국 시각까지. 하루 횟수: 접속 주소마다(TEST_DAILY_PER_IP, 기본 400)와 전체(TEST_DAILY_TOTAL, 기본 3000).
   횟수는 Upstash Redis(UPSTASH_REDIS_REST_URL·TOKEN)가 있으면 거기서 정확히, 없으면 함수 인스턴스 메모리로 대강.
   요청 글·그림은 저장하지도 기록하지도 않음 */
export const UNTIL = Date.UTC(2027, 2, 31, 14, 59, 59);
export const UNTIL_TEXT = '2027-03-31';
const ORIGINS = ['https://doguri25.github.io', 'http://tauri.localhost', 'https://tauri.localhost', 'tauri://localhost'];
export const allowedOrigin = o => typeof o === 'string' && ORIGINS.includes(o);

export function corsHeaders(origin) {
  return allowedOrigin(origin) ? { 'access-control-allow-origin': origin, vary: 'Origin', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400' } : { vary: 'Origin' };
}
export const json = (obj, status, origin) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...corsHeaders(origin) } });
export const preflight = origin => new Response(null, { status: allowedOrigin(origin) ? 204 : 403, headers: corsHeaders(origin) });

/* 하루 횟수 세개 */
export function memCounter() {
  const m = new Map();
  return { async incr(key) { const n = (m.get(key) || 0) + 1; m.set(key, n); if (m.size > 50000) m.clear(); return n; } };
}
export function redisCounter(url, token, fetchFn = fetch) {
  return {
    async incr(key, ttl) {
      const r = await fetchFn(`${url.replace(/\/$/, '')}/pipeline`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify([['INCR', key], ['EXPIRE', key, String(ttl)]]) });
      const j = await r.json();
      return Number(j && j[0] && j[0].result) || 0;
    }
  };
}
let shared = null;
export function defaultCounter(env) {
  if (shared) return shared;
  shared = env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN ? redisCounter(env.UPSTASH_REDIS_REST_URL, env.UPSTASH_REDIS_REST_TOKEN) : memCounter();
  return shared;
}
const ipOf = req => String(req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown').split(',')[0].trim();
const dayOf = now => Math.floor((now + 9 * 3600 * 1000) / 86400000); // 한국 날짜

/* 통과하면 { ok: true, key }, 아니면 오류 Response */
export async function guard(req, { env, now, counter }) {
  const origin = req.headers.get('origin');
  if (!allowedOrigin(origin)) return json({ ssam: true, error: 'origin', message: '쌤비서에서만 쓸 수 있어요.' }, 403, origin);
  const key = String(env.UPSTAGE_TEST_KEY || '').trim();
  if (!key) return json({ ssam: true, error: 'no_key', message: '시험용 업스테이지가 아직 준비되지 않았어요. 설정 › AI에 내 AI 키를 넣어 주세요.' }, 503, origin);
  if (now > UNTIL) return json({ ssam: true, error: 'expired', message: '시험용 업스테이지 사용 기간(2027. 3. 31.)이 끝났어요. 설정 › AI에 내 AI 키를 넣어 주세요.' }, 410, origin);
  const per = Number(env.TEST_DAILY_PER_IP || 400), total = Number(env.TEST_DAILY_TOTAL ?? 3000), day = dayOf(now);
  const nAll = await counter.incr(`all:${day}`, 172800);
  if (nAll > total) return json({ ssam: true, error: 'daily_limit', message: '오늘 시험용 업스테이지를 쓸 수 있는 전체 횟수를 다 썼어요. 내일 다시 쓰거나 설정 › AI에 내 AI 키를 넣어 주세요.' }, 429, origin);
  const nIp = await counter.incr(`ip:${day}:${ipOf(req)}`, 172800);
  if (nIp > per) return json({ ssam: true, error: 'daily_limit', message: `오늘 시험용 업스테이지 사용 횟수(${per}번)를 다 썼어요. 내일 다시 쓰거나 설정 › AI에 내 AI 키를 넣어 주세요.` }, 429, origin);
  return { ok: true, key, origin };
}
/* Vercel이 두 번째 인자로 넘기는 것(context)과 시험용 인자를 함께 받음 */
export const optsOf = o => {
  const env = (o && o.env) || (typeof process !== 'undefined' ? process.env : {});
  return { env, now: (o && o.now) || Date.now(), counter: (o && o.counter) || defaultCounter(env), fetchFn: (o && o.fetchFn) || fetch };
};
