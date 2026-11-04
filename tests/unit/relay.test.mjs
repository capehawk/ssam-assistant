// 시험용 업스테이지 중계(Vercel, relay/): 키는 Vercel 환경 변수에만. 기한(2027. 3. 31. 한국 시각)·하루 횟수(접속 주소마다)·
// 허용 출처(웹판·Windows 앱)·채팅/글자 읽기만·모델·크기를 서버가 지킴. 글은 저장·기록하지 않고 그대로 넘김
import test from 'node:test';
import assert from 'node:assert/strict';
import { UNTIL, allowedOrigin, corsHeaders, memCounter, guard } from '../../relay/lib/guard.js';
import info from '../../relay/api/info.js';
import chat from '../../relay/api/chat.js';
import ocr from '../../relay/api/ocr.js';

const NOW = Date.UTC(2026, 10, 4, 3, 0, 0);
const ORIGIN = 'https://doguri25.github.io';
const req = (url, init = {}) => new Request(`https://relay.example${url}`, { ...init, headers: { origin: ORIGIN, 'x-forwarded-for': '1.2.3.4', ...(init.headers || {}) } });

test('기한·출처', () => {
  assert.equal(new Date(UNTIL).toISOString(), '2027-03-31T14:59:59.000Z');
  for (const o of ['https://doguri25.github.io', 'http://tauri.localhost', 'https://tauri.localhost', 'tauri://localhost']) assert.ok(allowedOrigin(o), o);
  for (const o of ['https://evil.example', 'https://doguri25.github.io.evil.example', '', null]) assert.ok(!allowedOrigin(o), String(o));
  assert.equal(corsHeaders(ORIGIN)['access-control-allow-origin'], ORIGIN);
  assert.ok(!corsHeaders('https://evil.example')['access-control-allow-origin']);
});

test('guard: 키 없음 503, 기한 지남 410, 다른 출처 403, 하루 횟수(주소마다) 넘으면 429·다음 날 다시', async () => {
  const c = memCounter();
  const env = { UPSTAGE_TEST_KEY: 'k' };
  assert.equal((await guard(req('/api/chat'), { env: {}, now: NOW, counter: c })).status, 503);
  assert.equal((await guard(req('/api/chat'), { env, now: UNTIL + 1000, counter: c })).status, 410);
  assert.equal((await guard(req('/api/chat', { headers: { origin: 'https://evil.example' } }), { env, now: NOW, counter: c })).status, 403);
  for (let i = 0; i < 3; i++) assert.equal((await guard(req('/api/chat'), { env: { ...env, TEST_DAILY_PER_IP: '3' }, now: NOW, counter: c })).ok, true);
  const r = await guard(req('/api/chat'), { env: { ...env, TEST_DAILY_PER_IP: '3' }, now: NOW, counter: c });
  assert.equal(r.status, 429);
  const body = await r.json();
  assert.ok(body.ssam && body.error === 'daily_limit' && body.message.includes('3번'), JSON.stringify(body));
  assert.equal((await guard(req('/api/chat'), { env: { ...env, TEST_DAILY_PER_IP: '3' }, now: NOW + 86400000, counter: c })).ok, true, '다음 날');
  const g = await guard(req('/api/chat', { headers: { 'x-forwarded-for': '9.9.9.9' } }), { env: { ...env, TEST_DAILY_TOTAL: '0' }, now: NOW, counter: memCounter() });
  assert.equal(g.status, 429, '전체 하루 한도');
});

test('info: 키가 있고 기한 안이면 available', async () => {
  const r = await info(req('/api/info', { method: 'GET' }), { env: { UPSTAGE_TEST_KEY: 'k' }, now: NOW });
  assert.deepEqual(await r.json(), { available: true, until: '2027-03-31', daily: 400 });
  assert.equal(r.headers.get('access-control-allow-origin'), ORIGIN);
  assert.deepEqual(await (await info(req('/api/info', { method: 'GET' }), { env: {}, now: NOW })).json(), { available: false, until: '2027-03-31', daily: 400 });
});

test('chat: 키를 붙여 업스테이지 채팅으로만, Solar 모델만, 답은 그대로(스트리밍), 브라우저가 보낸 Authorization은 버림', async () => {
  const calls = [];
  const fetchFn = async (url, init) => { calls.push({ url, init }); return new Response('data: {"choices":[{"delta":{"content":"hi"}}]}\n\n', { status: 200, headers: { 'content-type': 'text/event-stream' } }); };
  const body = JSON.stringify({ model: 'solar-pro3', stream: true, messages: [{ role: 'user', content: '안녕' }] });
  const r = await chat(req('/api/chat', { method: 'POST', body, headers: { 'content-type': 'application/json', authorization: 'Bearer evil' } }), { env: { UPSTAGE_TEST_KEY: 'up_real' }, now: NOW, counter: memCounter(), fetchFn });
  assert.equal(r.status, 200);
  assert.ok((await r.text()).includes('hi'));
  assert.equal(calls[0].url, 'https://api.upstage.ai/v1/chat/completions');
  assert.equal(calls[0].init.headers.authorization, 'Bearer up_real');
  assert.equal(calls[0].init.redirect, 'manual');
  const bad = await chat(req('/api/chat', { method: 'POST', body: JSON.stringify({ model: 'gpt-x', messages: [] }), headers: { 'content-type': 'application/json' } }), { env: { UPSTAGE_TEST_KEY: 'k' }, now: NOW, counter: memCounter(), fetchFn });
  assert.equal(bad.status, 400);
  const big = await chat(req('/api/chat', { method: 'POST', body: 'x'.repeat(1_100_000), headers: { 'content-type': 'application/json' } }), { env: { UPSTAGE_TEST_KEY: 'k' }, now: NOW, counter: memCounter(), fetchFn });
  assert.equal(big.status, 413);
  const opt = await chat(req('/api/chat', { method: 'OPTIONS' }), { env: { UPSTAGE_TEST_KEY: 'k' }, now: NOW, counter: memCounter(), fetchFn });
  assert.equal(opt.status, 204);
  assert.ok(opt.headers.get('access-control-allow-headers').includes('content-type'));
});

test('ocr: 글자 읽기(document-digitization)로만, 받은 몸을 그대로·키를 붙여', async () => {
  const calls = [];
  const fetchFn = async (url, init) => { calls.push({ url, init }); return new Response('{"text":"글"}', { status: 200, headers: { 'content-type': 'application/json' } }); };
  const fd = new FormData(); fd.append('document', new Blob([new Uint8Array([1, 2, 3])]), 'p.jpg'); fd.append('model', 'ocr');
  const r = await ocr(req('/api/ocr', { method: 'POST', body: fd }), { env: { UPSTAGE_TEST_KEY: 'up_real' }, now: NOW, counter: memCounter(), fetchFn });
  assert.equal(r.status, 200);
  assert.equal(calls[0].url, 'https://api.upstage.ai/v1/document-digitization');
  assert.equal(calls[0].init.headers.authorization, 'Bearer up_real');
  assert.ok(String(calls[0].init.headers['content-type']).startsWith('multipart/form-data'));
});
