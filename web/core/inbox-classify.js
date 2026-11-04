/* 떠 있는 버튼: 넣은 파일이 무엇인지 AI 없이 판단 (스펙 2026-10-30-inbox-button 3).
   글에서 근거마다 점수를 더해 가장 높은 종류. 사진·스캔은 이름으로만(학생 이름이 보일 수 있어 AI로 보내지 않음) */
import { parseKey, parsePaper } from '../menus/evaluate/unit/unit-key.js';
import { splitDoc } from './bundle.js';

/* [종류, 이름, 기본 할 일] — 차례가 곧 실행 차례 */
export const KINDS = [
  ['unit-key', '단원평가 정답지', '새 단원평가로 넣기'],
  ['unit-paper', '단원평가 문제지', '단원평가 평가지로 넣기'],
  ['activity', '수업 활동지', '활동지 평가로 넣기'],
  ['unit-scan', '학생 답안 스캔', '채점하기'],
  ['eval-plan', '교과 평가계획', '교과 평어 평가계획으로 넣기'],
  ['class-plan', '작년 학급운영계획', '올해 학급운영계획 만들기'],
  ['event-plan', '작년 행사 계획', '행사계획 만들기'],
  ['year-plan', '작년 업무 계획', '연간계획 만들기'],
  ['notice', '안내·제출 공문', '공문 처리로'],
  ['guide', '올해 지침·공문', '계획에 지침으로 넣기'],
  ['jindo', '진도표', '학급 진도표에 넣기'],
  ['timetable', '기초시간표', '학급 시간표에 넣기'],
  ['roster', '학급 명단', '학급 명단으로 넣기'],
  ['quote', '견적서', '새 품의에 넣기'],
  ['survey', '설문 응답', '행사 결과 보고서 쓰기'],
  ['unknown', '모르는 파일', '']
];
export const kindLabel = k => (KINDS.find(x => x[0] === k) || KINDS[KINDS.length - 1])[1];
const order = k => KINDS.findIndex(x => x[0] === k);

const EVENT = /(운동회|체육\s*대회|학예회|발표회|축제|현장\s*체험\s*학습|체험\s*학습|수련\s*활동|입학식|졸업식|행사)/;
const YEAR_PARTS = [/목적/, /방침/, /세부\s*(추진|운영)/, /추진\s*(일정|계획)/, /예산/, /기대\s*효과/];
/* 연수·회의·행사 안내(쪽지, 스펙 2026-11-02 5장): 일시·장소·대상·신청·참석 안내가 둘 이상이고, 제목(「제목」 줄, 없으면 첫 줄)이
   연수·회의·협의회·설명회 안내·계획이거나, 계획서가 아닌 안내 공문(…안내·알림·개최·모집으로 끝남). 지침·운영 계획·행사 계획서는 그대로 */
const NOTICE_SIGNS = [/(일\s*시|일\s*자|기\s*간)\s*[:：]/, /장\s*소\s*[:：]/, /대\s*상\s*[:：]/,
  /(신\s*청|접\s*수|회\s*신|제\s*출)\s*(기\s*한|기\s*간|방\s*법)?\s*[:：]|까지\s*(신청|회신|제출|접수)/, /참\s*석|참\s*가\s*(자|대상|신청)/];
const MEET = /(연\s*수|회\s*의|협\s*의\s*회|설\s*명\s*회|워\s*크\s*숍)/;
const ANNOUNCE_END = /(안\s*내|알\s*림|개\s*최|모\s*집)\s*[)）]?\s*$/;
/* 수업 활동지 머리(활동지 스펙 6장): [5차시]·3-2-1-02 차시 번호, 교과서·국어책 N~M쪽·(N~M쪽), 반 번 이름 칸, 활동 안내(◉·※ …봅시다) */
const ACT_SIGNS = [
  ['차시', /\[\s*\d+\s*(?:[~-]\s*\d+\s*)?차시\s*\]|(?:^|[\s\]])\d-\d-\d{1,2}-\d{2}(?=\s|$)/m],
  ['교과서 쪽', /(?:교과서|[가-힣]{1,3}책|수익|실험\s*관찰)\s*\d+\s*(?:[~-]\s*\d+\s*)?쪽|\(\s*\d+\s*[~-]\s*\d+\s*쪽\s*\)/],
  ['이름 칸', /반\s+번\s+이\s*름/],
  ['활동 안내', /활동\s*[0-9①-⑩]|^\s*[◉※●▶■◆]\s*.*(?:봅시다|보세요|봐요)/m]
];

