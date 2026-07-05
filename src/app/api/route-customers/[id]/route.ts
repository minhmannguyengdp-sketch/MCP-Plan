export const dynamic = "force-dynamic";

const DEFAULT_SUPABASE_URL = "https://noiadkpkvdohljgopgfb.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_n6LXv-fd-ImF3XzeU2mrjg_G7tBGy66";

function env() {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL).trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || DEFAULT_SUPABASE_PUBLISHABLE_KEY).trim();
  if (!url || !key) throw new Error("missing_supabase_config");
  return { url: url.replace(/\/+$/, ""), key };
}

async function rpc(name: string, args: Record<string, unknown>) {
  const { url, key } = env();
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    cache: "no-store",
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(args)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || payload.error || `supabase_${response.status}`);
  return payload;
}

function cleanText(value: unknown) {
  if (value === undefined) return undefined;
  const text = String(value || "").trim();
  return text || null;
}

function numberOrNull(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json().catch(() => ({}));
    const customerName = cleanText(body.customerName ?? body.customer_name ?? body.accountName ?? body.name);
    const geoLat = numberOrNull(body.geoLat ?? body.geo_lat);
    const geoLng = numberOrNull(body.geoLng ?? body.geo_lng);

    const data = await rpc("mcp_update_route_customer", {
      p_route_customer_id: params.id,
      p_customer_name: customerName === undefined ? null : customerName,
      p_phone: body.phone === undefined ? null : cleanText(body.phone),
      p_area: body.area === undefined ? null : cleanText(body.area),
      p_address: body.address === undefined ? null : cleanText(body.address),
      p_sort_order: body.sortOrder === undefined && body.sort_order === undefined ? null : Number(body.sortOrder ?? body.sort_order ?? 0),
      p_note: body.note === undefined ? null : cleanText(body.note),
      p_active: body.active === undefined ? null : Boolean(body.active),
      p_geo_lat: geoLat === undefined ? null : geoLat,
      p_geo_lng: geoLng === undefined ? null : geoLng
    });

    return Response.json({ data, receivedAt: new Date().toISOString() });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "route_customer_update_failed" }, { status: 400 });
  }
}
