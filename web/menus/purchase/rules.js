/* 품의 계산·점검 규칙 (화면 없음 — Node 시험에서도 씀).
   금액은 원 단위 정수. 품의 사유의 가~라 줄과 산출 내역 숫자는 AI가 아니라 여기서 만든다 */

const ex = (project, purpose, date, target, place, items) => ({ project, purpose, date, target, place, items: items.map(([name, spec, qty, price]) => ({ name, spec, qty, price })) });

/* 예시는 모두 지어낸 것 */
export const TYPES = [
  { id: 'goods', label: '물품 구입', hint: '수업·업무에 쓸 물품을 살 때 써요. 「아무거나 넣기」에 엑셀·견적서, 장바구니 캡처, 대충 쓴 글을 넣으면 품목 표가 채워져요.',
    example: ex('5학년 과학 실험 재료 구입', '용해와 용액 단원 모둠 실험', '2026-11-10', '5학년 4개 반 학생 100명', '과학실',
      [['비커', '500ml', 8, 4500], ['유리 막대', '30cm', 8, 1200], ['전자저울', '0.1g 단위', 4, 23000]]) },
  { id: 'lecturer', label: '강사 수당', hint: '외부 강사를 부를 때 써요. 주민번호·계좌번호는 넣지 않아요(행정실에서 따로 받아요).',
    example: ex('진로 체험 특강', '직업 세계 이해와 진로 탐색', '2026-11-18 5~6교시', '6학년 학생 90명', '시청각실',
      [['강사 수당(외부 강사)', '2시간', 1, 200000]]) },
  { id: 'event', label: '행사 운영', hint: '학교 행사를 운영할 때 써요. 행사계획에서 「품의로 이어 가기」를 누르면 칸이 채워져요.',
    example: ex('가을 학교 축제', '학생 자치 역량 강화와 공동체 의식 함양', '2026-11-20', '전교생 420명', '운동장·강당',
      [['현수막', '5m×0.9m', 2, 45000], ['체험 부스 재료 꾸러미', '부스당 1세트', 12, 30000], ['간식', '1인분', 420, 2500]]) },
  { id: 'meeting', label: '협의회', hint: '협의회·교내 연수 운영비를 쓸 때 써요.',
    example: ex('학년 교육과정 협의회', '2학기 평가 계획 협의', '2026-11-12 15:00', '5학년 담임 교사 4명', '5학년 연구실',
      [['다과', '1인분', 4, 8000], ['자료 인쇄', 'A4 컬러', 40, 300]]) }
];

export const emptyItem = () => ({ name: '', spec: '', unit: '', qty: '', price: '', vendor: '' });

/* 붙임 서류: 지출품의서 1부는 늘 1번(여기에 없음). on = 처음에 체크 (조사: 스펙 3장) */
export const ATTACH = {
  goods: [{ id: 'quote', label: '견적서', on: true }, { id: 'quote2', label: '비교 견적서', on: false }, { id: 'bizreg', label: '사업자등록증 사본', on: false }, { id: 'bankbook', label: '통장 사본', on: false }],
  lecturer: [{ id: 'card', label: '강사 카드(이력)', on: true }, { id: 'lesson', label: '강의 계획서', on: false }, { id: 'check', label: '성범죄·아동학대 전력 조회 동의서', on: true }],
  event: [{ id: 'plan', label: '행사 계획서', on: true }, { id: 'quote', label: '견적서', on: true }],
  meeting: [{ id: 'plan', label: '협의회 계획', on: true }, { id: 'list', label: '참석 예정자 명단', on: false }]
};
const attachOf = type => ATTACH[type] || ATTACH.goods;

export function emptyForm(type = 'goods') {
  return { type, project: '', purpose: '', date: '', target: '', place: '', budget: '', budgetUnknown: false, total: '', memo: '', items: [emptyItem()],
    vat: true, income: 'other', attach: attachOf(type).filter(a => a.on).map(a => a.id), attachMore: [] };
}
export const defaultUnit = type => (type === 'lecturer' ? '시간' : type === 'meeting' ? '명' : '개');

const blank = v => String(v == null ? '' : v).trim() === '';
const won = n => Number(n).toLocaleString('ko-KR');

