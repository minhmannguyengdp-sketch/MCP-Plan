import { randomUUID } from "node:crypto";
import { supabaseRest, supabaseRpc } from "./supabase-adapter.js";

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

function foundationMetadata(context) {
  return {
    requestId: context.requestId,
    installationId: context.installation.id,
    nppCode: context.installation.nppCode,
    actorId: context.actor.id,
    actorType: context.actor.type
  };
}

function firstRow(payload) {
  return Array.isArray(payload) ? payload[0] || null : payload;
}

function safeStatus(value) {
  const normalized = String(value || "normal").trim().toLowerCase();
  return ["normal", "opportunity", "risk"].includes(normalized)
    ? normalized
    : "normal";
}

function slug(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || `group_${Date.now()}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function boundedLimit(value) {
  const parsed = Number(value || 50);
  if (!Number.isFinite(parsed)) return 50;
  return Math.max(1, Math.min(Math.trunc(parsed), 100));
}

async function saveFieldCheckResult(req, context, config, fetchImpl) {
  const body = await readJsonBody(req);
  const resultId = text(body.resultId || body.result_id);
  const fileId = text(body.fileId || body.file_id);
  const customerId = text(body.customerId || body.customer_id);
  const productName = text(body.productName || body.product_name);

  if (!productName) badRequest("product_name_required");
  if (!resultId && (!fileId || !customerId)) {
    badRequest("file_id_and_customer_id_required");
  }

  const payload = {
    product_id: text(body.productId || body.product_id),
    product_name: productName,
    status: safeStatus(body.status),
    note: text(body.note),
    sync_status: "pending",
    raw_payload: {
      ...body,
      source: "field_checks_session_admin",
      session_id: text(body.sessionId || body.session_id),
      session_customer_id: text(body.sessionCustomerId || body.session_customer_id),
      route_id: text(body.routeId || body.route_id),
      session_date: text(body.sessionDate || body.session_date),
      foundation_context: foundationMetadata(context)
    }
  };

  const data = resultId
    ? await supabaseRest(
        config,
        `test_customer_results?id=eq.${encodeURIComponent(resultId)}&select=*`,
        {
          method: "PATCH",
          body: payload,
          prefer: "return=representation",
          fetchImpl
        }
      )
    : await supabaseRest(config, "test_customer_results?select=*", {
        method: "POST",
        body: {
          id: `test-result-${randomUUID()}`,
          file_id: fileId,
          customer_id: customerId,
          ...payload
        },
        prefer: "return=representation",
        fetchImpl
      });

  return response({ data: firstRow(data) });
}

async function saveMarketReport(req, context, config, fetchImpl) {
  const body = await readJsonBody(req);
  const selected = body.selected && typeof body.selected === "object" ? body.selected : {};
  const fields = body.fields && typeof body.fields === "object" ? body.fields : {};
  const payload = {
    report_date: text(body.reportDate) || today(),
    sales: text(body.sales || body.owner),
    market_area: text(body.marketArea || body.area),
    route_name: text(body.routeName),
    market_type: text(body.reportType) || "market_report",
    competitor_summary: text(fields.competitorSummary || body.competitorSummary),
    price_summary: text(fields.priceSummary || body.priceSummary),
    demand_summary: text(fields.demandSummary || body.demandSummary),
    company_product_summary: text(fields.companyProductSummary || body.companyProductSummary),
    opportunity_summary: text(fields.opportunitySummary || body.opportunitySummary),
    risk_summary: text(fields.riskSummary || body.riskSummary),
    next_action: text(fields.nextAction || body.nextAction),
    note: text(body.content || body.note),
    sync_status: "mcp_session",
    raw_payload: {
      source: "mcp_market_report_api",
      sessionCustomerId: body.sessionCustomerId || null,
      templateId: body.templateId || null,
      selected,
      fields,
      content: body.content || body.note || "",
      foundation_context: foundationMetadata(context)
    }
  };
  const data = await supabaseRest(config, "market_reports", {
    method: "POST",
    body: payload,
    prefer: "return=representation",
    fetchImpl
  });
  return response({ data });
}

async function createSettingGroup(req, context, config, fetchImpl) {
  const body = await readJsonBody(req);
  const title = String(body.title || "").trim();
  if (!title) badRequest("title_required");
  const meta = body.meta && typeof body.meta === "object" ? body.meta : {};
  const payload = {
    group_key: String(body.key || slug(title)).trim(),
    title,
    group_type: String(body.groupType || "market_report"),
    description: String(body.description || "").trim() || null,
    sort_order: Number(body.sortOrder || 0),
    status: String(body.status || "active"),
    raw_payload: {
      ...meta,
      foundation_context: foundationMetadata(context)
    }
  };
  const data = await supabaseRest(config, "mcp_setting_groups", {
    method: "POST",
    body: payload,
    prefer: "return=representation",
    fetchImpl
  });
  return response({ data });
}

async function updateSettingGroup(req, context, config, fetchImpl) {
  const body = await readJsonBody(req);
  const groupId = String(body.groupId || "").trim();
  if (!groupId) badRequest("group_id_required");
  const payload = { updated_at: new Date().toISOString() };
  if (body.title !== undefined) payload.title = String(body.title || "").trim();
  if (body.description !== undefined) payload.description = String(body.description || "").trim() || null;
  if (body.sortOrder !== undefined) payload.sort_order = Number(body.sortOrder || 0);
  if (body.status !== undefined) payload.status = String(body.status || "active");
  if (body.meta !== undefined) {
    const meta = body.meta && typeof body.meta === "object" ? body.meta : {};
    payload.raw_payload = {
      ...meta,
      foundation_context: foundationMetadata(context)
    };
  }
  const data = await supabaseRest(
    config,
    `mcp_setting_groups?id=eq.${encodeURIComponent(groupId)}`,
    {
      method: "PATCH",
      body: payload,
      prefer: "return=representation",
      fetchImpl
    }
  );
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

  if (method === "POST" && pathname === "/api/field-checks/result") {
    return saveFieldCheckResult(req, context, config, fetchImpl);
  }
  if (method === "POST" && pathname === "/api/mcp-market-reports") {
    return saveMarketReport(req, context, config, fetchImpl);
  }
  if (method === "POST" && pathname === "/api/mcp-report-setting-groups") {
    return createSettingGroup(req, context, config, fetchImpl);
  }
  if (method === "PATCH" && pathname === "/api/mcp-report-setting-groups") {
    return updateSettingGroup(req, context, config, fetchImpl);
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
