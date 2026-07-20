import { supabaseRpc } from "./supabase-adapter.js";
import { signedR2DeleteRequest } from "./r2-storage.js";

const DELETE_CONCURRENCY = 6;

function text(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function rows(value) {
  return Array.isArray(value) ? value : [];
}

function fail(code, statusCode = 400, details = null) {
  const error = new Error(code);
  error.code = code;
  error.statusCode = statusCode;
  if (details) error.publicDetails = details;
  throw error;
}

function contextPayload(context) {
  return {
    requestId: context.requestId,
    idempotencyKey: context.idempotencyKey || null,
    receivedAt: context.receivedAt || null,
    installationId: context.installation.id,
    nppCode: context.installation.nppCode,
    actorId: context.actor.id,
    actorType: context.actor.type,
    actorAuthentication: context.actor.authentication || null
  };
}

function requireR2(config) {
  if (!config.r2?.configured) fail("r2_not_configured", 503);
  return config.r2;
}

function providerBusinessCode(error) {
  const normalized = String(error?.providerMessage || "").trim().toLowerCase();
  return /^[a-z][a-z0-9_]{2,127}$/.test(normalized) ? normalized : null;
}

function errorCode(error) {
  return text(error?.code) || providerBusinessCode(error) || text(error?.message) || "provider_request_failed";
}

function normalizeProviderError(error) {
  const code = providerBusinessCode(error);
  if (!code) return error;
  error.code = code;
  if (code.endsWith("_not_found")) error.statusCode = 404;
  else if (code.includes("conflict") || code.includes("already_completed")) error.statusCode = 409;
  else if (code.includes("required") || code.startsWith("invalid_") || code.includes("mismatch")) error.statusCode = 400;
  return error;
}

async function mapWithConcurrency(items, concurrency, worker) {
  const result = new Array(items.length);
  let next = 0;
  async function run() {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      result[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => run()));
  return result;
}

async function finishMediaDelete(mediaId, succeeded, errorMessage, context, config, fetchImpl) {
  return supabaseRpc(config, "mcp_finish_outlet_media_delete", {
    p_installation_id: context.installation.id,
    p_media_id: mediaId,
    p_succeeded: succeeded,
    p_error: errorMessage,
    p_context: contextPayload(context)
  }, { fetchImpl });
}

async function finishDeleteJob(jobId, succeeded, errorMessage, context, config, fetchImpl) {
  return supabaseRpc(config, "mcp_finish_storage_delete_job", {
    p_installation_id: context.installation.id,
    p_job_id: jobId,
    p_succeeded: succeeded,
    p_error: errorMessage,
    p_context: contextPayload(context)
  }, { fetchImpl });
}

async function finishIntent(intentId, succeeded, payload, errorMessage, context, config, fetchImpl) {
  return supabaseRpc(config, "mcp_finish_archive_intent", {
    p_installation_id: context.installation.id,
    p_intent_id: intentId,
    p_succeeded: succeeded,
    p_response_status: succeeded ? 200 : null,
    p_response_payload: succeeded ? payload : null,
    p_error: errorMessage,
    p_context: contextPayload(context)
  }, { fetchImpl });
}

async function deleteClaimedMedia(media, context, config, fetchImpl) {
  const mediaId = text(media.id);
  const objectKey = text(media.object_key || media.objectKey);
  if (!mediaId || !objectKey) return { mediaId, deleted: false, error: "invalid_media_delete_claim" };
  if (media.status === "deleted") return { mediaId, deleted: true, alreadyDeleted: true };
  try {
    const request = signedR2DeleteRequest(requireR2(config), objectKey);
    const response = await fetchImpl(request.url, request.init);
    const deleted = response.ok || response.status === 404;
    const errorMessage = deleted ? null : `r2_delete_http_${response.status}`;
    await finishMediaDelete(mediaId, deleted, errorMessage, context, config, fetchImpl);
    return { mediaId, deleted, status: response.status, error: errorMessage };
  } catch (error) {
    const errorMessage = `r2_delete_error:${String(error?.message || error).slice(0, 300)}`;
    try {
      await finishMediaDelete(mediaId, false, errorMessage, context, config, fetchImpl);
    } catch {
      // Cleanup can reclaim deleting/delete_failed rows.
    }
    return { mediaId, deleted: false, error: errorMessage };
  }
}

async function deleteClaimedRows(mediaRows, context, config, fetchImpl) {
  const results = await mapWithConcurrency(rows(mediaRows), DELETE_CONCURRENCY, (media) => (
    deleteClaimedMedia(media, context, config, fetchImpl)
  ));
  return {
    deletedCount: results.filter((item) => item.deleted).length,
    failed: results.filter((item) => !item.deleted)
  };
}

async function hardDeleteParent(targetType, targetId, config, fetchImpl) {
  if (targetType === "route_customer") {
    return supabaseRpc(config, "mcp_delete_route_customer_hard", {
      p_route_customer_id: targetId
    }, { fetchImpl });
  }
  return supabaseRpc(config, "mcp_delete_route_hard", {
    p_route_id: targetId
  }, { fetchImpl });
}

async function claimIntent(operation, targetType, targetId, context, config, fetchImpl) {
  if (!context.idempotencyKey) fail("idempotency_key_required", 400);
  return object(await supabaseRpc(config, "mcp_claim_archive_intent", {
    p_installation_id: context.installation.id,
    p_operation: operation,
    p_idempotency_key: context.idempotencyKey,
    p_target_type: targetType,
    p_target_id: targetId,
    p_request_payload: { targetId },
    p_context: contextPayload(context)
  }, { fetchImpl }));
}

async function linkIntent(intentId, deleteJobId, context, config, fetchImpl) {
  return supabaseRpc(config, "mcp_link_archive_intent_job", {
    p_installation_id: context.installation.id,
    p_intent_id: intentId,
    p_delete_job_id: deleteJobId,
    p_context: contextPayload(context)
  }, { fetchImpl });
}

async function executeArchive({ operation, targetType, targetId, claimRpc }, context, config, fetchImpl) {
  const claimedIntent = await claimIntent(operation, targetType, targetId, context, config, fetchImpl);
  const intent = object(claimedIntent.intent);
  if (!text(intent.id)) fail("archive_intent_invalid", 502);
  if (claimedIntent.mode === "replay" && intent.status === "completed") {
    return {
      data: object(intent.response_payload),
      meta: { idempotency: { replayed: true, intentId: intent.id } }
    };
  }

  let claim;
  try {
    claim = object(await supabaseRpc(config, claimRpc, {
      p_installation_id: context.installation.id,
      ...(targetType === "route" ? { p_route_id: targetId } : { p_route_customer_id: targetId }),
      p_context: contextPayload(context)
    }, { fetchImpl }));
  } catch (error) {
    const code = errorCode(error);
    const alreadyAbsent =
      (targetType === "route" && code === "route_not_found") ||
      (targetType === "route_customer" && code === "route_customer_not_found");
    if (alreadyAbsent && text(intent.delete_job_id)) {
      const payload = { targetId, deleteJobId: intent.delete_job_id, deleted: true, deletedMediaCount: 0 };
      await finishIntent(intent.id, true, payload, null, context, config, fetchImpl);
      return { data: payload, meta: { idempotency: { replayed: true, intentId: intent.id } } };
    }
    throw error;
  }

  const job = object(claim.deleteJob);
  const jobId = text(job.id);
  if (!jobId) fail("storage_delete_job_invalid", 502);
  await linkIntent(intent.id, jobId, context, config, fetchImpl);

  const deleted = await deleteClaimedRows(claim.media, context, config, fetchImpl);
  if (deleted.failed.length) {
    const code = targetType === "route" ? "route_media_delete_incomplete" : "route_customer_media_delete_incomplete";
    await finishDeleteJob(jobId, false, code, context, config, fetchImpl).catch(() => null);
    await finishIntent(intent.id, false, null, code, context, config, fetchImpl).catch(() => null);
    fail(code, 502, {
      targetId,
      deleteJobId: jobId,
      failedMediaIds: deleted.failed.map((item) => item.mediaId).filter(Boolean)
    });
  }

  let parentResult = null;
  try {
    parentResult = await hardDeleteParent(targetType, targetId, config, fetchImpl);
  } catch (error) {
    const code = errorCode(error);
    const alreadyAbsent =
      (targetType === "route" && code === "route_not_found") ||
      (targetType === "route_customer" && code === "route_customer_not_found");
    if (!alreadyAbsent) {
      await finishDeleteJob(jobId, false, code, context, config, fetchImpl).catch(() => null);
      await finishIntent(intent.id, false, null, code, context, config, fetchImpl).catch(() => null);
      throw error;
    }
  }

  const payload = {
    ...object(parentResult),
    targetId,
    deleted: true,
    deletedMediaCount: deleted.deletedCount,
    deleteJobId: jobId
  };
  await finishDeleteJob(jobId, true, null, context, config, fetchImpl);
  await finishIntent(intent.id, true, payload, null, context, config, fetchImpl);
  return {
    data: payload,
    meta: { idempotency: { replayed: false, intentId: intent.id } }
  };
}

export async function archiveRoute(routeIdInput, context, config, { fetchImpl = fetch } = {}) {
  const routeId = text(routeIdInput);
  if (!routeId) fail("route_id_required");
  try {
    return await executeArchive({
      operation: "route.archive",
      targetType: "route",
      targetId: routeId,
      claimRpc: "mcp_claim_route_media_delete"
    }, context, config, fetchImpl);
  } catch (error) {
    throw normalizeProviderError(error);
  }
}

export async function archiveRouteCustomer(routeCustomerIdInput, context, config, { fetchImpl = fetch } = {}) {
  const routeCustomerId = text(routeCustomerIdInput);
  if (!routeCustomerId) fail("route_customer_id_required");
  try {
    return await executeArchive({
      operation: "route-customer.archive",
      targetType: "route_customer",
      targetId: routeCustomerId,
      claimRpc: "mcp_claim_route_customer_media_delete"
    }, context, config, fetchImpl);
  } catch (error) {
    throw normalizeProviderError(error);
  }
}
