// 회사별 AI 요청 모양: 학생마다 같은 공통 부분(shared)을 앞에 두고 Claude는 공통 끝에 캐시 표시, 사용량 읽기·모으기
import test from 'node:test';
import assert from 'node:assert/strict';
import { claudeContent, geminiParts, openaiContent, flatten, emptyUse, readUsage, newMeter, useText } from '../../web/core/ai-wire.js';

const A = { mime: 'image/jpeg', b64: 'AAA' }, B = { mime: 'image/png', b64: 'BBB' };

test('claudeContent: 공통 그림·글이 앞, 공통 마지막(글)에만 cache_control, 학생 그림·글이 뒤', () => {
  const c = claudeContent({ text: 'T', images: [B], shared: { text: 'S', images: [A] } });
  assert.deepEqual(c.map(x => x.type), ['image', 'text', 'image', 'text']);
  assert.deepEqual(c[0].source, { type: 'base64', media_type: 'image/jpeg', data: 'AAA' });
  assert.equal(c[1].text, 'S');
  assert.deepEqual(c[1].cache_control, { type: 'ephemeral' });
  assert.ok(!c[0].cache_control && !c[2].cache_control && !c[3].cache_control);
  assert.equal(c[2].source.data, 'BBB');
  assert.equal(c[3].text, 'T');
});

test('claudeContent: 공통 글이 없으면 마지막 공통 그림에 cache_control, 공통이 없으면 지금 모양', () => {
  const c = claudeContent({ text: 'T', images: [B], shared: { images: [A, B] } });
  assert.deepEqual(c.map(x => x.type), ['image', 'image', 'image', 'text']);
  assert.ok(!c[0].cache_control && c[1].cache_control && !c[2].cache_control);
  assert.equal(claudeContent({ text: 'T' }), 'T');
  assert.equal(claudeContent({ text: 'T', shared: { text: '', images: [] } }), 'T');
  const g = claudeContent({ text: 'T', images: [A] });
  assert.deepEqual(g.map(x => x.type), ['image', 'text']);
  assert.ok(!g.some(x => x.cache_control));
});

test('claudeContent: 공통 글만 있으면 [공통 글(cache_control), 학생 글]', () => {
  const c = claudeContent({ text: 'T', shared: { text: 'S' } });
  assert.deepEqual(c.map(x => [x.type, x.text, !!x.cache_control]), [['text', 'S', true], ['text', 'T', false]]);
});

test('geminiParts: 공통 그림 → 공통 글 → 학생 그림 → 학생 글', () => {
  const p = geminiParts({ text: 'T', images: [B], shared: { text: 'S', images: [A] } });
  assert.deepEqual(p, [{ inline_data: { mime_type: 'image/jpeg', data: 'AAA' } }, { text: 'S' }, { inline_data: { mime_type: 'image/png', data: 'BBB' } }, { text: 'T' }]);
  assert.deepEqual(geminiParts({ text: 'T', images: [A] }), [{ inline_data: { mime_type: 'image/jpeg', data: 'AAA' } }, { text: 'T' }]);
});

