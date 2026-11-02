/* 단원평가: 정답지(「문항 이원 분류 및 모범 답안」 표)와 평가지 글을 AI 없이 읽기 (스펙 1, 3.1)
   글은 core/files.js의 readText 결과: 표는 줄마다 「칸 | 칸」 */
import { splitDoc } from '../../../core/bundle.js';

const CIRCLED = '①②③④⑤⑥⑦⑧⑨⑩';
const SYMBOLS = '㉮㉯㉰㉱㉲㉳㉴㉵㉶㉷㉸㉹㉺㉻㉠㉡㉢㉣㉤㉥㉦㉧㉨㉩㉪㉫㉬㉭';
const MARK = /^[○◯OoVv✓✔●◎]$/;
const cells = line => line.split('|').map(c => c.replace(/\s+/g, ' ').trim());
// 「5」·「5점」·「4.5」 → 앞의 수, 수가 아니면 0
const num = s => { const m = /^\s*(\d+(?:\.\d+)?)\s*(점)?\s*$/.exec(String(s)); return m ? Number(m[1]) : 0; };
// 문항 번호 칸: 「1」·「1.」·「1번」
const itemNo = s => { const m = /^(\d{1,2})\s*(?:\.|번)?$/.exec(String(s).trim()); return m ? Number(m[1]) : null; };

/* 문항 유형 짐작 (스펙 3.1 차례) */
export function itemType(answer, criteria) {
  const a = String(answer || '').trim();
  if (/^\(\s*예\s*\)/.test(a) || String(criteria || '').trim()) return 'essay';
  const bare = a.replace(/[\s,·/]|및/g, '');
  if (bare && [...bare].every(c => CIRCLED.includes(c))) return 'choice';
  if (/^(\(\s*\d+\s*\)\s*[○◯Oo]\s*)+$/.test(a)) return 'choice';
  if (/^\(\s*\d+\s*\)\s*[-–—~]/.test(a)) return 'match';
  if (bare && [...bare].every(c => SYMBOLS.includes(c))) return 'symbol';
  return 'short';
}

export const keyTotal = items => (items || []).reduce((s, i) => s + (Number(i.points) || 0), 0);

const SUBJ = /^(국어|수학|사회|과학|도덕|영어|음악|미술|체육|실과|통합)$/;
/* 머리에서 교과·학년-학기·단원 찾기 (따로 떨어진 줄 「도덕」·「3-2」·「4. 단원 이름」, 『과학』, 표 칸 「3. 동물의 생활」) */
function looseMeta(lines) {
  const head = lines.slice(0, 12).flatMap(l => cells(l)).filter(Boolean);
  const subj = head.find(c => SUBJ.test(c)) || (/『\s*([가-힣]+)\s*』/.exec(head.join(' ')) || [])[1] || '';
  const gt = head.map(c => /^(\d)\s*-\s*([12])$/.exec(c)).find(Boolean);
  const un = head.map(c => /^(\d{1,2})\.\s*([가-힣][^①-⑩|]*)$/.exec(c)).find(Boolean);
  return { subject: subj, grade: gt ? Number(gt[1]) : null, term: gt ? Number(gt[2]) : null, unitNo: un ? Number(un[1]) : null, unitName: un ? un[2].trim() : '' };
}

function keyMeta(lines) {
  const t = lines.join(' ');
  const m = (re, f = Number) => { const x = re.exec(t); return x ? f(x[1]) : null; };
  const l = looseMeta(lines);
  return {
    term: m(/([12])\s*학기/) ?? l.term,
    grade: m(/\(\s*(\d)\s*\)\s*학년/) ?? m(/(\d)\s*학년/) ?? l.grade,
    subject: m(/\(\s*([가-힣]+)\s*\)\s*과/, String) || l.subject,
    unitNo: m(/(\d+)\s*단원/) ?? l.unitNo,
    round: m(/\(\s*(\d+)\s*회\s*\)/) ?? m(/(\d+)\s*회/)
  };
}

