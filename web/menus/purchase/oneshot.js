/* 품의 「한 칸 → 바로 초안」(스펙 2026-11-02 3장): 한 번에 초안 프롬프트·답 다듬기, 확인할 것 칩, 빠진 것 묻기. 화면 없이 돌아감(시험) */
import { TYPES, draftMemo, findPersonal, cleanItems, toNumber } from './rules.js';
import { hasContact, maskNames } from './intake.js';

const VERB = { goods: '구입', lecturer: '지급', event: '운영', meeting: '운영' };
const FIELD_NAME = { project: '사업명', purpose: '목적', date: '일시', target: '대상', place: '장소' };
export const GUESS_KEYS = Object.keys(FIELD_NAME);
const TYPE_IDS = TYPES.map(t => t.id);
const blank = v => String(v == null ? '' : v).trim() === '';
const str = (v, n) => String(v == null ? '' : v).trim().slice(0, n);

/* 초안 AI 한 번: 제목·첫 문장 + 비어 있는 칸(목적은 짐작해도 됨) + (askType이면) 종류.
   강사 수당은 넣은 글(강사 이름일 수 있음)을 보내지 않고 메모(사람 수·시간)만 */
export function oneshotPrompt(form, text = '', { askType = false } = {}) {
  const f = form || {}, type = TYPE_IDS.includes(f.type) ? f.type : 'goods';
  const empty = GUESS_KEYS.filter(k => blank(f[k]));
  const said = type === 'lecturer' ? '' : maskNames(String(text || '').split(/\r?\n/).filter(l => !findPersonal(l)).join('\n')).trim().slice(0, 4000);
  return ['[품의 초안]',
    '학교 행정 문서(에듀파인 품의)를 돕는 도우미예요. 아래 메모로 품의의 제목과 품의 사유 첫 문장을 써 주세요.',
    '', draftMemo(f).trim(),
    ...(said ? ['', '[선생님이 넣은 글]', said] : []),
    '', '규칙:',
    '- title: 한 줄, 30자 안쪽. 무엇을 왜 하는지 드러나게 씁니다. 예) 5학년 과학 실험 재료(용해와 용액) 구입',
    `- intro: 한 문장. 「…을(를) 다음과 같이 ${askType ? '구입(물품)·지급(강사)·운영(행사·협의회)' : VERB[type]}하고자 합니다.」 꼴로 씁니다. 금액·날짜는 쓰지 않습니다.`,
    ...(empty.length ? [`- fields: 메모·넣은 글에서 알 수 있을 때만 ${empty.map(k => `${k}(${FIELD_NAME[k]})`).join('·')}를 씁니다. purpose(목적)는 비어 있으면 품목·사업명으로 짐작해 짧게 써도 됩니다. 나머지는 알 수 없으면 빼고 지어내지 않습니다.`] : []),
    ...(askType ? ['- type: goods(물품 구입)·lecturer(강사 수당)·event(행사 운영)·meeting(협의회) 중 하나. 알 수 없으면 빈 글.'] : []),
    '- 메모에 없는 사실은 지어내지 않습니다. 사람 이름·전화번호·주소는 쓰지 않습니다.',
    '', `답은 JSON 하나만: {"title": "…", "intro": "…", "fields": {}${askType ? ', "type": ""' : ''}}`].join('\n');
}

/* 답 다듬기: 제목·첫 문장, form에서 빈 칸만(개인정보·전화·이메일 든 값은 버림), 종류는 넷 중 하나 */
export function normOneshot(v, form) {
  const o = v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  const f = form || {}, src = o.fields && typeof o.fields === 'object' ? o.fields : {};
  const fields = {};
  for (const k of GUESS_KEYS) {
    const t = str(src[k], 200);
    if (!t || !blank(f[k]) || findPersonal(t) || hasContact(t)) continue;
    fields[k] = t;
  }
  return { title: str(o.title, 80), intro: str(o.intro, 300), fields, type: TYPE_IDS.includes(o.type) ? o.type : '' };
}

/* 초안 위 「확인할 것」 칩: [{ key(누르면 갈 칸, ''면 칸 없음), text, level: 'warn'|'info' }] */
export function confirmChips(form, check, guessed = []) {
  const f = form || {}, out = [];
  if (f.budgetUnknown || blank(f.budget)) out.push({ key: 'budget', text: '예산 과목 · 행정실 확인', level: 'warn' });
  const named = (Array.isArray(f.items) ? f.items : []).filter(it => it && !blank(it.name));
  const noPrice = named.filter(it => !(toNumber(it.qty) > 0) || !(toNumber(it.price) > 0)).length;
  if (noPrice) out.push({ key: 'items', text: `단가 없는 품목 ${noPrice}개`, level: 'warn' });
  if ((guessed || []).includes('purpose')) out.push({ key: 'purpose', text: '목적 · AI가 짐작함', level: 'warn' });
  for (const w of (check && check.warnings) || []) if (!w.includes('예산 과목')) out.push({ key: '', text: w, level: 'warn' });
  if (blank(f.date) && blank(f.target)) out.push({ key: 'date', text: '일시·대상 없이 썼어요', level: 'info' });
  return out;
}

/* 「빠진 것만 물어보기」: 초안에 꼭 필요한데 빈 것(최대 2개) */
export const askNeeds = form => [...(blank(form && form.purpose) ? ['purpose'] : []), ...(cleanItems(form && form.items).length ? [] : ['items'])];
