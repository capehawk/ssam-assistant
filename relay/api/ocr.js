/* POST /api/ocr → 업스테이지 글자 읽기(document-digitization, 4MB까지). 그림은 저장·기록 안 함 */
import { json, preflight, guard, corsHeaders, optsOf } from '../lib/guard.js';
export const config = { runtime: 'edge' };
const MAX = 4_000_000;
export default async function ocr(req, o) {
  const opts = optsOf(o), origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return preflight(origin);
  if (req.method !== 'POST') return json({ ssam: true, error: 'method' }, 405, origin);
  const type = req.headers.get('content-type') || '';
  if (!type.startsWith('multipart/form-data')) return json({ ssam: true, error: 'type' }, 400, origin);
  const buf = await req.arrayBuffer();
  if (buf.byteLength > MAX) return json({ ssam: true, error: 'too_big', message: '그림이 너무 커요.' }, 413, origin);
  const g = await guard(req, opts);
  if (!g.ok) return g;
  const up = await opts.fetchFn('https://api.upstage.ai/v1/document-digitization', { method: 'POST', redirect: 'manual', headers: { authorization: `Bearer ${g.key}`, 'content-type': type }, body: buf });
  return new Response(up.body, { status: up.status, headers: { 'content-type': up.headers.get('content-type') || 'application/json', 'cache-control': 'no-store', ...corsHeaders(origin) } });
}