test('openaiContent: 공통이 없으면 지금 모양(글 → 그림), 있으면 공통 → 학생', () => {
  assert.equal(openaiContent({ text: 'T' }), 'T');
  const now = openaiContent({ text: 'T', images: [A] });
  assert.deepEqual(now, [{ type: 'text', text: 'T' }, { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,AAA', detail: 'high' } }]);
  const c = openaiContent({ text: 'T', images: [B], shared: { text: 'S', images: [A] } });
  assert.deepEqual(c.map(x => x.type), ['image_url', 'text', 'image_url', 'text']);
  assert.deepEqual([c[1].text, c[3].text], ['S', 'T']);
});

test('flatten: 공통 글 + 빈 줄 + 학생 글, 그림은 공통 → 학생 (업스테이지·Claude 계정)', () => {
  assert.deepEqual(flatten({ text: 'T', images: [B] }), { text: 'T', images: [B] });
  assert.deepEqual(flatten({ text: 'T', shared: { text: 'S' } }), { text: 'S\n\nT', images: [] });
  assert.deepEqual(flatten({ text: 'T' }), { text: 'T', images: [] });
});

test('최종 검토 I3: 공통 그림과 학생 그림이 모두 있으면 첨부 차례를 글로 알려 줌(그림이 따로 붙는 Claude 계정)', () => {
  const f = flatten({ text: 'T', images: [B, B], shared: { text: 'S', images: [A] } });
  assert.deepEqual(f.images, [A, B, B]);
  assert.ok(f.text.startsWith('S\n\nT'), f.text);
  assert.ok(f.text.includes('첨부한 그림 3장 중 앞의 1장은') && f.text.includes('뒤의 2장은'), f.text);
});

test('readUsage claude: message_start의 입력·캐시, message_delta의 출력', () => {
  const acc = emptyUse();
  readUsage('claude', { type: 'message_start', message: { usage: { input_tokens: 100, cache_creation_input_tokens: 0, cache_read_input_tokens: 900, output_tokens: 1 } } }, acc);
  readUsage('claude', { type: 'content_block_delta', delta: { type: 'text_delta', text: 'x' } }, acc);
  readUsage('claude', { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 50 } }, acc);
  assert.deepEqual(acc, { input: 100, cacheRead: 900, cacheWrite: 0, output: 50 });
});

test('readUsage gemini: 마지막 usageMetadata(입력에서 캐시를 뺌, 출력 + 생각)', () => {
  const acc = emptyUse();
  readUsage('gemini', { usageMetadata: { promptTokenCount: 1000, candidatesTokenCount: 5 } }, acc);
  readUsage('gemini', { usageMetadata: { promptTokenCount: 1000, cachedContentTokenCount: 800, candidatesTokenCount: 40, thoughtsTokenCount: 10 } }, acc);
  assert.deepEqual(acc, { input: 200, cacheRead: 800, cacheWrite: 0, output: 50 });
});

test('readUsage openai·upstage: 마지막 조각 usage, usage 없는 조각은 그대로', () => {
  const acc = emptyUse();
  readUsage('openai', { choices: [{ delta: { content: 'x' } }] }, acc);
  readUsage('openai', { choices: [], usage: { prompt_tokens: 1200, prompt_tokens_details: { cached_tokens: 1024 }, completion_tokens: 30 } }, acc);
  assert.deepEqual(acc, { input: 176, cacheRead: 1024, cacheWrite: 0, output: 30 });
  const up = readUsage('upstage', { usage: { prompt_tokens: 300, completion_tokens: 20 } }, emptyUse());
  assert.deepEqual(up, { input: 300, cacheRead: 0, cacheWrite: 0, output: 20 });
});

test('meter: 여러 요청을 더해 보낸 양(입력+캐시 읽기+캐시 쓰기)·캐시·받은 양', () => {
  const m = newMeter();
  m.add({ input: 100, cacheRead: 0, cacheWrite: 900, output: 50 });
  m.add({ input: 100, cacheRead: 900, cacheWrite: 0, output: 60 });
  m.add(null);
  assert.deepEqual(m.total(), { sent: 2000, cached: 900, out: 110 });
  assert.equal(m.text(), useText(m.total()));
});

test('useText: 1만 이상은 「약 n.n만」, 미만은 쉼표, 캐시 0이면 괄호 없음, 모두 0이면 빈 글', () => {
  assert.equal(useText({ sent: 42000, cached: 35000, out: 9120 }), 'AI 사용량: 보낸 양 약 4.2만 토큰(그중 83%는 캐시로 싸게) · 받은 답 9,120 토큰');
  assert.equal(useText({ sent: 3210, cached: 0, out: 450 }), 'AI 사용량: 보낸 양 3,210 토큰 · 받은 답 450 토큰');
  assert.equal(useText({ sent: 50000, cached: 0, out: 12000 }), 'AI 사용량: 보낸 양 약 5만 토큰 · 받은 답 약 1.2만 토큰');
  assert.equal(useText({ sent: 0, cached: 0, out: 0 }), '');
  assert.equal(useText(null), '');
});
