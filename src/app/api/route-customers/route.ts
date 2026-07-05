import { randomUUID } from "node:crypto";

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

async function insertRow(table: string, row: Record<string, unknown>) {
  const response = await fetch(tableUrl(table), {
    method: "POST",
    cache: "no-store",
    headers: headers({ "Content-Type": "application/json", Prefer: "return=representation" }),
    body: JSON.stringify(row)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || payload.error || `supabase_${response.status}`);
  return Array.isArray(payload) ? payload[0] : payload;
}

function cleanText(value: unknown) {
  const text = String(value || "").trim();
  return text || null;
}

function numberOrNull(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const routeId = cleanText(body.routeId || body.route_id);
    const customerName = cleanText(body.customerName || body.customer_name || body.accountName || body.name);
    if (!routeId) throw new Error("route_id_required");
    if (!customerName) throw new Error("customer_name_required");

    const geoLat = numberOrNull(body.geoLat || body.geo_lat);
    const geoLng = numberOrNull(body.geoLng || body.geo_lng);
    const now = new Date().toISOString();
    const row = await insertRow("mcp_route_customers", {
      id: `mrc_${randomUUID().replaceAll("-", "")}`,
      route_id: routeId,
      customer_id: cleanText(body.customerId || body.customer_id),
      customer_name: customerName,
      phone: cleanText(body.phone),
      area: cleanText(body.area),
      address: cleanText(body.address),
      sort_order: Number(body.sortOrder || body.sort_order || 0),
      active: true,
      note: cleanText(body.note),
      geo_lat: geoLat,
      geo_lng: geoLng,
      geo_captured_at: geoLat !== null && geoLng !== null ? now : null,
      geo_source: geoLat !== null && geoLng !== null ? "manual" : null,
      created_at: now,
      updated_at: now,
      raw_payload: { source: "route_customer_create_api" }
    });

    return Response.json({ data: row, receivedAt: now });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "route_customer_create_failed" }, { status: 400 });
  }
}
