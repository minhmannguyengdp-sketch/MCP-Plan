import fs from "node:fs";

function replaceOnce(source, label, from, to) {
  if (!source.includes(from)) throw new Error(`${label}: marker not found`);
  return source.replace(from, to);
}

function replaceRegexOnce(source, label, pattern, to) {
  if (!pattern.test(source)) throw new Error(`${label}: pattern not found`);
  pattern.lastIndex = 0;
  return source.replace(pattern, to);
}

const backendPath = "apps/backend/server.js";
let backend = fs.readFileSync(backendPath, "utf8");

const backendBlock = `
function v1Object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function v1Text(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function v1NumberOrNull(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function v1PathId(pathname, prefix, suffix = "") {
  if (!pathname.startsWith(prefix) || (suffix && !pathname.endsWith(suffix))) return null;
  const end = suffix ? pathname.length - suffix.length : pathname.length;
  const encoded = pathname.slice(prefix.length, end);
  if (!encoded || encoded.includes("/")) return null;
  try {
    return decodeURIComponent(encoded).trim() || null;
  } catch {
    throw badRequest("invalid_path_id");
  }
}

function mcpV1ErrorStatus(error) {
  const message = String(error?.message || "");
  if (message.includes("not_found") || message.includes("no_data_found")) return 404;
  if (
    message.includes("closed") ||
    message.includes("has_activity") ||
    message.includes("read_only") ||
    message.includes("duplicate key") ||
    message.includes("already exists")
  ) return 409;
  if (
    message.includes("required") ||
    message.includes("invalid_") ||
    message.includes("inactive") ||
    message.includes("not_resolved")
  ) return 400;
  return Number(error?.statusCode || 500);
}

async function openMcpDaySessionV1(body) {
  const routeId = v1Text(body.routeId || body.route_id);
  const sessionDate = String(body.sessionDate || body.session_date || body.date || todayDateOnly()).slice(0, 10);
  const owner = v1Text(body.owner || body.sales || body.salesOwner || body.sales_owner);
  if (!routeId) throw badRequest("route_id_required");
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(sessionDate)) throw badRequest("invalid_session_date");
  return supabaseRpc("mcp_open_route_session", {
    p_route_id: routeId,
    p_session_date: sessionDate,
    p_owner: owner
  });
}

async function updateMcpSessionCustomerStatusV1(body) {
  const sessionCustomerId = v1Text(body.sessionCustomerId || body.session_customer_id || body.id);
  const visitStatus = String(body.visitStatus || body.visit_status || body.status || "visited").trim().toLowerCase();
  if (!sessionCustomerId) throw badRequest("session_customer_id_required");
  if (!["pending", "visited", "skipped", "cancelled"].includes(visitStatus)) throw badRequest("invalid_visit_status");
  return supabaseRpc("mcp_set_session_customer_status", {
    p_session_customer_id: sessionCustomerId,
    p_visit_status: visitStatus,
    p_status_reason: v1Text(body.statusReason || body.status_reason || body.reason),
    p_note: v1Text(body.note)
  });
}

function normalizeMcpOrderItemsV1(items) {
  if (!Array.isArray(items) || items.length === 0) throw badRequest("order_items_required");
  return items.map((item) => {
    const row = v1Object(item);
    const productName = String(row.productName || row.product_name || "").trim();
    const quantity = Number(row.quantity || 0);
    const unitPrice = Number(row.unitPrice ?? row.unit_price ?? 0);
    const discount = Number(row.discount || 0);
    if (!productName) throw badRequest("product_name_required");
    if (!Number.isFinite(quantity) || quantity <= 0) throw badRequest("quantity_required");
    if (!Number.isFinite(unitPrice) || unitPrice < 0) throw badRequest("invalid_unit_price");
    if (!Number.isFinite(discount) || discount < 0) throw badRequest("invalid_discount");
    return {
      productId: v1Text(row.productId || row.product_id),
      variantId: v1Text(row.variantId || row.variant_id),
      productName,
      sku: v1Text(row.sku),
      unit: v1Text(row.unit),
      quantity,
      unitPrice,
      discount,
      note: v1Text(row.note)
    };
  });
}

async function createMcpSessionCustomerOrderV1(body) {
  const sessionCustomerId = v1Text(body.sessionCustomerId || body.session_customer_id || body.id);
  if (!sessionCustomerId) throw badRequest("session_customer_id_required");
  return supabaseRpc("mcp_create_order_from_session_customer", {
    p_session_customer_id: sessionCustomerId,
    p_items: normalizeMcpOrderItemsV1(body.items),
    p_note: v1Text(body.note),
    p_status: v1Text(body.status) || "confirmed"
  });
}

const MCP_TEST_RESULT_STATUSES_V1 = new Set(["pending", "tested", "ok", "interested", "sample", "follow", "bad", "retry"]);

function normalizeMcpTestResultsV1(body) {
  const input = Array.isArray(body.results) ? body.results : Array.isArray(body.items) ? body.items : [];
  if (input.length === 0) throw badRequest("test_results_required");
  return input.map((item) => {
    const row = v1Object(item);
    const productId = v1Text(row.productId || row.product_id);
    const productName = v1Text(row.productName || row.product_name);
    const status = String(row.status || body.testStatus || body.test_status || "tested").trim().toLowerCase();
    if (!productId && !productName) throw badRequest("product_name_required");
    if (!MCP_TEST_RESULT_STATUSES_V1.has(status)) throw badRequest("invalid_test_status");
    return { productId, productName, status, note: v1Text(row.note) };
  });
}

async function createMcpSessionCustomerTestV1(body) {
  const sessionCustomerId = v1Text(body.sessionCustomerId || body.session_customer_id || body.id);
  if (!sessionCustomerId) throw badRequest("session_customer_id_required");
  return supabaseRpc("mcp_create_test_from_session_customer", {
    p_session_customer_id: sessionCustomerId,
    p_file_id: v1Text(body.fileId || body.file_id || body.testFileId || body.test_file_id),
    p_file_title: v1Text(body.fileTitle || body.file_title) || "Test nhanh từ checklist",
    p_results: normalizeMcpTestResultsV1(body),
    p_note: v1Text(body.note),
    p_status: v1Text(body.customerStatus || body.customer_status) || "tested"
  });
}

function normalizeMcpReportSelectionV1(value) {
  return Array.isArray(value)
    ? value.map((item) => {
        const row = v1Object(item);
        return {
          id: String(row.id || row.key || row.value || row.label || "").trim(),
          label: v1Text(row.label),
          value: v1Text(row.value),
          groupTitle: v1Text(row.groupTitle),
          category: v1Text(row.category),
          brandName: v1Text(row.brandName),
          productId: v1Text(row.productId)
        };
      }).filter((item) => item.id)
    : [];
}

function mcpReportSelectionIdsV1(items) {
  return Array.from(new Set(items.map((item) => item.id).filter(Boolean)));
}

function mcpReportFallbackContentV1(fields, competitors, products, context) {
  const parts = [];
  if (competitors.length) parts.push("Đối thủ: " + competitors.map((item) => item.label || item.value || item.id).join(", "));
  if (products.length) parts.push("Sản phẩm đang dùng: " + products.map((item) => item.label || item.value || item.id).join(", "));
  ["priceSummary", "competitorSummary", "displaySummary", "stockSummary", "demandSummary", "opportunitySummary", "riskSummary", "nextAction", "note"].forEach((key) => {
    const value = v1Text(fields[key]);
    if (value) parts.push(value);
  });
  return parts.join("\\n") || "Báo cáo thị trường: " + (v1Text(context.customerName || context.customer_name) || "khách trong phiên");
}

async function createMcpSessionCustomerReportV1(body) {
  const sessionCustomerId = v1Text(body.sessionCustomerId || body.session_customer_id || body.id);
  if (!sessionCustomerId) throw badRequest("session_customer_id_required");
  const fields = v1Object(body.fields);
  const selected = v1Object(body.selected);
  const context = v1Object(body.context);
  const competitors = normalizeMcpReportSelectionV1(selected.competitors);
  const usedProducts = normalizeMcpReportSelectionV1(selected.usedProducts);
  const settingItems = normalizeMcpReportSelectionV1(selected.settingItems);
  const allItems = settingItems.length ? settingItems : [...competitors, ...usedProducts];
  const reportType = String(body.reportType || body.report_type || "market_report").trim().toLowerCase();
  const allowed = new Set(["market_report", "price", "competitor", "display", "stock", "demand", "general"]);
  if (!allowed.has(reportType)) throw badRequest("invalid_report_type");
  const content = v1Text(body.content) || mcpReportFallbackContentV1(fields, competitors, usedProducts.length ? usedProducts : allItems, context);
  return supabaseRpc("mcp_create_report_from_session_customer", {
    p_session_customer_id: sessionCustomerId,
    p_report_type: reportType,
    p_content: content,
    p_price_summary: v1Text(fields.priceSummary),
    p_competitor_summary: v1Text(fields.competitorSummary),
    p_display_summary: v1Text(fields.displaySummary),
    p_stock_summary: v1Text(fields.stockSummary),
    p_demand_summary: v1Text(fields.demandSummary),
    p_opportunity_summary: v1Text(fields.opportunitySummary),
    p_risk_summary: v1Text(fields.riskSummary),
    p_next_action: v1Text(fields.nextAction),
    p_note: v1Text(fields.note) || content,
    p_raw_payload: {
      context,
      fields,
      selected: { competitors, usedProducts, settingItems: allItems },
      inputSessionCustomerId: v1Text(body.sessionCustomerId || body.session_customer_id),
      resolvedSessionCustomerId: sessionCustomerId
    },
    p_selected_competitor_ids: mcpReportSelectionIdsV1(competitors),
    p_selected_used_product_ids: mcpReportSelectionIdsV1(usedProducts),
    p_selected_setting_item_ids: mcpReportSelectionIdsV1(allItems)
  });
}

async function createMcpSessionCustomerFollowupV1(body) {
  const sessionCustomerId = v1Text(body.sessionCustomerId || body.session_customer_id || body.id);
  const title = v1Text(body.title || body.followupTitle || body.followup_title);
  const priority = String(body.priority || "medium").trim().toLowerCase();
  if (!sessionCustomerId) throw badRequest("session_customer_id_required");
  if (!title) throw badRequest("followup_title_required");
  if (!["low", "medium", "high", "urgent"].includes(priority)) throw badRequest("invalid_priority");
  return supabaseRpc("mcp_create_followup_from_session_customer", {
    p_session_customer_id: sessionCustomerId,
    p_title: title,
    p_due_date: v1Text(body.dueDate || body.due_date),
    p_priority: priority,
    p_owner: v1Text(body.owner),
    p_note: v1Text(body.note),
    p_followup_type: v1Text(body.followupType || body.followup_type || body.type) || "general"
  });
}

async function createMcpSessionReportSnapshotV1(body) {
  const sessionId = v1Text(body.sessionId || body.session_id);
  if (!sessionId) throw badRequest("session_id_required");
  return supabaseRpc("mcp_create_session_report_snapshot", {
    p_session_id: sessionId,
    p_source: v1Text(body.source) || "manual_snapshot"
  });
}

function mcpSettingSlugV1(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "item_" + Date.now();
}

function normalizeMcpSettingGroupV1(group, items) {
  return {
    id: group.id,
    key: group.group_key,
    title: group.title,
    type: group.group_type,
    description: group.description || "",
    status: group.status,
    sortOrder: group.sort_order,
    meta: group.raw_payload || {},
    items: items.filter((item) => item.group_id === group.id).map((item) => ({
      id: item.id,
      key: item.item_key,
      label: item.label,
      value: item.value || item.label,
      category: item.category || "",
      brandName: item.brand_name || "",
      productId: item.product_id || "",
      status: item.status,
      sortOrder: item.sort_order,
      meta: item.raw_payload || {}
    }))
  };
}

async function loadMcpReportSettingsV1(url) {
  const groupType = String(url.searchParams.get("groupType") || "market_report").trim();
  const includeInactive = url.searchParams.get("includeInactive") === "1";
  const groupParams = { select: "*", group_type: "eq." + groupType, order: "sort_order.asc,title.asc", limit: 1000 };
  const itemParams = { select: "*", order: "sort_order.asc,label.asc", limit: 5000 };
  if (!includeInactive) {
    groupParams.status = "eq.active";
    itemParams.status = "eq.active";
  }
  const [groups, items] = await Promise.all([
    supabaseGet("mcp_setting_groups", groupParams),
    supabaseGet("mcp_setting_items", itemParams)
  ]);
  const groupIds = new Set(groups.map((group) => group.id));
  const scopedItems = items.filter((item) => groupIds.has(item.group_id));
  return { groups: groups.map((group) => normalizeMcpSettingGroupV1(group, scopedItems)) };
}

async function createMcpReportSettingV1(body) {
  const groupId = v1Text(body.groupId || body.group_id);
  const label = v1Text(body.label);
  if (!groupId) throw badRequest("group_id_required");
  if (!label) throw badRequest("label_required");
  const groups = await supabaseGet("mcp_setting_groups", { select: "id", id: "eq." + groupId, limit: 1 });
  if (!groups[0]) throw badRequest("setting_group_not_found");
  const rows = await supabaseInsert("mcp_setting_items", {
    id: randomId("msi"),
    group_id: groupId,
    item_key: v1Text(body.key) || mcpSettingSlugV1(label),
    label,
    value: v1Text(body.value) || label,
    category: v1Text(body.category),
    brand_name: v1Text(body.brandName || body.brand_name),
    product_id: v1Text(body.productId || body.product_id),
    sort_order: Number(body.sortOrder || body.sort_order || 0),
    status: v1Text(body.status) || "active",
    raw_payload: v1Object(body.meta)
  });
  return rows[0] || null;
}

async function updateMcpReportSettingV1(body) {
  const itemId = v1Text(body.itemId || body.item_id);
  if (!itemId) throw badRequest("item_id_required");
  const values = { updated_at: new Date().toISOString() };
  if (body.label !== undefined) values.label = v1Text(body.label);
  if (body.value !== undefined) values.value = v1Text(body.value);
  if (body.category !== undefined) values.category = v1Text(body.category);
  if (body.brandName !== undefined || body.brand_name !== undefined) values.brand_name = v1Text(body.brandName || body.brand_name);
  if (body.productId !== undefined || body.product_id !== undefined) values.product_id = v1Text(body.productId || body.product_id);
  if (body.sortOrder !== undefined || body.sort_order !== undefined) values.sort_order = Number(body.sortOrder || body.sort_order || 0);
  if (body.status !== undefined) values.status = v1Text(body.status) || "active";
  if (body.meta !== undefined) values.raw_payload = v1Object(body.meta);
  const rows = await supabasePatch("mcp_setting_items", values, { id: "eq." + itemId });
  if (!rows[0]) throw badRequest("setting_item_not_found");
  return rows[0];
}

async function createMcpRouteV1(body) {
  return supabaseRpc("mcp_create_route", {
    p_route_name: v1Text(body.routeName || body.route_name || body.name),
    p_area: v1Text(body.area),
    p_weekday: body.weekday === undefined || body.weekday === "" ? null : Number(body.weekday),
    p_note: v1Text(body.note),
    p_distributor_id: v1Text(body.distributorId || body.distributor_id)
  });
}

async function updateMcpRouteV1(routeId, body) {
  return supabaseRpc("mcp_update_route", {
    p_route_id: routeId,
    p_route_name: body.routeName === undefined && body.route_name === undefined && body.name === undefined ? null : v1Text(body.routeName || body.route_name || body.name),
    p_area: body.area === undefined ? null : v1Text(body.area),
    p_weekday: body.weekday === undefined || body.weekday === "" ? null : Number(body.weekday),
    p_note: body.note === undefined ? null : v1Text(body.note),
    p_active: body.active === undefined ? null : Boolean(body.active),
    p_distributor_id: body.distributorId === undefined && body.distributor_id === undefined ? null : v1Text(body.distributorId || body.distributor_id)
  });
}

async function createMcpRouteCustomerV1(body) {
  const routeId = v1Text(body.routeId || body.route_id);
  const customerName = v1Text(body.customerName || body.customer_name || body.accountName || body.name);
  if (!routeId) throw badRequest("route_id_required");
  if (!customerName) throw badRequest("customer_name_required");
  const geoLat = v1NumberOrNull(body.geoLat ?? body.geo_lat);
  const geoLng = v1NumberOrNull(body.geoLng ?? body.geo_lng);
  const mapsUrl = v1Text(body.googleMapsUrl || body.google_maps_url) || (geoLat !== null && geoLng !== null ? "https://www.google.com/maps/search/?api=1&query=" + geoLat + "," + geoLng : null);
  return supabaseRpc("mcp_create_route_customer", {
    p_route_id: routeId,
    p_customer_name: customerName,
    p_phone: v1Text(body.phone),
    p_area: v1Text(body.area),
    p_address: v1Text(body.address),
    p_sort_order: Number(body.sortOrder || body.sort_order || 0),
    p_note: v1Text(body.note),
    p_customer_id: v1Text(body.customerId || body.customer_id),
    p_geo_lat: geoLat,
    p_geo_lng: geoLng,
    p_geo_accuracy: v1NumberOrNull(body.geoAccuracy ?? body.geo_accuracy),
    p_geo_source: v1Text(body.geoSource || body.geo_source) || (geoLat !== null && geoLng !== null ? "browser" : null),
    p_google_maps_url: mapsUrl
  });
}

async function updateMcpRouteCustomerV1(routeCustomerId, body) {
  const geoLat = v1NumberOrNull(body.geoLat ?? body.geo_lat);
  const geoLng = v1NumberOrNull(body.geoLng ?? body.geo_lng);
  const mapsUrl = v1Text(body.googleMapsUrl || body.google_maps_url) || (geoLat !== null && geoLng !== null ? "https://www.google.com/maps/search/?api=1&query=" + geoLat + "," + geoLng : null);
  return supabaseRpc("mcp_update_route_customer", {
    p_route_customer_id: routeCustomerId,
    p_customer_name: body.customerName === undefined && body.customer_name === undefined && body.accountName === undefined && body.name === undefined ? null : v1Text(body.customerName || body.customer_name || body.accountName || body.name),
    p_phone: body.phone === undefined ? null : v1Text(body.phone),
    p_area: body.area === undefined ? null : v1Text(body.area),
    p_address: body.address === undefined ? null : v1Text(body.address),
    p_sort_order: body.sortOrder === undefined && body.sort_order === undefined ? null : Number(body.sortOrder || body.sort_order || 0),
    p_note: body.note === undefined ? null : v1Text(body.note),
    p_active: body.active === undefined ? null : Boolean(body.active),
    p_geo_lat: geoLat,
    p_geo_lng: geoLng,
    p_geo_accuracy: v1NumberOrNull(body.geoAccuracy ?? body.geo_accuracy),
    p_geo_source: v1Text(body.geoSource || body.geo_source),
    p_google_maps_url: mapsUrl
  });
}
`;