/* 한글 문자표의 예시 답안 표시(사용자 영역 글자)는 「(예)」로, ⑴은 (1)로 */
const PUA = /^[\u{E000}-\u{F8FF}\u{F0000}-\u{FFFFD}]\s*/u;
const tidyAnswer = s => String(s || '').trim().replace(PUA, '(예) ').replace(/[⑴-⑽]/g, c => `(${c.charCodeAt(0) - 0x2473})`).replace(/\s+/g, ' ').trim();
const PTS = /^(배\s*점|점\s*수)/;
const NOT_DOMAIN = /정답|채점|문항|번호|내용|쪽|영역|난이도|배\s*점|점\s*수/;

/* 표로 된 정답지(문항 이원 분류표·이원 목적 분류표): 머리 이름으로 칸을 찾음 */
function tableKey(lines) {
  const h = lines.findIndex(l => l.includes('|') && cells(l).some(c => /문항|번호/.test(c)) && cells(l).some(c => /정답/.test(c)));
  if (h < 0) return null;
  const head = cells(lines[h]), next = lines[h + 1] ? cells(lines[h + 1]) : [];
  const pi = next.findIndex(c => PTS.test(c)), sub = pi >= 0 && itemNo(next[0]) == null;
  let names = head, domCols = [];
  if (sub && next.length >= head.length) {
    // 칸을 합치지 않았거나 합친 칸을 풀어 쓴 머리: 둘째 머리 줄의 칸 자리가 곧 열 자리(빈 칸은 첫 줄 이름)
    names = next.map((c, i) => c || head[i] || '');
    domCols = next.map((c, i) => (c && i < pi && c !== head[i] && !NOT_DOMAIN.test(c) ? i : -1)).filter(i => i >= 0);
  } else if (sub) {
    // 칸을 합친 머리(한글 파일 그대로): 둘째 머리 줄은 합친 칸 아래 칸만. 「…영역」은 배점 앞 칸들(영역 이름), 「배점 및 채점 기준」은 배점·채점 기준
    const doms = next.slice(0, pi), rest = next.slice(pi);
    names = [];
    for (const c of head) {
      if (/영역/.test(c) && doms.length) { domCols.push(...doms.map((_, j) => names.length + j)); names.push(...doms); }
      else if (PTS.test(c) && /채점|기준/.test(c)) names.push(...rest);
      else names.push(c);
    }
  }
  const at = re => names.findIndex(c => re.test(c));
  const col = { content: at(/내용/), answer: at(/정답/), points: at(PTS), pages: at(/쪽/) };
  col.criteria = names.findIndex((c, i) => i !== col.points && /채점/.test(c));
  // 영역을 ○로 적는 칸들이 없으면 「평가 영역」 칸의 글이 영역
  const domText = domCols.length ? -1 : at(/영역/);
  const items = [];
  for (let i = sub ? h + 2 : h + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes('|')) continue;
    const c = cells(line);
    const get = k => (col[k] >= 0 && c[col[k]] != null ? c[col[k]] : '');
    if (itemNo(c[0]) != null) {
      const domain = domCols.length ? domCols.filter(j => MARK.test(c[j] || '')).map(j => names[j]).join('·') : (domText >= 0 ? c[domText] || '' : '');
      items.push({ no: itemNo(c[0]), content: get('content'), domain, type: '', answer: tidyAnswer(get('answer')), points: num(get('points')), criteria: get('criteria'), pages: get('pages') });
    } else if (!c[0] && items.length) {
      // 첫 칸이 빈 줄: 앞 문항의 칸에 이어 붙임
      const last = items[items.length - 1];
      for (const k of ['answer', 'criteria', 'pages']) { const v = get(k); if (v) last[k] = (last[k] ? last[k] + ' ' : '') + v; }
    }
  }
  // 정답이나 배점이 빈 문항이 절반을 넘으면 표 모양을 잘못 읽은 것
  if (!items.length || items.filter(i => !i.answer || !i.points).length > items.length / 2) return null;
  const domains = domCols.length ? domCols.map(j => names[j]) : [...new Set(items.map(i => i.domain).filter(Boolean))];
  return { meta: keyMeta(lines.slice(0, h)), domains, items };
}

