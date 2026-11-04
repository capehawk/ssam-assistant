# 활동지 평가 · 한꺼번에 넣기 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 평가 › 활동지 탭(넣기 → 기준 확인 → 학생 활동지 → 채점·확인 → 결과·확정)과, 활동지·단원평가·평가지 채점의 「한꺼번에 넣기」(학생용·교사용·스캔을 알아서 나눔), 단원평가·활동지를 평가 영역에 이어 평가지 채점 평어에서 체크해 참고하는 것을 만든다.

**Architecture:** 나누기는 공통 부품 `web/core/bundle.js`(순수 규칙 + 파일 읽기·확인 카드). 활동지는 새 모듈 `web/menus/evaluate/activity/`(모델·머리 읽기·AI·화면), 스캔·이름 가림·번호 맞추기는 단원평가와 같은 부품(`SSAM.files.readPages`·`arrangePages`·`SSAM.openMaskEditor`·`core/student-no.js`). 평가 영역 이음은 `core/eval-link.js`(평가계획 영역 고르기)와 `core/eval-refs.js`(이어 둔 단원평가·활동지를 평가지 채점에 줌, `window.SSAM.evalRefs`).

**Tech Stack:** 정적 ES 모듈, 기존 `evaluate.js`(window.SSAM), node:test, Playwright e2e(`tests/e2e/*.mjs`, helpers open/run/assert), 가짜 Claude는 `page.route('https://api.anthropic.com/**')`.

**Spec:** `docs/superpowers/specs/2026-11-02-activity-grading-design.md`

## Global Constraints

- 화면 글·문서·프롬프트는 한국어. 학생 이름은 저장·전송하지 않음(이름 칸 가림, 기록·쪽지·표·프롬프트는 번호만).
- 선생님이 올린 실제 파일은 레포·시험에 넣지 않음. 시험 자료·예시는 같은 모양으로 지어냄.
- 문항 표시 4가지: `o` ○(잘함) · `t` △(조금 더) · `x` ×(틀림) · `n` 안 함(빈칸). 수준 3가지: `good` 잘함 · `ok` 보통 · `try` 노력(AI 판단, 선생님이 바꿈).
- 문항 종류: `choice` 고르기 · `match` 짝짓기 · `short` 빈칸·단답 · `write` 쓰기 · `draw` 그림·색칠.
- AI는 업무별 AI 「채점」(`task: 'grade'`), 검토는 그 검토 AI(`reviewJSON('grade', …)`).
- 한꺼번에 넣기: 나눈 결과는 확인 카드에서 [이대로 넣기]를 눌러야 넣음. 스캔은 글자층 → 없으면 앞 2쪽·뒤 2쪽만 AI.
- 「교과 평어에 참고하기」 기본 꺼짐. 평가지 채점의 참고 체크 기본 안 함. 목록은 최근 5개 + [더보기].
- 저장 키(학년도 자료): `activity:list`, `activity:a:<id>`, `activity:set`. 스캔 그림은 저장하지 않음.
- 개인정보 줄(주민번호·전화)은 `core/privacy.js`로 빼고 알림.

## Review Focus

1. 한꺼번에 넣기에 학생 스캔만 넣음(나눌 것이 없음) → 확인 카드 없이 바로 그 자리에 들어감.
2. 기준을 확정하고 채점한 뒤 기준을 고침 → 채점한 학생에 「기준이 바뀌었어요 · 다시 채점」, 결과는 지우지 않음.
3. 학생 수가 다른 스캔을 다시 올림(채점한 학생이 있음) → 「새로 나누면 채점한 결과가 지워져요」 확인 뒤에만.
4. 이어 둔 평가 영역이 평가계획에서 바뀜(id가 달라짐) → 교과·label이 같으면 이어짐, 없으면 평가지 채점 목록에 안 나오고 활동지·단원평가 쪽에 「이어 둔 영역을 찾지 못했어요」.
5. AI 채점 답에 기준에 없는 문항 번호·모양 틀린 칸이 옴 → 버리고, 빠진 문항은 노란 칸(읽지 못함).

---

### Task 1: 나누기 규칙 (`core/bundle.js` 순수 부분)

