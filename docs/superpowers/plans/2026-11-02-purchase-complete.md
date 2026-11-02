# 품의 메뉴 완성 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 품의 메뉴에 아무거나 넣기(엑셀·장바구니 캡처·줄글), 단위·산출 근거, 종류별 계산 도우미, 예산 과목 도우미, 붙임 체크리스트(지출품의서 1부 먼저), 기안문 모양 개요, 템플릿·최근 작성, 업무별 AI 「품의」, 형식 고르기를 더한다.

**Architecture:** 계산·문장 조립은 모두 `rules.js`(순수 함수), 넣기 읽기·합치기는 새 `intake.js`(순수 함수 + AI 부르기), 템플릿·최근 작성 저장은 새 `library.js`. `purchase.js`는 화면만. AI는 제목·첫 문장과 (규칙으로 못 읽은) 넣기만.

**Tech Stack:** 정적 ES 모듈, node:test, Playwright e2e(`tests/e2e/helpers.mjs`).

**Spec:** `docs/superpowers/specs/2026-11-02-purchase-complete-design.md`

## Global Constraints

- 붙임 1번은 늘 「지출품의서 1부」(끌 수 없음), 끝에 「 끝.」.
- 세율·상한·예산 과목·견적 안내는 「참고용 · 행정실 확인」. 원천징수: 기타소득 금액 > 125,000원이면 8.8%, 사업소득 3.3%, 10원 아래 버림. 협의회 1인 상한 기본 40,000원. 1인 견적 기준 공급가액 20,000,000원(부가세 포함이면 합계 ÷ 1.1, 원 아래 버림).
- 넣기: 빈 칸만 채움(쓴 칸 덮지 않음), 배송비는 품목 줄 「배송비」(규격=구입처, 단위 「건」, 수량 1, 0원·무료면 넣지 않음), 품목이 있으면 [더하기][바꾸기][그만두기], 구입처 둘 이상이면 [한 품의로][구입처별로 나누기].
- 개인정보: 주민번호·계좌 모양은 어느 새 칸이든 막음. 캡처의 주문자·받는 사람·주소·전화는 받지 않음. 강사 칸 글은 AI로 보내지 않음.
- AI는 제목·첫 문장(intro)만 쓰고, 금액·합계·산출 근거·가~사 줄·붙임 줄·한글 금액은 앱이 만든다.
- 저장 키: `purchase:current`(그대로), `purchase:templates`(학년도 자료, carryOver로 가져감, 50개), `purchase:recent`(학년도 자료, 20개), `purchaseMeetCap`(협의회 1인 상한, carryOver).
- 쉬운 우리말 문구(앱의 다른 문구 말투). 커밋 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, `Claude-Session: https://claude.ai/code/session_01KjeihiYexWK2nFymBR9ht6`.

## Review Focus

1. 예전에 저장한 `purchase:current`(unit·vendor·attach·income 없음)와 0.10의 템플릿 없는 상태 → 열림·빈칸으로 채움 (Task 1 단위 시험).
2. 줄글에 금액이 「총 2만원」처럼 합계로만 있음 → 단가 = 총액 ÷ 수량(원 아래 반올림) (Task 2).
3. 장바구니 캡처에 주문자 이름·주소·전화가 있음 → AI 답에 들어와도 버림, 칸에 들어가지 않음 (Task 2).
4. 초안을 만든 뒤 품목·붙임을 바꿈 → 손대지 않은 사유는 가~붙임 줄이 다시 맞춰지고, 손으로 고친 사유는 그대로 + [사유 다시 맞추기] (Task 4).
5. 템플릿을 불러오면 일시는 비고, 쓰던 품의에 내용이 있으면 먼저 물어봄 (Task 5).

---

### Task 1: 규칙 — 단위·구입처·산출 근거·한글 금액·견적 안내·원천징수·협의회·예산 추천·붙임·기안문 사유·문서

