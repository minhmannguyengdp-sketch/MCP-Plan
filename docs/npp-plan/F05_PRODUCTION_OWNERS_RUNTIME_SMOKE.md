# NPP-F05 complete production-owner runtime smoke

> Source tooling only. This document is not production execution evidence and does not advance runtime coverage beyond 14/30.

## Command

```bash
npm run smoke:f05-production-owners
```

The command verifies standalone order creation; route create/update; session open, customer status, close/update and empty delete; route-customer update; route and route-customer archive; and canonical 404 responses for the seven retired legacy settings POST routes.

Every persisted-idempotent mutation must prove first execution, same-key replay, different-payload conflict, canonical envelope/request ID, trusted context, one completed idempotency record, append-only succeeded/replayed audit events, and its business invariant. Archive evidence is separate: intent, R2/delete job, retry/reclaim, and finalizer must each pass. The tool must never describe PostgreSQL and R2 as one transaction.

The evidence layer accepts observed facts, not caller-provided `"PASS"` labels. Missing before/after invariant checks, an archive job with only one attempt, database-only media cleanup, or an unverified R2 provider result forces the overall result to `FAIL`.

Before creating any fixture, the runner requires a preflight proof of the remote installation identity and an exact inventory of business-invariant, archive retry/reclaim, and provider-level R2 verifiers. The initial live driver intentionally reports those capabilities as unproven until their real verifiers exist, so it stops before the first network mutation. It cannot create production fixtures for a run that is known in advance to be incapable of producing valid closure evidence.

## Mandatory guard

The command refuses to start unless all values are explicitly present and identities match:

```bash
export NPP_F05_RUNTIME_SMOKE_GUARDED=I_UNDERSTAND_TEMPORARY_PRODUCTION_MUTATIONS
export NPP_F05_EXPECTED_INSTALLATION_ID='<approved installation UUID>'
export NPP_F05_EXPECTED_NPP_CODE='<approved NPP code>'
export MCP_INSTALLATION_ID='<must equal expected installation UUID>'
export MCP_NPP_CODE='<must equal expected NPP code>'
export MCP_API_BASE_URL='https://<approved Foundation gateway>'
export BACKEND_API_TOKEN='<private backend token>'
export SUPABASE_URL='https://<approved project>.supabase.co'
export SUPABASE_SERVICE_ROLE_KEY='<private service role key>'
```

Never paste this command with real values into CI logs, issues, PRs, chat, or shell history. Output redacts token-shaped errors and never includes provider object keys.

## Fixture boundary and cleanup

* All names/notes use `__NPP_F05_RUNTIME_SMOKE__` and dates use year 2099.
* IDs are captured only from responses created by this run. Existing routes, customers, sessions, orders and media are never selected as mutation targets.
* Cleanup runs from `finally`, archives only captured temporary route IDs, and then checks temporary rows and outlet-media references are absent.
* A failed cleanup makes the whole command fail. It is forbidden to manually delete unrelated production data to make evidence green.
* Archive PASS requires separate persisted intent/delete-job evidence, including retry/reclaim/finalizer behavior and final R2 absence.
* A zero-row `mcp_outlet_media` query is not proof that R2 objects are gone. Cleanup PASS additionally requires a provider-level absence check for the exact temporary objects created by that run.

## Evidence

Stdout is one JSON object headed by:

```json
{
  "NPP_F05_PRODUCTION_OWNERS_RUNTIME_SMOKE": "PASS|FAIL",
  "preflight": {},
  "operations": {},
  "retiredSettingsPosts": {},
  "archiveLifecycle": {},
  "cleanup": {}
}
```

Do not record runtime `30/30` unless a guarded authenticated production run returns PASS, its cleanup is independently verified, and the evidence is reviewed. Codex must only run contract tests and builds; it must not run this production command, deploy, apply migrations, or run `pullmcp`.
