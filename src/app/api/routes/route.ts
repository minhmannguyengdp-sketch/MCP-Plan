export const dynamic = "force-dynamic";

function env() {
  const url = (process.env.SUPABASE_URL || "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) throw new Error("missing_supabase_config");
  return { url: url.replace(/\/+$/, ""), key };
}

async function rpc(name: string, args: Record<string, unknown>) {
  const { url, key } = env();
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    cache: "no-store",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(args)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || payload.error || `supabase_${response.status}`);
  return payload;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const data = await rpc("mcp_create_route", {
      p_route_name: String(body.routeName || body.route_name || body.name || "").trim(),
      p_area: String(body.area || "").trim() || null,
      p_weekday: body.weekday === undefined || body.weekday === "" ? null : Number(body.weekday),
      p_note: String(body.note || "").trim() || null,
      p_distributor_id: String(body.distributorId || body.distributor_id || "").trim() || null
    });
    return Response.json({ data, receivedAt: new Date().toISOString() });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "route_create_failed" }, { status: 400 });
  }
}