backend = replaceOnce(
  backend,
  "insert MCP v1 backend functions",
  "\nfunction normalizeOrderItems(items) {",
  `${backendBlock}\nfunction normalizeOrderItems(items) {`
);

backend = replaceRegexOnce(
  backend,
  "replace PATCH router",
  /async function handlePatch\(req, url\) \{[\s\S]*?\n\}\n\nasync function handleDelete/,
  `async function handlePatch(req, url) {
  const sessionId = mcpSessionIdFromPath(url);
  if (sessionId) return wrap(await updateMcpRouteSession(sessionId, await readJsonBody(req)));

  const routeId = v1PathId(url.pathname, "/api/routes/");
  if (routeId) return wrap(await updateMcpRouteV1(routeId, await readJsonBody(req)));

  const routeCustomerId = v1PathId(url.pathname, "/api/route-customers/");
  if (routeCustomerId) return wrap(await updateMcpRouteCustomerV1(routeCustomerId, await readJsonBody(req)));

  if (url.pathname === "/api/mcp-report-settings") return wrap(await updateMcpReportSettingV1(await readJsonBody(req)));

  const error = new Error("not_found");
  error.statusCode = 404;
  throw error;
}

async function handleDelete`
);

backend = replaceOnce(
  backend,
  "replace open session handler",
  '  if (url.pathname === "/api/mcp-day/open-session") return wrap(await openMcpDaySession(await readJsonBody(req)));',
  '  if (url.pathname === "/api/mcp-day/open-session") return wrap(await openMcpDaySessionV1(await readJsonBody(req)));'
);
backend = replaceOnce(
  backend,
  "replace status handler",
  '  if (url.pathname === "/api/mcp-day/session-customer/status") return wrap(await updateMcpSessionCustomerStatus(await readJsonBody(req)));',
  '  if (url.pathname === "/api/mcp-day/session-customer/status") return wrap(await updateMcpSessionCustomerStatusV1(await readJsonBody(req)));'
);
backend = replaceOnce(
  backend,
  "replace order handler",
  '  if (url.pathname === "/api/mcp-day/session-customer/order") return wrap(await createMcpSessionCustomerOrder(await readJsonBody(req)));',
  '  if (url.pathname === "/api/mcp-day/session-customer/order") return wrap(await createMcpSessionCustomerOrderV1(await readJsonBody(req)));'
);
backend = replaceOnce(
  backend,
  "replace test handler",
  '  if (url.pathname === "/api/mcp-day/session-customer/test") return wrap(await createMcpSessionCustomerTest(await readJsonBody(req)));',
  '  if (url.pathname === "/api/mcp-day/session-customer/test") return wrap(await createMcpSessionCustomerTestV1(await readJsonBody(req)));'
);
backend = replaceOnce(
  backend,
  "replace report handler",
  '  if (url.pathname === "/api/mcp-day/session-customer/report") return wrap(await createMcpSessionCustomerReport(await readJsonBody(req)));',
  '  if (url.pathname === "/api/mcp-day/session-customer/report") return wrap(await createMcpSessionCustomerReportV1(await readJsonBody(req)));'
);
backend = replaceOnce(
  backend,
  "replace followup handler",
  '  if (url.pathname === "/api/mcp-day/session-customer/followup") return wrap(await createMcpSessionCustomerFollowup(await readJsonBody(req)));',
  '  if (url.pathname === "/api/mcp-day/session-customer/followup") return wrap(await createMcpSessionCustomerFollowupV1(await readJsonBody(req)));'
);

