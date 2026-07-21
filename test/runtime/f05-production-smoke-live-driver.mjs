import {
  auditRows, db, ensure, gateway, idempotencyRows, must, mustConflict, object, replayed, sameJson, stamp
} from "./a5-5-2-smoke-http.mjs";
import { SMOKE_PREFIX, SMOKE_SESSION_DATE } from "./f05-production-smoke-inventory.mjs";

function replaceIds(path, fixtures) {
  return path
    .replace(":routeId", encodeURIComponent(fixtures.routeId))
    .replace(":routeCustomerId", encodeURIComponent(fixtures.routeCustomerId))
    .replace(":sessionId", encodeURIComponent(fixtures.currentOperation === "sessionDeleteEmpty" ? fixtures.emptySessionId : fixtures.sessionId));
}

function plan(definition, fixtures) {
  const commonRoute = { routeName: `${SMOKE_PREFIX}${stamp}`, area: "API Smoke", weekday: 5, note: `${SMOKE_PREFIX} temporary` };
  const plans = {
    standaloneOrderCreate: { body: { customerMode: "existing", routeCustomerId: fixtures.routeCustomerId, orderDate: "2099-12-28", items: [{ productName: `${SMOKE_PREFIX}PRODUCT`, quantity: 1, unitPrice: 1 }], note: `${SMOKE_PREFIX} temporary` }, conflict: { note: `${SMOKE_PREFIX} conflict` } },
    routeCreate: { body: commonRoute, conflict: { ...commonRoute, weekday: 6 } },
    routeUpdate: { body: { note: `${SMOKE_PREFIX} updated` }, conflict: { note: `${SMOKE_PREFIX} conflict` } },
    sessionOpen: { body: { routeId: fixtures.routeId, sessionDate: SMOKE_SESSION_DATE, owner: `${SMOKE_PREFIX}ACTOR` }, conflict: { owner: `${SMOKE_PREFIX}CONFLICT` } },
    sessionCustomerStatus: { body: { sessionCustomerId: fixtures.sessionCustomerId, status: "visited", note: `${SMOKE_PREFIX} visited` }, conflict: { status: "skipped", note: `${SMOKE_PREFIX} conflict` } },
    sessionUpdateClose: { body: { status: "done", note: `${SMOKE_PREFIX} closed` }, conflict: { status: "active" } },
    sessionDeleteEmpty: { body: {}, conflict: { smokeConflict: true } },
    routeCustomerUpdate: { body: { note: `${SMOKE_PREFIX} updated`, sortOrder: 1 }, conflict: { note: `${SMOKE_PREFIX} conflict` } },
    routeCustomerArchive: { body: {}, conflict: { smokeConflict: true } },
    routeArchive: { body: {}, conflict: { smokeConflict: true } }
  };
  return plans[definition.name];
}

