export const dynamic = "force-dynamic";

const DEFAULT_SUPABASE_URL = "https://noiadkpkvdohljgopgfb.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_n6LXv-fd-ImF3XzeU2mrjg_G7tBGy66";

type Dict = Record<string, unknown>;

function text(value: unknown) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function env() {
  const url = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL).trim().replace(/\/+$/, "");
  const key = String(
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    DEFAULT_SUPABASE_PUBLISHABLE_KEY
  ).trim();
  if (!url || !key) throw new Error("missing_supabase_config");
  return { url, key };
}

function headers(extra?: HeadersInit) {
  const cfg = env();
  return {
    apikey: cfg.key,
    Authorization: `Bearer ${cfg.key}`,
    Accept: "application/json",
    ...extra
  };
}

function eq(value: string) {
  return `eq.${encodeURIComponent(value)}`;
}

function safeStatus(value: unknown) {
  const normalized = String(value || "normal").trim().toLowerCase();
  if (["normal", "opportunity", "risk"].includes(normalized)) return normalized;
  return "normal";
}

function rawPayload(body: Dict) {
  return {
    ...body,
    source: "field_checks_session_admin",
    session_id: text(body.sessionId || body.session_id),
    session_customer_id: text(body.sessionCustomerId || body.session_customer_id),
    route_id: text(body.routeId || body.route_id),
    session_date: text(body.sessionDate || body.session_date)
  };
}

async function supabaseWrite(method: "POST" | "PATCH", path: string, body: Dict) {
  const cfg = env();
  const response = await fetch(`${cfg.url}${path}`, {
    method,
    cache: "no-store",
    headers: headers({ "Content-Type": "application/json", Prefer: "return=representation" }),
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || payload.error || `supabase_${response.status}`);
  return Array.isArray(payload) ? payload[0] : payload;
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({})) as Dict;
    const resultId = text(body.resultId || body.result_id);
    const fileId = text(body.fileId || body.file_id);
    const customerId = text(body.customerId || body.customer_id);
    const productName = text(body.productName || body.product_name);

    if (!productName) throw new Error("product_name_required");
    if (!resultId && (!fileId || !customerId)) throw new Error("file_id_and_customer_id_required");

    const payload: Dict = {
      product_id: text(body.productId || body.product_id),
      product_name: productName,
      status: safeStatus(body.status),
      note: text(body.note),
      sync_status: "pending",
      raw_payload: rawPayload(body)
    };

    const data = resultId
      ? await supabaseWrite("PATCH", `/rest/v1/test_customer_results?id=${eq(resultId)}&select=*`, payload)
      : await supabaseWrite("POST", "/rest/v1/test_customer_results?select=*", {
          id: `test-result-${crypto.randomUUID()}`,
          file_id: fileId,
          customer_id: customerId,
          ...payload
        });

    return Response.json({ data, receivedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "field_check_save_failed" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
