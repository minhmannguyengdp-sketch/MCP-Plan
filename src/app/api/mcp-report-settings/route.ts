export const dynamic = "force-dynamic";

const DEFAULT_SUPABASE_URL = "https://noiadkpkvdohljgopgfb.supabase.co";

function env() {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL).trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "").trim();
  if (!url || !key) throw new Error("missing_supabase_config");
  return { url: url.replace(/\/+$/, ""), key };
}

async function rest(path: string) {
  const { url, key } = env();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    cache: "no-store",
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || payload.error || `supabase_${response.status}`);
  return payload;
}

type SettingGroup = {
  id: string;
  group_key: string;
  title: string;
  group_type: string;
  description?: string | null;
  status: string;
  sort_order: number;
  raw_payload?: Record<string, unknown> | null;
};

type SettingItem = {
  id: string;
  group_id: string;
  item_key: string;
  label: string;
  value?: string | null;
  category?: string | null;
  brand_name?: string | null;
  product_id?: string | null;
  status: string;
  sort_order: number;
  raw_payload?: Record<string, unknown> | null;
};

export async function GET(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const groupType = String(searchParams.get("groupType") || "market_report").trim();
    const encodedType = encodeURIComponent(groupType);
    const [groups, items] = await Promise.all([
      rest(`mcp_setting_groups?select=*&group_type=eq.${encodedType}&status=eq.active&order=sort_order.asc,title.asc`),
      rest(`mcp_setting_items?select=*&status=eq.active&order=sort_order.asc,label.asc`)
    ]) as [SettingGroup[], SettingItem[]];

    const groupIds = new Set(groups.map((group) => group.id));
    const data = groups.map((group) => ({
      id: group.id,
      key: group.group_key,
      title: group.title,
      type: group.group_type,
      description: group.description || "",
      sortOrder: group.sort_order,
      meta: group.raw_payload || {},
      items: items
        .filter((item) => groupIds.has(item.group_id) && item.group_id === group.id)
        .map((item) => ({
          id: item.id,
          key: item.item_key,
          label: item.label,
          value: item.value || item.label,
          category: item.category || "",
          brandName: item.brand_name || "",
          productId: item.product_id || "",
          sortOrder: item.sort_order,
          meta: item.raw_payload || {}
        }))
    }));

    return Response.json({ data: { groups: data }, receivedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "mcp_report_settings_failed" }, { status: 400 });
  }
}
