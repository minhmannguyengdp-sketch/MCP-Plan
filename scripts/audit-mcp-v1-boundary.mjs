import fs from "node:fs";
import path from "node:path";

const root = "src/app/api";
const files = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) files.push(full);
  }
}

walk(root);

function isMcpRelevant(file) {
  const normalized = file.replaceAll("\\", "/");
  return normalized.includes("/mcp") || normalized.includes("/route-customers/") || normalized.endsWith("/route-customers/route.ts") || normalized.includes("/routes/") || normalized.endsWith("/routes/route.ts");
}

const relevant = files.filter(isMcpRelevant);
const violations = [];

for (const file of relevant) {
  const source = fs.readFileSync(file, "utf8");
  const hasDirectSupabase = /\/rest\/v1\/rpc\/|\/rest\/v1\/[a-z0-9_?]/i.test(source) || /supabase(?:Insert|Patch|Delete)\s*\(/.test(source);
  const hasMutationMethod = /method\s*:\s*["'`](POST|PATCH|DELETE)["'`]/i.test(source) || /export\s+async\s+function\s+(POST|PATCH|DELETE)\b/.test(source);
  const isThinProxy = source.includes("proxyBackendRequest") || source.includes("from \"@/app/api/backend/") || source.includes("from '@/app/api/backend/");

  if (hasDirectSupabase && hasMutationMethod && !isThinProxy) {
    violations.push(file.replaceAll("\\", "/"));
  }
}

const report = [
  "# MCP v1 Mutation Boundary Audit",
  "",
  `Scanned: ${relevant.length} MCP-relevant API source files.`,
  "",
  violations.length === 0
    ? "PASS: no live MCP mutation route writes directly from Next.js/Vercel to Supabase."
    : `FAIL: ${violations.length} direct mutation route(s) remain.`,
  "",
  ...violations.map((file) => `- ${file}`),
  "",
  "Expected runtime boundary: Browser -> Vercel proxy -> VPS backend -> Supabase service role.",
  ""
].join("\n");

fs.writeFileSync("docs/MCP_V1_BOUNDARY_AUDIT.md", report, "utf8");
console.log(report);

if (violations.length > 0) process.exit(1);
