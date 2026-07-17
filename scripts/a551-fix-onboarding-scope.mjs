import { readFile, writeFile } from "node:fs/promises";

async function replaceOnce(path, before, after) {
  const source = await readFile(path, "utf8");
  if (source.includes(after)) return;
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${path}: expected one source match, found ${count}`);
  await writeFile(path, source.replace(before, after), "utf8");
}

await replaceOnce(
  "src/features/mcp/McpSessionsManagerSafe.tsx",
  `async function callApi(path: string, init: RequestInit) {
  const method = String(init.method || "POST").toUpperCase();
  const response = await idempotentMutationFetch(
    path,
    {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      ...init,
      method
    },
    { operation: \`mcp-session-manager.\${method.toLowerCase()}\` }
  );

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || payload.message || "Không xử lý được phiên");
  }

  return payload;
}`,
  `async function parseApiResponse(response: Response) {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error?.message || payload.error || payload.message || "Không xử lý được phiên");
  }

  return payload;
}

async function callApi(path: string, init: RequestInit) {
  const response = await fetch(path, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    ...init
  });
  return parseApiResponse(response);
}

async function callIdempotentApi(path: string, init: RequestInit, operation: string) {
  const response = await idempotentMutationFetch(
    path,
    {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      ...init
    },
    { operation }
  );
  return parseApiResponse(response);
}`
);

await replaceOnce(
  "src/features/mcp/McpSessionsManagerSafe.tsx",
  `        await callApi("/api/mcp-session-report", {
          method: "POST",
          body: JSON.stringify({
            sessionId: session.id,
            source: "manual_rebuild_from_sessions_page"
          })
        });`,
  `        await callIdempotentApi(
          "/api/mcp-session-report",
          {
            method: "POST",
            body: JSON.stringify({
              sessionId: session.id,
              source: "manual_rebuild_from_sessions_page"
            })
          },
          "session-report.snapshot.create"
        );`
);

await replaceOnce(
  "src/lib/api/api-client.ts",
  `async function postJson<T>(
  baseUrl: string,
  path: string,
  backendApiToken: string | null,
  body: unknown
): Promise<ApiResult<T>> {
  const response = await idempotentMutationFetch(
    \`\${baseUrl}\${path}\`,
    {
      method: "POST",
      headers: backendHeaders(backendApiToken, true),
      body: JSON.stringify(body)
    },
    { operation: \`api-client\${path}\` }
  );
  const payload = (await response.json().catch(() => ({}))) as T | { data: T; receivedAt?: string; error?: string; detail?: string };
  if (!response.ok) {
    const errorPayload = payload as { error?: string; detail?: string };
    throw new Error(errorPayload.error || \`API \${path} failed with \${response.status}\`);
  }
  if (payload && typeof payload === "object" && "data" in payload) {
    const wrapped = payload as { data: T; receivedAt?: string };
    return { data: wrapped.data, source: "api", receivedAt: wrapped.receivedAt ?? new Date().toISOString() };
  }
  return result(payload as T, "api");
}`,
  `async function parseMutationResponse<T>(response: Response, path: string): Promise<ApiResult<T>> {
  const payload = (await response.json().catch(() => ({}))) as T | { data: T; receivedAt?: string; error?: { message?: string } | string; detail?: string };
  if (!response.ok) {
    const errorPayload = payload as { error?: { message?: string } | string; detail?: string };
    const message = typeof errorPayload.error === "string" ? errorPayload.error : errorPayload.error?.message;
    throw new Error(message || \`API \${path} failed with \${response.status}\`);
  }
  if (payload && typeof payload === "object" && "data" in payload) {
    const wrapped = payload as { data: T; receivedAt?: string };
    return { data: wrapped.data, source: "api", receivedAt: wrapped.receivedAt ?? new Date().toISOString() };
  }
  return result(payload as T, "api");
}

async function postJson<T>(
  baseUrl: string,
  path: string,
  backendApiToken: string | null,
  body: unknown
): Promise<ApiResult<T>> {
  const response = await fetch(\`\${baseUrl}\${path}\`, {
    method: "POST",
    cache: "no-store",
    headers: backendHeaders(backendApiToken, true),
    body: JSON.stringify(body)
  });
  return parseMutationResponse<T>(response, path);
}

async function postIdempotentJson<T>(
  baseUrl: string,
  path: string,
  backendApiToken: string | null,
  body: unknown,
  operation: string
): Promise<ApiResult<T>> {
  const response = await idempotentMutationFetch(
    \`\${baseUrl}\${path}\`,
    {
      method: "POST",
      headers: backendHeaders(backendApiToken, true),
      body: JSON.stringify(body)
    },
    { operation }
  );
  return parseMutationResponse<T>(response, path);
}`
);

await replaceOnce(
  "src/lib/api/api-client.ts",
  `    createMcpDayResult(payload) { return postJson<McpDayActionResult>(baseUrl, "/api/mcp-day/session-customer/result", backendApiToken, payload); },
    addMcpDayCustomer(payload) { return postJson<McpDayActionResult>(baseUrl, "/api/mcp-day/session-customer/add", backendApiToken, payload); },
    createMcpDayFollowup(payload) { return postJson<McpDayActionResult>(baseUrl, "/api/mcp-day/session-customer/followup", backendApiToken, payload); },`,
  `    createMcpDayResult(payload) { return postIdempotentJson<McpDayActionResult>(baseUrl, "/api/mcp-day/session-customer/result", backendApiToken, payload, "session-customer.result.record"); },
    addMcpDayCustomer(payload) { return postIdempotentJson<McpDayActionResult>(baseUrl, "/api/mcp-day/session-customer/add", backendApiToken, payload, "session-customer.add"); },
    createMcpDayFollowup(payload) { return postJson<McpDayActionResult>(baseUrl, "/api/mcp-day/session-customer/followup", backendApiToken, payload); },`
);

console.log("a551_onboarding_scope_fixed");
