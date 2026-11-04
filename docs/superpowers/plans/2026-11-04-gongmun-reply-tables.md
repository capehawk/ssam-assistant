# 계획 18 — 공문 처리 · 회신서 모으기 · 본문 표 · 양식 잇기 · 미뤄 둔 것

> 실행: 인라인(이 세션에서 끝까지). 스펙: `docs/superpowers/specs/2026-11-04-gongmun-reply-tables-design.md`

**Goal:** 기타 › 공문 처리(기한·할 일·넘기기·달력·오늘 수업 띠), 회신서 모으기, 본문 「|」 표, 행사계획·결과 보고서를 학교 양식으로, 0.16 미뤄 둔 것.

## Global Constraints
- 학생 이름 저장·AI 전송 없음(회신서는 가린 그림만). 원본 공문 파일 저장 없음(글 8천 자까지).
- 실제 학교·학생 파일은 저장소에 넣지 않음(시험 자료는 지어냄).
- 저장·결재·상신은 앱이 누르지 않음. 연수 메뉴는 고치지 않음.

## Review Focus
1. 표 줄이 본문 첫 줄·마지막 줄이거나 표만 있는 본문일 때 양식이 깨지지 않는지(문단 수 0, secPr 문단).
2. 결과 보고서 사진이 이미 BinData가 있는 양식(로고)과 이름이 겹치지 않는지, manifest가 잘 짜인 XML인지.
3. 공문 기한이 없는 문서·지난 기한·학년도 넘어가는 날짜에서 차례·D-n·달력이 맞는지.
4. 회신서 읽기 중 다른 가정통신문을 열거나 스캔을 바꿨을 때 옛 결과가 새 것에 들어가지 않는지.
5. 「notice」를 공문 처리로 돌린 뒤 떠 있는 버튼·받는 곳 시험이 맞는지.

## Task A: 미뤄 둔 것 (결과 보고·쪽지·가정통신문)
- 시험: 각 고침마다 단위/e2e 하나씩 먼저.

## Task B: 본문 표 (`web/core/body-table.js`, `hwpx-form.js`, `letter-ai.js`, `letter.js`)
- `parseTableLines(lines)`, `fillForm` 표, `plainLetterDoc` 표 블록, AI 지시, 미리보기.

## Task C: 행사계획 → 가정통신문 (`putLetterDraft`, event.js 버튼)

## Task D: 결과 보고서 → 학교 양식 (`docToLetter`, `fillForm` photos, `rolesValid(r, { date:false })`, report.js 양식 고르기)

## Task E: 기타 › 공문 처리 (`web/menus/etc/gongmun-ai.js`, `gongmun-model.js`, `gongmun.js`, css, today.js 띠, inbox notice, putLetterSources, putPurchaseText, ai-roles `gongmun`)

## Task F: 회신서 모으기 (`web/menus/etc/reply-collect.js` 규칙, letter.js 카드, ai-roles `reply`)

## Task G: 문서(README·PRD·RELEASE_NOTES)·전체 시험·최종 검토·고침
