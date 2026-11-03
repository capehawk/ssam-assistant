// 동시 채점 일꾼: 처음 3명, 잘되면 4명까지, 한도('rate')면 그 학생을 줄 맨 앞에 다시·절반·쉼, 1명에서 세 번 연달아면 멈춤
import test from 'node:test';
import assert from 'node:assert/strict';
import { runPool } from '../../web/core/ai-pool.js';

const tick = () => new Promise(r => setImmediate(r));
const sleep = async () => { await tick(); };
/* 동시에 몇 개가 도는지 세는 task. hold번 tick 동안 붙잡음 */
function counter({ rateOnce = new Set(), always = false, hold = 3 } = {}) {
  const s = { now: 0, max: 0, calls: [], firstBatch: null, seen: new Set(), seq: [] };
  s.task = async item => {
    s.now++; s.max = Math.max(s.max, s.now); s.calls.push(item); s.seq.push(s.now);
    for (let k = 0; k < hold; k++) await tick();
    s.now--;
    if (always) return 'rate';
    if (rateOnce.has(item) && !s.seen.has(item)) { s.seen.add(item); return 'rate'; }
    return 'ok';
  };
  return s;
}

test('처음 3명이 동시에 시작하고, 잘되면 4명까지 늘지만 넘지 않음', async () => {
  const c = counter(), run = { queue: [...Array(14).keys()], stop: false };
  const r = await runPool(run, c.task, { sleep });
  assert.equal(r.gaveUp, false);
  assert.equal(c.calls.length, 14);
  assert.deepEqual(c.seq.slice(0, 3), [1, 2, 3]);
  assert.equal(c.max, 4);
});

test('한도 → 그 학생은 줄 맨 앞에 다시(끝내 처리), 동시 수는 절반, 한 번만 쉼', async () => {
  const c = counter({ rateOnce: new Set([1]) }), run = { queue: [0, 1, 2, 3, 4, 5], stop: false }, waits = [];
  let after = 0;
  const r = await runPool(run, async it => { const v = await c.task(it); if (waits.length) after = Math.max(after, c.now + 1); return v; }, { sleep, onWait: on => waits.push(on) });
  assert.equal(r.gaveUp, false);
  assert.deepEqual([...new Set(c.calls)].sort(), [0, 1, 2, 3, 4, 5]);
  assert.equal(c.calls.filter(x => x === 1).length, 2);
  assert.deepEqual(waits, [true, false]);
  assert.ok(after <= 2, '쉰 뒤 동시 수 ' + after);
});

test('1명씩인데 세 번 연달아 한도면 멈춤', async () => {
  const c = counter({ always: true }), run = { queue: [0, 1, 2, 3], stop: false };
  const r = await runPool(run, c.task, { sleep });
  assert.equal(r.gaveUp, true);
  assert.equal(run.stop, true);
});

test('쉬는 중에 멈추면 더 부르지 않고 끝남', async () => {
  const c = counter({ rateOnce: new Set([0]) }), run = { queue: [0, 1, 2, 3, 4, 5, 6], stop: false };
  const r = await runPool(run, c.task, { sleep, onWait: on => { if (on) { run.stop = true; run.queue = []; } } });
  const n = c.calls.length;
  await tick(); await tick();
  assert.equal(c.calls.length, n);
  assert.ok(n <= 3, '부른 수 ' + n);
  assert.equal(r.gaveUp, false);
});

test('Claude 계정(start=max=2)은 2명을 넘지 않음', async () => {
  const c = counter(), run = { queue: [...Array(9).keys()], stop: false };
  await runPool(run, c.task, { start: 2, max: 2, sleep });
  assert.equal(c.max, 2);
  assert.equal(c.calls.length, 9);
});

test('task가 던지면(멈춘 채점) 그 일꾼은 다음 학생으로 — 풀은 끝까지', async () => {
  const run = { queue: [0, 1, 2], stop: false }, done = [];
  await runPool(run, async it => { if (it === 1) throw new Error('x'); done.push(it); }, { sleep });
  assert.deepEqual(done.sort(), [0, 2]);
});

test('최종 검토 I1: 한도로 멈추면 줄을 비움(화면이 「채점하는 중」에 멈추지 않게)', async () => {
  const c = counter({ always: true }), run = { queue: [0, 1, 2, 3, 4], stop: false };
  const r = await runPool(run, c.task, { sleep });
  assert.equal(r.gaveUp, true);
  assert.deepEqual(run.queue, []);
});

test('최종 검토 M4: warm이면 첫 학생 혼자 끝난 뒤(캐시를 써 둔 뒤) 나머지가 함께', async () => {
  let done = 0;
  const starts = [], c = counter(), run = { queue: [...Array(8).keys()], stop: false };
  await runPool(run, async it => { starts.push(done); const v = await c.task(it); done++; return v; }, { sleep, warm: true });
  assert.equal(c.calls.length, 8);
  assert.equal(starts[0], 0);
  assert.ok(starts.slice(1, 4).every(d => d === 1), JSON.stringify(starts));
  assert.ok(c.max >= 3 && c.max <= 4, '동시 ' + c.max);
});

test('미뤄 둔 M5: 한도 전에 보낸 요청의 성공은 다시 늘리는 데 세지 않음(절반으로 줄인 수가 바로 되돌아가지 않게)', async () => {
  const s = { now: 0, seq: [], rated: false, after: [] };
  const task = async it => {
    s.now++; if (s.rated) s.after.push(s.now);
    const hold = it === 0 ? 1 : it < 4 ? 6 : 3;
    for (let k = 0; k < hold; k++) await tick();
    s.now--;
    if (it === 0 && !s.rated) { s.rated = true; return 'rate'; }
    return 'ok';
  };
  const run = { queue: [...Array(9).keys()], stop: false };
  await runPool(run, task, { start: 4, max: 4, sleep });
  assert.ok(s.after.slice(0, 4).every(n => n <= 2), JSON.stringify(s.after));
});

test('미뤄 둔 M7: AI가 알려 준 기다릴 시간({ rate: ms })이 20초보다 길면 그만큼 쉼', async () => {
  let slices = 0, once = true;
  const run = { queue: [0, 1], stop: false };
  await runPool(run, async () => { await tick(); if (once) { once = false; return { rate: 50000 }; } return 'ok'; }, { start: 1, sleep: async () => { slices++; await tick(); } });
  assert.ok(slices >= 200, '쉰 조각 ' + slices);
});
