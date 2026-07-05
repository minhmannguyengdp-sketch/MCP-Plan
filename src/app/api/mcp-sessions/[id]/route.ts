export const dynamic = "force-dynamic";

const DEFAULT_SUPABASE_URL = "https://noiadkpkvdohljgopgfb.supabase.co";

type Dict = Record<string, unknown>;

function env() {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL).trim().replace(/\/+$/, "");
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();
  if (!key) throw new Error("missing_supabase_config");
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
    const body = await request.json().catch(() => ({}));
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

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const sessionId = cleanText(params.id);
    if (!sessionId) throw new Error("session_id_required");
    const data = await rpc("mcp_delete_empty_route_session", { p_session_id: sessionId });
    return Response.json({ data, receivedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "mcp_session_delete_failed" }, { status: 400 });
  }
}
