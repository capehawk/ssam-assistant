/* AI 요청 모양 (스펙 2026-11-03): 학생마다 같은 공통 부분(shared)을 앞에 두면 AI 회사가 앞부분을 캐시해 값이 줄고 빨라짐.
   Claude는 공통 끝에 cache_control(5분), Gemini·OpenAI는 앞부분이 같으면 스스로 캐시. 화면 없이 돌아감(시험)
   shared: { text?, images?: [{ mime, b64 }] } · images: 학생 그림 · text: 학생 글 */

const hasShared = sh => !!(sh && (String(sh.text || '').trim() || (sh.images || []).length));
const imgsOf = sh => (sh && Array.isArray(sh.images) ? sh.images : []);

export function claudeContent({ text, images = [], shared } = {}) {
  const img = im => ({ type: 'image', source: { type: 'base64', media_type: im.mime, data: im.b64 } });
  const own = images || [];
  if (!hasShared(shared)) return own.length ? [...own.map(img), { type: 'text', text }] : text;
  const out = imgsOf(shared).map(img);
  if (String(shared.text || '').trim()) out.push({ type: 'text', text: shared.text });
  out[out.length - 1].cache_control = { type: 'ephemeral' };
  return [...out, ...own.map(img), { type: 'text', text }];
}

export function geminiParts({ text, images = [], shared } = {}) {
  const img = im => ({ inline_data: { mime_type: im.mime, data: im.b64 } });
  const sh = hasShared(shared) ? [...imgsOf(shared).map(img), ...(String(shared.text || '').trim() ? [{ text: shared.text }] : [])] : [];
  return [...sh, ...(images || []).map(img), { text }];
}

export function openaiContent({ text, images = [], shared } = {}) {
  const img = im => ({ type: 'image_url', image_url: { url: `data:${im.mime};base64,${im.b64}`, detail: 'high' } });
  const own = images || [];
  if (!hasShared(shared)) return own.length ? [{ type: 'text', text }, ...own.map(img)] : text;
  return [...imgsOf(shared).map(img), ...(String(shared.text || '').trim() ? [{ type: 'text', text: shared.text }] : []), ...own.map(img), { type: 'text', text }];
}

/* Claude 계정: 하나로 이어 붙임(공통 → 학생 차례). 그림은 글과 따로 붙으므로 공통 그림·학생 그림이 다 있으면 차례를 글로 알려 줌 */
export function flatten({ text, images = [], shared } = {}) {
  const st = hasShared(shared) && String(shared.text || '').trim() ? shared.text : '';
  const sh = hasShared(shared) ? imgsOf(shared) : [], own = images || [];
  const order = sh.length && own.length
    ? `\n\n[첨부한 그림 차례] 첨부한 그림 ${sh.length + own.length}장 중 앞의 ${sh.length}장은 위 글에서 「이 글 앞의 그림」이라고 한 것이고, 뒤의 ${own.length}장은 「이 글 뒤에 오는 그림」·「바로 위 그림」이라고 한 학생 것이에요.`
    : '';
  return { text: (st ? `${st}\n\n${text}` : text) + order, images: [...sh, ...own] };
}

/* ---------- 사용량 ---------- */
export const emptyUse = () => ({ input: 0, cacheRead: 0, cacheWrite: 0, output: 0 });
const n = v => (Number.isFinite(Number(v)) ? Number(v) : 0);
/* 스트리밍 조각(ev) 하나를 읽어 acc를 고침(회사마다 모양이 다름) */
export function readUsage(provider, ev, acc = emptyUse()) {
  if (!ev || typeof ev !== 'object') return acc;
  if (provider === 'claude') {
    const u = ev.type === 'message_start' ? ev.message && ev.message.usage : ev.type === 'message_delta' ? ev.usage : null;
    if (!u) return acc;
    if ('input_tokens' in u) acc.input = n(u.input_tokens);
    if ('cache_creation_input_tokens' in u) acc.cacheWrite = n(u.cache_creation_input_tokens);
    if ('cache_read_input_tokens' in u) acc.cacheRead = n(u.cache_read_input_tokens);
    if ('output_tokens' in u) acc.output = n(u.output_tokens);
  } else if (provider === 'gemini') {
    const u = ev.usageMetadata;
    if (!u) return acc;
    const cached = n(u.cachedContentTokenCount);
    acc.input = Math.max(0, n(u.promptTokenCount) - cached); acc.cacheRead = cached;
    acc.output = n(u.candidatesTokenCount) + n(u.thoughtsTokenCount);
  } else {
    const u = ev.usage;
    if (!u) return acc;
    const cached = n(u.prompt_tokens_details && u.prompt_tokens_details.cached_tokens);
    acc.input = Math.max(0, n(u.prompt_tokens) - cached); acc.cacheRead = cached;
    acc.output = n(u.completion_tokens);
  }
  return acc;
}

const fmt = v => (v >= 10000 ? `약 ${String(Math.round(v / 1000) / 10).replace(/\.0$/, '')}만 토큰` : `${Math.round(v).toLocaleString('en-US')} 토큰`);
/* { sent, cached, out } → 「AI 사용량: 보낸 양 약 4.2만 토큰(그중 83%는 캐시로 싸게) · 받은 답 9,120 토큰」, 모두 0이면 '' */
export function useText(t) {
  if (!t) return '';
  const sent = n(t.sent), cached = n(t.cached), out = n(t.out);
  if (!sent && !out) return '';
  const pct = sent && cached ? Math.round(cached / sent * 100) : 0;
  return `AI 사용량: 보낸 양 ${fmt(sent)}${pct ? `(그중 ${pct}%는 캐시로 싸게)` : ''} · 받은 답 ${fmt(out)}`;
}
/* 한 번의 채점에 쓴 양을 모음 */
export function newMeter() {
  const t = { sent: 0, cached: 0, out: 0 };
  return {
    add(u) { if (!u) return; t.sent += n(u.input) + n(u.cacheRead) + n(u.cacheWrite); t.cached += n(u.cacheRead); t.out += n(u.output); },
    total: () => ({ ...t }),
    text: () => useText(t)
  };
}
