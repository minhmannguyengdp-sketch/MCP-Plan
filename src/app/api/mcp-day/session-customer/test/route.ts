export const dynamic = "force-dynamic";

const SUPABASE_URL = "https://noiadkpkvdohljgopgfb.supabase.co";
const SUPABASE_KEY = "sb_publishable_n6LXv-fd-ImF3XzeU2mrjg_G7tBGy66";
type Dict = Record<string, unknown>;
function isObj(v: unknown): v is Dict { return !!v && typeof v === "object" && !Array.isArray(v); }
function text(v: unknown) { const s = String(v ?? "").trim(); return s || null; }
function env() { const url = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || SUPABASE_URL).trim().replace(/\/+$/, ""); const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || SUPABASE_KEY).trim(); if (!url || !key) throw new Error("missing_supabase_config"); return { url, key }; }
function eq(value: string) { return `eq.${encodeURIComponent(value)}`; }
async function getRows<T>(path: string) { const e = env(); const res = await fetch(`${e.url}${path}`, { cache: "no-store", headers: { apikey: e.key, Authorization: `Bearer ${e.key}`, Accept: "application/json" } }); const payload = await res.json().catch(() => ({})); if (!res.ok) throw new Error(payload.message || payload.error || `supabase_${res.status}`); return payload as T; }
async function rpc<T>(name: string, args: Dict) { const e = env(); const res = await fetch(`${e.url}/rest/v1/rpc/${name}`, { method: "POST", cache: "no-store", headers: { apikey: e.key, Authorization: `Bearer ${e.key}`, Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify(args) }); const payload = await res.json().catch(() => ({})); if (!res.ok) throw new Error(payload.message || payload.error || `supabase_${res.status}`); return payload as T; }
async function resolveId(input: string, body: Dict) { const direct = await getRows<Array<{ id: string }>>(`/rest/v1/mcp_session_customers?id=${eq(input)}&select=id&limit=1`); if (direct[0]?.id) return direct[0].id; const ctx = isObj(body.context) ? body.context : {}; const rc = text(body.routeCustomerId || body.route_customer_id || ctx.routeCustomerId || ctx.route_customer_id) || (input.startsWith("mcp-route-customer") ? input : null); const sid = text(body.sessionId || body.session_id || ctx.sessionId || ctx.session_id); const rid = text(body.routeId || body.route_id || ctx.routeId || ctx.route_id); const d = text(body.sessionDate || body.session_date || body.date || ctx.sessionDate || ctx.session_date || ctx.date)?.slice(0, 10); const name = text(body.customerName || body.customer_name || ctx.customerName || ctx.customer_name); if (rc && sid) { const rows = await getRows<Array<{ id: string }>>(`/rest/v1/mcp_session_customers?session_id=${eq(sid)}&route_customer_id=${eq(rc)}&select=id&limit=1`); if (rows[0]?.id) return rows[0].id; } if (name && sid) { const rows = await getRows<Array<{ id: string }>>(`/rest/v1/mcp_session_customers?session_id=${eq(sid)}&customer_name=${eq(name)}&select=id&limit=1`); if (rows[0]?.id) return rows[0].id; } if ((rc || name) && rid && d) { const sessions = await getRows<Array<{ id: string }>>(`/rest/v1/mcp_route_sessions?route_id=${eq(rid)}&session_date=${eq(d)}&select=id&limit=1`); const realSid = sessions[0]?.id; if (realSid && rc) { const rows = await getRows<Array<{ id: string }>>(`/rest/v1/mcp_session_customers?session_id=${eq(realSid)}&route_customer_id=${eq(rc)}&select=id&limit=1`); if (rows[0]?.id) return rows[0].id; } if (realSid && name) { const rows = await getRows<Array<{ id: string }>>(`/rest/v1/mcp_session_customers?session_id=${eq(realSid)}&customer_name=${eq(name)}&select=id&limit=1`); if (rows[0]?.id) return rows[0].id; } } throw new Error("session_customer_not_resolved"); }

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const inputId = text(body.sessionCustomerId || body.session_customer_id);
    if (!inputId) throw new Error("session_customer_id_required");
    const sessionCustomerId = await resolveId(inputId, body);
    const results = Array.isArray(body.results) ? body.results : [];
    const safeResults = results.length ? results : [{ productName: text(body.productName) || "Test nhanh", status: text(body.status) || "tested", note: text(body.note) || "Tạo test từ MCP" }];
    const data = await rpc("mcp_create_test_from_session_customer", { p_session_customer_id: sessionCustomerId, p_file_id: text(body.fileId || body.file_id), p_file_title: text(body.fileTitle || body.file_title) || "Test nhanh từ checklist", p_results: safeResults, p_note: text(body.note), p_status: text(body.status) || "tested" });
    return Response.json({ data, receivedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "mcp_test_save_failed" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
