export const dynamic = "force-dynamic";

const DEFAULT_SUPABASE_URL = "https://noiadkpkvdohljgopgfb.supabase.co";

type SettingGroup = { id: string; group_key: string; title: string; group_type: string; description?: string | null; status: string; sort_order: number; raw_payload?: Record<string, unknown> | null };
type SettingItem = { id: string; group_id: string; item_key: string; label: string; value?: string | null; category?: string | null; brand_name?: string | null; product_id?: string | null; status: string; sort_order: number; raw_payload?: Record<string, unknown> | null };

function cleanBase(value?: string) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function backendBase(_request: Request) {
  return "";
}

async function proxyBackend(request: Request, init?: RequestInit) {
  const base = backendBase(request);
  if (!base) return null;
  const sourceUrl = new URL(request.url);
  const targetUrl = `${base}/api/mcp-report-settings${sourceUrl.search}`;
  const response = await fetch(targetUrl, {
    cache: "no-store",
    ...init,
    headers: { Accept: "application/json", "Content-Type": "application/json", "x-mcp-via-vercel": "1", ...(init?.headers || {}) }
  });
  const text = await response.text();
  return new Response(text, { status: response.status, headers: { "Content-Type": response.headers.get("Content-Type") || "application/json", "Cache-Control": "no-store" } });
}

function supabaseEnv() {
  const url = cleanBase(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL);
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "").trim();
  if (!url || !key) throw new Error("missing_backend_or_supabase_config");
  return { url, key };
}

async function rest(path: string, init?: RequestInit) {
  const { url, key } = supabaseEnv();
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
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || `item_${Date.now()}`;
}

function normalizeGroup(group: SettingGroup, items: SettingItem[]) {
  return {
    id: group.id,
    key: group.group_key,
    title: group.title,
    type: group.group_type,
    description: group.description || "",
    status: group.status,
    sortOrder: group.sort_order,
    meta: group.raw_payload || {},
    items: items.filter((item) => item.group_id === group.id).map((item) => ({ id: item.id, key: item.item_key, label: item.label, value: item.value || item.label, category: item.category || "", brandName: item.brand_name || "", productId: item.product_id || "", status: item.status, sortOrder: item.sort_order, meta: item.raw_payload || {} }))
  };
}

export async function GET(request: Request) {
  try {
    const proxied = await proxyBackend(request);
    if (proxied) return proxied;
    const searchParams = new URL(request.url).searchParams;
    const groupType = String(searchParams.get("groupType") || "market_report").trim();
    const includeInactive = searchParams.get("includeInactive") === "1";
    const encodedType = encodeURIComponent(groupType);
    const groupStatus = includeInactive ? "" : "&status=eq.active";
    const itemStatus = includeInactive ? "" : "&status=eq.active";
    const [groups, items] = await Promise.all([
      rest(`mcp_setting_groups?select=*&group_type=eq.${encodedType}${groupStatus}&order=sort_order.asc,title.asc`),
      rest(`mcp_setting_items?select=*${itemStatus}&order=sort_order.asc,label.asc`)
    ]) as [SettingGroup[], SettingItem[]];
    const groupIds = new Set(groups.map((group) => group.id));
    const data = groups.map((group) => normalizeGroup(group, items.filter((item) => groupIds.has(item.group_id))));
    return Response.json({ data: { groups: data }, receivedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "mcp_report_settings_failed" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const bodyText = await request.text();
    const proxied = await proxyBackend(request, { method: "POST", body: bodyText });
    if (proxied) return proxied;
    const body = bodyText ? JSON.parse(bodyText) : {};
    const groupId = String(body.groupId || "").trim();
    const label = String(body.label || "").trim();
    if (!groupId) throw new Error("group_id_required");
    if (!label) throw new Error("label_required");
    const payload = { group_id: groupId, item_key: String(body.key || slug(label)).trim(), label, value: String(body.value || label).trim(), category: String(body.category || "").trim() || null, brand_name: String(body.brandName || "").trim() || null, sort_order: Number(body.sortOrder || 0), status: String(body.status || "active"), raw_payload: body.meta && typeof body.meta === "object" ? body.meta : {} };
    const data = await rest("mcp_setting_items", { method: "POST", body: JSON.stringify(payload) });
    return Response.json({ data, receivedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "mcp_report_setting_create_failed" }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const bodyText = await request.text();
    const proxied = await proxyBackend(request, { method: "PATCH", body: bodyText });
    if (proxied) return proxied;
    const body = bodyText ? JSON.parse(bodyText) : {};
    const itemId = String(body.itemId || "").trim();
    if (!itemId) throw new Error("item_id_required");
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.label !== undefined) payload.label = String(body.label || "").trim();
    if (body.value !== undefined) payload.value = String(body.value || "").trim();
    if (body.category !== undefined) payload.category = String(body.category || "").trim() || null;
    if (body.brandName !== undefined) payload.brand_name = String(body.brandName || "").trim() || null;
    if (body.sortOrder !== undefined) payload.sort_order = Number(body.sortOrder || 0);
    if (body.status !== undefined) payload.status = String(body.status || "active");
    if (body.meta !== undefined) payload.raw_payload = body.meta && typeof body.meta === "object" ? body.meta : {};
    const data = await rest(`mcp_setting_items?id=eq.${encodeURIComponent(itemId)}`, { method: "PATCH", body: JSON.stringify(payload) });
    return Response.json({ data, receivedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "mcp_report_setting_update_failed" }, { status: 400 });
  }
}