backend = replaceOnce(
  backend,
  "add MCP v1 POST routes",
  "async function handlePost(req, url) {\n",
  `async function handlePost(req, url) {
  if (url.pathname === "/api/routes") return wrap(await createMcpRouteV1(await readJsonBody(req)));
  const routeArchiveId = v1PathId(url.pathname, "/api/routes/", "/archive");
  if (routeArchiveId) return wrap(await supabaseRpc("mcp_delete_route_hard", { p_route_id: routeArchiveId }));
  if (url.pathname === "/api/route-customers") return wrap(await createMcpRouteCustomerV1(await readJsonBody(req)));
  const routeCustomerArchiveId = v1PathId(url.pathname, "/api/route-customers/", "/archive");
  if (routeCustomerArchiveId) return wrap(await supabaseRpc("mcp_delete_route_customer_hard", { p_route_customer_id: routeCustomerArchiveId }));
  if (url.pathname === "/api/mcp-report-settings") return wrap(await createMcpReportSettingV1(await readJsonBody(req)));
  if (url.pathname === "/api/mcp-session-report") return wrap(await createMcpSessionReportSnapshotV1(await readJsonBody(req)));
`
);

backend = replaceOnce(
  backend,
  "add MCP v1 GET settings route",
  '  if (url.pathname === "/" || url.pathname === "/health" || url.pathname === "/api/health") return healthPayload();',
  '  if (url.pathname === "/" || url.pathname === "/health" || url.pathname === "/api/health") return healthPayload();\n  if (url.pathname === "/api/mcp-report-settings") return wrap(await loadMcpReportSettingsV1(url));'
);

