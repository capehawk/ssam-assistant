# 품의 한 칸 → 바로 초안 · 기타 › 쪽지 작성 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 품의를 「넣기 칸 하나 → [초안 만들기] 한 번」으로 바꾸고(필수는 목적·품목, 설정에서 「빠진 것만 물어보기」), 세로 메뉴 「기타 › 쪽지 작성」에서 공문·계획 파일로 선생님들께 보낼 안내 쪽지를 쓰며 붙임 파일을 복사·폴더 열기로 돕는다.

**Architecture:** 품의는 지금 화면(`purchase.js`)을 「간단히」(넣기 칸 + 초안 칸)와 접힌 「자세히 고치기」(지금 칸 전부)로 나누고, 순수 규칙(`oneshot.js`)이 AI 답을 칸·종류·확인할 것 칩으로 다듬는다. 쪽지는 새 메뉴 폴더 `web/menus/etc/`에 순수 규칙(`message-ai.js`)·저장(`message-model.js`)·화면(`message.js`)을 두고, 붙임 파일은 Tauri 명령(`files.rs`)으로 다운로드 폴더에 모아 클립보드 파일 복사·탐색기 열기. 떠 있는 버튼은 `inbox-classify.js`에 `notice` 종류를 더한다.

**Tech Stack:** 정적 ES 모듈(web/), node:test(`npm test`), Playwright 화면 시험(`npm run e2e`, `tests/e2e/*.mjs`, helpers `open/run/assert/mockClaude/FIXTURES/ROOT`), Tauri 2(Rust, `arboard` `file_list`, `tauri-plugin-opener`).

**Spec:** `docs/superpowers/specs/2026-11-02-purchase-oneshot-notes-design.md`

## Global Constraints

- 학생 이름은 저장·AI 전송 안 함. 쪽지는 AI로 보내기 전 `stripNames`(명단 줄·전화번호 줄 빼기, 직책 옆 이름 ○○○)와 주민번호 줄 빼기. 보내는 사람(문의)·붙임 파일 내용은 AI로 보내지 않음.
- 품의 강사 수당은 넣기 칸 글·그림을 AI로 보내지 않음(지금 규칙 그대로). 주민번호·계좌는 막음.
- AI 키는 코드·저장소·로그·백업에 넣지 않음.
- 화면 단추 속성: 품의 `data-pc`, 쪽지 `data-msg`(기존 평가 화면의 `data-act`와 겹치지 않게).
- 저장 키: GLOBAL에 `purchase:view`·`purchase:flow`·`msg:sender`를 더함. `msg:list`(20개)·`msg:draft`는 학년도 자료.
- 업무별 AI: 새 업무 `['message', '쪽지']`(이미 있는 `notes`는 피드백·알림이라 이름을 달리함).
- 날짜 꼴: `2026. 11. 12.(목)`. 쪽지 제목 머리: `[연수 안내]`·`[회의 안내]`·`[행사 안내]`·`[제출 안내]`·`[안내]`, 다시 안내는 `[다시 안내]`.
- 붙임 폴더: `다운로드/쌤비서 쪽지 붙임/<YYYY-MM-DD> <제목>/`.
- 모든 글·안내는 한국어 쉬운 말. 버전은 올리지 않음(릴리즈 때).

## Review Focus

1. 강사 수당 품의에서 넣기 칸에 「김철수 강사 2시간 10만원」을 쓰고 [초안 만들기] → 초안 AI 요청에 넣은 글·강사 이름이 들어가지 않음(사람 수·시간만).
2. 공문에 담당자 명단·전화번호 줄이 있음 → 쪽지 AI 요청에 그 줄이 없고, 뺀 줄 수를 알림.
3. AI 답이 선생님이 이미 쓴 칸(목적·일시 등)을 다르게 채움 → 쓴 칸은 그대로, 빈 칸만 채움(「AI가 짐작함」은 빈 칸에만).
4. 목적·방침·세부 추진 계획이 있는 운영 계획·지침 공문(연수 낱말이 있어도) → 떠 있는 버튼은 지금처럼 「계획에 지침으로 넣기」(`guide`/`year-plan`), `notice`가 아님.
5. AI 답의 날짜가 연도 없음(「11-12」)·없는 날(「2026-13-40」)·빈칸 → 쪽지가 깨지지 않음: 연도는 지금 학년도로 채우고, 없는 날은 날짜 줄을 AI 글 그대로(요일 없이) 쓰거나 빼기.