**Files:**
- Create: `web/core/bundle.js`
- Modify: `web/menus/evaluate/unit/unit-key.js` (`splitCombined`)
- Test: `tests/unit/bundle.test.mjs`, `tests/unit/unit-key.test.mjs`(더함)

**Interfaces:**
- Produces: `splitDoc(text: string) → { student: string, teacher: string, how: 'marker'|'repeat'|'none' }`; `edgeIdx(n: number) → number[]`(앞 2·뒤 2, 겹침 없이 차례대로); `pageRolesPrompt(k: number) → string`(머리 `[쪽 나누기]`); `normPageRoles(v, k) → ('teacher'|'blank'|'student')[]`(길이 k, 모르면 'student'); `pickRoles(pages: {text?: string}[], ai?: {[idx]: role}) → role[]`(글자층 30자 이상 'teacher', 아니면 ai, 아니면 'student'); `needsCard({ doc, roles }) → boolean`(teacher 글이 있거나 roles에 student 아닌 것이 있으면 true); `ROLE_NAME = { teacher: '정답·교사용', blank: '빈 활동지', student: '학생' }`.
- `splitCombined(text)`: 지금 「정답」 줄 규칙이 못 찾으면 `splitDoc` → teacher가 있으면 `{ paper: student, key: teacher }`.

- [ ] **Step 1: 시험** — `bundle.test.mjs`(지어낸 글, 실제 파일과 같은 모양):
  - 국어 모양(머리 「국어 |  | 1. 경험을 나눠요 | 국어책 10~12쪽」 → 학생 칸 → 같은 머리 다시 → 「학년 반 번 이름: 교사용」 → 채운 답): `how==='marker'`, `student`에 「교사용」 없음, `teacher`가 같은 머리 줄로 시작.
  - 사회 모양(머리 → 빈 칸 → 같은 머리 → 「(예시)」 → 채운 답): marker, teacher가 머리 줄로 시작.
  - 수학 모양(문항들 → 「[정답]」 → 「1. 6/5」…): marker, teacher가 「[정답]」으로 시작.
  - 과학·도덕 모양(표시 없음, 머리 한 번): `how==='none'`, teacher `''`, student = 원문 trim.
  - 표시 없이 같은 머리가 두 번: `how==='repeat'`, teacher = 두 번째 머리부터.
  - `edgeIdx(1)`→`[0]`, `edgeIdx(3)`→`[0,1,2]`, `edgeIdx(10)`→`[0,1,8,9]`.
  - `normPageRoles({ pages: [{ i: 0, role: 'teacher' }, { i: 3, role: 'zzz' }, { i: 9, role: 'blank' }] }, 4)` → `['teacher','student','student','student']`(범위 밖 버림).
  - `pickRoles([{ text: '[정답] 1. ③ 2. ① …(30자 넘게)' }, {}, {}], { 2: 'blank' })` → `['teacher','student','blank']`.
  - `needsCard`: 학생 스캔만·teacher 글 없음 → false(Review Focus 1).
  - `unit-key.test.mjs`: 「교사용」으로 붙은 문제지+정답 글 → `splitCombined`가 `{ paper, key }`로 나눔, 기존 「정답 및 해설」 시험은 그대로 통과.
- [ ] **Step 2:** `node --test tests/unit/bundle.test.mjs tests/unit/unit-key.test.mjs` → FAIL(bundle.js 없음).
- [ ] **Step 3:** 구현. 표시 줄: `/^\s*(\|\s*)?(교사용|\(예시\)|예시\s*답안|모범\s*답안|\[정답\]|정답(\s*및\s*해설지?)?|채점\s*기준)\s*(\||$)/` 또는 「이름」이 든 줄 끝 「교사용」. 표시 줄 앞 8줄 안에 문서 첫 머리 줄(빈 줄 아닌 첫 줄, 6자 이상)과 같은 줄이 있으면 그 줄에서 나눔.
- [ ] **Step 4:** 같은 명령 PASS, `npm test` 전체 PASS.
- [ ] **Step 5:** 커밋 「활동지 1: 한꺼번에 넣기 나누기 규칙」.

### Task 2: 파일 읽기·확인 카드 (`core/bundle.js` 화면 부분)

