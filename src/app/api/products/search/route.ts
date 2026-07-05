export const dynamic = "force-dynamic";

const DEFAULT_SUPABASE_URL = "https://noiadkpkvdohljgopgfb.supabase.co";
const PRODUCTS_EDGE_URL = `${DEFAULT_SUPABASE_URL}/functions/v1/mcp-products`;

function supabaseEnv() {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL).trim();
  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    ""
  ).trim();
  return key ? { url: url.replace(/\/+$/, ""), key } : null;
}

async function rpc(name: string, args: Record<string, unknown>) {
  const env = supabaseEnv();
  if (!env) return fetchEdgeProducts(args);

  const response = await fetch(`${env.url}/rest/v1/rpc/${name}`, {
    method: "POST",
    cache: "no-store",
    headers: { apikey: env.key, Authorization: `Bearer ${env.key}`, Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(args)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || payload.error || `supabase_${response.status}`);
  return payload;
}

async function fetchEdgeProducts(args: Record<string, unknown>) {
  const params = new URLSearchParams();
  params.set("q", String(args.p_q || ""));
  params.set("category", String(args.p_category || ""));
  params.set("brand", String(args.p_brand || ""));
  params.set("limit", String(args.p_limit || 50));

  const response = await fetch(`${PRODUCTS_EDGE_URL}?${params.toString()}`, { cache: "no-store", headers: { Accept: "application/json" } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `edge_products_${response.status}`);
  return payload.data || [];
}

function boundedLimit(value: string | null) {
  const parsed = Number(value || 50);
  if (!Number.isFinite(parsed)) return 50;
  return Math.max(1, Math.min(Math.trunc(parsed), 100));
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const q = String(url.searchParams.get("q") || "").trim();
    const category = String(url.searchParams.get("category") || "").trim();
    const brand = String(url.searchParams.get("brand") || "").trim();
    const limit = boundedLimit(url.searchParams.get("limit"));

    const data = await rpc("mcp_search_products", {
      p_q: q,
      p_category: category,
      p_brand: brand,
      p_limit: limit
    });

    return Response.json({ data, receivedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "product_search_failed" }, { status: 400 });
  }
}
