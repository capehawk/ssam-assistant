# GAS adapter verification record

2026-11-02: `node --test tests/unit/training-service-gas.test.mjs`

- RED before implementation: exit 1, application.js missing (1 failed test file).
- GREEN after implementation: exit 0, 4/4 assertions groups pass: expiry/revocation, locked authentication/error boundary, chunked record/receipt roundtrip, deterministic file recovery.
- Review hardening: all executable bundle functions enclosed in TrainingModule_; only doGet/doPost/trainingRequest public. `j:` cell prefix prevents formula interpretation. Grid expansion handles large bounded records. Old evidence references retained for cleanup.
- `node services/training-submission/build.mjs` succeeds and copies four deployment artifacts.
- Additional regression checks: 7/7 GAS tests pass, including committed-write/failed-flush receipt recovery, formula-shaped chunk boundary, grid growth and VM inspection showing only doGet/doPost/trainingRequest public. A new grid test initially failed because its fixture did not exceed 26 columns; corrected fixture to 999,980 characters, then 7/7 passed (test-fixture correction, not a production bug/TDD cycle).
- Service total: 20/20 unit tests pass (13 core + 7 GAS/application).
- `tests/e2e/training-reviewer.mjs`: 6/6 browser cases pass with real core/application + memory storage behind mock google.script.run. Teacher rejection, text-only rendering, PDF download, response-loss retry, revise/approve/teacher result, logout. Local installed Playwright bridge and browser-cache override used because default sandbox browser cache was absent. These UI tests were added after implementation and are regression/integration tests, not claimed as RED-first TDD.

These are local mocks, not a deployed Google service. Actual GAS authorization, quotas, Drive sharing semantics and HTTP redirect smoke remain unexecuted until personal-account deployment.
