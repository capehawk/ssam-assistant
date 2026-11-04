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

### 원본 main 동기화 (2026-11-04)

원본 `b1981ea`(0.18.2)를 연수 브랜치에 병합했습니다. 텍스트 충돌은 없었으며 연수 모듈 등록·전용 전송 명령·테스트판 업데이트 차단을 유지했습니다. 로컬 전체 단위 검사는 563개 중 562개 통과, 기존 정답지 문장부호 비교 1개 실패입니다. 실패한 `unit-key` 코드와 테스트는 원본 main과 동일합니다. 교사 화면 6개·담당자 화면 6개·메뉴 회귀 13개 및 웹/GAS 빌드가 통과했습니다. Windows 컴파일 결과는 해당 병합 커밋의 Actions 기록에서 확인합니다.

### 설치판 연수 화면 회귀 검사

첫 설치판에서 PDF 검사 JavaScript가 `application/pdf`로 제공되어 연수 모듈이 로드되지 않는 오류를 재현했습니다. PDF 머리 검사를 숫자 바이트 비교로 바꾸었습니다. 일반 HTTP 서버의 화면 테스트로 발견하지 못했던 문제이므로 Rust 테스트에서 Tauri의 실제 MIME 판별 함수를 호출해 회귀를 검사합니다.

`tests/native/training-smoke.mjs`는 Windows 데스크톱에서 다운로드한 실행 파일의 MIME·연수 연결 화면·업데이트 차단·네이티브 전송 명령을 검사합니다. 수정 전 설치판은 MIME 검사에서 실패했고, 커밋 `65776a0`의 실행 파일은 로컬 Windows에서 모두 통과했습니다. GitHub 호스팅 러너에서는 WebView2 진단 포트 연결이 실패하여 이 GUI 검사는 CI 필수 단계에서 분리했습니다. CI 통과를 실제 앱 실행 검사 통과로 해석하면 안 됩니다. 배포할 파일은 별도로 이 스크립트를 실행해 확인합니다.

테스트판은 `tauri.training.conf.json`과 `training-demo` 기능으로 빌드합니다. 이름은 ‘쌤비서 연수 테스트’이며 앱 식별자를 분리하고 공식 업데이트 조회·설치를 차단합니다. 이 검사에는 실제 교사 인증값을 사용한 제출·담당자 승인 과정이 포함되지 않습니다.

```sh
npm run tauri build -- --bundles nsis --config src-tauri/tauri.training.conf.json --features training-demo
node tests/native/training-smoke.mjs
```

[최초 실행 결과](https://github.com/capehawk/ssam-assistant/actions/runs/41355906916): 커밋 `42b8fe8`의 Windows CI가 통과했습니다. 연수 단위 테스트, 교사·담당자 화면 통합, 배포 파일 일치 검사, 웹 빌드와 Rust 빌드·테스트가 모두 성공했습니다. 실제 GAS 배포·설치형 앱 네트워크 통신 점검은 이 결과에 포함되지 않습니다.

실제 GAS 업로드 확인: 숫자 구분자 표기 때문에 최초 업로드가 파서 오류로 실패했습니다. 1000000 표기로 수정한 뒤 25개 연수 단위 테스트와 실제 코드 업로드가 성공했습니다. 최초 OAuth 승인·저장소 초기화·웹앱 배포·실제 통신 검증은 아직 남아 있습니다.
