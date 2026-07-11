import { saveMcpSessionReportSnapshot } from "@/lib/mcp/session-report-snapshot";

export const dynamic = "force-dynamic";

const SUPABASE_URL = "https://noiadkpkvdohljgopgfb.supabase.co";

type Dict = Record<string, unknown>;

function cfg() {
  const url = String(
    process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      SUPABASE_URL
  )
    .trim()
    .replace(/\/+$/, "");

  const key = String(
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      ""
  ).trim();

  if (!url) throw new Error("missing_supabase_url");
  if (!key) throw new Error("missing_supabase_service_role_key");

  return { url, key };
}

function text(value: unknown) {
  const result = String(value ?? "").trim();
  return result || null;
}

function dateOnly(value: unknown) {
  const result = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(result) ? result : null;
}

function isCloseStatus(value: unknown) {
  const status = String(value || "").trim().toLowerCase();
  return status === "done" || status === "completed";
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function errorStatus(message: string) {
  if (message.includes("session_not_found")) return 404;
  if (
    message.includes("session_has_activity") ||
    message.includes("session_closed")
  ) {
    return 409;
  }
  if (message.includes("missing_supabase_service_role_key")) return 500;
  return 400;
}

async function rpc(name: string, args: Dict) {
  const env = cfg();
  const response = await fetch(`${env.url}/rest/v1/rpc/${name}`, {
    method: "POST",
    cache: "no-store",
    headers: {
      apikey: env.key,
      Authorization: `Bearer ${env.key}`,
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(args)
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      payload.message || payload.error || `supabase_${response.status}`
    );
  }

  return payload;
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = text(params.id);
    if (!id) throw new Error("session_id_required");

    const body = await request.json().catch(() => ({}));
    const data = await rpc("mcp_update_route_session", {
      p_session_id: id,
      p_session_date: dateOnly(body.sessionDate || body.session_date),
      p_status: text(body.status),
      p_note: body.note === undefined ? null : text(body.note)
    });

    const snapshot = isCloseStatus(body.status)
      ? await saveMcpSessionReportSnapshot(id, "close_session")
      : null;

    return Response.json(
      { data, snapshot, receivedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const message = errorMessage(error, "mcp_session_update_failed");
    return Response.json(
      { ok: false, error: message },
      { status: errorStatus(message) }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = text(params.id);
    if (!id) throw new Error("session_id_required");

    const data = await rpc("mcp_delete_empty_route_session", {
      p_session_id: id
    });

    if (!data || data.deleted !== true) {
      throw new Error("session_delete_not_applied");
    }

    return Response.json(
      { data, receivedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const message = errorMessage(error, "mcp_session_delete_failed");
    return Response.json(
      { ok: false, error: message },
      { status: errorStatus(message) }
    );
  }
}