---

### Task 1: 품의 규칙 — 필수 줄이기·한 번에 초안 답 다듬기·확인할 것

**Files:**
- Modify: `web/menus/purchase/rules.js` (`checkPurchase`)
- Create: `web/menus/purchase/oneshot.js`
- Test: `tests/unit/purchase-oneshot.test.mjs`, 고칠 기대값: `tests/unit/purchase-rules.test.mjs`(일시·대상 필수 아님)

**Interfaces:**
- Produces:
  - `checkPurchase(form, { limit, meetCap, guessPurpose = false })` — `missing`은 `purpose`(guessPurpose면 빼고)·`items`만.
  - `oneshotPrompt(form, text = '', { askType = false } = {}) → string` — 머리 `[품의 초안]`, 지금 `draftMemo(form)` 위에 넣은 글(`text`, 강사 수당이면 넣지 않음), 비어 있는 칸 이름 목록, askType이면 `type`도 묻기. 출력 `{"title","intro","fields":{...},"type":""}`.
  - `normOneshot(v, form) → { title, intro, fields, type }` — `fields`는 form에서 **빈** `project·purpose·date·target·place`만(개인정보·전화·이메일 든 값 버림, 200자), `type`은 `goods|lecturer|event|meeting` 아니면 `''`.
  - `confirmChips(form, check, guessed = []) → [{ key, text, level: 'warn'|'info' }]` — 예산 과목 비면 `{key:'budget', text:'예산 과목 · 행정실 확인', level:'warn'}`, 단가·수량 빈 품목 `{key:'items', text:'단가 없는 품목 n개'}`, guessed의 목적 `{key:'purpose', text:'목적 · AI가 짐작함'}`, 일시·대상 둘 다 비면 `{key:'date', text:'일시·대상 없이 썼어요', level:'info'}`, 그 밖의 `check.warnings`는 `{key:'', text:w, level:'warn'}`(예산 과목 경고는 겹치지 않게 뺌).
  - `askNeeds(form) → Array<'purpose'|'items'>` (빈 것만, 최대 2).

- [ ] **Step 1: 시험** `purchase-oneshot.test.mjs`:
  - `checkPurchase({...목적 있음, 품목 1개, 일시·대상 빈칸})`의 `missing`이 `[]`, `canDraft` 참. 목적 빈칸이면 `['purpose']`, `guessPurpose: true`면 `[]`. 품목 없으면 `items`.
  - `reasonTail`에 일시·대상이 비면 「나. 일시」 줄이 없고 `가. 목적`, `나. 장소`처럼 다시 매김(이미 있는 동작 고정).
  - `oneshotPrompt(form, '알코올램프 10개 5천원 다음 주 화요일 과학실')`이 `[품의 초안]`으로 시작하고 넣은 글을 품음, 강사 수당 form이면 넣은 글·`김철수`가 없음, askType이면 `"type"` 설명 줄.
  - `normOneshot({ title:'과학 실험 재료 구입', intro:'…', fields:{ purpose:'실험', date:'11. 12.', place:'과학실 010-1234-5678' }, type:'event' }, { purpose:'', date:'11월', place:'' })` → `fields`는 `{ purpose:'실험' }`(date는 이미 있음, place는 전화번호라 버림), `type` `'event'`; 모르는 type `'x'` → `''`.
  - `confirmChips`: 예산 빈 form → 첫 칩 `budget`·warn, 단가 빈 품목 2개 → `단가 없는 품목 2개`, guessed `['purpose']` → `목적 · AI가 짐작함`, 일시·대상 빈칸 → info 칩.
  - `askNeeds({ purpose:'', items:[] })` → `['purpose','items']`, 다 있으면 `[]`.
- [ ] **Step 2:** `node --test tests/unit/purchase-oneshot.test.mjs` → FAIL(모듈 없음).
- [ ] **Step 3:** 구현. `purchase-rules.test.mjs`의 일시·대상 필수 기대값을 스펙 3.2에 맞게 고침.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** 커밋 「품의 1: 필수는 목적·품목, 한 번에 초안 답 다듬기·확인할 것 칩 규칙」.

