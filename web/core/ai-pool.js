/* 동시 채점 일꾼 (스펙 2026-11-03 4장): 처음 start명, 연달아 3명 잘되면 1명씩 늘려 최대 max명.
   task(item)가 'rate'(AI 한도)를 돌려주면 그 학생을 줄 맨 앞에 다시 넣고, 동시 수를 절반(최소 1)으로, 모두 wait ms 쉼.
   1명씩 보냈는데 giveUp번 연달아 한도면 run.stop = true로 멈춤. run: { queue, stop } — 부르는 쪽과 같이 씀(멈추기) */
const SLICE = 250;

export function runPool(run, task, { start = 3, max = 4, wait = 20000, giveUp = 3, sleep = ms => new Promise(r => setTimeout(r, ms)), onWait = () => {} } = {}) {
  let limit = Math.max(1, Math.min(start, max)), active = 0, okRun = 0, soloRate = 0, gaveUp = false, pause = null;
  const workers = new Set();
  // 쉬는 동안에도 멈추기를 곧 알아채게 잘게 나눠 쉼
  const rest = async () => {
    onWait(true);
    for (let i = 0; i < Math.ceil(wait / SLICE) && !run.stop; i++) await sleep(SLICE);
    onWait(false);
  };
  return new Promise(resolve => {
    const spawn = () => {
      const p = worker();
      workers.add(p);
      p.finally(() => { workers.delete(p); if (!workers.size) resolve({ gaveUp }); });
    };
    async function worker() {
      for (;;) {
        if (pause) await pause;
        if (run.stop || !run.queue.length || active >= limit) return;
        const item = run.queue.shift(), solo = limit === 1;
        active++;
        let r = null;
        try { r = await task(item); } catch (e) { r = null; }
        active--;
        if (r === 'rate') {
          if (run.stop) return;
          run.queue.unshift(item);
          okRun = 0;
          if (solo && ++soloRate >= giveUp) { gaveUp = true; run.stop = true; return; }
          limit = Math.max(1, Math.floor(limit / 2));
          if (!pause) pause = rest().finally(() => { pause = null; });
        } else {
          soloRate = 0;
          if (++okRun >= 3 && limit < max) { limit++; okRun = 0; spawn(); }
        }
      }
    }
    for (let i = 0; i < limit && i < run.queue.length; i++) spawn();
    if (!workers.size) resolve({ gaveUp });
  });
}
