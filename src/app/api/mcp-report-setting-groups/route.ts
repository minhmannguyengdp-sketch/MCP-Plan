export const dynamic = "force-dynamic";

const DEFAULT_SUPABASE_URL = "https://noiadkpkvdohljgopgfb.supabase.co";

function env() {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL).trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "").trim();
  if (!url || !key) throw new Error("missing_supabase_config");
  return { url: url.replace(/\/+$/, ""), key };
}

async function rest(path: string, init?: RequestInit) {
  const { url, key } = env();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    cache: "no-store",
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json", "Content-Type": "application/json", Prefer: "return=representation", ...(init?.headers || {}) }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || payload.error || `supabase_${response.status}`);
  return payload;
}

function slug(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || `group_${Date.now()}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const title = String(body.title || "").trim();
    if (!title) throw new Error("title_required");
    const payload = {
      group_key: String(body.key || slug(title)).trim(),
      title,
      group_type: String(body.groupType || "market_report"),
      description: String(body.description || "").trim() || null,
      sort_order: Number(body.sortOrder || 0),
      status: String(body.status || "active"),
      raw_payload: body.meta && typeof body.meta === "object" ? body.meta : {}
    };
    const data = await rest("mcp_setting_groups", { method: "POST", body: JSON.stringify(payload) });
    return Response.json({ data, receivedAt: new Date().toISOString() });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "mcp_setting_group_create_failed" }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const groupId = String(body.groupId || "").trim();
    if (!groupId) throw new Error("group_id_required");
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.title !== undefined) payload.title = String(body.title || "").trim();
    if (body.description !== undefined) payload.description = String(body.description || "").trim() || null;
    if (body.sortOrder !== undefined) payload.sort_order = Number(body.sortOrder || 0);
    if (body.status !== undefined) payload.status = String(body.status || "active");
    if (body.meta !== undefined) payload.raw_payload = body.meta && typeof body.meta === "object" ? body.meta : {};
    const data = await rest(`mcp_setting_groups?id=eq.${encodeURIComponent(groupId)}`, { method: "PATCH", body: JSON.stringify(payload) });
    return Response.json({ data, receivedAt: new Date().toISOString() });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "mcp_setting_group_update_failed" }, { status: 400 });
  }
}