**Files:**
- Modify: `web/menus/purchase/rules.js`, `web/core/settings.js` (협의회 상한 get/set), `web/core/years.js` (carryOver에 `purchase:templates`, `purchaseMeetCap`)
- Test: `tests/unit/purchase-rules.test.mjs` (더함)

**Interfaces:**
- Produces (`rules.js`):
  - `emptyItem() → { name, spec, unit, qty, price, vendor }`, `emptyForm(type) → { …기존, vat: true, income: 'other', attach: string[] (종류별 기본 체크), attachMore: string[] }`
  - `defaultUnit(type) → '개'|'시간'|'명'`
  - `koreanWon(n) → '금칠만오천원'` (0 → '금영원')
  - `basisLine(item, type) → '비커(500ml) 4,500원 × 8개 = 36,000원'` (단위 빈칸이면 defaultUnit)
  - `supplyValue(total, vat) → number`, `quoteNote(total, vat) → { solo: bool, text }` (20,000,000 기준)
  - `withholding(amount, income) → { tax, net, note }` (other: >125000 → floor(amount*0.088/10)*10, business: floor(amount*0.033/10)*10, staff: tax null, note 「근로소득으로 행정실에서 계산해요」)
  - `meetingItem({ people, price, times }) → item` (name 「협의회 다과비」, spec `N명 × M회`, unit '명', qty N×M)
  - `budgetHints(form) → string[]` (스펙 4.3 규칙, 1~2개)
  - `ATTACH = { goods: [...], lecturer: [...], event: [...], meeting: [...] }` 각 `{ id, label, on }`; `attachLines(form) → string[]` (['지출품의서 1부', …체크한 것 '견적서 1부', …attachMore '… 1부'])
  - `attachText(lines) → '붙임  1. 지출품의서 1부.\n      2. 견적서 1부.  끝.'`
  - `composeReason({ intro, form }) → string` (스펙 4.5: 가. 목적~사. 산출 근거, 빈 줄 빼고 가나다 다시, 산출 근거 3건 넘으면 「외 N건」, 마지막 붙임 줄)
  - `reasonTail(form) → string` (첫 문장 뒤 부분), `itemsTSV(items)` 열 `품명 규격 단위 수량 단가 금액` (+ 구입처가 있으면 `구입처` 열)
  - `checkPurchase(form, { limit, meetCap })` 추가 경고: 협의회 1인 단가 > meetCap, 행사 식비, 새 칸 개인정보(items unit·vendor, attachMore)
  - `purchaseDoc(form, draft)` 표에 단위(·구입처), 산출 근거·예산 과목·붙임 블록
- Produces (`settings.js`): `getMeetCap() → number` (기본 40000), `setMeetCap(won) → true|false|'full'`

