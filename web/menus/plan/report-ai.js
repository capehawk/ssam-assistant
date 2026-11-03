/* 계획 › 결과 보고 (스펙 2026-11-03 5장): 계획서·관련 공문·작년 보고서·한 일 메모·사진 → AI 한 번 → 칸.
   결과 보고 공문(에듀파인 기안 꼴)과 결과 보고서(개요 표·소제목·사진 자료)는 앱이 맞춤. 화면 없이 돌아감(시험) */
import { normDate, fmtDay } from '../etc/message-ai.js';
import { attachText } from '../purchase/rules.js';

export const SOURCE_KINDS = [['plan', '계획서'], ['official', '관련 공문'], ['last', '작년 보고서'], ['etc', '기타']];
const KIND_IDS = SOURCE_KINDS.map(k => k[0]);
export const kindLabel = k => (SOURCE_KINDS.find(x => x[0] === k) || SOURCE_KINDS[3])[1];

const PHONE = /0\d{1,2}[-.\s)]?\d{3,4}[-.\s]?\d{4}/g;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/g;
const clean = (v, n) => String(v == null ? '' : v).replace(PHONE, '').replace(EMAIL, '').replace(/\(\s*문의\s*\)|\(\s*\)/g, '').replace(/[ \t]+/g, ' ').trim().slice(0, n);
const KO = '가나다라마바사아자차카타파하';

/* 넣은 문서의 종류 짐작: 이름·첫 줄에 「결과」·「보고」 → 작년 보고서, 이름에 「공문」이나 위쪽에 수신·발신·문서번호 꼴 → 관련 공문, 나머지 계획서 */
export function guessSourceKind(name, text, year) {
  const n = String(name || ''), head = String(text || '').split('\n').map(l => l.trim()).filter(Boolean);
  const first = head[0] || '', top = head.slice(0, 8).join('\n');
  if (/작년|전년|지난\s*해/.test(n) || /결과\s*보고|보고서/.test(n) || /결과\s*보고/.test(first)) return 'last';
  if (/공문/.test(n) || /^\s*수\s*신(\s|:|$)/m.test(top) || /(^|\n)\s*(시행|발신|접수)\s/.test(top) || /[가-힣A-Za-z]+-\d{2,6}\s*\(\s*\d{4}\s*\.\s*\d{1,2}\s*\.\s*\d{1,2}/.test(top)) return 'official';
  return 'plan';
}

/* nPhotos: 앞에 붙인 행사 사진 수, nDocImages: 그 뒤 글로 읽지 못한 문서(스캔본) 쪽 그림 수 */
export function reportPrompt({ sources = [], memo = '', nPhotos = 0, nDocImages = 0, year } = {}) {
  const docs = sources.filter(s => s && String(s.text || '').trim())
    .map(s => `[${kindLabel(s.kind)}: ${String(s.name || '글').slice(0, 60)}]\n${String(s.text).slice(0, 6000)}`).join('\n\n');
  const hasLast = sources.some(s => s && s.kind === 'last' && String(s.text || '').trim());
  return ['[결과 보고]',
    `학교 행사·사업이 끝난 뒤 쓰는 결과 보고의 내용을 뽑고 씁니다. 학년도: ${year || new Date().getFullYear()}.`,
    nPhotos ? `첨부한 그림 중 앞의 사진 ${nPhotos}장은 행사 장면입니다(차례대로 사진 1, 2, …). 사진마다 무엇을 하는 장면인지 짧게 설명합니다(사람 이름·얼굴 묘사는 쓰지 않음).` : '',
    nDocImages ? `${nPhotos ? '그 뒤' : '첨부한'} 그림 ${nDocImages}장은 글로 읽지 못한 문서(스캔본)의 쪽입니다. 사진이 아니므로 photos에 넣지 않습니다.` : '',
    '- name: 행사·사업 이름(연도 포함, 예: 2026 과학의 날 행사). 「계획」·「결과 보고」 같은 말은 뺍니다.',
    '- related: 관련 문서(계획서·공문)마다 {"no":"문서번호(예: ○○초-1234)","date":"YYYY-MM-DD","title":"문서 제목"}. 모르면 빈 글. 없으면 [].',
    '- period: {"start":"YYYY-MM-DD","end":"며칠에 걸쳤으면 끝 날","time":"시간(있으면)"}, place: 장소, target: 대상, count: 참여 인원(예: 320명)',
    '- summary: 주요 내용 한 줄(공문의 「주요 내용」에 들어감)',
    `- sections: 결과 보고서의 소제목과 줄. ${hasLast ? '작년 보고서의 소제목 차례와 문체를 따르되 올해 내용으로 씁니다(개요·사진은 앱이 따로 만들므로 빼고).' : '「목적」·「추진 내용」·「성과」·「반성 및 개선 방안」 차례로.'} 줄은 짧은 개조식(~함, ~임).`,
    nPhotos ? '- photos: 사진마다 설명 한 줄(차례대로, 사진 수만큼)' : '- photos: []',
    '- 한 일 메모와 문서에 없는 성과·숫자·만족도는 지어내지 않습니다. 사람 이름·전화번호·이메일은 쓰지 않습니다.',
    '', docs ? docs : '(넣은 문서 없음)', '', '[한 일]', String(memo || '').slice(0, 4000) || '(메모 없음)',
    '', '[출력] JSON 하나만 출력합니다.',
    '{"name":"…","related":[{"no":"","date":"","title":""}],"period":{"start":"","end":"","time":""},"place":"","target":"","count":"","summary":"…","sections":[{"h":"목적","lines":["…"]}],"photos":["…"]}']
    .filter(l => l !== '').join('\n').replace('[출력]', '\n[출력]');
}

/* AI 답 → 결과 보고 칸. year: 연도 없는 날에 붙일 학년도 */
export function normReport(v, { year } = {}) {
  const o = v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  const p = o.period && typeof o.period === 'object' ? o.period : {};
  const start = normDate(p.start, year);
  let end = start ? normDate(p.end, Number(start.slice(0, 4))) : '';
  if (end && end <= start) end = '';
  const arr = x => (Array.isArray(x) ? x : []);
  return {
    name: clean(o.name, 80),
    related: arr(o.related).filter(x => x && typeof x === 'object').slice(0, 4).map(x => ({ no: clean(x.no, 40), date: normDate(x.date, year), title: clean(x.title, 100) })).filter(x => x.no || x.title),
    period: { start, end, time: clean(p.time, 40) },
    place: clean(o.place, 80), target: clean(o.target, 80), count: clean(o.count, 40), summary: clean(o.summary, 200),
    sections: arr(o.sections).filter(s => s && typeof s === 'object').map(s => ({ h: clean(s.h, 40), lines: arr(s.lines).map(l => clean(l, 300)).filter(Boolean).slice(0, 20) }))
      .filter(s => s.h && s.lines.length).slice(0, 8),
    photos: arr(o.photos).slice(0, 12).map(x => (typeof x === 'string' ? clean(x, 80) : ''))
  };
}

/* 「2026 과학의 날 행사」 → 「2026 과학의 날 행사 운영」 (이미 「운영」이 있으면 그대로) */
export function reportBase(r) {
  const n = String((r && r.name) || '').trim() || '행사';
  return /운영$/.test(n) ? n : `${n} 운영`;
}
export const reportTitle = r => `${reportBase(r)} 결과 보고서`;
const dotDate = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '')); return m ? `${+m[1]}. ${+m[2]}. ${+m[3]}.` : ''; };
export const relText = x => [x.no ? `${x.no}${x.date ? `(${dotDate(x.date)})` : ''}` : '', x.title ? `「${x.title}」` : ''].filter(Boolean).join(' ');
const periodText = p => [p.start ? (p.end ? `${fmtDay(p.start)}~${fmtDay(p.end, { noYear: p.end.slice(0, 4) === p.start.slice(0, 4) })}` : fmtDay(p.start)) : '', p.time].filter(Boolean).join(' ');
const targetText = r => (r.target && r.count ? `${r.target}(${r.count})` : r.target || r.count || '');

