# Core test evidence

Local Node v24.19.0; synthetic inputs only. No Apps Script deployment was exercised.

2026-11-02 (Asia/Seoul):

1. Authored eight behavioral tests in `tests/unit/training-service-core.test.mjs` before implementation.
2. `node --test tests/unit/training-service-core.test.mjs`: RED, exit 1, missing core module.
3. Added exported API stub (`execute` returned null) and memory test adapters. Same command: RED, 0 passed / 8 failed. Failures included absent expected storage exceptions and null submission results.
4. Implemented the pure dependency-injected service. Same command: GREEN, 8 passed / 0 failed, including exact 5 MiB PDF boundary, role/ownership checks, state/revision transitions, old-result idempotency, ambiguous committed writes and evidence reuse after failed writes.
5. Added supplementary regression assertions for changed ownership on duplicate submit, rejected review requests leaving the stored record unchanged, and mutation-history limits. These are postimplementation regression checks, not a separate claimed RED/GREEN cycle.
6. Added evidence replacement retention and 1,000,000-character aggregate record limit tests. Same command: RED, 11 passed / 2 failed (missing evidenceHistory and missing expected VALIDATION). Added private evidenceHistory and pre-save size guard. Same command: GREEN, 13 passed / 0 failed. A size rejection after evidence creation may leave an orphan; it must remain until reference-aware adapter cleanup, because deleting on ambiguous writes is unsafe.

Authentication expiry/revocation and GAS lock/chunk persistence belong to adapter tests, not the pure service. Memory adapters clone records to model detached storage reads. The evidence store never deletes a file on a failed submission write: a write could have committed before an exception, so retry uses its opaque actor/request/content key. Orphan cleanup belongs to the deployment adapter after checking references.

Last usage check at 2026-11-02 01:14 Asia/Seoul: known primary window 12% used / 88% remaining; secondary unavailable. No reset credit or paid overage used.
