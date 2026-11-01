# 검증 상태

2026-11-02 기준. 합성 데이터만 사용했으며 개인 Google 계정에는 아직 배포하지 않았습니다.

| 검사 | 결과 |
| --- | --- |
| 변경 전 단위 테스트 | 272/273 통과. 기존 `unit-key.test.mjs:183` 구두점 비교 실패 |
| 변경 후 전체 단위 테스트(`npm test`) | 297/298 통과. 동일한 기존 실패 1건 |
| 연수 단위 테스트(`npm run test:training`) | 25/25 통과(코어 13, GAS·인증 7, 클라이언트 5) |
| 교사 화면 통합 | 5/5 통과. 실제 PDF.js 읽기, 수동 제출, 응답 유실 재시도, 보완·승인, 최신 여부 표시, 계정 격리, 모든 이수연도 조회 |
| 담당자 화면 통합 | 6/6 통과. 실제 코어와 모의 `google.script.run` 연결 |
| 기존 메뉴 화면 회귀 | 13/13 통과 |
| 웹 빌드·GAS 배포 파일 생성 | 통과 |
| Rust 빌드·테스트 | Windows CI에서 통과. 로컬에는 Rust 도구가 없음 |
| 실제 GAS·ContentService 리디렉션·설치형 앱 통신 | 미실행. 개인 계정 배포 후 README의 기본 동작 점검 필요 |

로컬 화면 검사는 저장소에서 지정한 브라우저가 캐시되어 있지 않아 설치된 Chromium과 호환되는 Playwright 1.63을 사용했습니다. CI는 저장소에 지정된 Playwright와 Chromium을 설치합니다. 화면 검사는 실제 인증·업무 코드를 호출하지만 저장소는 메모리이며 통신은 모의 구현입니다. Google 할당량·Drive 권한·네이티브 TLS 및 리디렉션·설치형 앱 호환성을 검증한 것은 아닙니다.

## 실패→구현→통과 근거

코어와 GAS 근거는 [코어 테스트 기록](TDD-core.md), [GAS 테스트 기록](TDD-gas.md)에 있습니다. 클라이언트 테스트는 `client.js`와 `certificate.js` 구현 전에 작성했습니다. `node --test tests/unit/training-client.test.mjs`는 처음 `ERR_MODULE_NOT_FOUND`로 실패했고 구현 후 4/4 통과했습니다. 독립 리뷰에서 비동기 조회 순서 역전 회귀 검사를 추가하고 세대 번호 검사로 방어한 뒤 5/5 통과했습니다. 화면 통합과 Rust URL 정책 검사는 구현 후 검증용으로 작성했으며 실행된 Rust 실패→통과 주기는 주장하지 않습니다.

독립 리뷰에서 시트 격자 확장, 수식 실행을 막는 JSON 분할, 교체 증빙 보존, 계정 변경 시 초안 제거, 늦게 도착한 조회 결과 무시, 배포 파일 생성과 테스트 순서를 보완했습니다. GAS 공개 진입점은 `doGet`, `doPost`, 인증을 거치는 `trainingRequest`뿐입니다. 내부 증빙 ID와 인증값 해시는 응답하지 않습니다.

## 재현 명령

```sh
npm ci
npm run build:training
npm run test:training
npx playwright install chromium
node tests/e2e/training.mjs
node tests/e2e/training-reviewer.mjs
node tests/e2e/shell.mjs
npm run web
cargo test --manifest-path src-tauri/Cargo.toml
```

전체 `npm test`에는 기존 실패가 남아 있으므로 전체 통과라고 보고하지 않습니다. 실제 배포 점검에는 앱·배포 버전과 항목별 결과만 기록하고 인증값·개인 계정 식별값·실제 교직원 자료는 넣지 않습니다.

## Windows CI

[최초 실행 결과](https://github.com/capehawk/ssam-assistant/actions/runs/41355906916): 커밋 `42b8fe8`의 Windows CI가 통과했습니다. 연수 단위 테스트, 교사·담당자 화면 통합, 배포 파일 일치 검사, 웹 빌드와 Rust 빌드·테스트가 모두 성공했습니다. 실제 GAS 배포·설치형 앱 네트워크 통신 점검은 이 결과에 포함되지 않습니다.