/* 번호 표시: 「01」·「1.」·「1번」. 처음 번호의 꼴(두 자리·점)을 끝까지 따름 (10부터는 원래 두 자리) */
const MARK_RE = /(^|\s)(0?\d{1,2})(\.|번)?(?=\s|$)/g;
function markers(line, from, style) {
  const out = [];
  let want = from, m;
  MARK_RE.lastIndex = 0;
  while ((m = MARK_RE.exec(line))) {
    const n = Number(m[2]), st = { pad: /^0\d$/.test(m[2]), dot: !!m[3] };
    if (n !== want) continue;
    if (style && ((n < 10 && st.pad !== style.pad) || st.dot !== style.dot)) continue;
    style = style || st;
    out.push({ n, at: m.index + m[1].length, end: m.index + m[0].length });
    want++;
  }
  return { list: out, style };
}
/* 해설 속 채점 표 한 줄 → 「상: …」·「… : 100%」 (머리 줄은 뺌) */
function rubricRow(line) {
  const c = cells(line).filter(Boolean);
  if (c.length < 2 || c.every(x => /^(배\s*점|채점\s*기준|점수)$/.test(x))) return '';
  const pct = /^(\d+)\s*%$/.exec(c[c.length - 1]);
  return pct ? `${c.slice(0, -1).join(' ')}: ${pct[1]}%` : `${c[0]}: ${c.slice(1).join(' ')}`;
}

/* 정답을 한 줄로 늘어놓은 정답·해설지(「01 ④ 02 ③ …」·「1. ③ 2. ④ …」)와 그 뒤 문항별 해설·채점 기준 표 */
function inlineKey(lines) {
  // 정답 줄: 표 줄(|)이 아니고, 그 줄이나 바로 위 몇 줄에 「정답」 머리가 있어야 함 (계획서의 번호 붙은 중점 과제 등은 빼려고)
  const nearAnswerHead = i => lines.slice(Math.max(0, i - 5), i + 1).some(l => /정답/.test(l));
  let a = -1, mk = null;
  for (let i = 0; i < lines.length && a < 0; i++) {
    if (lines[i].includes('|')) continue;
    const r = markers(lines[i], 1);
    if (r.list.length >= 3 && r.list[0].at <= 1 && nearAnswerHead(i)) { a = i; mk = r; }
  }
  if (a < 0) return null;
  const style = mk.style, answers = {};
  let last = 0, i = a;
  for (; i < lines.length; i++) {
    const r = i === a ? mk : markers(lines[i], last + 1, style);
    if (i > a && (r.list.length < 2 || r.list[0].at > 1)) break;
    r.list.forEach((x, j) => { answers[x.n] = lines[i].slice(x.end, j + 1 < r.list.length ? r.list[j + 1].at : undefined); });
    last = r.list[r.list.length - 1].n;
  }
  // 해설: 같은 꼴의 번호로 시작하는 줄부터 다음 번호 앞까지. 그 안의 표 줄은 채점 기준
  const expl = {}, rub = {};
  let cur = 0;
  for (; i < lines.length; i++) {
    const line = lines[i].trim();
    if (/이원\s*(목적\s*)?분류/.test(line)) break;
    const r = markers(line, cur + 1, style);
    if (r.list.length && r.list[0].at === 0) { cur = r.list[0].n; expl[cur] = [line.slice(r.list[0].end).trim()].filter(Boolean); rub[cur] = []; continue; }
    if (!cur || !line) continue;
    if (line.includes('|')) { const x = rubricRow(line); if (x) rub[cur].push(x); }
    else if (!/^모범\s*답안$/.test(line)) expl[cur].push(line);
  }
  const nos = Object.keys(answers).map(Number).sort((x, y) => x - y);
  const base = Math.floor(100 / nos.length), extra = 100 - base * nos.length;
  const items = nos.map((no, k) => {
    let answer = tidyAnswer(answers[no]);
    const ex = (expl[no] || []).join(' ').trim(), rb = rub[no] || [];
    let criteria = '';
    if (/해설\s*참조/.test(answer) && ex) { answer = '(예) ' + (expl[no][0] || ex); criteria = rb.join(' / '); }
    else if (rb.length || /^\(\s*예\s*\)/.test(answer)) criteria = [ex, ...rb].filter(Boolean).join(' / ');
    return { no, content: '', domain: '', type: itemType(answer, criteria), answer, points: base + (k >= nos.length - extra ? 1 : 0), criteria, pages: '' };
  });
  return { meta: keyMeta(lines.slice(0, a)), domains: [], items, pointsGuessed: true };
}