/* 「12,000원」「 2.5 」 → 숫자. 못 읽으면 0 */
export function toNumber(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = Number(String(v == null ? '' : v).replace(/[,\s원₩]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export const itemAmount = it => Math.round(toNumber(it.qty) * toNumber(it.price));

/* 품명이 빈 줄은 빼고, 수량 빈칸은 1 */
export function cleanItems(items) {
  return (Array.isArray(items) ? items : [])
    .filter(it => it && !blank(it.name))
    .map(it => ({ ...it, name: String(it.name).trim(), spec: String(it.spec == null ? '' : it.spec).trim(), qty: blank(it.qty) ? 1 : it.qty }));
}

export const sumItems = items => cleanItems(items).reduce((s, it) => s + itemAmount(it), 0);

/* 개인정보 모양: 주민번호(6자리-7자리), 계좌번호(은행 이름 + 숫자 10~16개).
   「우리·하나·기업」처럼 흔한 말은 「은행」이 붙어야 은행으로 봄. 휴대전화 번호는 계좌로 보지 않음 */
const RRN = /\d{6}\s*-\s*\d{7}/;
const BANK = /은행|국민|신한|농협|카카오뱅크|토스뱅크|케이뱅크|우체국|새마을금고|신협|수협|SC제일|씨티|KB|NH|IBK/i;
const PHONE = /^01[016-9]-?\d{3,4}-?\d{4}$/;
export function findPersonal(text) {
  const s = String(text == null ? '' : text);
  if (RRN.test(s)) return 'rrn';
  if (BANK.test(s)) {
    for (const tok of s.match(/\d[\d-]*\d/g) || []) {
      const digits = tok.replace(/-/g, '').length;
      if (digits >= 10 && digits <= 16 && !PHONE.test(tok)) return 'account';
    }
  }
  return null;
}

const TEXT_FIELDS = ['project', 'purpose', 'date', 'target', 'place', 'budget', 'memo'];
const unitOf = (it, type) => (blank(it.unit) ? defaultUnit(type) : String(it.unit).trim());

/* 금액 한글 읽기: 75000 → 금칠만오천원 */
const DIG = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'], SMALL = ['', '십', '백', '천'], BIG = ['', '만', '억', '조'];
export function koreanWon(n) {
  let v = Math.max(0, Math.floor(toNumber(n)));
  if (!v) return '금영원';
  let out = '', g = 0;
  while (v > 0) {
    const part = v % 10000;
    if (part) {
      let w = '';
      String(part).padStart(4, '0').split('').forEach((d, i) => { if (d !== '0') w += DIG[+d] + SMALL[3 - i]; });
      out = w + BIG[g] + out;
    }
    v = Math.floor(v / 10000); g++;
  }
  return `금${out}원`;
}

/* 산출 근거 한 줄: 비커(500ml) 4,500원 × 8개 = 36,000원 */
export function basisLine(it, type) {
  const name = String(it.name || '').trim() + (blank(it.spec) ? '' : `(${String(it.spec).trim()})`);
  return `${name} ${won(toNumber(it.price))}원 × ${won(toNumber(blank(it.qty) ? 1 : it.qty))}${unitOf(it, type)} = ${won(itemAmount({ qty: blank(it.qty) ? 1 : it.qty, price: it.price }))}원`;
}

/* 공급가액(부가세 뺀 값): 포함이면 ÷1.1, 원 아래 버림. 2천만 원 이하면 1인 견적 (참고) */
export const SOLO_LIMIT = 20000000;
export const supplyValue = (total, vat) => (vat ? Math.floor(Math.round(toNumber(total) * 10) / 11) : Math.floor(toNumber(total)));
export function quoteNote(total, vat) {
  const sv = supplyValue(total, vat), solo = sv <= SOLO_LIMIT;
  return { solo, supply: sv, text: solo
    ? `공급가액 ${won(sv)}원 · 1인 견적으로 수의계약할 수 있어요(학교 지침이 비교 견적을 요구하면 2곳) · 행정실 확인`
    : `공급가액 ${won(sv)}원 · 2인 이상 견적·계약 절차를 행정실에 확인해 주세요` };
}

/* 강사 수당 원천징수(참고): 기타소득 125,000원 넘으면 8.8%, 사업소득 3.3%, 10원 아래 버림 */
export const INCOME = [['other', '기타소득(일시 강의)'], ['business', '사업소득(계속·반복 강의)'], ['staff', '교직원(기타수당)']];
export function withholding(amount, income) {
  const a = Math.round(toNumber(amount));
  if (income === 'staff') return { tax: null, net: null, note: '근로소득으로 행정실에서 계산해요' };
  const rate = income === 'business' ? 0.033 : (a > 125000 ? 0.088 : 0);
  const tax = Math.floor(a * rate / 10) * 10;
  return { tax, net: a - tax, note: income === 'business' ? '사업소득 3.3%' : a > 125000 ? '기타소득 8.8%' : '기타소득 125,000원 이하 · 떼지 않음' };
}

/* 협의회: 인원 × 1인 단가 × 횟수 → 품목 줄 하나 */
export function meetingItem({ people, price, times = 1 }) {
  const n = Math.max(1, Math.round(toNumber(people))), m = Math.max(1, Math.round(toNumber(times) || 1));
  return { name: '협의회 다과비', spec: `${n}명 × ${m}회`, unit: '명', qty: String(n * m), price: String(Math.round(toNumber(price))), vendor: '' };
}
const perPerson = it => toNumber(it.price);
/* 1인당 줄: 단위 명, 규격에 「N명」, 다과·식사 같은 품명 (대관료 1식 같은 줄은 상한과 상관없음) */
const perPersonLine = it => String(it.unit || '').trim() === '명' || /\d\s*명/.test(String(it.spec || '')) || FOOD.test(String(it.name || ''));

/* 예산 과목 추천 (참고, AI 없음) */
const EDU = /교구|실험|재료|교재|체험|학습|만들기|키트|교육/, SUPPLY = /소모품|인쇄|사무|토너|용지|복사|문구|파일|테이프|건전지|잉크/;
const DURABLE = /노트북|태블릿|프린터|책상|의자|카메라|TV|티비|모니터|컴퓨터|빔|프로젝터|복합기|냉장고|청소기/i;
const FOOD = /식사|간식|도시락|식비|다과|음료|급식|중식|석식/;
export function budgetHints(form) {
  const f = form || {}, items = cleanItems(f.items);
  if (f.type === 'meeting') return ['업무추진비'];
  if (f.type === 'lecturer') return [f.income === 'staff' ? '기타수당' : '운영수당'];
  if (f.type === 'event') return items.some(it => FOOD.test(it.name)) ? ['교육운영비', '업무추진비'] : ['교육운영비'];
  const out = [];
  if (items.some(it => DURABLE.test(it.name) && toNumber(it.price) >= 300000)) out.push('자산취득비');
  if (items.some(it => EDU.test(it.name))) out.push('교육운영비');
  if (items.some(it => SUPPLY.test(it.name))) out.push('일반수용비');
  return out.length ? out.slice(0, 2) : ['일반수용비', '교육운영비'];
}

/* 붙임 줄들: 지출품의서 1부 → 체크한 서류 → 직접 더한 것 */
export function attachLines(form) {
  const f = form || {}, type = f.type || 'goods';
  const on = Array.isArray(f.attach) ? f.attach : [];
  const more = Array.isArray(f.attachMore) ? f.attachMore.map(x => String(x).trim()).filter(Boolean) : [];
  return ['지출품의서 1부', ...attachOf(type).filter(a => on.includes(a.id)).map(a => `${a.label} 1부`), ...more.map(x => (/\d+\s*부$/.test(x) ? x : `${x} 1부`))];
}
export function attachText(lines) {
  if (lines.length === 1) return `붙임  ${lines[0]}.  끝.`;
  return lines.map((l, i) => `${i ? '      ' : '붙임  '}${i + 1}. ${l}.`).join('\n') + '  끝.';
}

/* 확인 목록 (P-6·P-7). missing·personal은 칸 이름. 필수는 목적·품목 1개(일시·대상은 아님, 스펙 3.2).
   guessPurpose: 목적이 비어도 초안 AI가 짐작해 씀 */
export function checkPurchase(form, { limit, meetCap, guessPurpose = false } = {}) {
  const f = form || {};
  const items = cleanItems(f.items);
  const missing = guessPurpose ? [] : ['purpose'].filter(k => blank(f[k]));
  if (!items.length) missing.push('items');
  const personal = TEXT_FIELDS.filter(k => findPersonal(f[k]));
  if ((Array.isArray(f.items) ? f.items : []).some(it => it && ['name', 'spec', 'unit', 'vendor'].some(k => findPersonal(it[k])))) personal.push('items');
  if ((Array.isArray(f.attachMore) ? f.attachMore : []).some(x => findPersonal(x))) personal.push('attach');
  const total = sumItems(f.items);
  const warnings = [], oks = [];
  if (!blank(f.total)) {
    const want = toNumber(f.total);
    if (want !== total) warnings.push(`품목 금액의 합(${won(total)}원)과 총액(${won(want)}원)이 달라요`);
    else oks.push('품목 금액의 합과 총액이 같아요');
  }
  if (f.budgetUnknown || blank(f.budget)) warnings.push('예산 과목 · 행정실 확인 필요');
  if (limit > 0 && total > limit) warnings.push(`별도 계약 절차 확인 필요 (합계 ${won(total)}원 > 기준 ${won(limit)}원)`);
  const cap = meetCap > 0 ? meetCap : 40000;
  if (f.type === 'meeting') { const over = items.filter(perPersonLine).find(it => perPerson(it) > cap); if (over) warnings.push(`1인 단가 ${won(perPerson(over))}원이 협의회 상한 ${won(cap)}원보다 커요 · 행정실 확인`); }
  if (f.type === 'event' && items.some(it => FOOD.test(it.name))) warnings.push('행사성 식비는 업무추진비로 따로 품의하는지 행정실 확인');
  if (!personal.length) oks.push('주민번호·계좌번호가 들어 있지 않아요');
  return { missing, personal, warnings, oks, total, canDraft: !missing.length && !personal.length };
}

const hasVendor = items => cleanItems(items).some(it => !blank(it.vendor));
/* 산출 내역을 탭으로 나눈 글로 (에듀파인·엑셀에 붙여넣기). 숫자는 쉼표 없이. 구입처가 있으면 구입처 열 */
export function itemsTSV(items, type = 'goods') {
  const v = hasVendor(items);
  const rows = cleanItems(items).map(it => [it.name, it.spec, unitOf(it, type), toNumber(it.qty), toNumber(it.price), itemAmount(it), ...(v ? [String(it.vendor || '').trim()] : [])].join('\t'));
  return [`품명\t규격\t단위\t수량\t단가\t금액${v ? '\t구입처' : ''}`, ...rows, `합계\t\t\t\t\t${sumItems(items)}${v ? '\t' : ''}`].join('\n');
}

/* 에듀파인에 차례로 붙여넣기 조각 (스펙 2026-11-03 3.2): 제목 → 품의 사유 → 산출 내역.
   mode 'table': 산출 내역을 표 한 번에(표 복사와 같은 글) · 'cells': 품목마다 품명·규격·단위·수량·단가 한 칸씩(숫자는 쉼표 없이) */
export function purchaseQueueItems(draft, form, mode = 'cells') {
  const d = draft || {}, f = form || {}, type = f.type || 'goods';
  const out = [{ label: '제목', text: String(d.title || '') }, { label: '품의 사유', text: String(d.reason || '') }];
  if (mode === 'table') return [...out, { label: '산출 내역(표)', text: itemsTSV(f.items, type) }];
  cleanItems(f.items).forEach((it, i) => {
    const n = `${i + 1}. `;
    out.push({ label: n + '품명', text: String(it.name || '').trim() }, { label: n + '규격', text: String(it.spec || '').trim() },
      { label: n + '단위', text: unitOf(it, type) }, { label: n + '수량', text: String(toNumber(it.qty) || '') }, { label: n + '단가', text: String(toNumber(it.price) || '') });
  });
  return out;
}

/* 초안 AI(와 검토 AI)에 보내는 메모 줄. 강사 수당은 강사 칸 글(이름일 수 있음)을 보내지 않고 사람 수·시간만 */
export function draftMemo(form) {
  const f = form || {}, type = TYPES.find(t => t.id === f.type) || TYPES[0], its = cleanItems(f.items);
  const items = type.id === 'lecturer'
    ? `강사 ${its.length}명, 모두 ${won(its.reduce((n, it) => n + toNumber(it.qty), 0))}시간`
    : its.map(it => `${it.name}${it.spec ? `(${it.spec})` : ''} ${won(toNumber(it.qty))}${String(it.unit || '').trim() || defaultUnit(type.id)} × ${won(toNumber(it.price))}원`).join(', ');
  const line = (k, v) => (String(v || '').trim() ? `- ${k}: ${String(v).trim()}\n` : '');
  return line('종류', type.label) + line('사업명', f.project) + line('목적', f.purpose) + line('일시', f.date) + line('대상', f.target) + line('장소', f.place)
    + line('품목', items) + `- 합계: ${won(sumItems(f.items))}원\n` + line('그 밖의 메모', f.memo);
}

/* 품의 사유의 앱이 만드는 부분: 가~ 줄(빈 칸 빼고 다시 매김) + 붙임 (스펙 4.5) */
const KO = '가나다라마바사아자차카타파하';
export function reasonTail(form) {
  const f = form || {}, type = f.type || 'goods', items = cleanItems(f.items);
  const total = sumItems(f.items);
  const basis = items.slice(0, items.length > 3 ? 1 : 3).map(it => basisLine(it, type)).join(', ') + (items.length > 3 ? ` 외 ${items.length - 1}건` : '');
  const budget = f.budgetUnknown || blank(f.budget) ? '' : f.budget;
  const rows = [['목적', f.purpose], ['일시', f.date], ['대상', f.target], ['장소', f.place],
    ['소요 예산', items.length ? `금${won(total)}원(${koreanWon(total)})` : ''], ['예산 과목', budget], ['산출 근거', items.length ? basis : '']]
    .filter(([, v]) => !blank(v)).map(([l, v], i) => `${KO[i]}. ${l}: ${String(v).trim()}`);
  return `${rows.join('\n')}\n\n${attachText(attachLines(f))}`;
}
/* 품의 사유: AI가 쓴 첫 문장 + 앱이 만드는 부분 */
export function composeReason({ intro, form }) {
  return `${String(intro || '').trim()}\n\n${reasonTail(form)}`;
}

/* 한글 파일(.hwpx)로 내보낼 문서: 제목, 1. 품의 사유, 2. 산출 내역 표, 예산 과목 */
export function purchaseDoc(form, draft) {
  const f = form || {}, d = draft || {};
  const items = cleanItems(f.items);
  const type = f.type || 'goods', v = hasVendor(f.items);
  const rows = [['품명', '규격', '단위', '수량', '단가', '금액', ...(v ? ['구입처'] : [])],
    ...items.map(it => [it.name, it.spec, unitOf(it, type), String(toNumber(it.qty)), won(toNumber(it.price)), won(itemAmount(it)), ...(v ? [String(it.vendor || '').trim()] : [])]),
    ['합계', '', '', '', '', won(sumItems(f.items)), ...(v ? [''] : [])]];
  const budget = f.budgetUnknown || blank(f.budget) ? '행정실 확인 필요' : String(f.budget).trim();
  const reason = String(d.reason || '');
  return {
    title: String(d.title || f.project || '품의').trim(),
    blocks: [
      { type: 'h', text: '1. 품의 사유' }, { type: 'p', text: d.reason || '' },
      { type: 'h', text: '2. 산출 내역' }, { type: 'table', head: true, rows },
      // 사유에 이미 있으면(앱이 만든 사유) 다시 쓰지 않음, 손으로 고쳐 빠졌으면 씀
      ...(reason.includes('산출 근거') ? [] : [{ type: 'p', text: `산출 근거: ${items.map(it => basisLine(it, type)).join(' / ')}` }]),
      ...(reason.includes('예산 과목') ? [] : [{ type: 'p', text: `예산 과목: ${budget}` }]),
      ...(/(^|\n)\s*붙임/.test(reason) ? [] : [{ type: 'p', text: attachText(attachLines(f)) }])
    ]
  };
}
