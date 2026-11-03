# 계획 16 — 쪽지 첫 줄 · 이음 붙임 · 에듀파인 차례로 붙여넣기 · 결과 보고

> 실행: 인라인(이 세션에서 끝까지). 스펙: `docs/superpowers/specs/2026-11-03-report-edufine-design.md`

**Goal:** 스펙 2~5장을 만든다. **Tech:** 정적 ES 모듈(web/), Tauri 2(Rust, Windows), node:test, Playwright.

## Global Constraints
- 저장·결재·상신 단추는 앱이 누르지 않는다.
- 원본 파일·사진은 저장하지 않는다(글·칸·사진 설명만). 시험 자료는 지어낸 것.
- AI 키는 코드·저장소·기록에 없음. 학생 이름은 AI로 보내지 않음(cleanSheet).
- Windows 코드는 `cargo check --target x86_64-pc-windows-msvc --tests`로 확인.

## Review Focus
1. 차례로 붙여넣기 중 나이스 준비를 하면 하나만 Ctrl+V를 맡는지.
2. 빈 조각(규격 없음 등)을 Ctrl+V 한 번에 건너뛰는지.
3. 사진 없는 결과 보고서·사진만 있는 보고서가 깨지지 않는지(hwpx·docx·PDF).
4. 결과 보고에서 관련 공문이 없을 때 공문 번호 매김(1. 2.)이 맞는지.
5. 쪽지 본문을 손으로 고친 뒤 제목을 바꾸면 본문을 덮지 않는지.

## Task 1: 쪽지 첫 줄
- `web/menus/etc/message-ai.js` `composeMessage`: body = `title` 줄 + 빈 줄 + 「안녕하세요 선생님.」 + 안내 줄 …
- `web/menus/etc/message.js`: 쪽지 카드의 제목 칸·[복사] 없앰, [모두 복사] = 본문.
- 시험: `tests/unit/message*.test.mjs` 첫 줄·인사, `tests/e2e/message.mjs` 제목 칸 없음·복사 글.

## Task 2: 이음 붙임
- `src-tauri/Cargo.toml`: `windows = "0.62"`(Win32_Foundation, System_Com, System_Ole, System_Memory, System_SystemServices, UI_Shell, UI_Shell_Common, "implement")
- `src-tauri/src/files.rs` + `src-tauri/src/shell_win.rs`: `copy_files_shell(paths)`(쉘 데이터 개체 + Preferred DropEffect + OleFlushClipboard), `drag_files(paths)`(DoDragDrop, 메인 스레드). 명령 `note_copy_files`(바꿈), `note_drag_files`, `note_copy_path`.
- `web/menus/etc/message.js`: 붙임 줄 끌기(mousedown → 저장 → `note_drag_files`), [폴더 경로 복사], 안내.
- 시험: e2e 가짜 `__TAURI__`로 부르는 명령·인자.

## Task 3: 에듀파인 차례로 붙여넣기
- `src-tauri/src/neis.rs`: `queue_plan`, `Queue` 상태, `queue_arm`·`queue_goto`, on_paste 갈래, 15분 풀림. Rust 시험.
- `web/core/queue-paste.js`: `openQueue({ title, items: [{ label, text }], key })` 패널(목록·다음·앞으로·건너뛰기·닫기), `neis-paste` 이벤트 `state: 'queue'`.
- `web/menus/purchase/purchase.js`: [에듀파인에 차례로 붙여넣기](앱만), 산출 내역 [표 한 번에]/[칸마다].
- 시험: e2e 가짜 `__TAURI__`(invoke 기록 + event.listen).

## Task 4: 문서에 사진
- `web/core/hwpx.js`·`web/core/doc-export.js`: `photos` 블록(hwpx BinData·manifest·hp:pic 표, docx media·rels·drawing 표, HTML img 표).
- 시험: `tests/unit/doc-photos.test.mjs`(zip 안 파일·XML), LibreOffice로 docx → PDF 손 확인.

## Task 5: 결과 보고 모델·AI
- `web/menus/plan/report-ai.js`: `guessSourceKind(name, text, year)`, `reportPrompt({ sources, memo, nPhotos, year })`, `normReport(v, { year })`, `composeReportLetter(r)`, `reportDoc(r, photos)`.
- `web/menus/plan/report-model.js`: 지금 것·최근 20개 저장.
- 시험: `tests/unit/report.test.mjs`.

## Task 6: 결과 보고 화면·행사계획 잇기·문서
- `web/menus/plan/report.js` + css, `web/core/shell.js` 탭, `web/core/ai-roles.js` 업무 `report`, `web/menus/plan/event.js` [결과 보고 쓰기].
- README·PRD·RELEASE_NOTES.
- 시험: `tests/e2e/report.mjs`, 전체 `npm test`·`npm run e2e`.
- 최종 검토(새 눈) → 고침.
