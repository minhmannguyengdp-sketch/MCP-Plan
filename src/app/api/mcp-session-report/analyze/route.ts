import { backendApiBaseUrl, backendApiRequestHeaders } from "@/lib/api/backend-proxy";
import { mcpReportAgentHealthUrl, mcpReportAgentUrl } from "@/lib/mcp/report-agent-config";
import { buildSessionReportExportPayload } from "@/lib/mcp/session-report-export-v2";
import { loadMcpSessionReportSource } from "@/lib/mcp/session-report-source";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type AgentResult = {
  summary: string;
  market_insights: unknown[];
  product_insights: unknown[];
  customer_actions: unknown[];
  sample_requests: unknown[];
  follow_up_list: unknown[];
  order_opportunities: unknown[];
  risks: unknown[];
  next_steps: unknown[];
};

function text(value: unknown) {
  return String(value ?? "").trim();
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return { content: value };
  }
}

function list(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function fallbackResult(reason: string): AgentResult {
  return {
    summary: reason,
    market_insights: [],
    product_insights: [],
    customer_actions: [],
    sample_requests: [],
    follow_up_list: [],
    order_opportunities: [],
    risks: [reason],
    next_steps: ["Kiểm tra cấu hình và log MCP Report Agent."]
  };
}

function extractResult(payload: Record<string, unknown>) {
  const candidate =
    payload.result ||
    payload.output ||
    payload.analysis ||
    payload.response ||
    payload.answer ||
    payload.content ||
    payload;

  if (typeof candidate === "string") {
    const parsed = parseJson(candidate);
    return typeof parsed === "object" && parsed
      ? (parsed as Record<string, unknown>)
      : { summary: candidate };
  }

  return object(candidate);
}

function normalizeResult(value: unknown): AgentResult {
  const result = object(value);
  return {
    summary: text(result.summary || result.answer || result.text),
    market_insights: list(result.market_insights),
    product_insights: list(result.product_insights),
    customer_actions: list(result.customer_actions),
    sample_requests: list(result.sample_requests),
    follow_up_list: list(result.follow_up_list),
    order_opportunities: list(result.order_opportunities),
    risks: list(result.risks),
    next_steps: list(result.next_steps)
  };
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 55000
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store"
    });
  } finally {
    clearTimeout(timer);
  }
}

async function persistAgentResult(
  sessionId: string,
  aiResult: Record<string, unknown>
) {
  const analyzedAt = new Date().toISOString();
  const { headers } = backendApiRequestHeaders(undefined, {
    hasBody: true,
    contentType: "application/json"
  });
  const response = await fetch(
    `${backendApiBaseUrl()}/api/mcp-session-report/ai-result`,
    {
      method: "POST",
      cache: "no-store",
      headers,
      body: JSON.stringify({ sessionId, aiResult, analyzedAt })
    }
  );

  const payload = object(await response.json().catch(() => ({})));
  if (!response.ok) {
    throw new Error(text(payload.error || payload.message) || `save_ai_result_${response.status}`);
  }

  const data = object(payload.data);
  return {
    row: data.row,
    analyzedAt: text(data.analyzedAt) || analyzedAt
  };
}

export async function GET() {
  try {
    const response = await fetchWithTimeout(
      mcpReportAgentHealthUrl(),
      {
        method: "GET",
        headers: { Accept: "application/json" }
      },
      15000
    );

    const rawText = await response.text();
    const health = object(parseJson(rawText));

    return Response.json(
      {
        ok: response.ok && health.ok !== false,
        status: response.status,
        source: "mcp_report_agent_health",
        health,
        receivedAt: new Date().toISOString()
      },
      {
        status: response.ok ? 200 : 502,
        headers: { "Cache-Control": "no-store" }
      }
    );
  } catch (error) {
    const reason =
      error instanceof Error
        ? error.message
        : "mcp_report_agent_health_failed";

    return Response.json(
      { ok: false, error: reason },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function POST(request: Request) {
  const body = object(await request.json().catch(() => ({})));
  const sessionId = text(body.sessionId || body.session_id);

  if (!sessionId) {
    return Response.json(
      {
        ok: false,
        error: "session_id_required",
        result: fallbackResult("Thiếu sessionId để phân tích BC phiên.")
      },
      { status: 400 }
    );
  }

  try {
    const source = await loadMcpSessionReportSource({ sessionId });
    if (source.origin !== "snapshot" || !source.snapshotId) {
      return Response.json(
        {
          ok: false,
          source: "missing_snapshot",
          error: "session_report_snapshot_required",
          result: fallbackResult(
            "BC phiên chưa có snapshot chính thức. Hãy rebuild BC trước khi chạy AI."
          )
        },
        { status: 409, headers: { "Cache-Control": "no-store" } }
      );
    }

    const snapshot = buildSessionReportExportPayload(source);
    const agentUrl = mcpReportAgentUrl();
    const token = text(process.env.MCP_REPORT_AGENT_TOKEN);
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json; charset=utf-8"
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetchWithTimeout(agentUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        input: source.aiPromptContext,
        snapshot: source.aiPromptContext,
        report_type: snapshot.reportType,
        selected_items: source.customerDetails,
        selected_only: true,
        task: "mcp_session_report_analysis"
      })
    });

    const responseText = await response.text();
    const raw = object(parseJson(responseText));
    const result = normalizeResult(extractResult(raw));
    const agentOk = response.ok && raw.ok !== false;
    const agentSource = text(raw.source) || "mcp_report_agent_url";

    if (!agentOk) {
      return Response.json(
        {
          ok: false,
          source: agentSource,
          status: response.status,
          result,
          reportSource: source.origin,
          snapshotId: source.snapshotId,
          persisted: false,
          receivedAt: new Date().toISOString()
        },
        { status: 502, headers: { "Cache-Control": "no-store" } }
      );
    }

    const saved = await persistAgentResult(sessionId, {
      schemaVersion: "mcp.session-report.ai-result.v1",
      source: agentSource,
      status: response.status,
      result,
      generatedAt: new Date().toISOString()
    });

    return Response.json(
      {
        ok: true,
        source: agentSource,
        status: response.status,
        result,
        reportSource: source.origin,
        snapshotId: source.snapshotId,
        persisted: true,
        aiAnalyzedAt: saved.analyzedAt,
        receivedAt: new Date().toISOString()
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const reason =
      error instanceof Error
        ? error.name === "AbortError"
          ? "Agent phân tích quá thời gian chờ."
          : error.message
        : "mcp_report_agent_failed";

    return Response.json(
      {
        ok: false,
        source: "mcp_report_agent_exception",
        error: reason,
        result: fallbackResult(reason)
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
