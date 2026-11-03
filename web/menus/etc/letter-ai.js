/* 기타 › 가정통신문 (스펙 2026-11-03 가정통신문): AI는 제목·인사·취지·항목·맺음·회신서 칸·알림 글·관련 공문만 뽑고,
   본문 줄·발송 기안·글 짜임 양식(.hwp·기본) 문서는 앱이 맞춤. 화면 없이 돌아감(시험) */
import { normDate, fmtDay } from './message-ai.js';
import { relText } from '../plan/report-ai.js';
import { findRoles, swapDate, DATE } from '../../core/hwpx-form.js';

const PHONE = /0\d{1,2}[-.\s)]?\d{3,4}[-.\s]?\d{4}/g;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/g;
const clean = (v, n) => String(v == null ? '' : v).replace(PHONE, '').replace(EMAIL, '').replace(/\(\s*\)/g, '').replace(/[ \t]+/g, ' ').trim().slice(0, n);
/* 줄 앞 공백(단계 들여쓰기)은 남기고 다듬음 */
const cleanLine = (v, n) => { const s = String(v == null ? '' : v); const lead = (/^[ 　]*/.exec(s) || [''])[0].slice(0, 8); const t = clean(s, n); return t ? lead + t : ''; };
/* 회신서 칸은 띄어쓰기를 그대로(「□ 참가  □ 불참」) */
const cleanKeep = (v, n) => String(v == null ? '' : v).replace(PHONE, '').replace(EMAIL, '').replace(/\(\s*\)/g, '').replace(/[\t\r\n]+/g, ' ').trim().slice(0, n);
const squash = s => String(s || '').replace(/\s+/g, '');
export const spaced = s => [...squash(s)].join(' ');
const CUT = '✂ - - - - - - - - - - - 자 르 는 선 - - - - - - - - - - -';

/* .hwp 양식 글 → 글 짜임 양식 { kind: 'plain', head(머리 줄들), sign(학교장 줄), dateFmt(날짜 꼴), sample(옛 제목·본문, 문체 참고) } */
export function plainFromText(text) {
  const lines = String(text || '').split('\n').map(t => ({ text: t.replace(/\s+$/, ''), box: 'doc', inBox: false, obj: false }));
  const r = findRoles(lines);
  const at = i => (i >= 0 ? lines[i].text.trim() : '');
  const title = r.title >= 0 ? r.title : r.bodyStart;
  const head = lines.slice(0, Math.max(0, title)).map(l => l.text.trim()).filter(Boolean);
  let sign = at(r.sign), dateFmt = at(r.date) || '{날짜}';
  if (r.sign >= 0 && r.sign === r.date) { const m = DATE.exec(sign); if (m) { dateFmt = sign.slice(0, m.index + m[0].length).trim(); sign = sign.slice(m.index + m[0].length).trim(); } }
  const end = r.date >= 0 ? r.date : r.sign >= 0 ? r.sign : lines.length;
  const sample = title >= 0 ? lines.slice(title, end).map(l => l.text).join('\n').trim() : '';
  return { kind: 'plain', head, sign, dateFmt, sample };
}
/* 기본 양식: 「가 정 통 신 문」·학교 이름, 학교장 줄(띄어 씀), 날짜 「YYYY. M. D.」 */
export function defaultPlain(school) {
  const name = String(school || '').trim();
  return { kind: 'plain', head: ['가 정 통 신 문', name || '○○초등학교'], sign: spaced(`${name || '○○초등학교'}장`), dateFmt: '{날짜}', sample: '' };
}

/* 회신서 표의 줄: 학년 반 번호 · 학생 이름 · 칸마다 「이름: 내용」 → [이름, 내용] */
export function replyRows(reply) {
  const fields = ((reply && reply.fields) || []).map(f => String(f || '').trim()).filter(Boolean);
  return [['학년 반 번호', '      학년        반        번'], ['학생 이름', ''], ...fields.map(f => { const i = f.indexOf(':'); return i > 0 ? [f.slice(0, i).trim(), f.slice(i + 1).trim()] : [f, '']; })];
}

/* 글 짜임 양식 + 가정통신문 → 쌤비서 문서(한글·워드·PDF) */
export function plainLetterDoc(plain, letter) {
  const p = plain || defaultPlain(''), x = letter || {};
  const big = (p.head || []).find(l => squash(l) === '가정통신문');
  const blocks = (p.head || []).filter(l => l !== big).map(text => ({ type: 'c', text }));
  blocks.push({ type: 'p', text: '' }, { type: 'c', text: x.title || '', bold: true }, { type: 'p', text: '' });
  for (const l of x.body || []) blocks.push({ type: 'p', text: l });
  blocks.push({ type: 'p', text: '' }, { type: 'c', text: swapDate(p.dateFmt || '{날짜}', x.date) }, { type: 'c', text: p.sign || '', bold: true });
  if (x.reply) {
    blocks.push({ type: 'p', text: '' }, { type: 'c', text: CUT }, { type: 'c', text: x.reply.title || '회신서', bold: true }, { type: 'table', rows: replyRows(x.reply) });
    if (String(x.reply.due || '').trim()) blocks.push({ type: 'p', text: x.reply.due });
    blocks.push({ type: 'c', text: `${String(x.date || '').slice(0, 4)} .     .     .          보호자 :                (서명)` });
  }
  return { title: big || '가 정 통 신 문', blocks };
}