- [ ] **Step 1: 단위 시험** (purchase-rules.test.mjs에 더함)
  - `koreanWon(75000) === '금칠만오천원'`, `koreanWon(12345678) === '금일천이백삼십사만오천육백칠십팔원'`, `koreanWon(100000) === '금십만원'`, `koreanWon(10) === '금십원'`, `koreanWon(0) === '금영원'`.
  - `basisLine({name:'비커',spec:'500ml',unit:'',qty:'8',price:'4500'},'goods') === '비커(500ml) 4,500원 × 8개 = 36,000원'`.
  - `supplyValue(22000000, true) === 20000000`; `quoteNote(22000000,true).solo === true`; `quoteNote(22000001,false).solo === false`.
  - `withholding(125000,'other').tax === 0`; `withholding(200000,'other')` → tax 17600, net 182400; `withholding(123456,'business').tax === 4070`; `withholding(1,'staff').tax === null`.
  - `meetingItem({people:4,price:8000,times:2})` → `{name:'협의회 다과비',spec:'4명 × 2회',unit:'명',qty:'8',price:'8000',vendor:''}`.
  - `budgetHints`: meeting → ['업무추진비']; lecturer other → ['운영수당'], staff → ['기타수당']; goods 품명 「실험 재료」 → ['교육운영비']; 「토너」 → ['일반수용비']; 단가 500000 「노트북」 → 첫 칸 '자산취득비'; 모르는 품명 → ['일반수용비','교육운영비']; event + 품명 「간식」 → ['교육운영비','업무추진비'].
  - `attachLines(emptyForm('goods'))[0] === '지출품의서 1부'` 그리고 `includes('견적서 1부')`; attachMore ['참고 자료'] → 끝에 '참고 자료 1부'; `attachText(['지출품의서 1부','견적서 1부'])` 줄 모양 그대로 끝이 `'  끝.'`.
  - `composeReason`: 장소·예산 빈 form → 줄 머리 `가. 목적`,`나. 일시`,`다. 대상`,`라. 소요 예산: 금…원(금…원)`,`마. 산출 근거: …`; 품목 4개 → 산출 근거에 「외 3건」... (3건 이하 모두 쉼표로, 넘으면 첫 건 + `외 N건`); 마지막 줄 붙임·끝.
  - `itemsTSV` 머리 `품명\t규격\t단위\t수량\t단가\t금액`; vendor 있는 품목이면 머리에 `\t구입처`.
  - `checkPurchase`: 협의회 1인 50000 > meetCap 40000 경고 「1인 단가 50,000원이 협의회 상한 40,000원보다 커요」; event 품목 「도시락」 → 경고에 「업무추진비」; items[0].vendor에 주민번호 → personal에 'items'; attachMore에 계좌 → personal에 'attach'.
  - 예전 값: `purchaseDoc`·`composeReason`이 unit·vendor·attach 없는 form으로도 동작(붙임은 지출품의서만).
  - `isYearKey('purchase:templates') === true`, `carryOver({ 'purchase:templates': '[]', purchaseMeetCap: '30000', 'purchase:recent': '[]' }, 2027)`에 templates·cap만 있음.
- [ ] **Step 2:** `node --test tests/unit/purchase-rules.test.mjs` → FAIL.
- [ ] **Step 3:** 구현.
- [ ] **Step 4:** PASS, `npm test` 통과(기존 품의 시험이 새 사유 모양에 맞지 않으면 시험의 기대값을 스펙 4.5 모양으로 고치고 ledger에 Ruling).
- [ ] **Step 5:** 커밋 「품의 1: 규칙 …」.

### Task 2: 아무거나 넣기 — 읽기·합치기 (`intake.js`)

**Files:**
- Create: `web/menus/purchase/intake.js`
- Modify: `web/menus/purchase/quote.js` (unit·vendor 받기)
- Test: `tests/unit/purchase-intake.test.mjs`

**Interfaces:**
- Produces:
  - `parseLines(text) → { items: item[], fields: {}, missed: string[] }` — 규칙 읽기. 숫자+단위어(개·박스·권·자루·세트·장·통·묶음·팩·병·봉·EA·ea·명·시간·식·건) = 수량·단위, 금액(`2만원`·`1.2만원`·`20,000원`·`20000`·`× 500`·`×500`·`*500`), 「총·합계·전체 N원」이면 단가 = round(N ÷ 수량). 품명 = 나머지 글. 금액이 없거나 품명이 없으면 missed.
  - `intakePrompt(kind: 'text'|'image') → string` (머리 `[품의 넣기]`; 받을 것만: items(name·spec·unit·qty·price(1개 결제 단가)·vendor), shipping [{vendor, fee}], fields {project, purpose, target, date, place, budget}; 주문자·받는 사람·주소·전화·이메일은 쓰지 말 것)
  - `normIntake(v) → { items, shipping, fields }` — 모양 틀린 것 버림, items·fields에 개인정보 모양이면 그 값 버림, fields는 그 6개 키만.
  - `readIntake(input: { text?: string, file?: File, image?: Blob }) → Promise<{ items, fields, by: 'rule'|'table'|'ai', missed: string[] }>` — 파일은 `readQuote`(사진이면 이 프롬프트로), 그림은 AI, 글은 parseLines 먼저(못 읽은 줄이 있고 AI 준비면 AI로 전체). 배송비는 `shippingItems(shipping)`으로 품목 끝에 붙임. AI 부르기는 `task: 'purchase'`.
  - `shippingItems(shipping) → item[]` (fee > 0만, {name:'배송비', spec: vendor, unit:'건', qty:'1', price})
  - `fillEmpty(form, fields) → form` (빈 칸만)
  - `mergeItems(items, add, how: 'add'|'replace') → item[]` (빈 줄은 먼저 채움)
  - `vendorsOf(items) → string[]` (빈 구입처·배송비 빼고 처음 나온 차례), `splitByVendor(form) → form[]` (첫 구입처가 [0]; 배송비 줄은 spec의 구입처를 따라감; 구입처 없는 품목은 [0])
