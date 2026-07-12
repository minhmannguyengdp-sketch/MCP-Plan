import fs from "node:fs";

const file = "apps/backend/server.js";
let source = fs.readFileSync(file, "utf8");

function replaceOnce(label, from, to) {
  if (!source.includes(from)) throw new Error(`${label}: marker not found`);
  source = source.replace(from, to);
}

const functions = `
async function loadMcpReportContextV1(url) {
  const sessionCustomerId = v1Text(
    url.searchParams.get("sessionCustomerId") ||
      url.searchParams.get("session_customer_id")
  );
  if (!sessionCustomerId) throw badRequest("session_customer_id_required");
  return supabaseRpc("mcp_get_report_context", {
    p_session_customer_id: sessionCustomerId
  });
}

async function persistMcpSessionAiResultV1(body) {
  const sessionId = v1Text(body.sessionId || body.session_id);
  if (!sessionId) throw badRequest("session_id_required");

  const aiResult = v1Object(body.aiResult || body.ai_result);
  const analyzedAt = v1Text(body.analyzedAt || body.ai_analyzed_at) || new Date().toISOString();
  const rows = await supabasePatch(
    "mcp_session_reports",
    {
      ai_result: aiResult,
      ai_analyzed_at: analyzedAt,
      updated_at: analyzedAt
    },
    { session_id: \`eq.\${sessionId}\` }
  );

  if (!Array.isArray(rows) || rows.length !== 1) {
    const error = new Error("session_report_snapshot_not_found_for_ai_result");
    error.statusCode = 404;
    throw error;
  }

  return { row: rows[0], analyzedAt };
}
`;

replaceOnce(
  "insert boundary functions",
  "\nfunction mcpSettingSlugV1(value) {",
  `${functions}\nfunction mcpSettingSlugV1(value) {`
);

replaceOnce(
  "add ai result POST route",
  '  if (url.pathname === "/api/mcp-session-report") return wrap(await createMcpSessionReportSnapshotV1(await readJsonBody(req)));',
  '  if (url.pathname === "/api/mcp-session-report") return wrap(await createMcpSessionReportSnapshotV1(await readJsonBody(req)));\n  if (url.pathname === "/api/mcp-session-report/ai-result") return wrap(await persistMcpSessionAiResultV1(await readJsonBody(req)));'
);

replaceOnce(
  "add report context GET route",
  '  if (url.pathname === "/api/mcp-report-settings") return wrap(await loadMcpReportSettingsV1(url));',
  '  if (url.pathname === "/api/mcp-report-settings") return wrap(await loadMcpReportSettingsV1(url));\n  if (url.pathname === "/api/mcp-report-context") return wrap(await loadMcpReportContextV1(url));'
);

fs.writeFileSync(file, source, "utf8");
console.log("Applied final MCP v1 report context and AI persistence routes.");