export function letterPrompt({ sources = [], memo = '', sample = '', today = '', year } = {}) {
  const docs = sources.filter(s => s && String(s.text || '').trim()).map(s => `[공문·계획: ${String(s.name || '글').slice(0, 60)}]\n${String(s.text).slice(0, 6000)}`).join('\n\n');
  return ['[가정통신문]',
    `학교에서 보호자(학부모)께 보내는 가정통신문을 씁니다. 오늘: ${today || ''}, 학년도: ${year || ''}.`,
    '- title: 가정통신문 제목(예: 2026학년도 가을 현장체험학습 안내). 「가정통신문」이라는 말은 빼도 됩니다.',
    '- greeting: 인사 1~2줄(예: 「안녕하십니까?」, 「항상 본교 교육 활동에 관심을 가져 주시는 보호자님께 감사드립니다.」)',
    '- intro: 취지 2~3문장, items: 「1.」·「  가.」·「    1)」 머리를 단 항목 줄(일시·장소·대상·준비물·신청 방법 등, 있는 것만), closing: 맺음 부탁 한 문장',
    '- reply: 신청·동의·회신이 필요하면 {"need":true,"title":"○○ 참가 신청서","fields":["참가 여부: □ 참가합니다  □ 참가하지 않습니다"],"due":"○. ○.(○)까지 담임 선생님께 제출"}, 아니면 {"need":false}',
    '- short: 학부모 알림 앱(e알리미 등)에 보낼 3~5줄 짧은 안내, related: 관련 공문 [{"no":"문서번호","date":"YYYY-MM-DD","title":"제목"}], target: 받는 사람(예: 3학년 보호자)',
    '- 보호자께 쓰는 정중한 문체(「~습니다」). 넣을 내용과 공문에 없는 날짜·장소·금액은 지어내지 않습니다. 사람 이름·전화번호·이메일은 쓰지 않습니다.',
    '', docs || '(넣은 공문·계획 없음)', '', '[넣을 내용]', String(memo || '').slice(0, 4000) || '(없음)',
    ...(String(sample || '').trim() ? ['', '[양식의 옛 글(문체만 참고)]', String(sample).replace(PHONE, '').replace(EMAIL, '').slice(0, 3000)] : []),
    '', '[출력] JSON 하나만 출력합니다.',
    '{"title":"…","greeting":["안녕하십니까?","…"],"intro":"…","items":["1. …","  가. …"],"closing":"…","reply":{"need":false},"short":"…","related":[],"target":"…"}'].join('\n');
}

/* AI 답 → 가정통신문 칸 */
export function normLetter(v, { year } = {}) {
  const o = v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  const arr = x => (Array.isArray(x) ? x : typeof x === 'string' && x.trim() ? [x] : []);
  const rp = o.reply && typeof o.reply === 'object' ? o.reply : {};
  return {
    title: clean(o.title, 100), greeting: arr(o.greeting).map(g => clean(g, 200)).filter(Boolean).slice(0, 3),
    intro: clean(o.intro, 600), items: arr(o.items).map(i => cleanLine(i, 300)).filter(Boolean).slice(0, 30), closing: clean(o.closing, 300),
    reply: { need: !!rp.need, title: clean(rp.title, 60), fields: arr(rp.fields).filter(f => typeof f === 'string').map(f => cleanKeep(f, 120)).filter(Boolean).slice(0, 8), due: clean(rp.due, 120) },
    short: String(o.short == null ? '' : o.short).split('\n').map(l => clean(l, 200)).filter(Boolean).slice(0, 6).join('\n'),
    related: arr(o.related).filter(x => x && typeof x === 'object').slice(0, 3).map(x => ({ no: clean(x.no, 40), date: normDate(x.date, year), title: clean(x.title, 100) })).filter(x => x.no || x.title),
    target: clean(o.target, 60)
  };
}

/* 본문 줄: 인사 → 빈 줄 → 취지 → 빈 줄 → 항목 → 빈 줄 → 맺음 (빈 묶음은 빼고 빈 줄은 하나로) */
export function composeBody(n) {
  const x = n || {};
  const groups = [x.greeting || [], x.intro ? [x.intro] : [], x.items || [], x.closing ? [x.closing] : []].filter(g => g.length);
  return groups.flatMap((g, i) => (i ? ['', ...g] : g));
}

/* 발송 기안 { title, body } (에듀파인 기안 본문 꼴) */
export function composeSend({ title = '', related = [], target = '', date = '' } = {}) {
  const t = String(title || '').trim() || '가정통신문';
  const rel = (related || []).map(relText).filter(Boolean);
  const lines = [];
  let no = 1;
  if (rel.length === 1) lines.push(`${no++}. 관련: ${rel[0]}`);
  else if (rel.length > 1) lines.push(`${no++}. 관련: ${rel.map((r, i) => `${i ? '         ' : ''}${'가나다'[i]}. ${r}`).join('\n')}`);
  lines.push(`${no}. ${rel.length ? '위 호와 관련하여 ' : ''}「${t}」 가정통신문을 다음과 같이 발송하고자 합니다.`,
    `  가. 발송 대상: ${String(target || '').trim() || '보호자'}`, `  나. 발송일: ${fmtDay(date) || String(date || '')}`, '  다. 발송 방법: 학부모 알림 앱(e알리미 등) 및 가정통신문',
    '', `붙임  「${t}」 가정통신문 1부.  끝.`);
  return { title: `${t} 가정통신문 발송`, body: lines.join('\n') };
}