- Consumes: `emptyItem`, `findPersonal` (Task 1), `readQuote` (quote.js), `ai.generateJSON`.

- [ ] **Step 1: 단위 시험** `purchase-intake.test.mjs`
  - `parseLines('A4 용지 5박스 2만원\n보드마커 검정 10개 1200원\n풀 3개×500\n가위 4자루 총 1만원\n그냥 메모')` → items 4개: `{name:'A4 용지',unit:'박스',qty:'5',price:'20000'}`, `{name:'보드마커 검정',unit:'개',qty:'10',price:'1200'}`, `{name:'풀',qty:'3',price:'500'}`, `{name:'가위',unit:'자루',qty:'4',price:'2500'}`; missed `['그냥 메모']`.
  - `parseLines('색연필 12색 30세트 1.2만원')` → name '색연필 12색', qty '30', unit '세트', price '12000'.
  - `normIntake({items:[{name:'물티슈',qty:2,price:3000,vendor:'쿠팡'},{name:'',price:1}], shipping:[{vendor:'쿠팡',fee:3000},{vendor:'학교장터',fee:0}], fields:{purpose:'교실 환경 정리',buyer:'홍길동',address:'서울시…',phone:'010-1234-5678',target:'3학년 1반'}})` → items 1개, shipping 2개, fields 키는 purpose·target만.
  - 개인정보: items name에 주민번호 모양 → 그 품목 버림.
  - `shippingItems([{vendor:'쿠팡',fee:3000},{vendor:'학교장터',fee:0}])` → 1줄 `{name:'배송비',spec:'쿠팡',unit:'건',qty:'1',price:'3000'}`.
  - `fillEmpty({purpose:'쓴 목적',target:''}, {purpose:'새 목적',target:'3학년'})` → purpose '쓴 목적', target '3학년'.
  - `mergeItems([빈 줄], add, 'add')` → add 그대로; `mergeItems([a], [b], 'add')` → [a,b]; 'replace' → [b].
  - `vendorsOf([{vendor:'쿠팡'},{vendor:''},{name:'배송비',vendor:'',spec:'쿠팡'},{vendor:'학교장터'}])` → ['쿠팡','학교장터']; `splitByVendor` → 2개, [0]에 쿠팡 품목·쿠팡 배송비·구입처 없는 품목, [1]에 학교장터 품목, 다른 칸(project 등)은 둘 다 같음.
  - `intakePrompt('image')`가 `[품의 넣기]`로 시작하고 「주문자」「받는 사람」「주소」「전화」를 쓰지 말라는 말을 담음.
- [ ] **Step 2:** FAIL → **Step 3:** 구현 → **Step 4:** PASS.
- [ ] **Step 5:** 커밋 「품의 2: 아무거나 넣기 읽기·합치기」.

### Task 3: 새 품의 화면 — 넣기 칸·단위·구입처 열

**Files:**
- Modify: `web/menus/purchase/purchase.js`, `web/menus/purchase/purchase.css`, `web/menus/purchase/purchase.js` 떠 있는 버튼 입구(견적서 → 넣기)
- Test: `tests/e2e/purchase-intake.mjs`

