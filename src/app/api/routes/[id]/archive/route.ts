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

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const data = await rpc("mcp_delete_route_hard", { p_route_id: params.id });
    return Response.json({ data, receivedAt: new Date().toISOString() });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "route_hard_delete_failed" }, { status: 400 });
  }
}