### Task 2: 품의 화면 — 간단히·자세히 고치기·한 번에 초안

**Files:**
- Modify: `web/menus/purchase/purchase.js`, `web/menus/purchase/purchase.css`, `web/core/years.js`(GLOBAL에 `purchase:view`·`purchase:flow`·`msg:sender`)
- Test: `tests/e2e/purchase-oneshot.mjs`, 기존 품의 화면 시험이 칸 위치에 기대면 `[자세히 고치기]`를 열고 하도록 고침

**Interfaces:**
- Consumes: Task 1 전부, 지금 `runIntake`·`makeDraft`·`fillEmpty`·`composeReason`·`renderDraft`.
- Produces:
  - 화면: 넣기 칸 `#pcIntake` 아래 주 단추 `[data-pc="go"]` 「초안 만들기」(넣기 + 초안 한 번에), 지금 칸들은 `<details id="pcMore">` 「자세히 고치기」 안(열림은 `purchase:view` `'simple'|'full'`로 기억), 초안 칸 위 `#pcChips`의 `[data-chip="key"]`(누르면 `#pcMore` 열고 그 칸 `[data-k=key]`·품목으로 감).
  - `st.form.typeSet`(선생님이 종류를 누르면 참, 템플릿·최근 작성에서 연 품의도 참), `st.form.guessed: string[]`(AI가 채운 칸).
  - 초안: `oneshotPrompt`로 AI 한 번 → `normOneshot` → 빈 칸만 채우고(`guessed`), `typeSet`이 아니고 품목이 있으면 `type`으로 바꿈 → `composeReason`. 목적이 끝까지 비면(AI도 못 씀) 「무엇에 쓰는지 목적을 적어 주세요」와 목적 칸 열기.

- [ ] **Step 1: 시험** `purchase-oneshot.mjs`(가짜 AI `[품의 초안]` → `{title, intro, fields:{purpose:'과학 실험 수업', date:'2026. 11. 12.', place:'과학실'}, type:'goods'}`):
  - 처음 화면에 `#pcIntake`·`[data-pc="go"]`가 보이고 `#pcMore`는 닫힘(사업명 칸 `#pcProject`가 보이지 않음).
  - 넣기 칸 「알코올램프 10개 5000원」 → [초안 만들기] → `#pcDraftCard`에 제목·품의 사유(「가. 목적: 과학 실험 수업」, 일시·장소 줄), 산출 내역 1줄; AI 요청 1번에 넣은 글 포함; `#pcChips`에 「예산 과목 · 행정실 확인」·「목적 · AI가 짐작함」.
  - 칩 「예산 과목」을 누르면 `#pcMore` 열림·`#pcBudget`에 초점, 다시 그리면 열림이 남음(`ssam:purchase:view` = `"full"`).
  - Review Focus 1: 종류 「강사 수당」, 넣기 칸 「김철수 강사 2시간 10만원」 → [초안 만들기] → AI 요청에 `김철수`·넣은 글이 없음(강사 1명·2시간만).
  - Review Focus 3: 목적 칸에 「1학기 실험」을 쓴 뒤 초안 → 목적 그대로 「1학기 실험」, 칩에 「AI가 짐작함」 없음.
- [ ] **Step 2:** `node tests/e2e/purchase-oneshot.mjs` → FAIL.
- [ ] **Step 3:** 구현(넣기 칸 글이 있으면 `runIntake({text, keepBox:false})` 뒤 초안, 넣기 칸·품목이 다 비면 「넣기 칸에 사려는 것·견적서를 넣어 주세요」).
- [ ] **Step 4:** `node tests/e2e/purchase-oneshot.mjs` PASS, `tests/e2e/purchase*.mjs` 모두 PASS.
- [ ] **Step 5:** 커밋 「품의 2: 간단히 화면 — 넣기 칸 하나·[초안 만들기] 한 번·확인할 것 칩·자세히 고치기」.

### Task 3: 품의 「빠진 것만 물어보기」·떠 있는 버튼 견적서 바로 초안