/* 정답지 글 → { meta, domains, items[, pointsGuessed] } 또는 null(AI로 읽게). 표가 있으면 표, 없으면 한 줄 정답 */
export function parseKey(text) {
  const lines = String(text || '').split('\n');
  const k = tableKey(lines) || inlineKey(lines);
  if (!k) return null;
  k.items.forEach(it => { it.type = itemType(it.answer, it.criteria); });
  return k;
}

/* 문제지와 정답이 한 파일이면 「정답 (및 해설)」 줄 앞뒤로 나눔 → { paper, key }. 문제가 없으면 paper는 빈 글 */
export function splitCombined(text) {
  const src = String(text || ''), lines = src.split('\n');
  const i = lines.findIndex(l => /^\s*(\|\s*)?정답(\s*및\s*해설지?)?\s*(\||$)/.test(l));
  if (i < 0) {
    // 「교사용」·「(예시)」·「[정답]」 같은 표시나 같은 머리가 다시 나오는 한 파일도 나눔 (한꺼번에 넣기 규칙)
    const d = splitDoc(src);
    return d.teacher ? { paper: d.student, key: d.teacher } : { paper: src, key: '' };
  }
  const paper = lines.slice(0, i).join('\n').trim(), key = lines.slice(i).join('\n').trim();
  return Object.keys(parsePaper(paper).questions).length >= 2 ? { paper, key } : { paper: '', key: src.trim() };
}

const BLANK_END = /\s*\(\s*(?:,\s*)*\)\s*$/;
const ASK = /(까\?|시오\.|봅시다\.|세요\.)$/;
const NOT_STEM = /^([①-⑩⑴-⑽▲※]|\(\d+\)|\[\s*\d+\s*~\s*\d+\s*\]|서술형$)/;
/* 문항 찾기 셋: 번호만 있는 줄 다음 줄, 「01 발문」·「1. 발문」, 번호가 사라진 문서(자동 번호)는 묻는 말로 끝나는 줄 */
function questionsAlone(lines) {
  const q = {};
  let expect = 1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] !== String(expect)) continue;
    let j = i + 1;
    while (j < lines.length && (!lines[j] || lines[j].startsWith('※'))) j++;
    if (j < lines.length) q[expect] = lines[j].slice(0, 200);
    expect++;
  }
  return q;
}
function questionsLead(lines) {
  const q = {};
  let style = null;
  for (const l of lines) {
    const m = /^(0?\d{1,2})(\.|번)?\s+(\S.*)$/.exec(l);
    if (!m || Number(m[1]) !== Object.keys(q).length + 1) continue;
    const st = { pad: /^0\d$/.test(m[1]), dot: !!m[2] };
    if (style && ((Number(m[1]) < 10 && st.pad !== style.pad) || st.dot !== style.dot)) continue;
    style = style || st;
    q[Number(m[1])] = m[3].replace(BLANK_END, '').trim().slice(0, 200);
  }
  return q;
}
function questionsStem(lines) {
  const q = {};
  for (const l of lines) {
    if (!l || NOT_STEM.test(l)) continue;
    const s = l.replace(BLANK_END, '').trim();
    if (ASK.test(s)) q[Object.keys(q).length + 1] = s.slice(0, 200);
  }
  return q;
}

export function parsePaper(text) {
  const lines = String(text || '').split('\n').map(l => l.trim());
  const head = lines.slice(0, 4).join(' ');
  const sg = /([가-힣]+)\s*(\d)\s*-\s*([12])/.exec(head);
  const un = /(\d+)\.\s*([^|(]+?)\s*\(\s*(\d+)\s*회\s*\)/.exec(head);
  const l = looseMeta(lines), rd = /(\d+)\s*회/.exec(lines.slice(0, 4).join(' '));
  const meta = {
    subject: sg ? sg[1] : l.subject, grade: sg ? Number(sg[2]) : l.grade, term: sg ? Number(sg[3]) : l.term,
    unitNo: un ? Number(un[1]) : l.unitNo, unitName: un ? un[2].trim() : l.unitName, round: un ? Number(un[3]) : rd ? Number(rd[1]) : null
  };
  const counts = [questionsAlone(lines), questionsLead(lines)];
  const best = counts.find(q => Object.keys(q).length >= 2);
  return { meta, questions: best || questionsStem(lines) };
}