async function prove(definition, fixtures) {
  const path = replaceIds(definition.path, fixtures);
  const requestPlan = plan(definition, fixtures);
  ensure(requestPlan, `missing_runtime_plan_${definition.name}`);
  const key = `npp-f05.${definition.operation}.${stamp}`;
  const firstRequestId = `npp-f05-${definition.name}-first-${stamp}`;
  const first = await must(path, { method: definition.method, body: requestPlan.body, idempotencyKey: key, requestId: firstRequestId });
  ensure(!replayed(first.payload), `${definition.name}_first_marked_replay`);
  const second = await must(path, { method: definition.method, body: requestPlan.body, idempotencyKey: key, requestId: `npp-f05-${definition.name}-replay-${stamp}` });
  ensure(replayed(second.payload), `${definition.name}_replay_missing`);
  ensure(sameJson(first.payload.data, second.payload.data), `${definition.name}_replay_changed`);
  const conflictPath = definition.name === "routeArchive"
    ? `/api/routes/${encodeURIComponent(fixtures.archiveConflictRouteId)}/archive`
    : definition.name === "routeCustomerArchive"
      ? `/api/route-customers/${encodeURIComponent(fixtures.archiveConflictCustomerId)}/archive`
      : path;
  const conflict = await mustConflict(conflictPath, { method: definition.method, body: { ...requestPlan.body, ...requestPlan.conflict }, idempotencyKey: key, requestId: `npp-f05-${definition.name}-conflict-${stamp}` });
  const audits = await auditRows(definition.operation, key);
  ensure(audits.some((row) => row.outcome === "succeeded"), `${definition.name}_audit_success_missing`);
  ensure(audits.some((row) => row.outcome === "replayed"), `${definition.name}_audit_replay_missing`);
  const records = await idempotencyRows(definition.operation, key);
  ensure(records.length === 1 && records[0].status === "completed", `${definition.name}_idempotency_invalid`);
  const succeededAudits = audits.filter((row) => row.outcome === "succeeded");
  const replayAudits = audits.filter((row) => row.outcome === "replayed");
  const contextRows = [...audits, ...records];
  const installationId = String(process.env.MCP_INSTALLATION_ID || "");
  const actorId = String(records[0]?.actor_id || succeededAudits[0]?.actor_id || "");
  ensure(contextRows.every((row) => row.installation_id === installationId), `${definition.name}_installation_context_mismatch`);
  ensure(actorId && contextRows.every((row) => row.actor_id === actorId), `${definition.name}_actor_context_mismatch`);
  const data = object(first.payload.data);
  return {
    aggregateId: String(data.routeId || data.orderId || data.sessionId || data.id || ""),
    execute: { ok: first.response.ok, canonical: first.payload.requestId === firstRequestId && typeof first.payload.receivedAt === "string", requestId: firstRequestId },
    replay: { persisted: replayed(second.payload), sameResult: sameJson(first.payload.data, second.payload.data) },
    conflict: { status: conflict.response.status, canonical: conflict.payload.requestId === conflict.requestId && typeof conflict.payload.receivedAt === "string" },
    context: { persisted: true, installationId, actorId },
    idempotency: { rowCount: records.length, status: records[0].status, attemptCount: Number(records[0].attempt_count) },
    audit: { succeeded: succeededAudits.length, replayed: replayAudits.length, appendOnly: succeededAudits.length === 1 && replayAudits.length === 1 },
    // A successful HTTP call is not itself a business-invariant proof. Each operation needs
    // an explicit persisted before/after verifier before the complete smoke may report PASS.
    invariants: { verified: false }
  };
}