**Files:**
- Modify: `web/core/bundle.js`, `web/menus/evaluate/evaluate.js`(`readPdfPages`: 쪽마다 `text` = 글자층 글 2000자까지)
- Create: `web/core/bundle.css`(index.html에 link)
- Test: `tests/e2e/bundle.mjs`

**Interfaces:**
- Consumes: Task 1 전부, `core/files.js` `readText(file)`, `SSAM.files.readPages(files, say)`, `core/ai.js`.
- Produces: `readBundle(files: File[], { say?, mask? }) → Promise<{ doc: { student, teacher, how, names: string[] }, pages: Page[], roles: role[], skipped: string[] }>` — 한글·txt는 글, PDF·사진은 쪽(글자층 있는 쪽 글은 doc에도 이어 붙임); 모든 쪽에 글자층이 없고 3쪽 이상이며 AI가 되면 `edgeIdx` 쪽의 `page.thumb`를 AI(`task:'grade'`)에 한 번 → `pickRoles`. AI 실패는 모두 'student'.
- Produces: `openBundleCard(b, { what: string }) → Promise<b | null>` — 시트 `#bundleCard`: 요약 줄 `#bundleSum`(예 「학생용 · 교사용으로 나눴어요 · 정답·교사용 1쪽 · 학생 4쪽」), 문서 [나누지 않기] `#bundleNoSplit`(teacher를 student 뒤에 붙이고 teacher ''), 쪽 띠 `[data-bundle-page=i]`(누르면 student → teacher → blank → student), [이대로 넣기] `#bundleOk`, [취소] → null.
- Produces: `bundleBoxHTML(id: string, note: string) → string` — 「한꺼번에 넣기」 칸(`[data-bundle-drop=id]`, 파일 고르기 `[data-bundle-pick=id]`, 숨은 input `#bundleFile-<id>` multiple).

- [ ] **Step 1: 시험** `bundle.mjs`(시험 쪽에서 `page.evaluate`로 모듈 import): (a) 국어 모양 .txt 하나 + PNG 4장, 가짜 AI가 `[쪽 나누기]`에 `{"pages":[{"i":0,"role":"teacher"}]}` → `readBundle`의 doc.how 'marker', roles[0] 'teacher'; (b) 카드: `#bundleSum`에 「정답·교사용 1쪽」, 1쪽 눌러 'blank'로, [이대로 넣기] → 돌려받은 roles[0]==='blank'; (c) PNG 2장만(나눌 것 없음) → AI 요청 없음, `needsCard` false; (d) [나누지 않기] → teacher ''; (e) 페이지 오류 없음.
- [ ] **Step 2:** `node tests/e2e/bundle.mjs` → FAIL.
- [ ] **Step 3:** 구현.
- [ ] **Step 4:** PASS, `npm test` PASS, `node tests/e2e/unit-*.mjs`·`gr-*.mjs` 중 `readPdfPages`를 쓰는 시험 PASS.
- [ ] **Step 5:** 커밋 「활동지 2: 한꺼번에 넣기 파일 읽기·확인 카드」.

### Task 3: 활동지 모델·머리 읽기·학기

**Files:**
- Create: `web/menus/evaluate/activity/activity-model.js`, `web/menus/evaluate/activity/activity-read.js`
- Test: `tests/unit/activity-model.test.mjs`, `tests/unit/activity-read.test.mjs`

**Interfaces:**
- Produces (read): `readMeta(text) → { subject, unit, lesson, pages, title }`(모르면 ''); `SUBJECTS`(국어·수학·사회·과학·도덕·영어·음악·미술·체육·실과·바른 생활·슬기로운 생활·즐거운 생활); `termOf(date: 'YYYY-MM-DD', breaks: {label, from, to}[]) → 1|2`.
- Produces (model): `newActivity(meta?) → act`(`{ id, meta: { subject, unit, lesson, pages, title, date, term }, sheet: { student, teacher }, items: [], confirmed: false, students: [], done: false, link: null, createdAt }`); `listActivities() → [{ id, title, subject, date, term, n, done }]`(날짜 늦은 것 먼저); `getActivity(id)`; `saveActivity(act) → boolean`; `removeActivity(id)`; `getSet()/saveSet(s)`(`{ pagesPer: 1, maskOn: true, mask: [], maskAll: false }`); `records(no, { subject?, term? }) → [{ id, date, subject, title, level, good, next }]`(done이고 skip 아님, 날짜 차례); `markCounts(act) → { [itemNo]: { o, t, x, n } }`; `linkedTo({ unitId, subject, label }) → [{ kind: 'activity', id, title, date }]`(unitId 같음, 없으면 subject·label 같음).

