// 떠 있는 버튼: 넣은 파일의 종류를 AI 없이 판단 (지어낸 글과 기존 시험 자료)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { classify, groupFiles, KINDS } from '../../web/core/inbox-classify.js';

const fx = name => readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8');
const kind = (name, text, scan = false) => classify({ name, text, scan }).kind;

test('단원평가: 정답지(표·한 줄 정답·합본)와 문제지', () => {
  assert.equal(kind('국어 정답.hwp', fx('unit-key.txt')), 'unit-key');
  assert.equal(kind('도덕 해설.hwp', fx('unit-key-inline.txt')), 'unit-key');
  assert.equal(kind('과학 중간평가.hwp', fx('unit-combined.txt')), 'unit-key');
  assert.equal(kind('국어 2단원.hwp', fx('unit-paper.txt')), 'unit-paper');
  assert.equal(kind('도덕 5단원.hwp', fx('unit-paper-inline.txt')), 'unit-paper');
});

test('사진·스캔 PDF는 이름으로만: 정답 → 정답지, 견적 → 견적서, 그 밖은 답안 스캔', () => {
  assert.equal(kind('3반 답안.pdf', '', true), 'unit-scan');
  assert.equal(kind('IMG_0001.jpg', '', true), 'unit-scan');
  assert.equal(kind('정답지.jpg', '', true), 'unit-key');
  assert.equal(kind('견적서.png', '', true), 'quote');
});

test('계획: 교과 평가계획, 작년 학급운영계획·행사 계획·업무 계획, 올해 지침·공문', () => {
  assert.equal(kind('3학년 국어 평가계획.hwp', '2027학년도 3학년 국어과 평가 계획\n성취기준 | 평가 요소 | 평가 방법 | 평가 기준\n[4국02-01] | 중심 생각 찾기 | 서술형 | 상 | 중 | 하'), 'eval-plan');
  assert.equal(kind('작년.hwp', fx('classplan-last.txt')), 'class-plan');
  assert.equal(kind('운동회.hwp', '2026 가을 운동회 운영 계획\n1. 목적\n2. 일시 및 장소\n3. 경기 종목\n4. 안전 대책'), 'event-plan');
  assert.equal(kind('독서.hwp', '2026학년도 독서교육 운영 계획\nⅠ. 목적\nⅡ. 방침\nⅢ. 세부 추진 계획\nⅣ. 예산'), 'year-plan');
  assert.equal(kind('공문.hwp', 'OO교육지원청\n수신 OO초등학교장\n(경유)\n제목 2027학년도 학교 교육과정 운영 지침 안내\n발신 OO교육지원청교육장'), 'guide');
});

test('학급·명단·품의·설문', () => {
  assert.equal(kind('진도표.hwp', fx('jindo-sample.txt')), 'jindo');
  assert.equal(kind('시간표.hwp', fx('timetable-sample.txt')), 'timetable');
  assert.equal(kind('명렬표.csv', fx('roster-sample.csv')), 'roster');
  assert.equal(kind('견적.xlsx', '견 적 서\n품명 | 규격 | 수량 | 단가 | 금액\n비커 | 500ml | 2 | 3000 | 6000'), 'quote');
  assert.equal(kind('응답.csv', fx('survey-12.csv')), 'survey');
});

test('모르는 파일은 unknown, 까닭은 늘 빈 글이 아님, 다른 후보', () => {
  const r = classify({ name: '메모.txt', text: '안녕하세요. 오늘 회의는 3시입니다.', scan: false });
  assert.equal(r.kind, 'unknown');
  assert.ok(r.why);
  const k = classify({ name: '국어 정답.hwp', text: fx('unit-key.txt'), scan: false });
  assert.ok(k.why.length > 0 && Array.isArray(k.alts));
  assert.ok(KINDS.every(([k, label]) => k && label));
});

test('여러 파일: 같은 종류는 묶고 정답지 → 문제지 → 답안 → 나머지 차례', () => {
  const f = n => ({ name: n });
  const g = groupFiles([{ file: f('a.jpg'), kind: 'unit-scan' }, { file: f('명단.csv'), kind: 'roster' }, { file: f('b.jpg'), kind: 'unit-scan' }, { file: f('문제.hwp'), kind: 'unit-paper' }, { file: f('정답.hwp'), kind: 'unit-key' }]);
  assert.deepEqual(g.map(x => [x.kind, x.files.map(y => y.name)]), [['unit-key', ['정답.hwp']], ['unit-paper', ['문제.hwp']], ['unit-scan', ['a.jpg', 'b.jpg']], ['roster', ['명단.csv']]]);
});

test('번호가 늘어선 중점 과제 표 줄이 있는 계획서는 정답지가 아님', () => {
  const t = fx('classplan-last.txt').replace('Ⅰ. 학급 현황', '1. 꿈 키우기 진로교육 | 2. 지덕체 능력 계발 | 3. 예술 교육 | 4. 안전교육\nⅠ. 학급 현황');
  assert.equal(kind('작년.hwp', t), 'class-plan');
});