export function createLiveF05SmokeDriver() {
  const createdRouteIds = new Set();
  const createdAggregates = [];
  return {
    async createTemporaryFixtures() {
      const route = await must("/api/routes", { method: "POST", idempotencyKey: `npp-f05.fixture.route.${stamp}`, body: { routeName: `${SMOKE_PREFIX}FIXTURE_${stamp}`, area: "API Smoke", weekday: 5, note: `${SMOKE_PREFIX} temporary` } });
      const routeId = String(object(route.payload.data).routeId || object(route.payload.data).id || "");
      ensure(routeId, "smoke_fixture_route_missing");
      createdRouteIds.add(routeId);
      const customer = await must("/api/route-customers", { method: "POST", idempotencyKey: `npp-f05.fixture.customer.${stamp}`, body: { routeId, customerName: `${SMOKE_PREFIX}CUSTOMER_${stamp}`, area: "API Smoke", sortOrder: 1, note: `${SMOKE_PREFIX} temporary` } });
      const routeCustomerId = String(object(customer.payload.data).routeCustomerId || object(customer.payload.data).id || "");
      ensure(routeCustomerId, "smoke_fixture_customer_missing");
      const session = await must("/api/mcp-day/open-session", { method: "POST", idempotencyKey: `npp-f05.fixture.session.${stamp}`, body: { routeId, sessionDate: SMOKE_SESSION_DATE, owner: `${SMOKE_PREFIX}ACTOR` } });
      const sessionId = String(object(object(session.payload.data).session).id || object(session.payload.data).sessionId || "");
      const day = await must(`/api/mcp-day/data?routeId=${encodeURIComponent(routeId)}&date=${SMOKE_SESSION_DATE}`);
      const line = object(object(day.payload.data).lines?.[0]);
      const sessionCustomerId = String(line.sessionCustomerId || line.id || "");
      ensure(sessionId && sessionCustomerId, "smoke_fixture_session_missing");
      const emptyRoute = await must("/api/routes", { method: "POST", idempotencyKey: `npp-f05.fixture.empty-route.${stamp}`, body: { routeName: `${SMOKE_PREFIX}EMPTY_${stamp}`, area: "API Smoke", weekday: 6, note: `${SMOKE_PREFIX} temporary empty route` } });
      const emptyRouteId = String(object(emptyRoute.payload.data).routeId || object(emptyRoute.payload.data).id || "");
      ensure(emptyRouteId, "smoke_empty_route_missing");
      createdRouteIds.add(emptyRouteId);
      const emptySession = await must("/api/mcp-day/open-session", { method: "POST", idempotencyKey: `npp-f05.fixture.empty-session.${stamp}`, body: { routeId: emptyRouteId, sessionDate: SMOKE_SESSION_DATE, owner: `${SMOKE_PREFIX}ACTOR` } });
      const emptySessionId = String(object(object(emptySession.payload.data).session).id || object(emptySession.payload.data).sessionId || "");
      ensure(emptySessionId, "smoke_empty_session_missing");
      const archiveRoute = await must("/api/routes", { method: "POST", idempotencyKey: `npp-f05.fixture.archive-route.${stamp}`, body: { routeName: `${SMOKE_PREFIX}ARCHIVE_CONFLICT_${stamp}`, area: "API Smoke", weekday: 4, note: `${SMOKE_PREFIX} temporary archive conflict` } });
      const archiveConflictRouteId = String(object(archiveRoute.payload.data).routeId || object(archiveRoute.payload.data).id || "");
      ensure(archiveConflictRouteId, "smoke_archive_conflict_route_missing");
      createdRouteIds.add(archiveConflictRouteId);
      const archiveCustomer = await must("/api/route-customers", { method: "POST", idempotencyKey: `npp-f05.fixture.archive-customer.${stamp}`, body: { routeId: archiveConflictRouteId, customerName: `${SMOKE_PREFIX}ARCHIVE_CUSTOMER_${stamp}`, area: "API Smoke", sortOrder: 1, note: `${SMOKE_PREFIX} temporary` } });
      const archiveConflictCustomerId = String(object(archiveCustomer.payload.data).routeCustomerId || object(archiveCustomer.payload.data).id || "");
      ensure(archiveConflictCustomerId, "smoke_archive_conflict_customer_missing");
      return { routeId, routeCustomerId, sessionId, sessionCustomerId, emptyRouteId, emptySessionId, archiveConflictRouteId, archiveConflictCustomerId };
    },
    async proveOperation(definition, fixtures) {
      fixtures.currentOperation = definition.name;
      const result = await prove(definition, fixtures);
      if (definition.name === "routeCreate" && result.aggregateId) createdRouteIds.add(result.aggregateId);
      if (result.aggregateId) {
        const table = definition.name === "standaloneOrderCreate" ? "orders"
          : definition.name === "routeCreate" ? "mcp_routes"
            : definition.name === "sessionOpen" ? "mcp_route_sessions" : null;
        if (table) createdAggregates.push({ table, id: result.aggregateId });
      }
      return result;
    },
    async proveRetiredPost(path) {
      const result = await gateway(path, { method: "POST", body: { smoke: true }, requestId: `npp-f05-retired-${stamp}` });
      ensure(result.response.status === 404, `${path}_expected_canonical_404`);
      ensure(result.payload.requestId === result.requestId, `${path}_request_id_missing`);
      ensure(typeof result.payload.receivedAt === "string", `${path}_received_at_missing`);
      return { status: result.response.status, canonical: true, requestId: result.requestId };
    },
    async proveArchiveLifecycle(fixtures) {
      const targetIds = [fixtures.routeId, fixtures.routeCustomerId].map(encodeURIComponent).join(",");
      const intents = await db(`mcp_archive_intents?target_id=in.(${targetIds})&select=id,status,delete_job_id`);
      ensure(intents.length === 2, "archive_intent_count_invalid");
      ensure(intents.every((intent) => intent.status === "completed" && intent.delete_job_id), "archive_finalizer_not_completed");
      const jobIds = intents.map((intent) => encodeURIComponent(intent.delete_job_id)).join(",");
      const jobs = await db(`mcp_storage_delete_jobs?id=in.(${jobIds})&select=id,status,attempt_count,completed_at`);
      ensure(jobs.length === 2, "archive_delete_job_count_invalid");
      ensure(jobs.every((job) => job.status === "completed" && Number(job.attempt_count) >= 1 && job.completed_at), "archive_delete_job_not_finalized");
      return {
        intentCount: intents.length,
        jobCount: jobs.length,
        minimumJobAttempts: Math.min(...jobs.map((job) => Number(job.attempt_count))),
        reclaimedJobs: jobs.filter((job) => Number(job.attempt_count) >= 2).length,
        finalizedIntents: intents.filter((intent) => intent.status === "completed").length,
        finalizedJobs: jobs.filter((job) => job.status === "completed" && job.completed_at).length,
        separateIntentAndJobTransactions: intents.every((intent) => intent.id !== intent.delete_job_id)
      };
    },
    async cleanupTemporaryFixtures() {
      const errors = [];
      for (const routeId of [...createdRouteIds].reverse()) {
        try {
          const result = await gateway(`/api/routes/${encodeURIComponent(routeId)}/archive`, { method: "POST", body: {}, requestId: `npp-f05-cleanup-${stamp}`, idempotencyKey: `npp-f05.cleanup.${routeId}.${stamp}` });
          ensure(result.response.ok || result.response.status === 404, "smoke_cleanup_archive_failed");
          createdRouteIds.delete(routeId);
        } catch (error) { errors.push(error); }
      }
      if (errors.length) throw new AggregateError(errors, "smoke_cleanup_routes_failed");
    },
    async verifyCleanup(fixtures) {
      let databaseRowsRemaining = 0;
      const exactRows = [
        ...createdAggregates,
        { table: "mcp_route_customers", id: fixtures?.routeCustomerId },
        { table: "mcp_route_customers", id: fixtures?.archiveConflictCustomerId },
        { table: "mcp_route_sessions", id: fixtures?.sessionId },
        { table: "mcp_route_sessions", id: fixtures?.emptySessionId }
      ].filter((item) => item.id);
      for (const { table, id } of exactRows) {
        const rows = await db(`${table}?id=eq.${encodeURIComponent(id)}&select=id`);
        databaseRowsRemaining += rows.length;
      }
      const targetIds = [...createdRouteIds, fixtures?.routeId, fixtures?.emptyRouteId, fixtures?.archiveConflictRouteId].filter(Boolean);
      if (targetIds.length) {
        const media = await db(`mcp_outlet_media?route_id=in.(${targetIds.map(encodeURIComponent).join(",")})&select=id`);
        databaseRowsRemaining += media.length;
      }
      // Database metadata cannot prove provider deletion. Until the driver owns temporary R2
      // objects and verifies their absence against R2, the complete smoke must remain FAIL.
      return { databaseRowsRemaining, r2ProviderVerified: false, r2ObjectsRemaining: null };
    }
  };
}
