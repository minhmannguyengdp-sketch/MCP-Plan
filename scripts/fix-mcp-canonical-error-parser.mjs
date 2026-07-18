import { readFile, writeFile } from "node:fs/promises";

const path = "src/features/mcp/McpSessionCompactViewFinal2.tsx";
let source = await readFile(path, "utf8");

const helperMarker = `}\n\nfunction appendToken(current: string, token: string) {`;
const helper = `}\n\nfunction apiErrorMessage(payload: unknown, fallback: string) {\n  if (!payload || typeof payload !== "object") return fallback;\n  const value = payload as { error?: string | { message?: string }; detail?: string; message?: string };\n  if (typeof value.error === "string" && value.error.trim()) return value.error;\n  if (value.error && typeof value.error === "object" && value.error.message?.trim()) return value.error.message;\n  return value.detail || value.message || fallback;\n}\n\nfunction appendToken(current: string, token: string) {`;

if (!source.includes("function apiErrorMessage(")) {
  if (!source.includes(helperMarker)) throw new Error("helper_marker_not_found");
  source = source.replace(helperMarker, helper);
}

const replacements = [
  [
    `  if (!response.ok) {\n    const err = payload as { error?: string | { message?: string }; detail?: string };\n    const errorMessage = typeof err.error === "string" ? err.error : err.error?.message;\n    throw new Error(errorMessage || err.detail || "Không lưu được hành động MCP");\n  }`,
    `  if (!response.ok) throw new Error(apiErrorMessage(payload, "Không lưu được hành động MCP"));`
  ],
  [
    `  if (!response.ok) {\n    const err = payload as { error?: string; detail?: string };\n    throw new Error(err.error || err.detail || "Không tìm được sản phẩm");\n  }`,
    `  if (!response.ok) throw new Error(apiErrorMessage(payload, "Không tìm được sản phẩm"));`
  ],
  [
    `  if (!response.ok) {\n    const err = payload as { error?: string; detail?: string };\n    throw new Error(err.error || err.detail || "Không tải được quy cách sản phẩm");\n  }`,
    `  if (!response.ok) throw new Error(apiErrorMessage(payload, "Không tải được quy cách sản phẩm"));`
  ]
];

for (const [before, after] of replacements) {
  if (source.includes(before)) source = source.replace(before, after);
  else if (!source.includes(after)) throw new Error(`replacement_not_found:${after}`);
}

await writeFile(path, source);
console.log("canonical error parser applied");
