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

type ReportTemplate = {
  id: string;
  title: string;
  report_type: string;
  scope_type?: string | null;
  content?: string | null;
  price_summary?: string | null;
  competitor_summary?: string | null;
  display_summary?: string | null;
  stock_summary?: string | null;
  demand_summary?: string | null;
  opportunity_summary?: string | null;
  risk_summary?: string | null;
  next_action?: string | null;
  sort_order: number;
  note?: string | null;
  raw_payload?: Record<string, unknown> | null;
};

export async function GET() {
  try {
    const rows = await rest("mcp_report_templates?select=*&status=eq.active&order=sort_order.asc,title.asc") as ReportTemplate[];
    const templates = rows.map((row) => ({
      id: row.id,
      title: row.title,
      reportType: row.report_type,
      scopeType: row.scope_type || "global",
      content: row.content || "",
      priceSummary: row.price_summary || "",
      competitorSummary: row.competitor_summary || "",
      displaySummary: row.display_summary || "",
      stockSummary: row.stock_summary || "",
      demandSummary: row.demand_summary || "",
      opportunitySummary: row.opportunity_summary || "",
      riskSummary: row.risk_summary || "",
      nextAction: row.next_action || "",
      sortOrder: row.sort_order,
      note: row.note || "",
      meta: row.raw_payload || {}
    }));

    return Response.json({ data: { templates }, receivedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "mcp_report_templates_failed" }, { status: 400 });
  }
}
