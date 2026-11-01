# 연수 제출 API 계약 v1

요청 형식은 `{action, token, requestId, payload}`입니다. `token`은 임시 인증값이며 요청 본문으로만 전송합니다. 모든 작업은 서버에서 인증하며 클라이언트가 보낸 사용자 ID와 역할을 인증 근거로 사용하지 않습니다. 응답은 `{ok, data, error, requestId}`이며 `error`는 null 또는 `{code,message}`입니다. GAS는 HTTP 200 응답에서도 이 형식으로 업무 오류를 반환합니다.

| 작업(action) | 요청 내용(payload) | 성공 결과(data) |
| --- | --- | --- |
| catalog | `{}` | `{id,title,kind,itemIds?}` 기준 목록 |
| mySubmissions | `{}` | 모든 이수연도의 본인 제출 목록 |
| submit | `{items,evidence}` | 제출 기록 |
| revise | `{submissionId,expectedRevision,items,evidence}` | 보완 후 제출 기록 |
| reviewQueue | `{}` | 담당자용 제출 목록(모든 상태) |
| review | `{submissionId,expectedRevision,decision,comment}` | 검토 후 제출 기록 |
| evidence | `{submissionId}` | `{name,mimeType,base64}`(본인 또는 담당자만) |

`items`는 `{catalogId,title,provider,completedOn,hours}` 항목 1~10개입니다. 날짜는 `YYYY-MM-DD`, 시간은 양수입니다. 시연 기준 ID는 `safety`, `privacy`, `child-protection`, `mandatory-bundle`입니다. 묶음은 구성 기준 ID를 보존하는 하나의 항목·제출로 처리합니다. `evidence`는 `{name,mimeType:'application/pdf',base64}`이며 최대 5 MiB PDF 한 개입니다. Base64에 data URL 접두어를 붙이지 않습니다. 서버는 복호화한 크기와 PDF 시작 바이트를 검사합니다. 검토 결정은 `approved`(확인완료) 또는 `needs_changes`(보완요청)이며 보완요청에는 의견이 필요합니다.

제출 기록은 `{submissionId,actorId,items,evidence:{name,mimeType,size},status,revision,comment,createdAt,updatedAt,history}`입니다. 이력 항목은 `{action,actorId,at,revision,comment}`입니다. 내부 파일 ID, 인증값 해시, 내용 해시, 중복 요청 처리 기록은 반환하지 않습니다. 상태는 `submitted`(확인대기) → `approved` 또는 `needs_changes` → `submitted`로 전환합니다. 버전은 1부터 시작해 변경마다 증가합니다. 담당자는 자기 제출을 검토할 수 없고 교사는 검토 작업을 할 수 없습니다. 확인완료 기록은 보완 수정할 수 없습니다.

변경 작업마다 새로운 `requestId`를 사용합니다(영문·숫자·밑줄·하이픈 8~100자). 재시도에는 같은 ID와 내용을 사용합니다. ID의 범위는 인증된 사용자별이며 같은 ID에 작업이나 내용이 다르면 `REQUEST_CONFLICT`를 반환합니다. 중복 결과를 반환하기 전에 인증과 대상 소유권을 검사합니다. 성공한 요청을 재전송하면 이후 기록이 변경됐더라도 해당 요청 당시의 결과를 반환합니다. 새로운 변경 요청의 `expectedRevision`이 오래됐으면 `REVISION_CONFLICT`입니다. 결과가 불확실한 요청은 ID와 내용을 유지해 재시도해야 합니다.

오류 코드는 `UNAUTHENTICATED`, `FORBIDDEN`, `VALIDATION`, `NOT_FOUND`, `INVALID_STATE`, `REQUEST_CONFLICT`, `REVISION_CONFLICT`, `STORAGE_ERROR`, `BUSY`, `INTERNAL`입니다. 오류 메시지에는 요청 본문·인증값·기반 서비스의 원문 예외를 포함하지 않습니다. 클라이언트는 `ok:true`를 받기 전에 접수 완료로 표시하지 않습니다. 통신 실패 시 결과 미확인 요청과 마지막 확인 상태를 유지합니다.

업무 서비스는 동기식 의존성(repository, evidenceStore, clock, idGenerator, hash, decodeBase64)을 주입받고 인증은 별도 어댑터로 처리합니다. GAS는 인증·조회·변경 동안 스크립트 잠금을 유지해 동시 변경을 제어합니다. 파일은 사용자·요청·내용에서 계산한 불투명한 키로 이름을 정해 저장 결과가 불확실해도 재사용합니다. JSON 기록은 Sheets 셀 제한보다 작은 조각으로 나눕니다. 증빙은 공개 공유하지 않습니다.