- [ ] **Step 1: 시험**:
  - `readMeta('[과학] 3-2-4-03 물은 어디로 갈까? (50~51쪽)\n물의 여행 그리기')` → `{ subject:'과학', unit:'4', lesson:'3', pages:'50~51쪽', title:'물은 어디로 갈까?' }`.
  - `readMeta('국어 |  | 2. 마음을 전해요 | 국어책 40~43쪽\n | [3차시] 편지 쓰기')` → `{ subject:'국어', unit:'2. 마음을 전해요', lesson:'3', pages:'40~43쪽', title:'편지 쓰기' }`.
  - `readMeta('3. 함께 사는 세상 > [4차시]서로 돕기(교과서 60-63쪽)\n친구 돕기 계획\n도덕')` → `{ subject:'도덕', unit:'3. 함께 사는 세상', lesson:'4', pages:'60-63쪽', title:'서로 돕기' }`.
  - `readMeta('아무 글')` → 모두 ''.
  - `termOf('2026-07-10', [])`=1, `termOf('2026-09-01', [])`=2, `termOf('2027-02-10', [])`=2, `termOf('2026-08-20', [{ label:'여름방학', from:'2026-07-25', to:'2026-08-16' }])`=2, `termOf('2026-08-10', 같은 것)`=1.
  - model: 저장·목록·지우기, 망가진 저장값은 버림, `records(3, { subject:'과학', term:2 })`가 done·과학·2학기만, skip 학생 뺌, `markCounts`, `linkedTo`(unitId 다르고 subject·label 같으면 찾음, 둘 다 다르면 없음).
- [ ] **Step 2:** FAIL 확인 → **Step 3:** 구현(`core/store.js` get/set, `isYearKey`로 학년도 자료) → **Step 4:** PASS → **Step 5:** 커밋 「활동지 3: 모델·머리 읽기·학기」.

### Task 4: 활동지 AI 프롬프트·답 다듬기·앱 판정

**Files:**
- Create: `web/menus/evaluate/activity/activity-ai.js`
- Test: `tests/unit/activity-ai.test.mjs`

**Interfaces:**
- Consumes: `unit-grade.js` `autoJudge`, `unit-key.js` `parseKey`.
- Produces: `TYPES = [['choice','고르기'],['match','짝짓기'],['short','빈칸·단답'],['write','쓰기'],['draw','그림·색칠']]`; `MARK = { o:'○', t:'△', x:'×', n:'안 함' }`; `LEVEL = { good:'잘함', ok:'보통', try:'노력' }`.
- `criteriaPrompt({ meta, student, teacher, nImages }) → string`(머리 `[활동지 기준]`, 학생용 글·교사용 글·그림 수, 출력 `{"items":[{"no":1,"type":"write","ask":"…","answer":"예시 답안","ok":"○ 기준","part":"△ 기준","src":"teacher|ai"}]}`).
- `normCriteria(v) → item[]`(`{ no, type, ask, answer, ok, part, src }`, 번호 1부터 겹침 없이, 모르는 type은 'write', src는 'teacher'|'ai').
- `applyKey(items, teacherText) → item[]`: `parseKey(teacherText)`의 번호별 정답이 있으면 choice·match·short의 answer를 바꾸고 src 'answer'.
- `gradePrompt(act, nImages) → string`(머리 `[활동지 채점]`, 문항마다 번호·종류·묻는 말·정답/예시·○·△ 기준, 그림은 「요구한 것·자세함·정성」, 이름 쓰지 않기, 출력 `{"items":[{"no":1,"read":"…","mark":"o|t|x|n","why":"…","sure":true}],"good":"…","next":"…","level":"good|ok|try","levelWhy":"…"}`).
- `validGrade(v) → boolean`; `normGrade(v, items) → { marks: { [no]: { read, mark, why, sure } }, good, next, level, levelWhy }`(기준에 없는 번호·모르는 mark 버림, 빠진 문항은 `{ read:'', mark:'', why:'읽지 못했어요', sure:false }`).
- `judgeCell(item, cell) → cell & { chk: boolean }`: choice·match·short에 answer가 있으면 read가 비면 'n', `autoJudge({ type, answer, points: 1 }, read)` 1→'o', 0→'x', null이면 AI mark; `chk` = !sure || 앱 판정 ≠ AI mark || mark 없음.
- `reviewPrompt(act, no, cells) → string`(머리 `[활동지 검토]`, 노란 칸만) / `normReview(v, nos) → [{ no, mark, why }]`.