/* 결과 보고 공문 { title, body } (에듀파인 기안 본문 꼴) */
export function composeReportLetter(r) {
  const x = r || normReport(null), base = reportBase(x);
  const rel = (x.related || []).map(relText).filter(Boolean);
  const lines = [];
  let no = 1;
  if (rel.length === 1) lines.push(`${no++}. 관련: ${rel[0]}`);
  else if (rel.length > 1) lines.push(`${no++}. 관련: ${rel.map((t, i) => `${i ? '         ' : ''}${KO[i]}. ${t}`).join('\n')}`);
  lines.push(`${no}. ${rel.length ? '위 호와 관련하여 ' : ''}${base} 결과를 다음과 같이 보고합니다.`);
  [['일시', periodText(x.period || {})], ['장소', x.place], ['대상', targetText(x)], ['주요 내용', x.summary]]
    .filter(([, v]) => String(v || '').trim()).forEach(([l, v], i) => lines.push(`  ${KO[i]}. ${l}: ${v}`));
  lines.push('', attachText([`${reportTitle(x)} 1부`]));
  return { title: `${base} 결과 보고`, body: lines.join('\n') };
}

/* 결과 보고서 { title, blocks }. photos: [{ bytes, w, h }](화면에만 있는 사진), captions: 선생님이 고친 설명(비면 AI 설명) */
export function reportDoc(r, photos = [], captions = []) {
  const x = r || normReport(null);
  const rows = [['행사명', x.name], ['일시', periodText(x.period || {})], ['장소', x.place], ['대상', targetText(x)], ['관련', (x.related || []).map(relText).filter(Boolean).join('\n')]]
    .filter(([, v]) => String(v || '').trim());
  const blocks = [{ type: 'h', text: '1. 개요' }, { type: 'table', head: true, rows: [['구분', '내용'], ...rows] }];
  let n = 2;
  for (const s of x.sections || []) {
    blocks.push({ type: 'h', text: `${n++}. ${s.h}` }, { type: 'p', text: s.lines.map(l => (/^\s*([-·•○※]|\d+[.)]|[가-하][.)])\s*/.test(l) ? l.replace(/^\s*[·•]\s*/, '- ') : `- ${l}`)).join('\n') });
  }
  const items = (photos || []).filter(p => p && p.bytes && p.bytes.length).map((p, i) => ({ ...p, caption: String(captions[i] || '').trim() || String((x.photos || [])[i] || '').trim() }));
  if (items.length) blocks.push({ type: 'h', text: `${n}. 사진 자료` }, { type: 'photos', items });
  return { title: reportTitle(x), blocks };
}

/* 에듀파인 공문 기안에 차례로 붙여넣기 조각 */
export const letterQueueItems = l => [{ label: '제목', text: String((l && l.title) || '') }, { label: '본문', text: String((l && l.body) || '') }];
export const isKind = k => KIND_IDS.includes(k);
