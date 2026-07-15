import { supabaseRpc } from "./supabase-adapter.js";

function text(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function badRequest(code) {
  const error = new Error(code);
  error.statusCode = 400;
  throw error;
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function optionalBoolean(body, camelKey, snakeKey) {
  const hasCamel = hasOwn(body, camelKey);
  const hasSnake = hasOwn(body, snakeKey);
  if (!hasCamel && !hasSnake) return null;

  const value = hasCamel ? body[camelKey] : body[snakeKey];
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;

  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "y", "co", "có"].includes(normalized)) return true;
  if (["false", "0", "no", "n", "khong", "không"].includes(normalized)) return false;
  badRequest(`invalid_${snakeKey}`);
}

function foundationContext(context) {
  return {
    requestId: context.requestId,
    installationId: context.installation.id,
    nppCode: context.installation.nppCode,
    actorId: context.actor.id,
    actorType: context.actor.type,
    actorAuthentication: context.actor.authentication || null
  };
}

function normalizeMutationError(error) {
  const message = String(error?.providerMessage || error?.message || "");
  if (message.includes("not_found")) error.statusCode = 404;
  else if (
    message.includes("closed") ||
    message.includes("read_only") ||
    message.includes("cancelled") ||
    message.includes("has_activity") ||
    message.includes("already_exists")
  ) error.statusCode = 409;
  else if (
    message.includes("required") ||
    message.includes("invalid_") ||
    message.includes("route_mismatch") ||
    message.includes("result_required")
  ) error.statusCode = 400;
  return error;
}

function resultInputPresent(body, resultType, note, orderId, testId, reportId) {
  return Boolean(
    resultType ||
    note ||
    orderId ||
    testId ||
    reportId ||
    hasOwn(body, "hasOrder") ||
    hasOwn(body, "has_order") ||
    hasOwn(body, "hasTest") ||
    hasOwn(body, "has_test") ||
    hasOwn(body, "hasReport") ||
    hasOwn(body, "has_report")
  );
}

export async function recordSessionCustomerResult(
  body,
  context,
  config,
  { fetchImpl = fetch } = {}
) {
  const sessionCustomerId = text(body.sessionCustomerId || body.session_customer_id || body.id);
  const resultType = text(body.resultType || body.result_type || body.type)?.toLowerCase() || null;
  const note = text(body.note || body.result || body.resultNote || body.result_note);
  const orderId = text(body.orderId || body.order_id);
  const testId = text(body.testId || body.test_id);
  const reportId = text(body.reportId || body.report_id);

  if (!sessionCustomerId) badRequest("session_customer_id_required");
  if (resultType && !["order", "test", "report"].includes(resultType)) {
    badRequest("invalid_result_type");
  }
  if (!resultInputPresent(body, resultType, note, orderId, testId, reportId)) {
    badRequest("result_required");
  }

  try {
    return await supabaseRpc(
      config,
      "mcp_record_session_customer_result",
      {
        p_session_customer_id: sessionCustomerId,
        p_result_type: resultType,
        p_note: note,
        p_order_id: orderId,
        p_test_id: testId,
        p_report_id: reportId,
        p_has_order: optionalBoolean(body, "hasOrder", "has_order"),
        p_has_test: optionalBoolean(body, "hasTest", "has_test"),
        p_has_report: optionalBoolean(body, "hasReport", "has_report"),
        p_context: foundationContext(context)
      },
      { fetchImpl }
    );
  } catch (error) {
    throw normalizeMutationError(error);
  }
}

export async function addSessionCustomer(
  body,
  context,
  config,
  { fetchImpl = fetch } = {}
) {
  const sessionId = text(body.sessionId || body.session_id);
  const customerName = text(body.customerName || body.customer_name || body.accountName || body.account_name);

  if (!sessionId) badRequest("session_id_required");
  if (!customerName) badRequest("customer_name_required");

  try {
    return await supabaseRpc(
      config,
      "mcp_add_session_customer",
      {
        p_session_id: sessionId,
        p_customer_name: customerName,
        p_route_customer_id: text(body.routeCustomerId || body.route_customer_id),
        p_customer_id: text(body.customerId || body.customer_id),
        p_phone: text(body.phone),
        p_area: text(body.area),
        p_address: text(body.address),
        p_note: text(body.note),
        p_context: foundationContext(context)
      },
      { fetchImpl }
    );
  } catch (error) {
    throw normalizeMutationError(error);
  }
}