- [ ] **Step 1: 시험**: 프롬프트 머리·학생 이름 없음·교사용 글 포함; `normCriteria`(모르는 type → write, 번호 겹침 버림); `applyKey`(「[정답]\n1. ③\n2. ①」 → choice 문항 answer '③' src 'answer'); `normGrade`(번호 9 없는 문항 버림, mark 'q' 버림, 빠진 문항 노란 칸 — Review Focus 5); `judgeCell`(고르기 맞음 ○, 틀림 ×, 빈 답 안 함, 쓰기는 AI mark 그대로, AI는 ○인데 앱 × → chk); `normReview`.
- [ ] **Step 2:** FAIL → **Step 3:** 구현 → **Step 4:** PASS → **Step 5:** 커밋 「활동지 4: AI 프롬프트·답 다듬기·판정」.

### Task 5: 활동지 탭 · 1·2단계 화면

**Files:**
- Create: `web/menus/evaluate/activity/activity.js`(탭·목록·단계·1단계·2단계), `web/menus/evaluate/activity/activity.css`, `web/menus/evaluate/activity/activity-sample.js`(예시)
- Modify: `web/core/shell.js`(평가 탭에 `['activity', '활동지']`, 단원평가 다음), `web/index.html`(script·css)
- Test: `tests/e2e/activity.mjs`

**Interfaces:**
- Consumes: Task 2 `readBundle`·`openBundleCard`·`bundleBoxHTML`·`needsCard`, Task 3·4 전부, `core/privacy.js`.
- Produces: `A = { view: 'list'|'act', id, step }`, `openActivity(id, step)`, `render()`, `registerStep(n, view)`(3~5단계는 Task 6·7이 붙임), `curAct()`, `commitAct(act)`.
- 1단계: `bundleBoxHTML('act', …)` → readBundle → (needsCard면 카드) → `sheet.student/teacher`·meta(`readMeta`, 날짜 오늘, `termOf(date, getSchool().breaks)`)·교사용·빈 쪽 그림은 화면에만(`A.critPages`); meta 칸 `#actSubject`(select SUBJECTS)·`#actUnit`·`#actLesson`·`#actTitle`·`#actDate`·`#actTerm`.
- 2단계: [AI로 기준 만들기] `[data-act="criteria"]`(들어올 때 items가 없으면 저절로) → `criteriaPrompt`+`applyKey` → 표 `#actItems`(행마다 `[data-it=no][data-f=type|ask|answer|ok|part]`, 출처 칩), [+ 문항] `[data-act="addItem"]`, [기준 확정] `[data-act="confirm"]` → `confirmed=true`. 확정 뒤 고치면 `confirmed=false`, 채점한 학생 `stale=true`(Review Focus 2).

- [ ] **Step 1: 시험** `activity.mjs`: 탭에 「활동지」; [새 활동지] → .txt(사회 모양 지어낸 글: 학생용 + 「(예시)」 교사용) 넣기 → 카드 → [이대로 넣기] → `#actSubject` '사회'·제목 채움; 2단계 들어가면 `[활동지 기준]` 요청 1번(교사용 글 포함, 이름 없음) → 표 2문항·출처 「교사용에서」; 칸 고치기 → [기준 확정]; 예시 답안 없는 활동지(과학 모양, 그림 문항)는 기준 요청에 교사용 글 없음·draw 문항; [예시로 채우기] → 5단계까지 채워진 예시; 개인정보 줄 빼고 알림; 페이지 오류 없음.
- [ ] **Step 2:** FAIL → **Step 3:** 구현 → **Step 4:** PASS, `npm test`·`node tests/e2e/shell.mjs`·`unit*.mjs` PASS → **Step 5:** 커밋 「활동지 5: 탭·1·2단계(넣기·기준 확인)」.

