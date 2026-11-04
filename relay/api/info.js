/* GET /api/info → { available, until, daily } (키 값은 주지 않음) */
import { UNTIL, UNTIL_TEXT, json, preflight, optsOf } from '../lib/guard.js';
export const config = { runtime: 'edge' };
export default async function info(req, o) {
  const { env, now } = optsOf(o), origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return preflight(origin);
  return json({ available: !!String(env.UPSTAGE_TEST_KEY || '').trim() && now <= UNTIL, until: UNTIL_TEXT, daily: Number(env.TEST_DAILY_PER_IP || 400) }, 200, origin);
}
