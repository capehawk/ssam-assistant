// 글쓰기 원칙(선생님이 준 「번역투·AI 단골 표현」 사진): 글을 쓰는 업무 프롬프트에 원칙을 붙이고, 답의 이중 피동·끝맺음 공식은 앱이 고침
import test from 'node:test';
import assert from 'node:assert/strict';
import { WRITE_TASKS, STYLE_RULES, withStyle, tidyKo } from '../../web/core/write-style.js';

test('원칙: 사진의 10가지(번역투 5·기계식 5)와 공문 항목 번호·요청한 끝맺음 꼴은 그대로', () => {
  for (const w of ['를 통해', '되어진다', '보여진다', '이에 있어서', '다양한 요인에 의해', '그는 그의', '첫째', '결론적으로', '요약하자면', '시사하는 바가 크다', '새로운 패러다임', '가 아니라']) assert.ok(STYLE_RULES.includes(w), w);
  assert.ok(STYLE_RULES.includes('1. 가.') && /끝맺음 꼴/.test(STYLE_RULES));
});

test('글을 쓰는 업무에만 붙임(채점·회신서 읽기에는 붙이지 않음), 두 번 붙이지 않음', () => {
  for (const t of ['writing', 'plan', 'notes', 'purchase', 'message', 'report', 'letter', 'gongmun']) assert.ok(WRITE_TASKS.includes(t), t);
  assert.ok(withStyle('글 써 줘', 'letter').endsWith(STYLE_RULES));
  assert.equal(withStyle('채점', 'grade'), '채점');
  assert.equal(withStyle('번호', 'reply'), '번호');
  assert.equal(withStyle('x', undefined), 'x');
  assert.equal(withStyle(withStyle('글', 'plan'), 'plan'), withStyle('글', 'plan'));
});

test('tidyKo: 이중 피동은 바로 끊고, 문장 앞 「결론적으로·요약하자면」은 빼고, 「~에 있어서」는 「~에서」', () => {
  assert.equal(tidyKo('효과가 보여진다. 문제가 발생되어진다.'), '효과가 보인다. 문제가 발생된다.');
  assert.equal(tidyKo('잘 보여집니다. 준비되어졌습니다.'), '잘 보입니다. 준비되었습니다.');
  assert.equal(tidyKo('수업을 했다. 결론적으로, 참여가 늘었다.\n요약하자면 좋았다.'), '수업을 했다. 참여가 늘었다.\n좋았다.');
  assert.equal(tidyKo('수업에 있어서 중요하다. 이에 있어서 협조 바랍니다.'), '수업에서 중요하다. 여기서 협조 바랍니다.');
  assert.equal(tidyKo('{"a":"보여진다"}'), '{"a":"보인다"}', 'JSON 안 글도');
  assert.equal(tidyKo(''), '');
  assert.equal(tidyKo('그대로 둘 글'), '그대로 둘 글');
});
