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

function text(value: unknown) {
  const clean = String(value || "").trim();
  return clean || null;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const selected = body.selected && typeof body.selected === "object" ? body.selected : {};
    const fields = body.fields && typeof body.fields === "object" ? body.fields : {};
    const payload = {
      report_date: text(body.reportDate) || today(),
      sales: text(body.sales || body.owner),
      market_area: text(body.marketArea || body.area),
      route_name: text(body.routeName),
      market_type: text(body.reportType) || "market_report",
      competitor_summary: text(fields.competitorSummary || body.competitorSummary),
      price_summary: text(fields.priceSummary || body.priceSummary),
      demand_summary: text(fields.demandSummary || body.demandSummary),
      company_product_summary: text(fields.companyProductSummary || body.companyProductSummary),
      opportunity_summary: text(fields.opportunitySummary || body.opportunitySummary),
      risk_summary: text(fields.riskSummary || body.riskSummary),
      next_action: text(fields.nextAction || body.nextAction),
      note: text(body.content || body.note),
      sync_status: "mcp_session",
      raw_payload: { source: "mcp_market_report_api", sessionCustomerId: body.sessionCustomerId || null, templateId: body.templateId || null, selected, fields, content: body.content || body.note || "" }
    };
    const data = await rest("market_reports", { method: "POST", body: JSON.stringify(payload) });
    return Response.json({ data, receivedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "mcp_market_report_save_failed" }, { status: 400 });
  }
}
