type QueryValue = string | number | boolean | null | undefined;

const DEFAULT_SUPABASE_URL = "https://noiadkpkvdohljgopgfb.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_n6LXv-fd-ImF3XzeU2mrjg_G7tBGy66";

const RAW_FILTER_PREFIXES = ["eq.", "neq.", "gte.", "lte.", "lt.", "gt.", "ilike.", "like.", "is.", "in."];

type RequestOptions = {
  select?: string;
  order?: string;
  limit?: number;
  filters?: Record<string, QueryValue>;
};

export function supabaseRestConfig() {
  const url = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL).trim().replace(/\/+$/, "");
  const key = String(
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    DEFAULT_SUPABASE_PUBLISHABLE_KEY
  ).trim();
  if (!url || !key) throw new Error("missing_supabase_config");
  return { url, key };
}

function filterValue(value: QueryValue) {
  if (value == null || value === "") return null;
  const text = String(value).trim();
  if (!text) return null;
  if (RAW_FILTER_PREFIXES.some((prefix) => text.startsWith(prefix))) return text;
  return `eq.${text}`;
}

export async function restRows<T>(table: string, options: RequestOptions = {}) {
  const cfg = supabaseRestConfig();
  const params = new URLSearchParams();
  params.set("select", options.select || "*");
  if (options.order) params.set("order", options.order);
  if (options.limit) params.set("limit", String(options.limit));
  Object.entries(options.filters || {}).forEach(([key, value]) => {
    const next = filterValue(value);
    if (next) params.set(key, next);
  });
  const response = await fetch(`${cfg.url}/rest/v1/${table}?${params.toString()}`, {
    cache: "no-store",
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      Accept: "application/json"
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || payload.error || `supabase_${response.status}`);
  return Array.isArray(payload) ? payload as T[] : [];
}

export function errorResponse(error: unknown) {
  return Response.json({ ok: false, error: error instanceof Error ? error.message : "export_failed" }, { status: 400, headers: { "Cache-Control": "no-store" } });
}