**Interfaces:**
- Consumes: Task 2 전부, Task 1 `emptyItem/defaultUnit`.
- Produces: 넣기 칸 `#pcIntake`(textarea, paste·drop 받음), `[data-pc="intake"]`(넣기), `[data-pc="intakeFile"]`+`#pcIntakeFile`; 묻기 창 `#pcMergeAdd`·`#pcMergeReplace`, 구입처 창 `#pcVendorOne`·`#pcVendorSplit`; 품목 줄 `data-f="unit"`·`data-f="vendor"`(구입처 열은 구입처가 하나라도 있으면 보임); 넣은 줄 `.pc-irow.new`. 지금의 [견적서 넣기]는 넣기 칸의 [파일 고르기]로 합침(`addQuote` 이름은 떠 있는 버튼용으로 남김: 같은 넣기를 부름).

- [ ] **Step 1: 화면 시험** `purchase-intake.mjs`(가짜 Claude: `[품의 넣기]` 프롬프트에 장바구니 답)
  - 줄글: 넣기 칸에 Step 1의 다섯 줄 → [넣기] → 품목 4줄(단위 칸 값 포함), 「못 읽은 줄 1개」 알림, AI 부르지 않음(규칙으로 다 읽은 줄만이면). 목적 칸이 비어 있으면 그대로(줄글에 목적 없음).
  - 줄글에 규칙으로 못 읽는 줄 + AI 키 → AI 한 번, 그 답의 fields(목적)가 빈 목적 칸에 들어가고 쓴 사업명은 그대로.
  - 캡처: 넣기 칸에 그림 붙여넣기(clipboard paste 이벤트에 png File) → AI 한 번(그림 1장, 머리 `[품의 넣기]`) → 품목 + 「배송비」 줄(쿠팡 3,000원), 구입처 열 보임.
  - 품목이 있을 때 다시 넣기 → `#pcMergeAdd`·`#pcMergeReplace` 창 → [바꾸기]면 새 품목만.
  - 구입처 둘(쿠팡·학교장터) → 구입처 창 → [구입처별로 나누기] → 지금 품의에 쿠팡 품목만, `ssam:purchase:recent`에 학교장터 품의 1개(초안 없음, project에 「(학교장터)」).
  - 엑셀 파일 끌어 놓기(drop 이벤트 DataTransfer) → 표에서 품목(AI 없음).
  - AI 답에 주문자·주소가 있어도 어느 칸에도 들어가지 않음.
  - 기존 `tests/e2e/purchase.mjs` 통과(견적서 버튼 자리 바뀌면 그 시험의 선택자만 고치고 Ruling).
  - FAIL 확인.
- [ ] **Step 2:** 구현(넣은 줄은 3초 동안 `.new` 노랑).
- [ ] **Step 3:** PASS, `purchase`·`inbox`·`inbox-class` 화면 시험 PASS.
- [ ] **Step 4:** 커밋 「품의 3: 아무거나 넣기 화면 …」.

### Task 4: 종류별 계산·예산 칩·붙임·기안문 사유·내려받기 형식

**Files:**
- Modify: `web/menus/purchase/purchase.js`, `purchase.css`, `web/menus/settings/settings.js`(품의 기준에 협의회 1인 상한)
- Test: `tests/e2e/purchase-more.mjs`

**Interfaces:**
- Consumes: Task 1 전부, `exportButton/exportDoc`(core/doc-export.js).
- Produces: `#pcVat`(부가세 포함 체크), `#pcQuoteNote`, 강사 `select#pcIncome`·줄마다 `[data-wh="i"]`(원천징수 글), 협의회 `#pcMeetPeople`·`#pcMeetPrice`·`#pcMeetTimes`·`[data-pc="meetAdd"]`, 예산 칩 `[data-budget-hint]`, 붙임 `[data-attach="id"]` 체크·`#pcAttachMore`+`[data-pc="attachAdd"]`·`[data-attach-del="i"]`, 사유 다시 맞추기 `[data-pc="resync"]`, 내려받기 `exportButton('data-pc="export"')`, 설정 `#meetCap`·`[data-set="saveMeetCap"]`. 초안 `st.draft = { title, intro, reason, edited: bool }`(예전 값: intro 없으면 reason 첫 줄).