### Task 6: 3·4단계 — 학생 활동지 올리기·채점·확인

**Files:**
- Create: `web/menus/evaluate/activity/activity-grading.js`
- Test: `tests/e2e/activity-grading.mjs`

**Interfaces:**
- Consumes: Task 5 `registerStep`·`curAct`·`commitAct`, `readBundle`/`openBundleCard`, `unit-pages.js` `arrangePages`, `SSAM.files.pageImage`·`freePages`, `SSAM.openMaskEditor`, `core/student-no.js` `readNos`·`openNoCheck`·`openNoWait`·`byNoOrder`·`rosterAllowed`, Task 4 `gradePrompt`·`validGrade`·`normGrade`·`judgeCell`·`reviewPrompt`·`normReview`, `ai-roles` `pick`, `ai-review` `reviewJSON`·`opinionHTML`·`REVIEW_FAIL`.
- Produces: 학생 `{ no, skip, status: 'idle'|'busy'|'done'|'error', marks: { [no]: cell }, good, next, level, levelWhy, levelManual?, stale?, err? }`.
- 3단계: 한꺼번에 넣기 칸(스캔 + 교사용 쪽 섞임 → 카드, 학생 쪽만 학생으로), 학생당 쪽 수 `#actPer`, 이름 칸 [이름 칸 정하기] `[data-act="mask"]`, 적힌 번호 `#actByNo`·[번호 칸 정하기]. 학생 수가 다르고 채점한 학생이 있으면 확인(Review Focus 3). 단원평가 `loadAnswers`·`openMask`·`askNos`와 같은 흐름.
- 4단계: [채점 시작] `[data-act="grade"]`(2명씩, 키·한도 오류면 멈춤), 표 `#actGrid`(번호 × 문항 칸 `[data-cell="no|itemNo"]`, 노란 칸 `.chk`, 수준 select `[data-level=no]`, 잘한 점·더 해 볼 점), 칸 누르면 시트(○·△·×·안 함, 읽은 답) `#actCellSheet` → `manual: true`, chk 해제. 검토를 켰으면 노란 칸만 `reviewPrompt` → 두 의견.

- [ ] **Step 1: 시험** `activity-grading.mjs`: PNG 5장(가짜 AI `[쪽 나누기]` → 0쪽 teacher) 넣기 → 카드 「정답·교사용 1쪽」 → [이대로 넣기] → 학생 4명; [채점 시작] → `[활동지 채점]` 4번(그림 1장씩, 이름 없음) → 고르기 맞음 ○·틀림 ×·빈칸 안 함, AI ○·앱 × 칸 노란색; 칸 눌러 △로 → 노란색 사라짐·저장; 수준 바꾸기; 기준 고치면 「다시 채점」 표시(Review Focus 2); 학생 수 다른 스캔 → 확인 시트(Review Focus 3); 검토 켬 → `[활동지 검토]` 노란 칸만; 401이면 멈추고 알림; 페이지 오류 없음(401 빼고).
- [ ] **Step 2:** FAIL → **Step 3:** 구현 → **Step 4:** PASS → **Step 5:** 커밋 「활동지 6: 학생 활동지 올리기·채점·확인」.

### Task 7: 5단계 결과·확정·학생별 모아 보기·평가 영역 이음

**Files:**
- Create: `web/menus/evaluate/activity/activity-results.js`, `web/core/eval-link.js`
- Modify: `web/menus/evaluate/evaluate.js`(`window.SSAM.planUnits = () => allUnits().map(u => ({ id: u.id, subject: u.subject, label: [u.area, u.elem || u.unit].filter(Boolean).join(' · ') }))`)
- Test: `tests/e2e/activity-results.mjs`, `tests/unit/eval-link.test.mjs`

