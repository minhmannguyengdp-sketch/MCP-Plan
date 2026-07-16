import { readFile, writeFile } from "node:fs/promises";

async function update(path, transform) {
  const before = await readFile(path, "utf8");
  const after = transform(before);
  if (after === before) throw new Error(`no_change:${path}`);
  await writeFile(path, after, "utf8");
}

function insertOnce(source, marker, addition, label) {
  const index = source.indexOf(marker);
  if (index < 0) throw new Error(`missing_marker:${label}`);
  if (source.indexOf(marker, index + marker.length) >= 0) throw new Error(`duplicate_marker:${label}`);
  return source.slice(0, index + marker.length) + addition + source.slice(index + marker.length);
}

function removeSection(source, startMarker, endMarker, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0 || end <= start) throw new Error(`missing_section:${label}`);
  return source.slice(0, start) + source.slice(end);
}

function replaceSection(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0 || end <= start) throw new Error(`missing_section:${label}`);
  return source.slice(0, start) + replacement + source.slice(end);
}

function removeOnce(source, value, label) {
  const index = source.indexOf(value);
  if (index < 0) throw new Error(`missing_value:${label}`);
  if (source.indexOf(value, index + value.length) >= 0) throw new Error(`duplicate_value:${label}`);
  return source.slice(0, index) + source.slice(index + value.length);
}

await update("apps/backend/foundation/transitional-api.js", (source) => {
  const sessionReportImport = `import {
  createSessionReportSnapshot,
  saveSessionReportAiResult
} from "./session-report-mutations.js";`;
  source = insertOnce(source, sessionReportImport, `
import {
  createReportSettingGroup,
  createReportSettingItem,
  updateReportSettingGroup,
  updateReportSettingItem
} from "./report-setting-mutations.js";`, "report_setting_import");

  source = removeSection(
    source,
    "function slug(value) {",
    "function today() {",
    "timestamp_slug"
  );

  const handlers = `async function createSettingGroup(req, context, config, fetchImpl) {
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

`;
  source = replaceSection(
    source,
    "async function createSettingGroup(",
    "async function loadReportTemplates(",
    handlers,
    "report_setting_handlers"
  );

  const groupRoutes = `  if (method === "PATCH" && pathname === "/api/mcp-report-setting-groups") {
    return updateSettingGroup(req, context, config, fetchImpl);
  }
`;
  source = insertOnce(source, groupRoutes, `  if (method === "POST" && pathname === "/api/mcp-report-settings") {
    return createSettingItem(req, context, config, fetchImpl);
  }
  if (method === "PATCH" && pathname === "/api/mcp-report-settings") {
    return updateSettingItem(req, context, config, fetchImpl);
  }
`, "report_setting_item_routes");

  if (source.includes("supabaseRest(config, \"mcp_setting_groups\"")) throw new Error("group_direct_rest_still_present");
  if (source.includes("mcp_setting_groups?id=eq.")) throw new Error("group_patch_filter_still_present");
  return source;
});

await update("apps/backend/server.js", (source) => {
  source = removeSection(
    source,
    "function mcpSettingSlugV1(",
    "function normalizeMcpSettingGroupV1(",
    "legacy_timestamp_slug"
  );
  source = removeSection(
    source,
    "async function createMcpReportSettingV1(",
    "async function createMcpRouteV1(",
    "legacy_item_mutations"
  );
  source = removeOnce(
    source,
    `  if (url.pathname === "/api/mcp-report-settings") return wrap(await updateMcpReportSettingV1(await readJsonBody(req)));

`,
    "legacy_item_patch_route"
  );
  source = removeOnce(
    source,
    `  if (url.pathname === "/api/mcp-report-settings") return wrap(await createMcpReportSettingV1(await readJsonBody(req)));
`,
    "legacy_item_post_route"
  );

  if (!source.includes('if (url.pathname === "/api/mcp-report-settings") return wrap(await loadMcpReportSettingsV1(url));')) {
    throw new Error("report_setting_read_route_missing");
  }
  for (const retired of [
    "createMcpReportSettingV1",
    "updateMcpReportSettingV1",
    'supabaseInsert("mcp_setting_items"',
    'supabasePatch("mcp_setting_items"'
  ]) {
    if (source.includes(retired)) throw new Error(`legacy_item_owner_still_present:${retired}`);
  }
  return source;
});
