import { supabaseRest, supabaseRpc } from "./supabase-adapter.js";
import {
  addSessionCustomer,
  recordSessionCustomerResult
} from "./session-customer-mutations.js";
import {
  createSessionReportSnapshot,
  saveSessionReportAiResult
} from "./session-report-mutations.js";
import {
  createReportSettingGroup,
  createReportSettingItem,
  updateReportSettingGroup,
  updateReportSettingItem
} from "./report-setting-mutations.js";
import { updateFieldCheckResult } from "./field-check-mutations.js";

const MAX_JSON_BODY_BYTES = 2 * 1024 * 1024;

function text(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function badRequest(code) {
  const error = new Error(code);
  error.statusCode = 400;
  throw error;
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_JSON_BODY_BYTES) {
      const error = new Error("request_body_too_large");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(buffer);
  }
  if (chunks.length === 0) return {};
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    badRequest("invalid_json_body");
  }
}

function response(data, statusCode = 200) {
  return {
    statusCode,
    payload: {
      ...data,
      receivedAt: new Date().toISOString()
    }
  };
}

function boundedLimit(value) {
  const parsed = Number(value || 50);
  if (!Number.isFinite(parsed)) return 50;
  return Math.max(1, Math.min(Math.trunc(parsed), 100));
}

async function saveSessionCustomerResult(req, context, config, fetchImpl) {
  const body = await readJsonBody(req);
  const data = await recordSessionCustomerResult(body, context, config, { fetchImpl });
  return response({ data });
}

async function saveAddedSessionCustomer(req, context, config, fetchImpl) {
  const body = await readJsonBody(req);
  const data = await addSessionCustomer(body, context, config, { fetchImpl });
  return response({ data });
}

async function saveSessionReportSnapshot(req, context, config, fetchImpl) {
  const body = await readJsonBody(req);
  const data = await createSessionReportSnapshot(body, context, config, { fetchImpl });
  return response({ data });
}

async function saveSessionReportAi(req, context, config, fetchImpl) {
  const body = await readJsonBody(req);
  const data = await saveSessionReportAiResult(body, context, config, { fetchImpl });
  return response({ data });
}

async function saveFieldCheckResult(req, context, config, fetchImpl) {
  const body = await readJsonBody(req);
  const data = await updateFieldCheckResult(body, context, config, { fetchImpl });
  return response({ data });
}

async function createSettingGroup(req, context, config, fetchImpl) {
  const body = await readJsonBody(req);
  const data = await createReportSettingGroup(body, context, config, { fetchImpl });
  return response({ data });
}

async function updateSettingGroup(req, context, config, fetchImpl) {
  const body = await readJsonBody(req);
  const data = await updateReportSettingGroup(body, context, config, { fetchImpl });
  return response({ data });
}

async function createSettingItem(req, context, config, fetchImpl) {
  const body = await readJsonBody(req);
  const data = await createReportSettingItem(body, context, config, { fetchImpl });
  return response({ data });
}

async function updateSettingItem(req, context, config, fetchImpl) {
  const body = await readJsonBody(req);
  const data = await updateReportSettingItem(body, context, config, { fetchImpl });
  return response({ data });
}

async function loadReportTemplates(config, fetchImpl) {
  const rows = await supabaseRest(
    config,
    "mcp_report_templates?select=*&status=eq.active&order=sort_order.asc,title.asc",
    { fetchImpl }
  );
  const templates = (Array.isArray(rows) ? rows : []).map((row) => ({
    id: row.id,
    title: row.title,
    reportType: row.report_type,
    scopeType: row.scope_type || "global",
    content: row.content || "",
    priceSummary: row.price_summary || "",
    competitorSummary: row.competitor_summary || "",
    displaySummary: row.display_summary || "",
    stockSummary: row.stock_summary || "",
    demandSummary: row.demand_summary || "",
    opportunitySummary: row.opportunity_summary || "",
    riskSummary: row.risk_summary || "",
    nextAction: row.next_action || "",
    sortOrder: row.sort_order,
    note: row.note || "",
    meta: row.raw_payload || {}
  }));
  return response({ data: { templates } });
}

async function loadProductVariants(productId, config, fetchImpl) {
  if (!productId) badRequest("product_id_required");
  const data = await supabaseRpc(
    config,
    "mcp_get_product_variants",
    { p_product_id: productId },
    { fetchImpl }
  );
  return response({ data });
}

async function searchProducts(url, config, fetchImpl) {
  const data = await supabaseRpc(
    config,
    "mcp_search_products",
    {
      p_q: String(url.searchParams.get("q") || "").trim(),
      p_category: String(url.searchParams.get("category") || "").trim(),
      p_brand: String(url.searchParams.get("brand") || "").trim(),
      p_limit: boundedLimit(url.searchParams.get("limit"))
    },
    { fetchImpl }
  );
  return response({ data });
}

export async function handleTransitionalApi(
  req,
  url,
  context,
  config,
  { fetchImpl = fetch } = {}
) {
  const method = String(req.method || "GET").toUpperCase();
  const pathname = url.pathname;

  if (method === "POST" && pathname === "/api/mcp-day/session-customer/result") {
    return saveSessionCustomerResult(req, context, config, fetchImpl);
  }
  if (method === "POST" && pathname === "/api/mcp-day/session-customer/add") {
    return saveAddedSessionCustomer(req, context, config, fetchImpl);
  }
  if (method === "POST" && pathname === "/api/mcp-session-report") {
    return saveSessionReportSnapshot(req, context, config, fetchImpl);
  }
  if (method === "POST" && pathname === "/api/mcp-session-report/ai-result") {
    return saveSessionReportAi(req, context, config, fetchImpl);
  }
  if (method === "POST" && pathname === "/api/field-checks/result") {
    return saveFieldCheckResult(req, context, config, fetchImpl);
  }
  if (method === "POST" && pathname === "/api/mcp-report-setting-groups") {
    return createSettingGroup(req, context, config, fetchImpl);
  }
  if (method === "PATCH" && pathname === "/api/mcp-report-setting-groups") {
    return updateSettingGroup(req, context, config, fetchImpl);
  }
  if (method === "POST" && pathname === "/api/mcp-report-settings") {
    return createSettingItem(req, context, config, fetchImpl);
  }
  if (method === "PATCH" && pathname === "/api/mcp-report-settings") {
    return updateSettingItem(req, context, config, fetchImpl);
  }
  if (method === "GET" && pathname === "/api/mcp-report-templates") {
    return loadReportTemplates(config, fetchImpl);
  }
  if (method === "GET" && pathname === "/api/products/search") {
    return searchProducts(url, config, fetchImpl);
  }
  if (method === "GET") {
    const match = pathname.match(/^\/api\/products\/([^/]+)\/variants$/);
    if (match) {
      let productId;
      try {
        productId = decodeURIComponent(match[1]).trim();
      } catch {
        badRequest("invalid_product_id");
      }
      return loadProductVariants(productId, config, fetchImpl);
    }
  }

  return null;
}