test('제목이 「교사 교육과정」이고 안에 진도표가 든 계획서는 학급운영계획, 진도표만 있는 파일은 진도표', () => {
  const t = fx('classplan-last.txt').replace('-3학년 2반 학급 교육과정 운영 계획-', '-3학년 교사 교육과정-');
  assert.equal(kind('2026 교사 교육과정.hwp', t), 'class-plan');
  assert.equal(kind('진도표.hwp', fx('jindo-sample.txt')), 'jindo');
});

test('앱이 읽은 엑셀·CSV 글(칸을 탭으로 이음)도 같은 판단', () => {
  const tab = s => s.replace(/,/g, '\t');
  assert.equal(kind('명렬표.csv', tab(fx('roster-sample.csv'))), 'roster');
  assert.equal(kind('견적.xlsx', '견 적 서\n품명\t규격\t수량\t단가\t금액\n비커\t500ml\t2\t3000\t6000'), 'quote');
  assert.equal(kind('시간표.xlsx', '학년별 기초시간표\n3-1\t월\t화\t수\t목\t금\n1\t국어\t수학\t국어\t수학\t국어'), 'timetable');
});

test('글자가 있는 답안 스캔 PDF(복사기 글자 인식): 이름 칸이 채워졌거나 1번 문항이 여러 번, 이름에 「답안」이면 답안 스캔', () => {
  const paper = fx('unit-paper.txt');
  assert.equal(kind('3반.pdf', paper.replace('이름:', '이름: 가람')), 'unit-scan');
  assert.equal(kind('3반.pdf', paper + '\n' + paper), 'unit-scan');
  assert.equal(kind('단원평가 답안.pdf', paper), 'unit-scan');
  assert.equal(kind('국어 2단원.hwp', paper), 'unit-paper');
});

/* 수업 활동지(지어낸 글): [N차시]·교과서 N쪽·반 번 이름 칸·활동 안내(◉·※ …봅시다) 중 둘 이상, 정답 표 없음 */
const ACT_SOC = ['1. 이웃과 함께 > [5차시] 서로 돕는 마을 (교과서 30~31쪽)', '이웃을 돕는 방법 알아보기', '사회 3-2', '반     번   이름:', '※ 이웃을 도운 경험을 적어 봅시다.', '(1) 이웃을 도운 경험 | ➡ | '].join('\n');
const ACT_SCI = ['[과학] 3-2-1-02 물은 어디로 갈까? (12~13쪽)', '물의 여행 그리기', '◉ 물이 여행하는 길을 그려 봅시다.', '번호 | 그림', '1 | '].join('\n');
const ACT_MATH = ['4. 분수', '[5차시] 진분수와 가분수를 알아볼까요', '교과서 94~95쪽', '수학', '학년       반       번   이름:', '1. □ 안에 알맞은 수를 써넣으세요.', '1/5 | ', '2. 진분수를 모두 찾아 ○표 하세요.', '3/4 | 5/3 | 2/7'].join('\n');
test('수업 활동지: 차시·교과서 쪽·이름 칸·활동 안내 중 둘 이상 → 활동지, 교사용 쪽이 같이 있어도', () => {
  assert.deepEqual(KINDS.find(k => k[0] === 'activity'), ['activity', '수업 활동지', '활동지 평가로 넣기']);
  assert.equal(kind('서로 돕는 마을.hwp', ACT_SOC), 'activity');
  assert.equal(kind('물의 여행.hwpx', ACT_SCI), 'activity');
  assert.equal(kind('분수.hwp', ACT_MATH), 'activity');
  // 학생용 다음 같은 양식의 교사용(「이름: 교사용」·(예시)) — 같은 문제가 두 번 나와도 학생 답안 묶음이 아님
  const both = ACT_MATH + '\n' + ACT_MATH.replace('이름:', '이름: 교사용').replace('1/5 | ', '1/5 | 1');
  assert.equal(kind('분수(교사용 포함).hwp', both), 'activity');
  assert.equal(kind('서로 돕는 마을.hwp', ACT_SOC + '\n(예시)\n' + ACT_SOC.replace('➡ | ', '➡ | 무거운 짐을 들어 드렸어요.')), 'activity');
});
test('수업 활동지가 아닌 것은 그대로: 단원평가 정답지·문제지·합본, 이름이 적힌 학생 활동지는 답안 스캔', () => {
  assert.equal(kind('국어 정답.hwp', fx('unit-key.txt')), 'unit-key');
  assert.equal(kind('과학 중간평가.hwp', fx('unit-combined.txt')), 'unit-key');
  assert.equal(kind('국어 2단원.hwp', fx('unit-paper.txt')), 'unit-paper');
  assert.equal(kind('작년.hwp', fx('classplan-last.txt')), 'class-plan');
  assert.equal(kind('스캔.pdf', ACT_MATH.replace('이름:', '이름: 김하늘')), 'unit-scan');
  // 활동 안내 한 가지만 있는 단원평가 문제지는 문제지
  assert.equal(kind('도덕 5단원.hwp', fx('unit-paper-inline.txt')), 'unit-paper');
});