backend = replaceOnce(
  backend,
  "map backend error status",
  '  handler.then((payload) => json(res, 200, payload)).catch((error) => json(res, error.statusCode || 500, { ok: false, service: SERVICE, error: error.message || "internal_error", detail: error.detail, table: error.table, path: url.pathname }));',
  '  handler.then((payload) => json(res, 200, payload)).catch((error) => json(res, mcpV1ErrorStatus(error), { ok: false, service: SERVICE, error: error.message || "internal_error", detail: error.detail, table: error.table, path: url.pathname }));'
);

fs.writeFileSync(backendPath, backend, "utf8");

const uiPath = "src/features/mcp/McpSessionCompactViewFinal2.tsx";
let ui = fs.readFileSync(uiPath, "utf8");

ui = replaceOnce(
  ui,
  "extend action draft",
  'type ActionDraft = { productName: string; note: string; skipReason: string; dueDate: string; priority: string; owner: string };',
  'type ActionDraft = { productName: string; note: string; skipReason: string; dueDate: string; priority: string; owner: string; testStatus: string; followupType: string };'
);
ui = replaceOnce(
  ui,
  "initialize action draft",
  '  return { productName: "", note: "", skipReason: "", dueDate: "", priority: "medium", owner };',
  '  return { productName: "", note: "", skipReason: "", dueDate: "", priority: "medium", owner, testStatus: "tested", followupType: "general" };'
);
ui = replaceOnce(
  ui,
  "add test statuses",
  'const TEST_NOTE_CHIPS = ["Khách muốn thử", "Gửi mẫu", "Test vị mới", "Đạt", "Chưa đạt", "Báo giá sau test"];',
  'const TEST_NOTE_CHIPS = ["Khách muốn thử", "Gửi mẫu", "Test vị mới", "Đạt", "Chưa đạt", "Báo giá sau test"];\nconst TEST_STATUS_OPTIONS = [{ value: "tested", label: "Đã test" }, { value: "ok", label: "Đạt" }, { value: "interested", label: "Quan tâm" }, { value: "sample", label: "Đã gửi mẫu" }, { value: "follow", label: "Cần theo dõi" }, { value: "retry", label: "Test lại" }, { value: "bad", label: "Chưa đạt" }];'
);

