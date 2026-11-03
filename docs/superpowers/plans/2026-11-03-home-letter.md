# 계획 17 — 기타 › 가정통신문 작성

> 실행: 인라인(이 세션에서 끝까지). 스펙: `docs/superpowers/specs/2026-11-03-home-letter-design.md`

**Goal:** 학교 양식(.hwpx는 모양 그대로, .hwp·기본은 짜임만)에 맞춘 가정통신문과 알림 앱용 글·발송 기안을 쓴다.

## Global Constraints
- 실제 학교 파일은 저장소에 넣지 않음. 시험 양식은 지어낸 「새싹초등학교」.
- 원본 공문 파일은 저장하지 않음(글만). 양식은 IndexedDB에만(5MB까지).
- AI로는 명단·전화번호 줄을 뺀 글만. 양식 머리·학교장 줄은 보내지 않음.
- 저장·결재·상신은 앱이 누르지 않음.

## Review Focus
1. 양식의 옛 본문 문단에 그림·표 같은 개체가 섞여 있을 때 지워도 머리·로고는 남는지.
2. 날짜와 학교 이름이 한 줄(「2025년 12월 12일 ○○초등학교」)일 때 날짜만 바뀌는지.
3. 회신서가 본문과 같은 표 안에 있는 양식에서 회신서를 지우다 본문까지 지우지 않는지.
4. 양식에 본문 2단계(가.)가 없을 때 「가.」 줄이 1단계·보통 문단 모양을 따르는지.
5. 같은 양식으로 두 번 채워도 첫 결과가 양식에 남지 않는지(늘 저장한 원본에서 채움).

## Task 1: XML 읽개 + 양식 줄 읽기·자리 찾기 (`web/core/hwpx-form.js`)
- `scanXml(xml) -> root{ children[] }`(요소 이름·시작·여는 태그 끝·닫는 태그 시작·끝), `readForm(u8) -> { entries, sections, lines }`, `findRoles(lines) -> roles`.
- 시험: `tests/unit/hwpx-form.test.mjs`(지어낸 양식, 표시 양식).

## Task 2: 채우기 (`fillForm`)
- 제목·날짜(꼴 그대로)·본문(단계별 모양)·회신서(지움/넣음, header.xml 테두리 더함)·PrvText, linesegarray 지움.
- 시험: 같은 파일 + 잘 짜인 XML 검사.

## Task 3: 기본·.hwp 양식 문서 + AI (`web/menus/etc/letter-ai.js`)
- `plainFromLines(lines)`, `defaultPlain(school)`, `plainLetterDoc(plain, letter)`(가운데 줄 블록 `c`는 hwpx·docx·HTML에 더함), `letterPrompt`, `normLetter`, `composeBody`, `composeSend`, `fmtLike(dateFmt, iso)`.
- 시험: `tests/unit/letter-ai.test.mjs`, `doc-export` 가운데 줄.

## Task 4: 양식 저장 (`web/core/form-store.js`) + 화면 (`web/menus/etc/letter.js`, css) + 탭·업무별 AI
- 시험: `tests/e2e/letter.mjs`, `samples/가정통신문-양식-예시.hwpx`(make-samples).

## Task 5: 문서·전체 시험·최종 검토
