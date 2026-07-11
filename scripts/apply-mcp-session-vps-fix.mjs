import fs from "node:fs";

const path = "apps/backend/server.js";
let source = fs.readFileSync(path, "utf8");

function replaceOnce(label, from, to) {
  if (!source.includes(from)) {
    throw new Error(`${label}: expected source marker not found`);
  }
  source = source.replace(from, to);
}

replaceOnce(
  "cors methods",
  '"Access-Control-Allow-Methods": "GET, POST, OPTIONS",',
  '"Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",'
);

const sessionFunctions = `
function mcpSessionIdFromPath(url) {
  const prefix = "/api/mcp-sessions/";
  if (!url.pathname.startsWith(prefix)) return null;
  const encoded = url.pathname.slice(prefix.length);
  if (!encoded || encoded.includes("/")) return null;
  try {
    return decodeURIComponent(encoded).trim() || null;
  } catch {
    throw badRequest("invalid_session_id");
  }
}

function normalizeSessionMutationError(error) {
  const message = String(error?.message || "");
  if (message.includes("session_not_found")) error.statusCode = 404;
  if (message.includes("session_has_activity") || message.includes("session_closed")) error.statusCode = 409;
  return error;
}

async function updateMcpRouteSession(sessionId, body) {
  const rawDate = String(body.sessionDate || body.session_date || "").trim();
  const sessionDate = rawDate ? rawDate.slice(0, 10) : null;
  if (sessionDate && !/^\\d{4}-\\d{2}-\\d{2}$/.test(sessionDate)) throw badRequest("invalid_session_date");

  try {
    return await supabaseRpc("mcp_update_route_session", {
      p_session_id: sessionId,
      p_session_date: sessionDate,
      p_status: String(body.status || "").trim() || null,
      p_note: body.note === undefined ? null : String(body.note || "").trim() || null
    });
  } catch (error) {
    throw normalizeSessionMutationError(error);
  }
}

async function deleteMcpRouteSession(sessionId) {
  try {
    const data = await supabaseRpc("mcp_delete_empty_route_session", {
      p_session_id: sessionId
    });
    if (!data || data.deleted !== true) {
      const error = new Error("session_delete_not_applied");
      error.statusCode = 500;
      throw error;
    }
    return data;
  } catch (error) {
    throw normalizeSessionMutationError(error);
  }
}
`;

replaceOnce(
  "session functions",
  "\nfunction normalizeOrderItems(items) {",
  `${sessionFunctions}\nfunction normalizeOrderItems(items) {`
);

const mutationHandlers = `
async function handlePatch(req, url) {
  const sessionId = mcpSessionIdFromPath(url);
  if (!sessionId) {
    const error = new Error("not_found");
    error.statusCode = 404;
    throw error;
  }
  return wrap(await updateMcpRouteSession(sessionId, await readJsonBody(req)));
}

async function handleDelete(url) {
  const sessionId = mcpSessionIdFromPath(url);
  if (!sessionId) {
    const error = new Error("not_found");
    error.statusCode = 404;
    throw error;
  }
  return wrap(await deleteMcpRouteSession(sessionId));
}
`;

replaceOnce(
  "mutation handlers",
  "\nasync function handlePost(req, url) {",
  `${mutationHandlers}\nasync function handlePost(req, url) {`
);

replaceOnce(
  "method router",
  '  const handler = req.method === "GET" ? handleGet(url) : req.method === "POST" ? handlePost(req, url) : Promise.reject(Object.assign(new Error("method_not_allowed"), { statusCode: 405 }));',
  '  const handler = req.method === "GET" ? handleGet(url) : req.method === "POST" ? handlePost(req, url) : req.method === "PATCH" ? handlePatch(req, url) : req.method === "DELETE" ? handleDelete(url) : Promise.reject(Object.assign(new Error("method_not_allowed"), { statusCode: 405 }));'
);

fs.writeFileSync(path, source, "utf8");
console.log("Applied MCP session PATCH/DELETE backend routes.");
