// 단원평가: 정답지(이원 분류표)·평가지 글 읽기 — AI 없이
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseKey, parsePaper, itemType, keyTotal, splitCombined } from '../../web/menus/evaluate/unit/unit-key.js';

const fx = name => readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8');

test('정답지: 제목 줄에서 학기·학년·교과·단원·회차, 영역 이름, 10문항 100점', () => {
  const k = parseKey(fx('unit-key.txt'));
  assert.deepEqual(k.meta, { term: 2, grade: 3, subject: '국어', unitNo: 2, round: 1 });
  assert.deepEqual(k.domains, ['지식', '이해']);
  assert.equal(k.items.length, 10);
  assert.equal(keyTotal(k.items), 100);
  assert.deepEqual(k.items[0], { no: 1, content: '글의 내용 파악하기', domain: '이해', type: 'choice', answer: '(2) ○', points: 5, criteria: '', pages: '<국어> 70~75쪽' });
  assert.equal(k.items[2].domain, '지식');
});

test('정답지: 문항 유형 짐작', () => {
  const t = parseKey(fx('unit-key.txt')).items.map(i => i.type);
  assert.deepEqual(t, ['choice', 'choice', 'symbol', 'short', 'choice', 'match', 'short', 'choice', 'essay', 'essay']);
  assert.equal(itemType('③', ''), 'choice');
  assert.equal(itemType('③, ⑤', ''), 'choice');
  assert.equal(itemType('(3) ○', ''), 'choice');
  assert.equal(itemType('㉯', ''), 'symbol');
  assert.equal(itemType('(1) - ①  (2) - ②', ''), 'match');
  assert.equal(itemType('준호', ''), 'short');
  assert.equal(itemType('(예) 친구와 계속 이야기하려고 노력해야 함. 등', ''), 'essay');
  assert.equal(itemType('책을 많이 읽는다.', '까닭을 들어 썼으면 정답 처리'), 'essay');
});

test('정답지: 영역이 3개인 표', () => {
  const text = [
    '1학기 단원평가 문항 이원 분류 및 모범 답안 ( 4 )학년 ( 수학 )과 3단원 (2회)',
    '문항번호 | 평가 내용 | 행동 영역 | 정답 | 배점 및 채점 기준 | 교과서 관련 쪽수',
    '계산 | 이해 | 문제해결 | 배점 | 채점 기준',
    '1 | 곱셈하기 | ○ |  |  | 345 | 10 |  | <수학> 50쪽',
    '2 | 곱셈의 뜻 알기 |  | ○ |  | ② | 10 |  | <수학> 52쪽'
  ].join('\n');
  const k = parseKey(text);
  assert.deepEqual(k.meta, { term: 1, grade: 4, subject: '수학', unitNo: 3, round: 2 });
  assert.deepEqual(k.domains, ['계산', '이해', '문제해결']);
  assert.equal(k.items[0].domain, '계산');
  assert.equal(k.items[0].answer, '345');
  assert.equal(k.items[1].domain, '이해');
  assert.equal(k.items[1].type, 'choice');
});

test('정답지: 칸을 합치지 않은 머리(둘째 머리 줄이 빈 칸으로 시작)', () => {
  const text = [
    '2학기 단원평가 문항 이원 분류 및 모범 답안 ( 3 )학년 ( 국어 )과 2단원 (1회)',
    '문항번호 | 평가 내용 | 행동 영역 |  | 정답 | 배점 및 채점 기준 |  | 교과서 관련 쪽수',
    ' |  | 지식 | 이해 |  | 배점 | 채점 기준 | ',
    '1 | 글의 내용 파악하기 |  | ○ | (2) ○ | 5 |  | <국어> 70~75쪽',
    '2 | 생각 쓰기 | ○ |  | (예) 좋다. | 15 | 비슷하면 정답 | <국어> 88쪽'
  ].join('\n');
  const k = parseKey(text);
  assert.deepEqual(k.domains, ['지식', '이해']);
  assert.deepEqual(k.items[0], { no: 1, content: '글의 내용 파악하기', domain: '이해', type: 'choice', answer: '(2) ○', points: 5, criteria: '', pages: '<국어> 70~75쪽' });
  assert.equal(k.items[1].domain, '지식'); assert.equal(k.items[1].criteria, '비슷하면 정답'); assert.equal(k.items[1].points, 15);
});

