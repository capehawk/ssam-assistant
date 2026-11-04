/* POST /api/chat → 업스테이지 채팅(Solar 모델만, 1MB까지). 답(스트리밍)은 그대로 넘김, 글은 저장·기록 안 함 */
import { json, preflight, guard, corsHeaders, optsOf } from '../lib/guard.js';
export const config = { runtime: 'edge' };
const MAX = 1_000_000;
export default async function chat(req, o) {
  const opts = optsOf(o), origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return preflight(origin);
  if (req.method !== 'POST') return json({ ssam: true, error: 'method' }, 405, origin);
  const text = await req.text();
  if (text.length > MAX) return json({ ssam: true, error: 'too_big', message: '보내는 글이 너무 길어요.' }, 413, origin);
  let body;
  try { body = JSON.parse(text); } catch (e) { return json({ ssam: true, error: 'bad_json' }, 400, origin); }
  if (!body || !/^solar[\w.-]*$/i.test(String(body.model || ''))) return json({ ssam: true, error: 'model', message: '시험용으로는 Solar 모델만 쓸 수 있어요.' }, 400, origin);
  const g = await guard(req, opts);
  if (!g.ok) return g;
  const up = await opts.fetchFn('https://api.upstage.ai/v1/chat/completions', { method: 'POST', redirect: 'manual', headers: { authorization: `Bearer ${g.key}`, 'content-type': 'application/json', accept: body.stream ? 'text/event-stream' : 'application/json' }, body: text });
  return new Response(up.body, { status: up.status, headers: { 'content-type': up.headers.get('content-type') || 'application/json', 'cache-control': 'no-store', ...corsHeaders(origin) } });
}
