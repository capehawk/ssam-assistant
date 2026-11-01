# Training submission contract v1

Transport request: `{action, token, requestId, payload}`. Token is a temporary secret, sent only in the request body. Every action authenticates on the server; actor IDs and roles from clients are ignored. Response: `{ok, data, error, requestId}`; `error` is null or `{code,message}`. GAS returns application errors in this envelope, including HTTP 200 responses.

| Action | Payload | Successful data |
| --- | --- | --- |
| catalog | `{}` | array of `{id,title,kind,itemIds?}` |
| mySubmissions | `{}` | own submission array, all years |
| submit | `{items,evidence}` | submission |
| revise | `{submissionId,expectedRevision,items,evidence}` | submission |
| reviewQueue | `{}` | submission array (reviewer only, all statuses) |
| review | `{submissionId,expectedRevision,decision,comment}` | submission |
| evidence | `{submissionId}` | `{name,mimeType,base64}` (owner or reviewer) |

`items`: 1–10 `{catalogId,title,provider,completedOn,hours}`. Date is `YYYY-MM-DD`; hours is a positive number. The fixed demo catalog IDs are `safety`, `privacy`, `child-protection`, `mandatory-bundle`; bundle is one item/submission with its catalog membership retained. `evidence`: `{name,mimeType:'application/pdf',base64}` with one PDF of at most 5 MiB. No data URL prefix. Server checks decoded size and PDF signature. The review decision is `approved` or `needs_changes`; a nonempty comment is required for needs_changes.

Submission: `{submissionId,actorId,items,evidence:{name,mimeType,size},status,revision,comment,createdAt,updatedAt,history}`. History has `{action,actorId,at,revision,comment}`. Internal file IDs, token hashes, payload hashes and idempotency receipts are never returned. States: submitted → approved or needs_changes → submitted. Revisions start at 1 and increment for every mutation. Reviewer cannot review their own submission. Teacher cannot review. Approved records cannot be revised.

Mutations require a fresh `requestId` (8–100 ASCII letters/digits/underscore/hyphen) per logical operation. Retries use the identical ID and payload. IDs are scoped to the authenticated actor; reuse with different action/content returns `REQUEST_CONFLICT`. Authentication and target ownership are checked before returning a duplicate result. A successful duplicate returns the recorded mutation result, even if later mutations changed the current record. A fresh mutation with stale expectedRevision returns `REVISION_CONFLICT`. A retry after an uncertain result must keep its ID and payload.

Error codes: `UNAUTHENTICATED`, `FORBIDDEN`, `VALIDATION`, `NOT_FOUND`, `INVALID_STATE`, `REQUEST_CONFLICT`, `REVISION_CONFLICT`, `STORAGE_ERROR`, `BUSY`, `INTERNAL`. Error messages contain no request bodies, tokens, or raw infrastructure exception text. Client must not mark a submission complete before `ok:true`. On transport failure retain an uncertain pending operation and last confirmed state.

Service dependencies are synchronous: repository, evidenceStore, clock, idGenerator, hash, decodeBase64; authentication is a separate adapter. GAS holds a script lock across authentication/reads/mutations to avoid stale read/write and token revocation races. Files are named by an actor/request/content-derived opaque key and reused after uncertain writes. JSON records are chunked across cells below the Sheets cell limit. Evidence is never shared publicly.
