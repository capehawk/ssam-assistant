/* 회신서 모으기 (스펙 2026-11-04 6장): 회신서 칸 가운데 □가 있는 칸만, 이름 칸을 가린 스캔 그림에서 AI가 번호와 ☑만 읽음.
   번호 × 칸 표·집계·미제출 번호·복사·문서. 학생 이름은 읽지도 저장하지도 않음. 화면 없이 돌아감(시험) */
const str = v => String(v == null ? '' : v).trim();

/* 「참가 여부: □ 참가합니다  □ 참가하지 않습니다」 → { name: '참가 여부', options: ['참가합니다', '참가하지 않습니다'] } */
export function replyOptions(fields) {
  const out = [];
  for (const f of fields || []) {
    const s = str(f);
    if (!s.includes('□')) continue;
    const i = s.indexOf('□'), head = s.slice(0, i).replace(/[:：]\s*$/, '').trim();
    const options = s.slice(i).split('□').map(x => x.trim()).filter(Boolean);
    if (head && options.length) out.push({ name: head, options });
  }
  return out;
}

export function replyPrompt(opts) {
  return ['[회신서 읽기]',
    '보호자가 써서 낸 가정통신문 회신서(신청서·동의서) 스캔 그림 한 장입니다. 학생 이름 칸은 흰색으로 가려 두었습니다.',
    '- no: 「학년 반 번호」 칸에 적힌 번호(반이 아니라 번호, 숫자만). 못 읽으면 null',
    '- answers: 아래 칸마다 ☑·✓·V·○·■로 표시한 선택지 글 그대로. 표시가 없거나 둘 이상이면 ""',
    '- unsure: 표시가 흐리거나 애매해 확실하지 않은 칸 이름',
    '학생 이름·보호자 이름·서명·연락처는 읽지도 쓰지도 마세요.',
    '칸:', ...opts.map(o => `- ${o.name}: ${o.options.join(' / ')}`),
    `{"no":12,"answers":{${opts.map(o => `"${o.name}":"${o.options[0]}"`).join(',')}},"unsure":[]}`].join('\n');
}

/* AI 답 → { no: 1~99 | null, answers: { 칸: 선택지 | '' }, unsure: [칸](빈 답도) } */
export function normReply(v, opts) {
  const o = v && typeof v === 'object' && !Array.isArray(v) ? v : {}, a = o.answers && typeof o.answers === 'object' ? o.answers : {};
  // 「3학년 2반 15번」·「3-2-15」 → 15(「번」 앞 숫자, 없으면 마지막 숫자)
  const sn = str(o.no), byBeon = /(\d+)\s*번/.exec(sn), all = sn.match(/\d+/g), n = byBeon ? +byBeon[1] : all ? +all[all.length - 1] : NaN;
  const said = new Set((Array.isArray(o.unsure) ? o.unsure : []).map(str));
  const answers = {}, unsure = [];
  const sq = x => str(x).replace(/\s+/g, '');
  for (const { name, options } of opts) {
    const t = sq(a[name]), exact = t ? options.find(x => sq(x) === t) : '';
    // 띄어쓰기만 다르면 그 선택지. 아니면 빈칸·「못 읽음」 — 「동의하지 않음」이 「동의」로 들어가지 않게 선생님이 고름
    answers[name] = exact || '';
    if (!exact || said.has(name)) unsure.push(name);
  }
  return { no: n >= 1 && n <= 99 ? n : null, answers, unsure };
}

/* 줄 표시: 번호 없음 'none', 같은 번호가 둘 이상 'dup' */
export function flagRows(rows) {
  const cnt = new Map();
  for (const r of rows) if (r.no != null) cnt.set(r.no, (cnt.get(r.no) || 0) + 1);
  return rows.map(r => ({ ...r, warn: r.no == null ? 'none' : cnt.get(r.no) > 1 ? 'dup' : '' }));
}
export function tally(rows, opts) {
  return opts.map(({ name, options }) => {
    const ans = rows.map(r => str((r.answers || {})[name]));
    return { name, counts: options.map(x => [x, ans.filter(a => a === x).length]), blank: ans.filter(a => !a).length };
  });
}
/* 미제출: allowed(명단 번호 Set) 중 없는 번호, 명단이 없으면 1~가장 큰 번호 */
export function missingNos(rows, allowed) {
  const got = new Set(rows.map(r => r.no).filter(n => n != null));
  const all = allowed ? [...allowed] : Array.from({ length: Math.max(0, ...got) }, (_, i) => i + 1);
  return all.filter(n => !got.has(n)).sort((a, b) => a - b);
}
const byNo = rows => [...rows].sort((a, b) => (a.no == null) - (b.no == null) || (a.no || 0) - (b.no || 0));
export function collectTSV(rows, opts) {
  return [['번호', ...opts.map(o => o.name)], ...byNo(rows).map(r => [r.no == null ? '?' : String(r.no), ...opts.map(o => str((r.answers || {})[o.name]))])].map(r => r.join('\t')).join('\n');
}
export function collectDoc(rows, opts, { title = '회신서', allowed = null } = {}) {
  const t = tally(rows, opts), miss = missingNos(rows, allowed);
  return { title: `${str(title) || '회신서'} 회신 결과`, blocks: [
    { type: 'p', text: `낸 회신서 ${rows.length}장${miss.length ? ` · 미제출: ${miss.join(', ')}번` : ' · 모두 냈어요'}` },
    ...t.map(x => ({ type: 'p', text: `${x.name}: ${x.counts.map(([o, n]) => `${o} ${n}명`).join(', ')}${x.blank ? `, 표시 없음 ${x.blank}명` : ''}` })),
    { type: 'table', head: true, rows: [['번호', ...opts.map(o => o.name)], ...byNo(rows).map(r => [r.no == null ? '?' : String(r.no), ...opts.map(o => str((r.answers || {})[o.name]))])] }] };
}