- [ ] **Step 1: 화면 시험** `purchase-more.mjs`
  - 물품: 합계 22,000,000(부가세 포함) → `#pcQuoteNote`에 「1인 견적」; 체크 끄면 「2인 이상」.
  - 강사 수당: 종류 고르면 품목 머리 「강사(역할)·시간·시간당 단가」, 2시간 × 100,000원·기타소득 → `[data-wh="0"]`에 「17,600원」「182,400원」; 사업소득 → 「6,600원」; 초안 프롬프트에 강사 칸 글 「김강사」가 없음.
  - 협의회: 4명 × 50,000원 × 1회 [품목에 넣기] → 품목 줄 「협의회 다과비 · 4명 × 1회」, 확인 목록에 상한 경고; 설정 › 품의 기준에서 상한 60,000으로 저장 → 경고 사라짐.
  - 예산 칩: 물품 품명 「실험 재료」 → 칩 「교육운영비」 → 누르면 예산 과목 칸 값.
  - 붙임: 기본 「견적서」 체크, 「사업자등록증 사본」 체크 + 직접 「참고 자료」 → 초안 사유 끝 `붙임  1. 지출품의서 1부.` … `4. 참고 자료 1부.  끝.`.
  - 사유 모양: 「마. 소요 예산: 금…원(금…원)」 줄, 산출 근거 줄.
  - 초안 뒤 붙임 하나 끔 → 사유 붙임 줄이 다시 맞춰짐(첫 문장 그대로); 사유를 손으로 고친 뒤 품목 바꿈 → 사유 그대로 + `[data-pc="resync"]` 보임 → 누르면 다시 맞춤(Review Focus 4).
  - 내려받기 ▾ 워드 → .docx, 본문에 「붙임」「산출 근거」.
  - FAIL 확인.
- [ ] **Step 2:** 구현.
- [ ] **Step 3:** PASS, `purchase`·`purchase-intake`·`settings`·`doc-export`·`event-plan`(품의로 이어 가기) PASS.
- [ ] **Step 4:** 커밋 「품의 4: …」.

### Task 5: 저장한 템플릿 · 최근 작성 · 새로 쓰기

**Files:**
- Create: `web/menus/purchase/library.js`
- Modify: `web/menus/purchase/purchase.js`(탭 그리기·[템플릿으로 저장]·[새로 쓰기]·초안 때 최근 작성 저장), `purchase.css`
- Test: `tests/unit/purchase-library.test.mjs`, `tests/e2e/purchase-library.mjs`

**Interfaces:**
- Produces (`library.js`):
  - `listTemplates() → [{ id, name, savedAt, form }]`, `saveTemplate(name, form) → tpl|null` (form에서 date 비우고, draft 없음; 50개 넘으면 오래된 것부터 뺌), `renameTemplate(id, name)`, `deleteTemplate(id)`, `templateForm(tpl) → form` (date '' )
  - `listRecent() → [{ id, at, form, draft|null }]`, `pushRecent(entry)` (같은 id는 그 자리 갱신 후 맨 앞, 20개), `deleteRecent(id)`
  - 예전 값·망가진 값은 버리거나 다듬음.
- Produces (`purchase.js`): `st.id`(품의 id, `pc` + 시각), [템플릿으로 저장] `[data-pc="saveTpl"]` → 창 `#pcTplName`·`#pcTplOk`; [새로 쓰기] `[data-pc="fresh"]`; 템플릿 탭 `[data-tpl-load=id]`·`[data-tpl-rename=id]`·`[data-tpl-del=id]`; 최근 탭 `[data-recent-open=id]`·`[data-recent-del=id]`; 바꿀까요 창 `#pcSwapOk`.
- Consumes: Task 2 `splitByVendor`가 만든 품의는 `pushRecent({ id, at, form, draft: null })`.

