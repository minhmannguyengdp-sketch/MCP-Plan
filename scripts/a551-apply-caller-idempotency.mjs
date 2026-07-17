import { readFile, writeFile } from "node:fs/promises";

async function patch(path, transforms) {
  let source = await readFile(path, "utf8");
  let changed = false;

  for (const [before, after] of transforms) {
    if (source.includes(after)) continue;
    const count = source.split(before).length - 1;
    if (count !== 1) throw new Error(`${path}: expected one source match, found ${count}`);
    source = source.replace(before, after);
    changed = true;
  }

  if (changed) await writeFile(path, source, "utf8");
}

await patch("src/lib/api/api-client.ts", [
  [
    'import type { AccountDto, ActionDto, ApiResult, DashboardOverviewDto, DashboardSummaryDto, DayRunDto, ListQuery, MarketCheckDto, OrderDto, RouteDto } from "./api.types";',
    'import type { AccountDto, ActionDto, ApiResult, DashboardOverviewDto, DashboardSummaryDto, DayRunDto, ListQuery, MarketCheckDto, OrderDto, RouteDto } from "./api.types";\nimport { idempotentMutationFetch } from "./idempotent-fetch";'
  ],
  [
    '  const response = await fetch(`${baseUrl}${path}`, {\n    method: "POST",\n    cache: "no-store",\n    headers: backendHeaders(backendApiToken, true),\n    body: JSON.stringify(body)\n  });',
    '  const response = await idempotentMutationFetch(\n    `${baseUrl}${path}`,\n    {\n      method: "POST",\n      headers: backendHeaders(backendApiToken, true),\n      body: JSON.stringify(body)\n    },\n    { operation: `api-client${path}` }\n  );'
  ]
]);

await patch("src/features/mcp/McpSessionsManagerSafe.tsx", [
  [
    'import { userFacingError } from "@/lib/ui/user-facing-error";',
    'import { userFacingError } from "@/lib/ui/user-facing-error";\nimport { idempotentMutationFetch } from "@/lib/api/idempotent-fetch";'
  ],
  [
    '  const response = await fetch(path, {\n    cache: "no-store",\n    headers: {\n      Accept: "application/json",\n      "Content-Type": "application/json"\n    },\n    ...init\n  });',
    '  const method = String(init.method || "POST").toUpperCase();\n  const response = await idempotentMutationFetch(\n    path,\n    {\n      headers: {\n        Accept: "application/json",\n        "Content-Type": "application/json"\n      },\n      ...init,\n      method\n    },\n    { operation: `mcp-session-manager.${method.toLowerCase()}` }\n  );'
  ]
]);

await patch("src/lib/api/backend-proxy.ts", [
  [
    '  requestId?: string;\n};',
    '  requestId?: string;\n  idempotencyKey?: string;\n};'
  ],
  [
    '  const idempotencyKey = request?.headers.get("idempotency-key");',
    '  const idempotencyKey = options.idempotencyKey || request?.headers.get("idempotency-key");'
  ]
]);

await patch("src/app/api/mcp-session-report/analyze/route.ts", [
  [
    '  requestId: string\n) {',
    '  requestId: string,\n  idempotencyKey: string\n) {'
  ],
  [
    '    contentType: "application/json"\n  });',
    '    contentType: "application/json",\n    idempotencyKey\n  });'
  ],
  [
    '  const requestId = normalizeApiRequestId(request.headers.get("x-request-id"));\n  let body: Record<string, unknown>;',
    '  const requestId = normalizeApiRequestId(request.headers.get("x-request-id"));\n  const idempotencyKey = text(request.headers.get("idempotency-key"));\n  let body: Record<string, unknown>;'
  ],
  [
    '  const sessionId = text(body.sessionId || body.session_id);',
    '  if (!idempotencyKey) {\n    return apiErrorResponse("IDEMPOTENCY_KEY_REQUIRED", {\n      requestId,\n      status: 400\n    });\n  }\n\n  const sessionId = text(body.sessionId || body.session_id);'
  ],
  [
    '      requestId\n    );',
    '      requestId,\n      idempotencyKey\n    );'
  ]
]);

await patch("src/features/market-reports/MarketReportsClientPage.tsx", [
  [
    'import { userFacingError } from "@/lib/ui/user-facing-error";',
    'import { userFacingError } from "@/lib/ui/user-facing-error";\nimport { idempotentMutationFetch } from "@/lib/api/idempotent-fetch";'
  ],
  [
    '      const response = await fetch("/api/mcp-session-report/analyze", {\n        method: "POST",\n        cache: "no-store",\n        headers: { Accept: "application/json", "Content-Type": "application/json" },\n        body: JSON.stringify({ sessionId: report.sessionId })\n      });',
    '      const response = await idempotentMutationFetch(\n        "/api/mcp-session-report/analyze",\n        {\n          method: "POST",\n          headers: { Accept: "application/json", "Content-Type": "application/json" },\n          body: JSON.stringify({ sessionId: report.sessionId })\n        },\n        { operation: "session-report.analyze" }\n      );'
  ]
]);

console.log("a551_caller_patch_complete");