/* 연수·회의·행사 안내 공문(지어낸 글): 일시·장소·대상·신청 같은 안내가 둘 이상 → 「연수·행사 안내」(쪽지), 지침·운영 계획·행사 계획서는 그대로 */
const NOTICE = ['○○교육지원청', '수신  각급학교장', '(경유)', '제목  2026 AI 활용 수업 역량 강화 연수 안내', '1. 관련: 교수학습지원과-1234',
  '2. 연수를 다음과 같이 운영하오니 참석할 수 있도록 협조 바랍니다.', '  가. 일시: 2026. 11. 12.(목) 15:00~16:30', '  나. 장소: 3층 대회의실', '  다. 대상: 관내 초등 교원 희망자',
  '  라. 신청: 2026. 11. 6.(금)까지 회신', '붙임  연수 계획 1부.  끝.', '○○교육지원청교육장'].join('\n');
test('연수·행사 안내 공문은 「공문·안내」(공문 처리로), 공문 이름이어도', () => {
  assert.deepEqual(KINDS.find(k => k[0] === 'notice'), ['notice', '공문·안내', '공문 처리로']);
  assert.ok(KINDS.findIndex(k => k[0] === 'notice') < KINDS.findIndex(k => k[0] === 'guide'), '지침 앞');
  assert.equal(kind('연수 안내 공문.hwp', NOTICE), 'notice');
  const plan = ['2026 AI 활용 수업 연수 계획', '1. 목적', '2. 방침', '3. 운영 개요', '  가. 일시: 2026. 11. 12.(목)', '  나. 장소: 시청각실', '  다. 대상: 전 교직원'].join('\n');
  assert.equal(kind('연수 계획.hwp', plan), 'notice');
});
test('지침·운영 계획·행사 계획서는 쪽지가 아님(그대로)', () => {
  assert.equal(kind('독서.hwp', '2027학년도 독서교육 운영 계획\nⅠ. 목적\nⅡ. 방침\nⅢ. 세부 추진 계획\nⅣ. 연수\nⅤ. 예산'), 'year-plan');
  assert.equal(kind('공문.hwp', 'OO교육지원청\n수신 OO초등학교장\n(경유)\n제목 2027학년도 학교 교육과정 운영 지침 안내\n발신 OO교육지원청교육장'), 'guide');
  assert.equal(kind('운동회.hwp', '2026 가을 운동회 운영 계획\n1. 목적\n2. 일시: 2026. 10. 2.\n3. 장소: 운동장\n4. 대상: 전교생\n5. 경기 종목'), 'event-plan');
  assert.equal(kind('지침.hwp', '2027 학교 평가 지침\n수신 각급학교장\n1. 일시: 2027. 3. 2.\n2. 대상: 전 학교'), 'guide');
});

test('I2 일시·대상·참가·신청·안내 줄이 있는 운영 계획·행사 계획서도 쪽지가 아님(그대로), 연수·회의 안내와 연수 계획은 쪽지', () => {
  const plan = (title, ...rest) => [title, '1. 목적', '2. 방침', '3. 세부 추진 계획', ...rest].join('\n');
  assert.equal(kind('독서.hwp', plan('2027학년도 독서교육 운영 계획', '  가. 기간: 2027. 3.~12.', '  나. 대상: 전교생', '4. 교원 연수')), 'year-plan');
  assert.equal(kind('학폭.hwp', plan('2027 학교폭력 예방교육 운영 계획', '  가. 일시: 2027. 4. 3.', '  나. 대상: 전교생', '  다. 장소: 강당')), 'year-plan');
  assert.equal(kind('운영계획 공문.hwp', ['○○교육지원청', '수신 각급학교장', '(경유)', '제목 2027 독서교육 운영 계획 안내', '1. 목적', '2. 방침', '3. 기간: 연중', '4. 대상: 전 학교'].join('\n')), 'guide');
  assert.equal(kind('운동회.hwp', ['2026 가을 운동회 운영 계획', '1. 일시: 2026. 10. 2.', '2. 장소: 운동장', '3. 참가 대상: 전교생', '4. 경기 종목'].join('\n')), 'event-plan');
  assert.equal(kind('학예회.hwp', ['2026 학예회 계획', '1. 일시: 2026. 12. 18.', '2. 장소: 강당', '3. 학부모 안내: 가정통신문'].join('\n')), 'event-plan');
  assert.equal(kind('체험.hwp', ['2026 현장체험학습 계획', '1. 일시: 2026. 10. 15.', '2. 장소: 과학관', '3. 대상: 4학년', '4. 신청: 10. 1.까지'].join('\n')), 'event-plan');
  assert.equal(kind('회의.hwp', ['제목  교직원 회의 안내', '1. 일시: 2026. 11. 5.(수) 15:00', '2. 장소: 교무실', '3. 대상: 전 교직원'].join('\n')), 'notice');
  assert.equal(kind('공개수업.hwp', ['제목  2026 학부모 공개수업 안내', '가. 일시: 2026. 11. 20.', '나. 장소: 각 교실', '다. 대상: 학부모'].join('\n')), 'notice');
});