- [ ] **Step 1: 단위 시험**: saveTemplate → listTemplates 1개, form.date ''; 51번째 저장 → 50개; renameTemplate; deleteTemplate; pushRecent 21번 → 20개; 같은 id 두 번 → 1개이고 맨 앞; 망가진 저장값(배열 아님·항목 모양 틀림) → []; `templateForm`이 unit 없는 예전 품목도 emptyItem 모양으로.
- [ ] **Step 2: 화면 시험** `purchase-library.mjs`: 칸 채우고 [템플릿으로 저장] 이름 「과학 실험 재료」 → 템플릿 탭 1줄(품목 N개·합계) → [이름 바꾸기] → [불러오기]: 쓰던 메모가 있으면 `#pcSwapOk` 확인 → 새 품의에 칸·품목(수량 그대로), 일시 빈칸, 초안 없음(Review Focus 5); [지우기] 확인 → 0줄. 초안 만들기 → 최근 작성 1줄(제목) → [새로 쓰기] → 빈 품의 → 최근 작성 [열기] → 입력·초안 그대로 돌아옴 → [지우기]. 새로고침 뒤에도 남음.
- [ ] **Step 3:** FAIL → 구현 → PASS, `purchase*` 시험 PASS.
- [ ] **Step 4:** 커밋 「품의 5: 저장한 템플릿·최근 작성·새로 쓰기」.

### Task 6: 업무별 AI 「품의」 + 검토

**Files:**
- Modify: `web/core/ai-roles.js`(TASKS에 `['purchase','품의']`), `web/core/ai-review.js`(`purchaseReviewPrompt(memo, draft) → string` 머리 `[품의 검토]`, `normPurchaseReview(v) → [{ field: 'title'|'intro', problem, fix }]`), `web/menus/purchase/purchase.js`(AI 줄 `aiRowHTML('purchase')`, 초안·넣기·견적서 AI에 `task: 'purchase'`, 초안 뒤 검토·두 의견·손으로 고치면 사라짐·실패 「검토하지 못했어요」), `web/menus/purchase/quote.js`(task)
- Test: `tests/unit/ai-roles.test.mjs`·`tests/unit/ai-review.test.mjs`(더함), `tests/e2e/purchase-ai.mjs`

**Interfaces:**
- Consumes: Task 4 `st.draft.intro/edited`, ai-review `reviewJSON`, `opinionHTML`.
- Produces: `st.draft.rv = [{ field, problem, fix, done? }]`, `[data-rv-use="title"|"intro"]`.

- [ ] **Step 1: 시험**: 단위 — TASKS 5개·`getRoles().tasks.purchase` 기본, 예전 ai-roles(purchase 없음) 읽힘; `purchaseReviewPrompt`에 강사 칸 글 없음·머리; `normPurchaseReview`가 모르는 field 버림. 화면 — `purchase.main = Haiku` → 초안 요청 모델 Haiku, 다른 업무는 기본; 검토 켬(Opus) → 초안 뒤 `[품의 검토]` 1번 → intro 의견 → [검토 안 쓰기]면 사유 첫 문장이 고친 문장으로(가~붙임 그대로); 제목 칸을 손으로 고치면 제목 의견 사라짐; 검토 401 → 초안 그대로·「검토하지 못했어요」; 설정 › AI 업무별 한눈에 5줄. FAIL 확인.
- [ ] **Step 2:** 구현 → **Step 3:** PASS, `ai-roles`·`settings`·`purchase*` 화면 시험 PASS.
- [ ] **Step 4:** 커밋 「품의 6: 업무별 AI 품의·검토」.

### Task 7: 문서·전체 시험

**Files:**
- Modify: `README.md`(품의 줄·시연), `docs/PRD.md`(5.2에 P-11 아무거나 넣기 ~ P-16, 6.3 업무 5개), `.github/RELEASE_NOTES.md`(whats-new에 품의; 버전은 릴리즈를 부탁받을 때)
- [ ] **Step 1:** 문서 고침.
- [ ] **Step 2:** `npm test`, `npm run e2e`, `cargo check --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc --tests` 통과.
- [ ] **Step 3:** 커밋 「품의 7: 문서」.