**Files:**
- Modify: `web/menus/purchase/purchase.js`, `web/menus/settings/settings.js`(품의 기준 카드 「넣는 방식」), `web/core/settings.js`(`getPurchaseFlow()`/`setPurchaseFlow(v)`, 키 `purchase:flow`, 기본 `'oneshot'`, `getPurchaseLimit` 옆)
- Test: `tests/e2e/purchase-oneshot.mjs`(더함), `tests/e2e/inbox-*.mjs` 중 견적서 시험

**Interfaces:**
- Consumes: Task 1 `askNeeds`, Task 2 [초안 만들기].
- Produces: 설정 라디오 `[name="pcFlow"][value="oneshot"|"ask"]`; 물어보는 창 `#pcAsk`(`#pcAskPurpose` 「무엇에 쓰나요?」, `#pcAskItems` 「무엇을 얼마나 사나요? (예: 색종이 10묶음 3,000원)」 — 답은 `parseLines` 규칙으로 품목, `#pcAskOk`, 닫으면 초안 안 씀); 떠 있는 버튼 `quote`는 넣은 뒤 `ai.ready()`면 바로 초안.

- [ ] **Step 1: 시험**: 설정 › 품의 기준에서 「빠진 것만 물어보기」 → 새 품의에 「색종이 10묶음 3000원」만 넣고 [초안 만들기] → `#pcAsk`에 목적 칸만(품목 칸 없음) → 「미술 수업」 → `#pcAskOk` → 초안 목적 「미술 수업」, AI 칩 없음. 창을 닫으면 AI 요청 0번. 떠 있는 버튼으로 견적서 CSV → 카드 [실행] → 초안 칸에 제목이 생김.
- [ ] **Step 2:** FAIL → **Step 3:** 구현 → **Step 4:** PASS(`purchase-oneshot.mjs`, 견적서 떠 있는 버튼 시험) → **Step 5:** 커밋 「품의 3: 빠진 것만 물어보기 설정·떠 있는 버튼 견적서는 초안까지」.

### Task 4: 쪽지 규칙 — AI 프롬프트·답 다듬기·쪽지 글 맞추기

**Files:**
- Create: `web/menus/etc/message-ai.js`
- Test: `tests/unit/message-ai.test.mjs`

**Interfaces:**
- Produces:
  - `KINDS = { training: '연수 안내', meeting: '회의 안내', event: '행사 안내', submit: '제출 안내', etc: '안내' }`.
  - `messagePrompt(text, { nImages = 0 } = {}) → string` — 머리 `[쪽지 안내]`, 「글에 없는 것은 빈칸, 지어내지 않음, 사람 이름·전화번호를 쓰지 않음」, 출력 스펙 4.3 JSON.
  - `normMessage(v, { year }) → { kind, title, when: [{ date, time, note }], place, target, apply: { due, how }, bring, notes, points }` — kind 모르면 `etc`, 날짜는 `YYYY-MM-DD`(연도 없으면 `year`), 없는 날은 `date: ''`·글은 `note`에 남김, points 최대 5, 각 글 200자.
  - `fmtDay('2026-11-12') → '2026. 11. 12.(목)'`(틀린 날 → `''`).
  - `composeMessage(m, { len = 'base', attach = [], sender = '', again = false } = {}) → { title, body }` — 스펙 4.4 모양 그대로(□ 줄은 있는 것만, short: 일시·장소·대상·신청 / base: + 준비물·유의 사항 / long: + 주요 내용, 붙임은 `attachText` 꼴 `붙임  1. 이름 1부.\n      2. … 끝.`, 문의 줄은 sender가 있을 때만, again이면 제목 `[다시 안내]`·첫 줄 「다시 한번 안내드립니다.」).

