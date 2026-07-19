# A5.5.2 — Archive Intents

## Scope

```text
POST /api/routes/:id/archive          route.archive
POST /api/route-customers/:id/archive route-customer.archive
```

These two operations span PostgreSQL and private R2. They are not one database transaction.

## Existing owner retained

Keep the current Foundation storage lifecycle and literal RPC targets:

```text
mcp_claim_route_media_delete
mcp_claim_route_customer_media_delete
mcp_finish_storage_delete_job
```

Do not add a second delete API or storage lifecycle.

## Durable intent

```text
stable browser key
-> persisted idempotency claim
-> exact delete-job linkage
-> parent/media claim
-> idempotent R2 DELETE
-> media completion
-> guarded parent hard delete
-> delete-job and idempotency completion in one DB transaction
```

An unfinished target job cannot be reassigned to a different key. A completed target can complete a later key from its terminal job response.

## Lock order

```text
idempotency record -> delete job -> parent -> media rows
```

Claim and finish owners must use the same order.

## Crash recovery

- expired idempotency lease lets the same key reclaim;
- R2 204 and 404 are successful deletion;
- cleanup reclaims deleting/delete_failed media;
- cleanup finalizes ready or stale-finalizing parent jobs;
- parent not-found after a crash is already-deleted success;
- job and idempotency completion are atomic in PostgreSQL;
- audit uses the original idempotency actor/request context.

## Conflicts

- same key and target: execute, in-progress or replay;
- same key and different target: idempotency conflict;
- different key and unfinished same target: archive intent conflict;
- new key and completed same target: immediate terminal success.

## Tests

- schema/linkage/lock-order/grant contract;
- execute and replay;
- both conflict cases;
- R2 failure remains retryable;
- cleanup completes the original intent;
- browser callers use `route.archive` and `route-customer.archive`;
- exact scanner fingerprints remain;
- Foundation, backend, typecheck and production build PASS.

## Non-scope

No production migration, VPS pull, Vercel deploy, production fixture, NPP-F06, Order Core or MCP mobile fix pass.