ui = replaceRegexOnce(
  ui,
  "replace test form",
  /function TestFields\([\s\S]*?\n\}\n\nfunction FollowUpFields/,
  `function TestFields({ draft, saving, onChange }: { draft: ActionDraft; saving: boolean; onChange: (field: keyof ActionDraft, value: string) => void }) {
  return <div className="report-popup-grid"><section className="report-quick-panel"><div className="report-section-head"><strong>Test nhanh</strong><small>Chọn sản phẩm, trạng thái test và ghi chú thực tế.</small></div><div className="report-quick-group"><strong>Sản phẩm thường test</strong><div className="report-chip-grid">{TEST_PRODUCT_CHIPS.map((label) => <QuickChip key={label} active={draft.productName === label} disabled={saving} onClick={() => onChange("productName", draft.productName === label ? "" : label)}>{label}</QuickChip>)}</div></div><label className="form-field report-field"><small>Sản phẩm test khác</small><input value={draft.productName} onChange={(event) => onChange("productName", event.target.value)} disabled={saving} placeholder="Nhập nhanh nếu chưa có chip" /></label><div className="report-quick-group"><strong>Kết quả test</strong><div className="report-chip-grid">{TEST_STATUS_OPTIONS.map((item) => <QuickChip key={item.value} active={draft.testStatus === item.value} disabled={saving} onClick={() => onChange("testStatus", item.value)}>{item.label}</QuickChip>)}</div></div><div className="report-quick-group"><strong>Ghi chú nhanh</strong><div className="report-chip-grid">{TEST_NOTE_CHIPS.map((label) => <QuickChip key={label} active={draft.note.includes(label)} disabled={saving} onClick={() => onChange("note", appendToken(draft.note, label))}>{label}</QuickChip>)}</div></div><label className="form-field report-field"><small>Ghi chú test</small><textarea value={draft.note} onChange={(event) => onChange("note", event.target.value)} disabled={saving} /></label></section></div>;
}

function FollowUpFields`
);

