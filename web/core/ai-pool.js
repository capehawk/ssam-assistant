/* 동시 채점 일꾼 (스펙 2026-11-03 4장): 처음 start명, 연달아 3명 잘되면 1명씩 늘려 최대 max명.
   task(item)가 'rate'(AI 한도)를 돌려주면 그 학생을 줄 맨 앞에 다시 넣고, 동시 수를 절반(최소 1)으로, 모두 wait ms 쉼.
   1명씩 보냈는데 giveUp번 연달아 한도면 run.stop = true, 줄을 비우고 멈춤. run: { queue, stop } — 부르는 쪽과 같이 씀(멈추기).
   warm: 첫 학생은 혼자 보내고 끝난 뒤 나머지를 함께 — 공통 부분 캐시를 한 번만 써서(동시에 보내면 모두 캐시 쓰기 값을 냄).
   task가 { rate: ms }를 돌려주면(AI가 알려 준 기다릴 시간) 20초보다 길 때 그만큼 쉼(최대 2분) */
const SLICE = 250, MAX_WAIT = 120000;

export function runPool(run, task, { start = 3, max = 4, wait = 20000, giveUp = 3, warm = false, sleep = ms => new Promise(r => setTimeout(r, ms)), onWait = () => {} } = {}) {
  const full = Math.max(1, Math.min(start, max));
  // epoch: 한도에 걸릴 때마다 +1 — 그 전에 보낸 요청의 성공은 동시 수를 다시 늘리는 데 세지 않음
  let limit = warm ? 1 : full, warming = !!warm, active = 0, okRun = 0, soloRate = 0, gaveUp = false, pause = null, epoch = 0, restMs = wait;
  const workers = new Set();
  // 쉬는 동안에도 멈추기를 곧 알아채게 잘게 나눠 쉼(쉬는 중에 더 긴 기다림을 알려 오면 늘림)
  const rest = async () => {
    onWait(true);
    for (let i = 0; i * SLICE < restMs && !run.stop; i++) await sleep(SLICE);
    restMs = wait;
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
        const item = run.queue.shift(), solo = limit === 1, sent = epoch;
        active++;
        let r = null;
        try { r = await task(item); } catch (e) { r = null; }
        active--;
        if (r === 'rate' || (r && typeof r === 'object' && r.rate > 0)) {
          if (run.stop) return;
          run.queue.unshift(item);
          okRun = 0;
          if (solo && ++soloRate >= giveUp) { gaveUp = true; run.stop = true; run.queue = []; return; }
          if (sent === epoch) { limit = Math.max(1, Math.floor(limit / 2)); epoch++; }
          if (r.rate > 0) restMs = Math.max(restMs, Math.min(MAX_WAIT, r.rate));
          if (!pause) pause = rest().finally(() => { pause = null; });
        } else if (warming) {
          // 첫 학생이 끝나 공통 부분이 캐시에 있음 → 처음 정한 수만큼 함께
          warming = false; soloRate = 0; limit = full;
          for (let k = 1; k < full; k++) spawn();
        } else {
          soloRate = 0;
          if (sent === epoch && ++okRun >= 3 && limit < max) { limit++; okRun = 0; spawn(); }
        }
      }
    }
    for (let i = 0; i < limit && i < run.queue.length; i++) spawn();
    if (!workers.size) resolve({ gaveUp });
  });
}