/* { name, text, scan } → { kind, why, alts } */
export function classify({ name = '', text = '', scan = false } = {}) {
  const n = String(name || '');
  if (scan) {
    if (/정답|해설/.test(n)) return { kind: 'unit-key', why: '파일 이름에 「정답」이 있어요. 사진 정답지는 AI가 읽어요.', alts: ['unit-scan'] };
    if (/견적/.test(n)) return { kind: 'quote', why: '파일 이름에 「견적」이 있어요.', alts: ['unit-scan'] };
    return { kind: 'unit-scan', why: '글자가 없는 사진·스캔이에요.', alts: ['unit-key', 'quote'] };
  }
  const t = String(text || '').slice(0, 30000), lines = t.split('\n'), head = lines.slice(0, 15).join('\n'), first = (lines.find(l => l.trim()) || '').replace(/^﻿/, '');
  const score = {}, why = {};
  const add = (k, pts, w) => { score[k] = (score[k] || 0) + pts; if (!why[k]) why[k] = w; };

  const key = parseKey(t);
  if (key) add('unit-key', 10, `정답 ${key.items.length}문항을 읽을 수 있어요.`);
  if (/정답|해설/.test(n)) add('unit-key', 2, '파일 이름에 「정답」이 있어요.');
  if (!key) {
    const q = Object.keys(parsePaper(t).questions).length;
    if (q >= 3 && /[①②③④⑤]|\(\s{2,}\)/.test(t)) add('unit-paper', 7, `문항 ${q}개와 답 칸이 있어요.`);
  }
  if (/문제지|평가지|단원\s*평가/.test(n)) add('unit-paper', 2, '파일 이름에 「평가지」가 있어요.');
  // 글자 인식이 된 학생 답안 스캔(복사기 PDF 등): 이름에 답안·스캔, 이름 칸이 채워짐, 같은 문제가 여러 번(반 전체를 한 파일로)
  // — 문제지로 잘못 보면 학생 이름·답이 평가지 글로 저장되고 채점 AI로 감
  if (/답안|스캔|scan/i.test(n)) add('unit-scan', 12, '파일 이름에 「답안」이 있어요.');
  // 「이름: 교사용」은 학생 이름이 아님(활동지 교사용 쪽)
  if (/(이\s*름|성\s*명)\s*[:：]\s*(?!교사용|학생용)[가-힣]{2,4}(?![가-힣])/.test(t)) add('unit-scan', 12, '이름이 적힌 학생 답안이에요.');
  const q1 = parsePaper(t).questions[1];
  // 교사용·(예시)·정답 표시로 나뉘는 글이면 같은 문제가 두 번 나와도 학생 답안 묶음이 아님(학생용 + 교사용)
  if (q1 && q1.length >= 8 && t.split(q1).length > 2 && splitDoc(t).how !== 'marker') add('unit-scan', 12, '같은 문제지가 여러 장 들어 있어요(학생 답안 묶음).');

  // 수업 활동지: 머리 표시가 둘 이상이고 정답 표(번호-정답 3줄 이상)가 없을 때. 표시 하나에 3점(문제지 7점을 넘으려면 셋)
  const top40 = lines.slice(0, 40).join('\n'), signs = ACT_SIGNS.filter(([, re]) => re.test(top40)).map(([w]) => w);
  if (signs.length >= 2 && !(key && key.items.length >= 3)) add('activity', 3 * signs.length, `수업 활동지예요(${signs.join('·')}).`);

  if (/성취\s*기준/.test(t) && /평가\s*(요소|기준|방법)/.test(t)) add('eval-plan', 4, '성취기준과 평가 기준이 있어요.');
  if (/평가\s*계획/.test(head)) add('eval-plan', 3, '제목에 「평가 계획」이 있어요.');
  if (/(^|\|)\s*상\s*\|\s*중\s*\|\s*하\s*(\||$)/m.test(t)) add('eval-plan', 2, '상·중·하 평가 기준이 있어요.');
  if (/평가\s*계획/.test(n)) add('eval-plan', 2, '파일 이름에 「평가계획」이 있어요.');

  if (/학급\s*(교육과정\s*)?(운영|경영)\s*계획|(교사|학급)\s*교육과정/.test(head)) add('class-plan', 8, '제목에 「학급 운영 계획」·「교사 교육과정」이 있어요.');
  if (/급훈|학급\s*실태|담임/.test(t)) add('class-plan', 2, '급훈·학급 실태가 있어요.');
  if (/학급/.test(n)) add('class-plan', 1, '파일 이름에 「학급」이 있어요.');

  if (EVENT.test(head) && /계획/.test(head)) add('event-plan', 7, '제목에 행사 계획이 있어요.');
  if (EVENT.test(n)) add('event-plan', 2, '파일 이름에 행사 이름이 있어요.');

  if (/(운영|추진|연간|사업)\s*계획/.test(head)) add('year-plan', 4, '제목에 「운영 계획」이 있어요.');
  if (YEAR_PARTS.filter(re => re.test(t)).length >= 2) add('year-plan', 3, '목적·방침·세부 추진 계획이 있어요.');

  // 안내 하나에 2점(지침 공문 9점보다 안내 항목 둘이면 10점)
  const nSigns = NOTICE_SIGNS.filter(re => re.test(lines.slice(0, 60).join('\n'))).length;
  const titleLine = (lines.find(l => /^\s*제\s*목/.test(l)) || first).replace(/^\s*제\s*목\s*[:：]?/, '').trim();
  const meetTitle = MEET.test(titleLine) && /(안\s*내|알\s*림|개\s*최|계\s*획|모\s*집)/.test(titleLine);
  const planLike = YEAR_PARTS.filter(re => re.test(t)).length >= 2 || (EVENT.test(titleLine) && /계획/.test(titleLine)) || /(운영|추진|연간|사업)\s*계획/.test(titleLine);
  if (nSigns >= 2 && !/지\s*침/.test(head) && (meetTitle || (ANNOUNCE_END.test(titleLine) && !planLike)))
    add('notice', 6 + 2 * nSigns, `안내 공문·계획이에요(일시·장소·대상·신청 중 ${nSigns}개). 공문 처리에서 기한·할 일을 뽑고 쪽지·가정통신문으로 이어 써요.`);
  if (/(지침|공문|시행|안내|협조|알림)/.test(head)) add('guide', 3, '제목에 지침·안내가 있어요.');
  if ([/수신/, /발신/, /경유/, /교육(지원)?청/].filter(re => re.test(head)).length >= 2) add('guide', 4, '공문(수신·발신)이에요.');
  if (/지침|공문/.test(n)) add('guide', 2, '파일 이름에 「지침」이 있어요.');

  // 진도표 파일은 처음부터 연간지도계획 표. 계획서 안에 든 진도표는 약하게 (계획서로 봄)
  if (/교육과정\s*연간지도계획/.test(head)) add('jindo', 9, '「교육과정 연간지도계획」 표예요.');
  else if (/교육과정\s*연간지도계획/.test(t)) add('jindo', 3, '「교육과정 연간지도계획」 표가 들어 있어요.');
  if (/기초\s*시간표/.test(head)) add('timetable', 6, '「기초시간표」예요.');
  if (/월\s*[|,]\s*화\s*[|,]\s*수\s*[|,]\s*목\s*[|,]\s*금/.test(t)) add('timetable', 3, '요일 칸이 있어요.');

  if (lines.slice(0, 15).some(l => /번\s*호/.test(l) && /(성\s*명|이\s*름)/.test(l))) add('roster', 8, '번호·성명 머리가 있는 명단이에요.');
  if (/명렬|명단/.test(n)) add('roster', 2, '파일 이름에 「명단」이 있어요.');

  if (/견\s*적\s*서/.test(t)) add('quote', 6, '「견적서」예요.');
  if (lines.slice(0, 20).some(l => /(품\s*명|품\s*목)/.test(l) && /(단\s*가|금\s*액)/.test(l))) add('quote', 4, '품명·단가 칸이 있어요.');
  if (/견적/.test(n)) add('quote', 2, '파일 이름에 「견적」이 있어요.');

  if (/타임스탬프|timestamp/i.test(first)) add('survey', 9, '구글 폼 응답(타임스탬프)이에요.');

  const ranked = Object.keys(score).sort((a, b) => score[b] - score[a] || order(a) - order(b));
  const top = ranked[0];
  if (!top || score[top] < 4) return { kind: 'unknown', why: '어떤 파일인지 알아보지 못했어요. 할 일을 골라 주세요.', alts: ranked };
  return { kind: top, why: why[top], alts: ranked.slice(1) };
}

/* [{file, kind}] → [{kind, files}] — 같은 종류는 묶고 KINDS 차례로 */
export function groupFiles(list) {
  const m = new Map();
  for (const x of list || []) { if (!m.has(x.kind)) m.set(x.kind, []); m.get(x.kind).push(x.file); }
  return [...m].sort((a, b) => order(a[0]) - order(b[0])).map(([kind, files]) => ({ kind, files }));
}
