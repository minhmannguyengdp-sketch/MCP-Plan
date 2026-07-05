export const dynamic = "force-dynamic";

function env() {
  const url = (process.env.SUPABASE_URL || "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) throw new Error("missing_supabase_config");
  return { url: url.replace(/\/+$/, ""), key };
}

function tableUrl(table: string, params: Record<string, string> = {}) {
  const { url } = env();
  const target = new URL(`/rest/v1/${table}`, url);
  Object.entries(params).forEach(([key, value]) => target.searchParams.set(key, value));
  return target;
}

function headers(extra: Record<string, string> = {}) {
  const { key } = env();
  return { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json", ...extra };
}

async function patchRow(table: string, id: string, row: Record<string, unknown>) {
  const response = await fetch(tableUrl(table, { id: `eq.${id}` }), {
    method: "PATCH",
    cache: "no-store",
    headers: headers({ "Content-Type": "application/json", Prefer: "return=representation" }),
    body: JSON.stringify(row)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || payload.error || `supabase_${response.status}`);
  return Array.isArray(payload) ? payload[0] : payload;
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
    const row: Record<string, unknown> = { updated_at: new Date().toISOString(), raw_payload: { source: "route_customer_update_api" } };

    const customerName = cleanText(body.customerName ?? body.customer_name ?? body.accountName ?? body.name);
    const geoLat = numberOrNull(body.geoLat ?? body.geo_lat);
    const geoLng = numberOrNull(body.geoLng ?? body.geo_lng);

    if (customerName !== undefined) row.customer_name = customerName;
    if (body.phone !== undefined) row.phone = cleanText(body.phone);
    if (body.area !== undefined) row.area = cleanText(body.area);
    if (body.address !== undefined) row.address = cleanText(body.address);
    if (body.sortOrder !== undefined || body.sort_order !== undefined) row.sort_order = Number(body.sortOrder ?? body.sort_order ?? 0);
    if (body.note !== undefined) row.note = cleanText(body.note);
    if (body.active !== undefined) row.active = Boolean(body.active);
    if (geoLat !== undefined) row.geo_lat = geoLat;
    if (geoLng !== undefined) row.geo_lng = geoLng;
    if (geoLat !== undefined && geoLng !== undefined && geoLat !== null && geoLng !== null) {
      row.geo_captured_at = new Date().toISOString();
      row.geo_source = "manual";
    }

    const data = await patchRow("mcp_route_customers", params.id, row);
    return Response.json({ data, receivedAt: new Date().toISOString() });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "route_customer_update_failed" }, { status: 400 });
  }
}
