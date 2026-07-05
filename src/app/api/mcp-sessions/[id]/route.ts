export const dynamic = "force-dynamic";

const DEFAULT_SUPABASE_URL = "https://noiadkpkvdohljgopgfb.supabase.co";

type Dict = Record<string, unknown>;

function cleanBase(value?: string) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function backendBase(request: Request) {
  const base = cleanBase(process.env.BACKEND_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL);
  if (!base) return "";
  const current = new URL(request.url);
  const target = new URL(base);
  if (current.host === target.host) return "";
  return base;
}

function env() {
  const url = cleanBase(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL);
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
  if (!key) throw new Error("missing_backend_or_supabase_config");
  return { url, key };
}

function cleanDate(value: unknown) {
  const text = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function cleanText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

async function proxyBackend(request: Request, params: { id: string }, init: RequestInit) {
  const base = backendBase(request);
  if (!base) return null;
  const targetUrl = `${base}/api/mcp-sessions/${encodeURIComponent(params.id)}`;
  const response = await fetch(targetUrl, {
    cache: "no-store",
    ...init,
    headers: { Accept: "application/json", "Content-Type": "application/json", "x-mcp-via-vercel": "1", ...(init.headers || {}) }
  });
  const text = await response.text();
  return new Response(text, { status: response.status, headers: { "Content-Type": response.headers.get("Content-Type") || "application/json", "Cache-Control": "no-store" } });
}

async function rpc(name: string, args: Dict) {
  const cfg = env();
  const response = await fetch(`${cfg.url}/rest/v1/rpc/${name}`, {
    method: "POST",
    cache: "no-store",
    headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}`, Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(args)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || payload.error || `supabase_${response.status}`);
  return payload;
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const bodyText = await request.text();
    const proxied = await proxyBackend(request, params, { method: "PATCH", body: bodyText });
    if (proxied) return proxied;
    const body = bodyText ? JSON.parse(bodyText) : {};
    const sessionId = cleanText(params.id);
    if (!sessionId) throw new Error("session_id_required");
    const data = await rpc("mcp_update_route_session", {
      p_session_id: sessionId,
      p_session_date: cleanDate(body.sessionDate || body.session_date),
      p_status: cleanText(body.status),
      p_note: body.note === undefined ? null : cleanText(body.note)
    });
    return Response.json({ data, receivedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "mcp_session_update_failed" }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const proxied = await proxyBackend(request, params, { method: "DELETE" });
    if (proxied) return proxied;
    const sessionId = cleanText(params.id);
    if (!sessionId) throw new Error("session_id_required");
    const data = await rpc("mcp_delete_empty_route_session", { p_session_id: sessionId });
    return Response.json({ data, receivedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "mcp_session_delete_failed" }, { status: 400 });
  }
}