ui = replaceRegexOnce(
  ui,
  "replace follow-up form",
  /function FollowUpFields\([\s\S]*?\n\}\n\nfunction SkipFields/,
  `function FollowUpFields({ draft, saving, onChange }: { draft: ActionDraft; saving: boolean; onChange: (field: keyof ActionDraft, value: string) => void }) {
  return <div className="report-popup-grid"><section className="report-quick-panel"><div className="report-section-head"><strong>Follow-up</strong><small>Lưu đủ việc, ngày hẹn, người phụ trách, ưu tiên và loại công việc.</small></div><div className="report-quick-group"><strong>Việc cần làm</strong><div className="report-chip-grid">{FOLLOWUP_CHIPS.map((label) => <QuickChip key={label} active={draft.productName === label} disabled={saving} onClick={() => onChange("productName", draft.productName === label ? "" : label)}>{label}</QuickChip>)}</div></div><label className="form-field report-field"><small>Tiêu đề</small><input value={draft.productName} onChange={(event) => onChange("productName", event.target.value)} disabled={saving} placeholder="VD: Hẹn chốt đơn siro" /></label><div className="report-quick-group"><strong>Ngày hẹn nhanh</strong><div className="report-chip-grid"><QuickChip active={draft.dueDate === addDays(1)} disabled={saving} onClick={() => onChange("dueDate", addDays(1))}>Mai</QuickChip><QuickChip active={draft.dueDate === addDays(3)} disabled={saving} onClick={() => onChange("dueDate", addDays(3))}>3 ngày</QuickChip><QuickChip active={draft.dueDate === addDays(7)} disabled={saving} onClick={() => onChange("dueDate", addDays(7))}>Tuần sau</QuickChip></div></div><label className="form-field report-field"><small>Ngày hẹn</small><input type="date" value={draft.dueDate} onChange={(event) => onChange("dueDate", event.target.value)} disabled={saving} /></label><label className="form-field report-field"><small>Người phụ trách</small><input value={draft.owner} onChange={(event) => onChange("owner", event.target.value)} disabled={saving} placeholder="Sale phụ trách" /></label><label className="form-field report-field"><small>Ưu tiên</small><select value={draft.priority} onChange={(event) => onChange("priority", event.target.value)} disabled={saving}><option value="low">Thấp</option><option value="medium">Trung bình</option><option value="high">Cao</option><option value="urgent">Khẩn</option></select></label><label className="form-field report-field"><small>Loại follow-up</small><select value={draft.followupType} onChange={(event) => onChange("followupType", event.target.value)} disabled={saving}><option value="general">Chung</option><option value="order">Đơn hàng</option><option value="test">Sau test</option><option value="report">Báo cáo</option><option value="debt">Công nợ</option><option value="delivery">Giao hàng</option></select></label><label className="form-field report-field"><small>Ghi chú</small><textarea value={draft.note} onChange={(event) => onChange("note", event.target.value)} disabled={saving} /></label></section></div>;
}

function SkipFields`
);