**Interfaces:**
- Consumes: Task 3 `records`·`markCounts`, Task 4 `MARK`·`LEVEL`, `core/doc-export.js` `exportButton`·`exportDoc`.
- Produces (`eval-link.js`): `planUnits() → [{ id, subject, label }]`; `findUnit(link) → unit | null`(id 같음 → 아니면 subject·label 같음); `linkHTML(link, subject, attr) → string`(스위치 `[${attr}="link"]` 기본 꺼짐, 켜졌으면 「과학 · 영역 이름」·[바꾸기], 찾지 못하면 「이어 둔 영역을 찾지 못했어요」 — Review Focus 4); `openLinkSheet({ subject, link, save(link|null) })`(교과 select `#elSubject` — 자동은 그 활동지·단원평가 교과, 영역 select `#elUnit`, 평가계획 없으면 「평가 › 교과 평어에서 평가계획을 먼저 넣어 주세요」).
- 5단계: 반 표 `#actTable`(번호 × 문항 표시·수준·잘한 점) 내려받기 `[data-act="exportTable"]`·[표 복사]; 피드백 쪽지 `[data-act="exportSlips"]`(한 쪽에 4명); 문항별 통계 `#actStats`(× 많은 문항 먼저); [확정] `[data-act="done"]`; 「교과 평어에 참고하기」(`linkHTML(act.link, act.meta.subject, 'data-act')`).
- 목록 [학생별 모아 보기] `[data-act="records"]` → 번호 `#recNo`·교과 `#recSubject`·학기 `#recTerm` → `records()` 표, [복사].

- [ ] **Step 1: 시험**: `eval-link.test.mjs`(findUnit id·label, planUnits 없음 → []); `activity-results.mjs`(예시 활동지로: 표·쪽지 .docx 본문에 번호·○·잘한 점, 이름 없음; 통계 차례; [확정] → 모아 보기에 그 활동지, 교과·학기 거름; 스위치 기본 꺼짐 → 켜면 시트 → 평가계획(시험에서 `ssam:plan:*` 지어 넣음) 영역 고르기 → `act.link` 저장; 평가계획의 영역 id를 바꿔도 label로 이어짐, label도 바꾸면 「찾지 못했어요」).
- [ ] **Step 2:** FAIL → **Step 3:** 구현 → **Step 4:** PASS → **Step 5:** 커밋 「활동지 7: 결과·확정·학생별 모아 보기·평가 영역 이음」.

### Task 8: 단원평가에 한꺼번에 넣기·평가 영역 이음

**Files:**
- Modify: `web/menus/evaluate/unit/unit.js`(1단계에 `bundleBoxHTML('unit', …)`: teacher → 정답지 글, student → 문제지 글, 학생 쪽 → 2단계로 넘김), `web/menus/evaluate/unit/unit-grading.js`(`loadAnswerPages(pages: Page[]) → Promise<boolean>`: `loadAnswers`의 쪽 단계부터 같은 흐름), `web/menus/evaluate/unit/unit-results.js`(결과에 `linkHTML(test.link, test.meta.subject, 'data-un')` → `test.link`)
- Test: `tests/e2e/unit-bundle.mjs`

**Interfaces:**
- Consumes: Task 2, Task 7 `linkHTML`·`openLinkSheet`, 지금 `loadKey`·`loadPaper`가 쓰는 글 읽기(정답지 글 → `parseKey`, 문제지 글 → `parsePaper`).
- Produces: 단원평가 본문 `link: { unitId, subject, label } | null`; `unitLinkedTo(link) → [{ kind: 'unit', id, title, date }]`(`unit-model.js`).

- [ ] **Step 1: 시험** `unit-bundle.mjs`: 1단계 한꺼번에 넣기에 「문제지 + [정답]」 .txt 하나 + 답안 PNG 3장 → 카드 → 정답 문항 수·문제지 채움 → 2단계에 학생 3명 그대로; 학생 스캔만 넣으면 카드 없이 2단계(Review Focus 1); 결과 화면 이음 스위치 기본 꺼짐 → 켜고 영역 고름 → 저장; 기존 `unit*.mjs` 그대로 통과.
- [ ] **Step 2:** FAIL → **Step 3:** 구현 → **Step 4:** PASS → **Step 5:** 커밋 「활동지 8: 단원평가 한꺼번에 넣기·평가 영역 이음」.

### Task 9: 평가지 채점에 한꺼번에 넣기·참고 체크·평어 프롬프트

**Files:**
- Create: `web/core/eval-refs.js`(`window.SSAM.evalRefs = { linked, lines }`)
- Modify: `web/menus/evaluate/evaluate.js`(GR 1단계 한꺼번에 넣기 칸, 참고 칸, `GRStore.body`에 `refs`, 평어 프롬프트 `[참고: 단원평가·활동지]`), `web/index.html`
- Test: `tests/unit/eval-refs.test.mjs`, `tests/e2e/gr-refs.mjs`

