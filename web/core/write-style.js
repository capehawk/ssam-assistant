/* 글쓰기 원칙: 선생님이 준 「넣자마자 탐지 걸리는 번역투 5개」·「AI 복붙으로 찍히는 기계식 단골 단어 5개」를 따라,
   글을 쓰는 업무의 AI 요청 끝에 원칙을 붙이고(withStyle), 답의 이중 피동·끝맺음 공식·번역투 조사는 앱이 고침(tidyKo).
   화면 없이 돌아감(시험). 평가 메뉴(evaluate.js)는 window.SSAM_STYLE로 씀 */
export const WRITE_TASKS = ['writing', 'plan', 'notes', 'purchase', 'message', 'report', 'letter', 'gongmun'];

export const STYLE_RULES = ['[글쓰기 원칙] 사람이 쓴 자연스러운 한국어로 쓰세요. 번역투와 AI 단골 표현은 쓰지 않아요.',
  '- 「~를 통해」 대신 「~로」(예: 「AI 기술을 통해 효율 향상」 → 「AI로 효율을 높인다」)',
  '- 이중 피동 「발생되어진다·보여진다」 대신 「발생한다·보인다」로 바로 끊기',
  '- 「이에 있어서·~에 관하여」 같은 번역 조사 대신 「여기서·~에서」',
  '- 「다양한 요인에 의해」처럼 뭉뚱그리지 말고 구체적인 까닭 1~2개',
  '- 「그는 그의 시계를」 같은 영어식 대명사는 빼기',
  '- 「첫째… 둘째… 셋째…」를 기계적으로 늘어놓지 말고 앞뒤 흐름으로 잇기(공문·가정통신문의 「1. 가. 1)」 항목 번호는 그대로)',
  '- 「결론적으로·요약하자면」 같은 끝맺음 공식 없이 핵심부터',
  '- 「시사하는 바가 크다」 같은 빈 평가 대신 실제로 무엇이 달라지는지',
  '- 「단순한 ~를 넘어 새로운 패러다임」 같은 과장 어휘 대신 핵심 사실만',
  '- 「~가 아니라 ~다」 대구를 되풀이하지 말고 담백한 평서문으로',
  '- 끝맺음 꼴(~함·~습니다 등)과 답의 형식(JSON 등)은 위에서 요청한 대로'].join('\n');

/* 글을 쓰는 업무면 원칙을 붙임(이미 붙었으면 그대로) */
export function withStyle(prompt, task) {
  const p = String(prompt == null ? '' : prompt);
  return task && WRITE_TASKS.includes(task) && !p.includes('[글쓰기 원칙]') ? `${p}\n\n${STYLE_RULES}` : p;
}

/* 뜻이 바뀌지 않는 것만 고침: 이중 피동(되어지다·보여지다), 문장 앞 끝맺음 공식, 「~에 있어서」 */
const PASSIVE = [
  [/되어졌습니다/g, '되었습니다'], [/되어집니다/g, '됩니다'], [/되어졌다/g, '되었다'], [/되어진다/g, '된다'], [/되어지는/g, '되는'], [/되어지고/g, '되고'], [/되어질/g, '될'], [/되어져/g, '되어'],
  [/보여졌습니다/g, '보였습니다'], [/보여집니다/g, '보입니다'], [/보여졌다/g, '보였다'], [/보여진다/g, '보인다'], [/보여지는/g, '보이는'], [/보여지고/g, '보이고'], [/보여질/g, '보일']
];
export function tidyKo(text) {
  let s = String(text == null ? '' : text);
  if (!s) return s;
  for (const [re, to] of PASSIVE) s = s.replace(re, to);
  s = s.replace(/(^|\n|[.!?]\s+|["“「]\s*)(결론적으로|요약하자면|요컨대|종합하자면)\s*,?\s*/g, '$1');
  s = s.replace(/이에 있어서/g, '여기서').replace(/에 있어서?(?=\s)/g, '에서');
  return s;
}

if (typeof globalThis !== 'undefined') globalThis.SSAM_STYLE = { WRITE_TASKS, STYLE_RULES, withStyle, tidyKo };