- [ ] **Step 1: 시험** `message-ai.test.mjs`:
  - `fmtDay('2026-11-12') === '2026. 11. 12.(목)'`, `fmtDay('2026-13-40') === ''`.
  - `normMessage({ kind:'training', title:'AI 활용 수업 연수', when:[{ date:'11-12', time:'15:00~16:30' }], place:'시청각실', target:'전 교직원', apply:{ due:'2026-11-07', how:'이음 쪽지로 회신' }, points:['a','b','c','d','e','f'] }, { year: 2026 })` → `when[0].date === '2026-11-12'`, points 5개; `{ kind:'?', when:[{ date:'2026-13-40', note:'13월 40일' }] }` → kind `etc`, date `''`, note 남음.
  - `composeMessage(m, { len:'base', attach:['AI 활용 연수 계획','연수 공문'], sender:'교무부 ○○○(내선 123)' })`: 제목 `[연수 안내] AI 활용 수업 연수`; 본문에 `□ 일시: 2026. 11. 12.(목) 15:00~16:30`, `□ 장소: 시청각실`, `□ 대상: 전 교직원`, `□ 신청: 2026. 11. 7.(금)까지 이음 쪽지로 회신`, `붙임  1. AI 활용 연수 계획 1부.\n      2. 연수 공문 1부.  끝.`, `문의: 교무부 ○○○(내선 123)`; 장소가 빈 m → 「□ 장소」 줄 없음; short에는 준비물 없음, long에만 「□ 주요 내용」; again → 제목 `[다시 안내] …`·「다시 한번 안내드립니다.」; sender 빈칸 → 「문의」 줄 없음; attach 빈 배열 → 「붙임」 없음.
  - `messagePrompt('…')`가 `[쪽지 안내]`로 시작하고 `"apply"`·「지어내지」를 품음.
- [ ] **Step 2:** FAIL → **Step 3:** 구현(`attachText`는 `menus/purchase/rules.js`의 것을 씀) → **Step 4:** PASS → **Step 5:** 커밋 「쪽지 1: 안내 프롬프트·답 다듬기·쪽지 글 맞추기(짧게·기본·자세히·붙임·문의·다시 안내)」.

### Task 5: 쪽지 저장

**Files:**
- Create: `web/menus/etc/message-model.js`
- Test: `tests/unit/message-model.test.mjs`

**Interfaces:**
- Produces: `getSender() → string`, `setSender(s)`(키 `msg:sender`, GLOBAL); `getDraft()/saveDraft(d)`(키 `msg:draft`: `{ id, m, len, attach: [{ name, on }], edited: false, body: '' }`); `listMessages() → [{ id, at, title, kind, m, len, attachNames }]`(키 `msg:list`, 늦은 것 먼저), `pushMessage(x)`(같은 id는 그 자리, 20개 넘으면 오래된 것 버림); `newMessageId()`.
- [ ] **Step 1: 시험**: 21개 넣으면 20개·가장 오래된 것 없음, 같은 id 다시 넣으면 1개, `isYearKey('msg:sender') === false`·`isYearKey('msg:list') === true`(`years.js`), 붙임은 이름만 저장(파일 없음).
- [ ] **Step 2:** FAIL → **Step 3:** 구현 → **Step 4:** PASS → **Step 5:** 커밋 「쪽지 2: 보내는 사람·지금 쪽지·최근 쪽지 20개 저장」.

### Task 6: 기타 메뉴·쪽지 작성 화면

**Files:**
- Create: `web/menus/etc/message.js`, `web/menus/etc/message.css`
- Modify: `web/core/shell.js`(MENUS 설정 앞에 `{ id:'etc', label:'기타', tabs:[['message','쪽지 작성']] }`), `web/core/icons.js`(`etc` 아이콘), `web/index.html`(`<section data-menu="etc" hidden>`, css·module), `web/core/ai-roles.js`(TASKS에 `['message','쪽지']`)
- Test: `tests/e2e/message.mjs`, `tests/e2e/shell.mjs`(세로 메뉴 목록에 기타)