ui = replaceOnce(
  ui,
  "fix test payload",
  '            await postJson("/api/backend/mcp-day/session-customer/test", { sessionCustomerId, fileTitle: "Test nhanh từ checklist", results: [{ productName: draft.productName, status: draft.priority || "tested", note: draft.note }], note: draft.note, status: "tested" });',
  '            if (!draft.productName.trim()) throw new Error("Cần chọn hoặc nhập sản phẩm test");\n            await postJson("/api/backend/mcp-day/session-customer/test", { sessionCustomerId, fileTitle: "Test nhanh từ checklist", results: [{ productName: draft.productName, status: draft.testStatus || "tested", note: draft.note }], note: draft.note, customerStatus: "tested" });'
);
ui = replaceOnce(
  ui,
  "fix follow-up payload",
  '            await postJson("/api/backend/mcp-day/session-customer/followup", { sessionCustomerId, title: draft.productName || "Follow-up khách", dueDate: draft.dueDate || undefined, priority: draft.priority, owner: draft.owner, note: draft.note, followupType: "general" });',
  '            await postJson("/api/backend/mcp-day/session-customer/followup", { sessionCustomerId, title: draft.productName || "Follow-up khách", dueDate: draft.dueDate || undefined, priority: draft.priority, owner: draft.owner, note: draft.note, followupType: draft.followupType || "general" });'
);

fs.writeFileSync(uiPath, ui, "utf8");

const planPath = "MCP_EXECUTION_PLAN.md";
let plan = fs.readFileSync(planPath, "utf8");
if (!plan.includes("## 13. MCP v1 freeze")) {
  plan += `\n\n## 13. MCP v1 freeze\n\nTrạng thái: **core complete / frozen**.\n\n- Mutation MCP chạy theo luồng Vercel proxy -> VPS backend -> Supabase service role.\n- Mở phiên idempotent theo route_id + session_date; snapshot khách chỉ tạo lần đầu.\n- Đơn, test, báo cáo và follow-up ghi dữ liệu thật và liên kết về session customer/visit.\n- Visit dùng session_date, kể cả phiên quá khứ.\n- Phiên done/completed/cancelled là read-only; chốt phiên tạo snapshot báo cáo.\n- Phiên rỗng được xóa; phiên có hoạt động bị chặn.\n- RPC mutation chỉ cấp execute cho service_role.\n- Template nâng cao ngoài report chips và các module Warehouse/Transport/Accounting thuộc update sau MCP v1.\n`;
}
fs.writeFileSync(planPath, plan, "utf8");

console.log("Applied MCP v1 backend, form contract and freeze updates.");
