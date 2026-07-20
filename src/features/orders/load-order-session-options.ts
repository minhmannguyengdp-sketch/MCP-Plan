import "server-only";

import { backendApiBaseUrl, backendApiRequestHeaders } from "@/lib/api/backend-proxy";
import type { OrderSessionOption } from "./order-create.types";

type SessionStatusRow = {
  id?: unknown;
  routeId?: unknown;
  routeName?: unknown;
  sessionDate?: unknown;
  status?: unknown;
  plannedCustomers?: unknown;
  visitedCustomers?: unknown;
};

type SessionStatusPayload = {
  data?: { sessions?: SessionStatusRow[] };
  error?: unknown;
  detail?: unknown;
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function count(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function normalizeStatus(value: unknown): OrderSessionOption["status"] | null {
  const status = text(value).toLowerCase();
  if (status === "active") return "active";
  if (status === "done" || status === "completed") return "done";
  return null;
}

function normalizeSession(row: SessionStatusRow): OrderSessionOption | null {
  const id = text(row.id);
  const routeId = text(row.routeId);
  const routeName = text(row.routeName) || routeId;
  const sessionDate = text(row.sessionDate).slice(0, 10);
  const status = normalizeStatus(row.status);
  if (!id || !routeId || !sessionDate || !status) return null;
  return {
    id,
    routeId,
    routeName,
    sessionDate,
    status,
    plannedCustomers: count(row.plannedCustomers),
    visitedCustomers: count(row.visitedCustomers)
  };
}

async function loadRouteSessions(routeId: string) {
  const target = new URL("/api/mcp-settings/session-status", `${backendApiBaseUrl()}/`);
  target.searchParams.set("routeId", routeId);
  const { headers } = backendApiRequestHeaders();
  const response = await fetch(target, { cache: "no-store", headers });
  const payload = await response.json().catch(() => ({})) as SessionStatusPayload;
  if (!response.ok) throw new Error(text(payload.detail) || `session_status_${response.status}`);
  return Array.isArray(payload.data?.sessions) ? payload.data.sessions : [];
}

export async function loadOrderSessionOptions(routeIds: string[]): Promise<OrderSessionOption[]> {
  const uniqueRouteIds = Array.from(new Set(routeIds.map(text).filter(Boolean)));
  if (uniqueRouteIds.length === 0) return [];

  const routeRows = await Promise.all(uniqueRouteIds.map(loadRouteSessions));
  const sessions = new Map<string, OrderSessionOption>();
  routeRows.flat().forEach((row) => {
    const session = normalizeSession(row);
    if (session) sessions.set(session.id, session);
  });

  return Array.from(sessions.values()).sort((left, right) => {
    if (left.status !== right.status) return left.status === "active" ? -1 : 1;
    return `${right.sessionDate}-${right.routeName}`.localeCompare(`${left.sessionDate}-${left.routeName}`, "vi");
  });
}
