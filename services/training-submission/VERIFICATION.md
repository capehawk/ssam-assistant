# Verification status

2026-11-02, synthetic data only. This branch has not been deployed to a personal Google account.

| Check | Result |
| --- | --- |
| Before-change unit baseline | 272/273 pass; existing `unit-key.test.mjs:183` punctuation mismatch |
| Final unit suite (`npm test`) | 297/298 pass; the same pre-existing failure |
| Training unit tests (`npm run test:training`) | 25/25 pass (13 core, 7 GAS/application, 5 client) |
| Teacher browser integration | 5/5 pass; real PDF.js text extraction; manual submit, lost-response retry, revise/approve, stale state, account isolation, all-year retrieval |
| Reviewer browser integration | 6/6 pass; real core with mocked `google.script.run` |
| Existing shell browser regression | 13/13 pass |
| `npm run web`, `npm run build:training` | pass |
| Rust build/tests | Local toolchain unavailable; Windows CI workflow added, result must be checked separately |
| Live GAS / ContentService redirects / installed Windows app | Not run; requires personal-account deployment and smoke procedure in README |

Browser tests used locally installed Chromium and a compatible Playwright 1.63 bridge because the repository-pinned browser was not cached. CI installs the repository-pinned Playwright/Chromium. These tests call the real application and domain code but use memory storage and mocked transport. They do not establish Google quotas, Drive permissions, native TLS/redirect behavior or installed-app compatibility.

## TDD evidence

Core and GAS evidence is in `TDD-core.md` and `TDD-gas.md`. Client tests were authored before `client.js`/`certificate.js`: `node --test tests/unit/training-client.test.mjs` first failed with ERR_MODULE_NOT_FOUND, then passed 4/4 after implementation. A fifth asynchronous stale-read regression was added during independent review and passed after generation guards. UI integration and Rust URL-policy tests were written as subsequent verification; no executed Rust RED/GREEN cycle is claimed.

Independent review corrections: spreadsheet grid growth; formula-safe JSON chunks; retention of replaced evidence; draft clearing on account changes; stale asynchronous read guards; deployment bundle/test ordering. Only `doGet`, `doPost`, and authenticated `trainingRequest` are public GAS entry points. The service never returns internal evidence IDs or authentication hashes.

## Reproduce

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

The full `npm test` still exposes the documented baseline failure; do not report it as fully green. Actual deployment smoke must record deployment/app version and each result without tokens, personal account IDs or real teacher data.