test('정답지: 머리 위 학교 이름·빈 줄, 숫자가 아닌 배점, 이어지는 줄', () => {
  const text = [
    '가나초등학교',
    '',
    '2학기 단원평가 문항 이원 분류 및 모범 답안 ( 3 )학년 ( 국어 )과 1단원 (1회)',
    '문항번호 | 평가 내용 | 행동 영역 | 정답 | 배점 및 채점 기준 | 교과서 관련 쪽수',
    '지식 | 이해 | 배점 | 채점 기준',
    '1 | 시 읽기 |  | ○ | (예) 즐거웠다. | 가 | 비슷하면 정답 | <국어> 36쪽',
    ' |  |  |  | 등 |  | 처리 | ',
    '2 | 낱말 알기 | ○ |  | ③ | 4 |  | <국어> 40쪽'
  ].join('\n');
  const k = parseKey(text);
  assert.equal(k.items.length, 2);
  assert.equal(k.items[0].points, 0);
  assert.equal(k.items[0].answer, '(예) 즐거웠다. 등');
  assert.equal(k.items[0].criteria, '비슷하면 정답 처리');
  assert.equal(k.items[1].no, 2);
  assert.equal(keyTotal(k.items), 4);
});

test('정답지: 표가 없는 글은 null', () => {
  assert.equal(parseKey('다음 시를 읽고 물음에 답하시오.\n1\n은행잎 편지'), null);
  assert.equal(parseKey(''), null);
});

test('평가지: 머리에서 교과·학년·학기·단원·회차, 번호 줄로 문항 발문', () => {
  const p = parsePaper(fx('unit-paper.txt'));
  assert.deepEqual(p.meta, { subject: '국어', grade: 3, term: 2, unitNo: 2, unitName: '중요한 내용을 적어요', round: 1 });
  assert.equal(Object.keys(p.questions).length, 10);
  assert.equal(p.questions[1], '이 글은 무엇을 알리는 글인지 알맞은 것에 ○표를 하시오.');
  assert.equal(p.questions[3], '‘잔치’의 뜻으로 알맞은 것을 찾아 기호를 쓰시오.');
  assert.equal(p.questions[10], '이 글을 읽고 자신의 생각을 까닭과 함께 쓰시오.');
});

test('평가지: 머리가 없어도 문항은 읽음', () => {
  const p = parsePaper('1\n첫 문제입니다.\n2\n둘째 문제입니다.');
  assert.deepEqual(p.meta, { subject: '', grade: null, term: null, unitNo: null, unitName: '', round: null });
  assert.deepEqual(p.questions, { 1: '첫 문제입니다.', 2: '둘째 문제입니다.' });
});

test('시연 자료: 정답지·평가지 한글 파일 글이 그대로 읽힘(10문항·100점)', async () => {
  const { sampleKeyDoc, samplePaperDoc, SAMPLE_ITEMS } = await import('../../web/menus/evaluate/unit/unit-sample.js');
  const docText = d => [d.title, ...d.blocks.flatMap(b => (b.type === 'table' ? b.rows.map(r => r.join(' | ')) : String(b.text || '').split('\n')))].join('\n');
  const k = parseKey(docText(sampleKeyDoc()));
  assert.equal(k.items.length, 10); assert.equal(keyTotal(k.items), 100);
  assert.deepEqual(k.items.map(i => i.type), SAMPLE_ITEMS.map(i => i.type));
  assert.deepEqual(k.meta, { term: 2, grade: 3, subject: '국어', unitNo: 2, round: 1 });
  const p = parsePaper(docText(samplePaperDoc()));
  assert.equal(p.meta.unitName, '중요한 내용을 적어요');
  assert.equal(Object.keys(p.questions).length, 10);
});

test('검토 고침: 합친 칸을 풀어 쓴 표(둘째 머리 줄이 머리 이름을 되풀이)도 읽음', () => {
  const text = [
    '2학기 단원평가 문항 이원 분류 및 모범 답안 ( 3 )학년 ( 국어 )과 1단원 (1회)',
    '문항번호 | 평가 내용 | 행동 영역 | 행동 영역 | 정답 | 배점 및 채점 기준 | 배점 및 채점 기준 | 교과서 관련 쪽수',
    '문항번호 | 평가 내용 | 지식 | 이해 | 정답 | 배점 | 채점 기준 | 교과서 관련 쪽수',
    '1 | 시의 내용 파악 |  | ○ | ③ | 5 |  | <국어> 36~41쪽',
    '2 | 시의 내용 파악 | ○ |  | ㉯ | 5 |  | <국어> 36~41쪽'
  ].join('\n');
  const k = parseKey(text);
  assert.deepEqual(k.domains, ['지식', '이해']);
  assert.deepEqual(k.items[1], { no: 2, content: '시의 내용 파악', domain: '지식', type: 'symbol', answer: '㉯', points: 5, criteria: '', pages: '<국어> 36~41쪽' });
});

