// AI 부르기에 공통 부분(shared)·사용량(meter): Claude는 공통 → 학생 차례와 cache_control, 사용량을 meter에,
// JSON 다시 묻기도 공통은 그대로·두 번 셈, GPT는 include_usage·차례, Gemini는 parts 차례, 업스테이지는 같은 그림을 다시 읽지 않음
import { open, run, assert, mockClaude } from './helpers.mjs';

const t = await open();
const { page, url, errors } = t;
const bodies = [];
let replies = [];
await mockClaude(page, async ({ body }) => {
  bodies.push(body);
  const r = replies.length ? replies.shift() : '{"ok":1}';
  return { text: r, usage: { input_tokens: 100, cache_read_input_tokens: 900, cache_creation_input_tokens: 0, output_tokens: 50 } };
});
const oa = [], gm = [], ocr = [], upChat = [];
await page.route('https://api.openai.com/**', async route => {
  oa.push(JSON.parse(route.request().postData()));
  const ev = [{ choices: [{ delta: { content: '{"ok":1}' } }] }, { choices: [{ delta: {}, finish_reason: 'stop' }] }, { choices: [], usage: { prompt_tokens: 1200, prompt_tokens_details: { cached_tokens: 1024 }, completion_tokens: 30 } }];
  await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: ev.map(e => 'data: ' + JSON.stringify(e) + '\n\n').join('') + 'data: [DONE]\n\n' });
});
await page.route('https://generativelanguage.googleapis.com/**', async route => {
  gm.push(JSON.parse(route.request().postData()));
  const ev = [{ candidates: [{ content: { parts: [{ text: '{"ok":1}' }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 1000, cachedContentTokenCount: 800, candidatesTokenCount: 40 } }];
  await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: ev.map(e => 'data: ' + JSON.stringify(e) + '\n\n').join('') });
});
await page.route('https://api.upstage.ai/v1/document-digitization', async route => { ocr.push(1); await route.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: '읽은 글' + ocr.length }) }); });
await page.route('https://api.upstage.ai/v1/chat/completions', async route => {
  upChat.push(JSON.parse(route.request().postData()));
  await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: 'data: ' + JSON.stringify({ choices: [{ delta: { content: '{"ok":1}' } }] }) + '\n\ndata: [DONE]\n\n' });
});
const setEngine = async (engine) => {
  await page.evaluate(e => localStorage.setItem('ssam:engine', JSON.stringify({ engine: e, keys: { [e]: 'k-test' }, remember: true })), engine);
  await page.reload(); await page.waitForTimeout(400);
};
/* 페이지 안에서: shared(그림 1 + 글 S)와 학생 그림 1 + 글 T로 n번 부르고 meter 합을 돌려줌 */
const call = (n = 1, json = false) => page.evaluate(async ({ n, json }) => {
  const ai = await import('./core/ai.js'), wire = await import('./core/ai-wire.js');
  const m = wire.newMeter(), A = { mime: 'image/jpeg', b64: '/9j/AAA=' };
  window.__shared = window.__shared || { text: '[공통] 정답표와 기준', images: [A] };
  for (let i = 0; i < n; i++) {
    const own = { mime: 'image/jpeg', b64: '/9j/BB' + i + '=' };
    if (json) await ai.generateJSON('[학생] ' + (i + 1) + '번', { shared: window.__shared, images: [own], meter: m, valid: v => !!v && v.a === 1 });
    else await ai.generate('[학생] ' + (i + 1) + '번', { shared: window.__shared, images: [own], meter: m });
  }
  return m.total();
}, { n, json });

await page.goto(url);
await page.waitForTimeout(400);

await run('ai-wire', [
  ['Claude: 공통 그림·글(cache_control)이 앞, 학생 그림·글이 뒤, 사용량이 meter에', async () => {
    await setEngine('claude');
    const tot = await call(1);
    const c = bodies.at(-1).messages[0].content;
    assert(JSON.stringify(c.map(x => x.type)) === '["image","text","image","text"]', JSON.stringify(c.map(x => x.type)));
    assert(c[1].text === '[공통] 정답표와 기준' && c[1].cache_control && c[1].cache_control.type === 'ephemeral' && !c[3].cache_control && c[3].text === '[학생] 1번', JSON.stringify(c.map(x => x.text)));
    assert(tot.sent === 1000 && tot.cached === 900 && tot.out === 50, JSON.stringify(tot));
  }],
  ['JSON 다시 묻기도 공통 글은 그대로(학생 글 끝에만 덧붙임)·사용량 두 번', async () => {
    const n0 = bodies.length;
    replies = ['모르겠어요', '{"a":1}'];
    const tot = await call(1, true);
    const [a, b] = bodies.slice(n0).map(x => x.messages[0].content);
    assert(bodies.length === n0 + 2 && a[1].text === b[1].text && b[3].text.startsWith('[학생] 1번') && b[3].text.includes('JSON만'), JSON.stringify(b.map(x => x.text)));
    assert(tot.out === 100 && tot.sent === 2000, JSON.stringify(tot));
  }],
  ['GPT: stream_options.include_usage, 공통 → 학생 차례, 마지막 조각 사용량', async () => {
    await setEngine('openai');
    const tot = await call(1);
    const b = oa.at(-1), c = b.messages[0].content;
    assert(b.stream_options && b.stream_options.include_usage === true, JSON.stringify(b).slice(0, 200));
    assert(JSON.stringify(c.map(x => x.type)) === '["image_url","text","image_url","text"]' && c[1].text === '[공통] 정답표와 기준', JSON.stringify(c.map(x => x.type)));
    assert(tot.sent === 1200 && tot.cached === 1024 && tot.out === 30, JSON.stringify(tot));
  }],
  ['Gemini: parts 공통 그림 → 공통 글 → 학생 그림 → 학생 글, 사용량', async () => {
    await setEngine('gemini');
    const tot = await call(1);
    const p = gm.at(-1).contents[0].parts;
    assert(p.length === 4 && p[0].inline_data && p[1].text === '[공통] 정답표와 기준' && p[2].inline_data && p[3].text === '[학생] 1번', JSON.stringify(p.map(x => Object.keys(x)[0])));
    assert(tot.sent === 1000 && tot.cached === 800 && tot.out === 40, JSON.stringify(tot));
  }],
  ['업스테이지: 같은 공통 그림은 한 번만 글자로 읽고, 공통 글이 학생 글보다 앞', async () => {
    await setEngine('upstage');
    await call(2);
    assert(ocr.length === 3, 'OCR ' + ocr.length);
    const m = upChat.at(-1).messages[0].content;
    assert(m.indexOf('[공통] 정답표와 기준') >= 0 && m.indexOf('[공통] 정답표와 기준') < m.indexOf('[학생] 2번') && m.indexOf('읽은 글1') < m.indexOf('[공통]'), m.slice(0, 300));
  }],
  ['미뤄 둔 M8: 요청 모양 모듈(SSAM_WIRE)이 아직 없어도 평가 메뉴 AI 부르기가 스스로 불러와 됨', async () => {
    await setEngine('claude');
    const r = await page.evaluate(async () => { delete window.SSAM_WIRE; const ai = await import('./core/ai.js'); return (await ai.generate('[학생] 1번', { shared: { text: '[공통]' } })).text; });
    assert(r === '{"ok":1}', r);
    const c = bodies.at(-1).messages[0].content;
    assert(c[0].text === '[공통]' && c[0].cache_control, JSON.stringify(c).slice(0, 200));
  }],
  ['페이지 오류 없음', async () => { assert(errors.length === 0, errors.join(' | ')); }]
]);
await t.close();