**Interfaces:**
- Consumes: Task 3 `linkedTo`·`getActivity`, Task 8 `unitLinkedTo`·`getTest`, Task 7 `findUnit`.
- Produces: `linked(unit: { id, subject, label }) → [{ kind, id, title, date }]`(날짜 늦은 것 먼저); `lines(refs: {kind,id}[], no: number) → string`(활동지: 「활동지 「제목」 잘함 · 잘한 점: … · 더 해 볼 점: …」, 단원평가: 「단원평가 「제목」 85% · 잘한 것: … · 보완할 것: …」, 한 학생 600자까지, 없으면 '').
- GR: 평가요소를 고르면 「참고할 단원평가·활동지」 `#grRefs`(체크 `[data-gr-ref="kind:id"]` 기본 안 함, 5개 넘으면 [더보기] `[data-gr-ref-more]`), 체크는 `GR.refs`에 저장. 평어 프롬프트 `who(s)` 줄 뒤에 `lines(GR.refs, s.no)`가 있으면 `  참고: …`. 한꺼번에 넣기: teacher 글 → `critDocs` 하나(이름 「한꺼번에 넣은 정답·기준」), teacher·blank 쪽 → `critImgs`, 학생 쪽 → `GR.pages`.

- [ ] **Step 1: 시험**: `eval-refs.test.mjs`(linked 차례·kind, lines 활동지·단원평가·600자·이름 없음); `gr-refs.mjs`(평가계획·활동지(link)·단원평가(link) 지어 넣기 → 평가지 채점에서 그 평가요소 → 목록 2개, 기본 체크 안 함 → 평어 쓰기 요청에 「참고:」 없음 → 활동지 체크 → 다시 쓰기 요청에 「참고: 활동지 「…」」·번호만; 한꺼번에 넣기(정답 .txt + PNG 3장) → 채점 기준 문서 1개·학생 3명).
- [ ] **Step 2:** FAIL → **Step 3:** 구현 → **Step 4:** PASS, `gr-*.mjs`·`review-gr.mjs` PASS → **Step 5:** 커밋 「활동지 9: 평가지 채점 한꺼번에 넣기·참고 체크」.

### Task 10: 떠 있는 버튼·예시 파일·문서·전체 시험

**Files:**
- Modify: `web/core/inbox-classify.js`(KINDS에 `['activity', '수업 활동지', '활동지 평가로 넣기']`, `classify`: 「[N차시]」·「활동」·「교과서 N쪽」·「학년 반 번 이름」 중 둘 이상, 정답 표(번호-정답 줄 3개 이상) 없음 → 'activity'), `web/menus/evaluate/activity/activity.js`(`registerInbox('activity', …)` → 새 활동지 1단계로), `web/menus/evaluate/unit/unit-grading.js`(`unit-scan` 받는 곳에 「활동지 채점」(채점할 활동지 고르기)), `README.md`, `docs/PRD.md`(평가 › 활동지 E-…, 한꺼번에 넣기), `.github/RELEASE_NOTES.md`(whats-new)
- Create: `samples/활동지-예시.hwpx`(지어낸 학생용 + 교사용, `core/hwpx.js`로 만든 것)
- Test: `tests/unit/inbox-classify.test.mjs`(더함), `tests/e2e/inbox-activity.mjs`

- [ ] **Step 1: 시험**: classify 지어낸 활동지 글 → 'activity', 단원평가 정답지 글은 그대로 'unit-key'; `inbox-activity.mjs`(활동지 .txt를 떠 있는 버튼에 → 카드 「수업 활동지」 → [실행] → 활동지 1단계에 들어감; 스캔 → 받는 곳 「활동지 채점」 고르면 그 활동지 3단계).
- [ ] **Step 2:** FAIL → **Step 3:** 구현·예시 파일·문서 → **Step 4:** `npm test`, `npm run e2e`, `cargo check --manifest-path src-tauri/Cargo.toml --target x86_64-pc-windows-msvc --tests` PASS → **Step 5:** 커밋 「활동지 10: 떠 있는 버튼·예시·문서」.