test('검토 고침: 「배 점」·「배점(점)」·「점수」 머리도 읽고, 엉뚱하게 읽히면 null(AI로 넘김)', () => {
  const mk = h => ['( 3 )학년 ( 국어 )과 1단원 (1회)', '문항번호 | 평가 내용 | 행동 영역 | 정답 | 배점 및 채점 기준 | 교과서 관련 쪽수', `지식 | 이해 | ${h} | 채점 기준`,
    '1 | 시 읽기 |  | ○ | ③ | 5 |  | <국어> 36쪽', '2 | 낱말 | ○ |  | ㉯ | 5 |  | <국어> 40쪽'].join('\n');
  for (const h of ['배 점', '배점(점)', '점수']) {
    const k = parseKey(mk(h));
    assert.ok(k, h);
    assert.deepEqual(k.items.map(i => [i.answer, i.points]), [['③', 5], ['㉯', 5]], h);
  }
  assert.equal(parseKey(mk('채 점 표')), null);
});

test('다듬기: 배점 「5점」, 문항 번호 「1.」·「1번」도 읽음', () => {
  const text = ['( 3 )학년 ( 국어 )과 1단원 (1회)', '문항번호 | 평가 내용 | 행동 영역 | 정답 | 배점 및 채점 기준 | 교과서 관련 쪽수', '지식 | 이해 | 배점 | 채점 기준',
    '1. | 시 읽기 |  | ○ | ③ | 5점 |  | <국어> 36쪽', '2번 | 낱말 | ○ |  | ㉯ | 4.5 |  | <국어> 40쪽'].join('\n');
  const k = parseKey(text);
  assert.deepEqual(k.items.map(i => [i.no, i.points]), [[1, 5], [2, 4.5]]);
});

test('정답·해설지: 정답을 한 줄로 늘어놓은 꼴(01 ③ 02 ⑤ …), 예시 답안 표시·⑴ 번호, 상·중·하 채점 기준, 배점이 없으면 100점을 나눔', () => {
  const k = parseKey(fx('unit-key-inline.txt'));
  assert.deepEqual(k.meta, { term: 2, grade: 3, subject: '도덕', unitNo: 4, round: null });
  assert.equal(k.items.length, 8);
  assert.deepEqual(k.items.map(i => i.answer), ['③', '⑤', '(예) 약속을 지키면 서로 믿을 수 있다.', '②', '(1) ○, (2) ×, (3) ○', '(예) “차례를 지켜 줄을 선다.”', '①, ④', '㉡']);
  assert.deepEqual(k.items.map(i => i.type), ['choice', 'choice', 'essay', 'choice', 'short', 'essay', 'choice', 'symbol']);
  assert.deepEqual(k.items.map(i => i.points), [12, 12, 12, 12, 13, 13, 13, 13]);
  assert.equal(keyTotal(k.items), 100);
  assert.equal(k.pointsGuessed, true);
  assert.ok(k.items[2].criteria.includes('1가지 이상 썼는지') && k.items[2].criteria.includes('상: 약속을 지키면 좋은 점을 까닭과 함께') && k.items[2].criteria.includes('하: 관련 없는'), k.items[2].criteria);
  assert.equal(k.items[0].criteria, '');
  assert.equal(k.items[4].criteria, '');
});

test('합본(문제지 + 정답 및 해설 + 이원 목적 분류표): 표의 정답·배점·채점 기준·평가 내용·평가 영역·쪽', () => {
  const k = parseKey(fx('unit-combined.txt'));
  assert.equal(k.items.length, 6);
  assert.equal(keyTotal(k.items), 100);
  assert.ok(!k.pointsGuessed);
  assert.deepEqual(k.items[2], { no: 3, content: '물에 사는 동물 설명하기', domain: '지식·이해', type: 'essay', answer: '(예) 지느러미가 있고 몸이 매끄럽다.', points: 20, criteria: '‘지느러미’, ‘매끄럽다’는 내용이 있으면 정답 처리', pages: '80~81 쪽' });
  assert.deepEqual(k.items.map(i => i.type), ['choice', 'short', 'essay', 'choice', 'short', 'short']);
  assert.deepEqual(k.domains, ['지식·이해', '과정·기능']);
  assert.equal(k.meta.subject, '과학');
  assert.equal(k.meta.round, 2);
  assert.equal(k.meta.unitNo, 3);
});

test('합본: 둘째 머리가 합친 칸만 적힌 꼴(배점 | 채점 기준)도 같은 표로 읽음', () => {
  const src = fx('unit-combined.txt').replace(/번호 \| 정답 \| 배점 및 채점 기준 \| 배점 및 채점 기준[^\n]*\n번호 \| 정답 \| 배점 \| 채점 기준[^\n]*/,
    '번호 | 정답 | 배점 및 채점 기준 | 평가 내용 | 평가 영역 | 난이도 | 교과서 관련 쪽수\n배점 | 채점 기준');
  const k = parseKey(src);
  assert.equal(keyTotal(k.items), 100);
  assert.equal(k.items[2].answer, '(예) 지느러미가 있고 몸이 매끄럽다.');
  assert.equal(k.items[3].content, '다리 수로 동물 분류하기');
  assert.equal(k.items[5].pages, '84~85 쪽');
});