**Interfaces:**
- Consumes: Task 4·5, `readText`, `SSAM.files.readPages`·`pageImage`, `stripNames`, `ai.generateJSON(prompt, { task:'message', images })`, `copyText`, `toast`.
- Produces: 화면 요소 — 넣기 칸 `[data-msg-drop]`·`#msgFile`·`#msgPaste`·`[data-msg="read"]`, 상태 `#msgState`; 칸 표 `#msgFields`(`[data-mf="title|date|time|place|target|due|how|bring"]`), 길이 `[data-len="short|base|long"]`, 본문 `#msgTitle`·`#msgBody`(손으로 고치면 `edited`, `[data-msg="resync"]` 「다시 맞추기」), 단추 `[data-msg="copyTitle|copyBody|copyAll"]`, 보내는 사람 `#msgSender`, 붙임 목록 `#msgAttach`(`[data-att=i]` 체크·`[data-att-name=i]` 이름), 최근 `#msgRecent`(`[data-msg-open=id]`, `[data-msg-again=id]`); 넣은 파일은 화면 메모리 `M.files: File[]`에 둠(저장 안 함).
- 흐름: 파일·글 → 글은 `stripNames`+주민번호 줄 빼기(뺀 수 알림) → AI 한 번 → `normMessage` → `composeMessage` → 저장(`saveDraft`·`pushMessage`). AI 키가 없으면 「설정 › AI에서 키를 넣어 주세요」.
- export `putMessageFiles(files: File[], { text = '' } = {}) → Promise<void>`: 기타 › 쪽지 작성으로 가서 새 쪽지로 넣고 읽기까지(Task 8 떠 있는 버튼이 씀).

- [ ] **Step 1: 시험** `message.mjs`(가짜 AI `[쪽지 안내]` → Task 4 예시 답):
  - 세로 메뉴에 「기타」, 누르면 가로 메뉴 「쪽지 작성」.
  - 지어낸 연수 공문 txt(담당자 줄 「담당: 장학사 김민수 041-123-4567」, 명단 3줄 포함) + 「AI 활용 연수 계획.hwpx」(samples 예시 hwpx 아무것) 넣기 → AI 요청 1번, 요청에 `041-123-4567`·명단 이름 없음(Review Focus 2), 알림에 「뺐어요」 → `#msgTitle` 값 `[연수 안내] AI 활용 수업 연수`, `#msgBody`에 `□ 일시: 2026. 11. 12.(목)`·`붙임  1.`(두 파일 이름).
  - 보내는 사람 「교무부 ○○○(내선 123)」 → 본문 끝 「문의: 교무부 ○○○(내선 123)」, 다시 열어도 남음.
  - [짧게]→ 「준비물」 없음, [자세히] → 「□ 주요 내용」. 장소 칸을 「강당」으로 고치면 본문 「□ 장소: 강당」.
  - 붙임 하나 체크 해제 → 붙임 1개, 「끝.」.
  - [모두 복사] → 클립보드 글에 제목·본문(`page.evaluate(() => navigator.clipboard.readText())`, 권한 허용).
  - 최근 쪽지에 1개 → [다시 안내] → 제목 `[다시 안내] AI 활용 수업 연수`.
- [ ] **Step 2:** FAIL → **Step 3:** 구현 → **Step 4:** `message.mjs`·`shell.mjs` PASS → **Step 5:** 커밋 「쪽지 3: 기타 › 쪽지 작성 — 공문·계획 넣기(명단·전화번호 줄 빼고 AI), 칸 표·짧게·기본·자세히·보내는 사람·붙임 목록·복사·최근 쪽지·다시 안내」.

### Task 7: 붙임 파일 복사·폴더 열기 (Windows 앱)

**Files:**
- Modify: `src-tauri/src/files.rs`(명령 2개 + 시험), `src-tauri/src/main.rs`(generate_handler), `web/menus/etc/message.js`(단추·웹판 안내)
- Test: `cargo test --manifest-path src-tauri/Cargo.toml`(files 시험), `tests/e2e/message.mjs`(더함)

**Interfaces:**
- Produces (Rust):
  - `#[tauri::command] note_save_attachments(folder: String, files: Vec<NoteFile>) -> Result<NoteSaved, String>`, `NoteFile { name: String, bytes: Vec<u8> }`, `NoteSaved { dir: String, paths: Vec<String> }` — `downloads_dir()/쌤비서 쪽지 붙임/safe_name(folder)/`에 `unique_path`로 씀(같은 이름 `이름 (2).확장자`).
  - `#[tauri::command] note_copy_files(paths: Vec<String>) -> Result<(), String>` — `arboard::Clipboard::new()?.set().file_list(&paths)`.
  - `#[tauri::command] note_open_dir(app, dir: String) -> Result<(), String>` — `app.opener().open_path(dir, None::<&str>)`.
  - 순수 함수 `note_dir(base: &Path, folder: &str) -> PathBuf`(시험용).