test('표 없이 정답 줄만 있으면(PDF 등): 「해설 참조」는 해설의 모범 답안, 채점 기준 표는 그 문항 기준', () => {
  const src = fx('unit-combined.txt').split('\n | 『과학』 70 쪽~95 쪽\n중간 평가 | 2회 | 이원 목적 분류표')[0];
  const k = parseKey(src);
  assert.equal(k.items.length, 6);
  assert.deepEqual(k.items.map(i => i.answer), ['③', '배', '(예) 지느러미가 있고 몸이 매끄럽다.', '②, ④', '㉠ 더듬이 ㉡ 날개', '(1) 날 (2) 없']);
  assert.equal(k.items[2].type, 'essay');
  assert.ok(k.items[2].criteria.includes('두 가지 쓴 경우: 100%') && k.items[2].criteria.includes('한 가지만 쓴 경우: 50%'), k.items[2].criteria);
  assert.equal(keyTotal(k.items), 100);
  assert.equal(k.pointsGuessed, true);
});

test('평가지: 「01」 번호 문항, 머리 줄이 흩어진 교과·학년-학기·단원', () => {
  const p = parsePaper(fx('unit-paper-inline.txt'));
  assert.deepEqual(p.meta, { subject: '도덕', grade: 3, term: 2, unitNo: 4, unitName: '함께 지키는 약속', round: null });
  assert.equal(Object.keys(p.questions).length, 8);
  assert.equal(p.questions[1], '다음 중 약속을 지키는 모습으로 알맞은 것은 무엇입니까?');
  assert.equal(p.questions[8], '다음 중 모두가 함께 정한 약속은 무엇입니까?');
});

test('합본 나누기와 번호가 사라진 문제지(자동 번호): 발문 줄로 문항을 셈', () => {
  const { paper, key } = splitCombined(fx('unit-combined.txt'));
  assert.ok(paper.includes('곤충이 아닌 것') && !paper.includes('정답 및 해설') && key.startsWith('정답 및 해설'), paper.slice(-80));
  const p = parsePaper(paper);
  assert.equal(Object.keys(p.questions).length, 6);
  assert.equal(p.questions[3], '물에 사는 동물의 생김새 특징을 쓰시오.');
  assert.equal(p.questions[4], '다리가 여섯 개인 동물을 두 가지 고르시오.');
  assert.deepEqual([p.meta.subject, p.meta.unitNo, p.meta.unitName, p.meta.round], ['과학', 3, '동물의 생활', 2]);
  assert.deepEqual(splitCombined(fx('unit-key-inline.txt')).paper, '', '정답지만 있으면 문제지 부분 없음');
});

test('「01」 꼴 번호도 10번부터는 두 자리 그대로(정답 줄·문제지)', () => {
  const ans = Array.from({ length: 12 }, (_, i) => `${String(i + 1).padStart(2, '0')} ${'①②③④⑤'[i % 5]}`).join(' ');
  const k = parseKey(`정답\n${ans}`);
  assert.equal(k.items.length, 12);
  assert.deepEqual(k.items.slice(8).map(i => i.answer), ['④', '⑤', '①', '②']);
  const p = parsePaper(Array.from({ length: 11 }, (_, i) => `${String(i + 1).padStart(2, '0')}  ${i + 1}번 문제입니까?\t(     )`).join('\n'));
  assert.equal(Object.keys(p.questions).length, 11);
});

test('「정답」 머리 없이 번호가 늘어선 글·표 줄(계획서의 중점 과제 등)은 정답 줄이 아님', () => {
  assert.equal(parseKey('학교 교육의 중점\n1. 꿈 키우기 진로교육 | 2. 지덕체 능력 계발 | 3. 예술 교육 | 4. 안전교육'), null);
  assert.equal(parseKey('올해 할 일\n1. 사과 2. 배 3. 감 4. 귤'), null);
  assert.equal(parseKey('정답\n1. 사과 2. 배 3. 감 4. 귤').items.length, 4);
});

test('문제지와 정답이 「교사용」으로 붙은 한 파일도 나눔(한꺼번에 넣기 규칙)', () => {
  const t = ['2. 곱셈', '1. 3 × 2 = □', '2. 4 × 2 = □', '3. 알맞은 수를 쓰세요.', '2. 곱셈', '이름: 교사용', '1. 6', '2. 8', '3. 12'].join('\n');
  const { paper, key } = splitCombined(t);
  assert.ok(paper.includes('3 × 2') && !paper.includes('교사용'), paper);
  assert.ok(key.startsWith('2. 곱셈') && key.includes('교사용') && key.includes('12'), key);
});