- Produces (화면): `#msgFiles` 줄에 `[data-msg="copyFiles"]` 「붙임 파일 복사」·`[data-msg="openDir"]` 「폴더 열기」(Windows 앱에서만, `window.__TAURI__` 있을 때). 폴더 이름 `<YYYY-MM-DD> <제목 머리 뺀 제목>`. 웹판은 「Windows 앱에서는 붙임 파일 복사·폴더 열기가 돼요」. 복사 뒤 안내 「이음 쪽지 창의 첨부 칸에서 Ctrl+V 해 보세요. 안 되면 [폴더 열기]로 끌어 놓으세요」.
- [ ] **Step 1: 시험**: Rust `note_dirs` — `note_dir(base, "2026-11-12 AI: 연수?")`가 `base/쌤비서 쪽지 붙임/2026-11-12 AI_ 연수_`; 같은 이름 두 번 저장하면 `(2)`. e2e: 웹판(타우리 없음)이면 `copyFiles` 단추 없음·안내 글; `window.__TAURI__.core.invoke`를 시험에서 가짜로 두면 [붙임 파일 복사] → `note_save_attachments`(체크한 파일 2개, 폴더 이름 `2026-11-02 AI 활용 수업 연수` 꼴) 다음 `note_copy_files`(돌려준 경로) 순서로 부름, [폴더 열기] → `note_open_dir`.
- [ ] **Step 2:** FAIL → **Step 3:** 구현 → **Step 4:** `cargo test --manifest-path src-tauri/Cargo.toml files`, `cargo check --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc --tests`, `node tests/e2e/message.mjs` PASS → **Step 5:** 커밋 「쪽지 4: 붙임 파일을 다운로드 폴더에 모아 클립보드 파일 복사·폴더 열기(Windows 앱)」.

### Task 8: 떠 있는 버튼 「연수·행사 안내」·예시·문서·전체 시험

**Files:**
- Modify: `web/core/inbox-classify.js`(KINDS `['notice','연수·행사 안내','쪽지로 안내하기']`를 `guide` 앞, classify), `web/menus/etc/message.js`(`registerInbox('notice')` → 기타 › 쪽지 작성에 파일 넣고 바로 쪽지), `scripts/make-samples.mjs`, `README.md`, `docs/PRD.md`(품의 P-17·P-18, 기타 M-1~M-4), `.github/RELEASE_NOTES.md`(0.12.0 항목은 「0.12.0에서 바뀐 점」으로 옮기고 whats-new에 이번 것)
- Create: `samples/연수안내-공문-예시.hwpx`(지어낸 연수 공문: 수신·발신, 일시·장소·대상·신청, 붙임)
- Test: `tests/unit/inbox-classify.test.mjs`(더함), `tests/e2e/inbox-message.mjs`

**Interfaces:**
- Consumes: Task 6 화면(넣기 함수 `putMessageFiles(files)`를 message.js에서 export).
- [ ] **Step 1: 시험**: classify — 지어낸 연수 안내 공문(「수신 각급학교장」「AI 활용 수업 연수 안내」「일시」「장소」「대상」「신청」) → `notice`; Review Focus 4: 「2027학년도 독서교육 운영 계획 / 목적 / 방침 / 세부 추진 계획 / 연수」 → `year-plan`, 「교육과정 운영 지침 안내」(수신·발신, 일시 없음) → `guide`; 기존 시험 모두 그대로. e2e `inbox-message.mjs`: samples 연수 안내 hwpx를 떠 있는 버튼에 → 카드 「연수·행사 안내」 → [실행] → 기타 › 쪽지 작성에 쪽지 제목·붙임 1개(그 파일).
- [ ] **Step 2:** FAIL → **Step 3:** 구현·예시 파일(`sampleNoticeDoc()`을 `message-ai.js`가 아니라 `web/menus/etc/message-sample.js`에)·문서 → **Step 4:** `npm test`, `npm run e2e`, `cargo check --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc --tests` PASS → **Step 5:** 커밋 「쪽지 5: 떠 있는 버튼 연수·행사 안내 → 쪽지, 예시 공문, 문서」.
