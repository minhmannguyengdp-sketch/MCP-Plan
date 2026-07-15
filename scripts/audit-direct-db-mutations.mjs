import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_SCAN_ROOTS = [
  "src",
  "apps/backend",
  "supabase",
  "scripts",
  "ops",
  ".github",
  "agent-backend"
];

const IGNORED_DIRECTORIES = new Set([
  ".git",
  ".next",
  "node_modules",
  "coverage",
  "dist",
  "build"
]);

const SELF_EXCLUDED_FILES = new Set([
  "scripts/audit-direct-db-mutations.mjs",
  "scripts/direct-db-mutation-baseline.json"
]);

const SELF_EXCLUDED_PREFIXES = [
  "scripts/__tests__/fixtures/"
];

const SOURCE_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".py",
  ".ps1",
  ".yml",
  ".yaml",
  ".json"
]);

const MUTATION_METHOD_PATTERN = /\bmethod\s*:\s*["'`](POST|PUT|PATCH|DELETE)["'`]|\bmethod\s*=\s*["'`](POST|PUT|PATCH|DELETE)["'`]|\brequests\.(post|put|patch|delete)\s*\(|\bfetch\s*\([^)]*\{[\s\S]*?\bmethod\s*:\s*["'`](POST|PUT|PATCH|DELETE)["'`]/i;
const READ_METHOD_PATTERN = /\bmethod\s*:\s*["'`]GET["'`]|\bmethod\s*=\s*["'`]GET["'`]|\brequests\.get\s*\(/i;
const SERVICE_ROLE_PATTERN = /SUPABASE_SERVICE_ROLE_KEY|supabaseServiceRoleKey|service_role/i;

function normalizePath(value) {
  return value.split(path.sep).join("/");
}

function normalizeToken(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/["'`]/g, "")
    .trim()
    .slice(0, 180);
}

function hashFingerprint(parts) {
  return createHash("sha256").update(parts.join("\n")).digest("hex").slice(0, 24);
}

function classifyConsumer(relativePath, content) {
  if (relativePath.startsWith("src/")) {
    if (/^[\s\r\n]*["']use client["'];?/m.test(content)) return "browser";
    return relativePath.startsWith("src/app/api/") ? "next-server" : "next-server";
  }
  if (relativePath.startsWith("apps/backend/foundation/gateway")) return "gateway";
  if (relativePath.startsWith("apps/backend/")) return "backend";
  if (relativePath.startsWith("supabase/functions/")) return "edge";
  if (relativePath.startsWith("scripts/")) return "script";
  if (relativePath.startsWith(".github/")) return "ci";
  if (relativePath.startsWith("ops/")) return "admin";
  if (relativePath.startsWith("agent-backend/")) return "backend";
  return "unknown";
}

function lineNumberAt(content, index) {
  return content.slice(0, index).split(/\r?\n/).length;
}

function functionRanges(content) {
  const starts = [];
  const patterns = [
    /(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/g,
    /(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{/g,
    /(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?[A-Za-z_$][\w$]*\s*=>\s*\{/g
  ];

  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      const braceIndex = content.indexOf("{", match.index);
      if (braceIndex >= 0) starts.push({ name: match[1], start: match.index, braceIndex });
    }
  }

  starts.sort((a, b) => a.start - b.start);
  const ranges = [];
  for (const item of starts) {
    let depth = 0;
    let quote = null;
    let escaped = false;
    let end = content.length;
    for (let index = item.braceIndex; index < content.length; index += 1) {
      const char = content[index];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (quote) {
        if (char === quote) quote = null;
        continue;
      }
      if (char === '"' || char === "'" || char === "`") {
        quote = char;
        continue;
      }
      if (char === "{") depth += 1;
      if (char === "}") {
        depth -= 1;
        if (depth === 0) {
          end = index + 1;
          break;
        }
      }
    }
    ranges.push({ ...item, end, text: content.slice(item.start, end) });
  }
  return ranges;
}

function owningFunction(ranges, index) {
  const candidates = ranges.filter((range) => range.start <= index && index < range.end);
  if (candidates.length === 0) return { name: "<file>", start: 0, end: Number.MAX_SAFE_INTEGER };
  return candidates.sort((a, b) => b.start - a.start)[0];
}

function literalTargets(text, pattern, fallback) {
  const targets = new Set();
  for (const match of text.matchAll(pattern)) targets.add(normalizeToken(match[1] || fallback));
  if (targets.size === 0) targets.add(fallback);
  return [...targets];
}

function detectOperation(block, defaultOperation = "unknown") {
  if (MUTATION_METHOD_PATTERN.test(block)) return "mutation";
  if (READ_METHOD_PATTERN.test(block)) return "read";
  return defaultOperation;
}

function buildRawFinding({ relativePath, content, matchIndex, functionName, ruleCode, operation, providerSurface, target, evidence }) {
  const normalizedTarget = normalizeToken(target || "<dynamic>");
  const fingerprint = hashFingerprint([relativePath, ruleCode, functionName, normalizedTarget]);
  return {
    fingerprint,
    file: relativePath,
    line: lineNumberAt(content, matchIndex),
    functionName,
    consumer: classifyConsumer(relativePath, content),
    operation,
    providerSurface,
    classification: "unclassified",
    ruleCode,
    target: normalizedTarget,
    reason: "No audited baseline entry matches this finding.",
    replacementTarget: null,
    owner: null,
    replacementPhase: null,
    usesServiceRole: SERVICE_ROLE_PATTERN.test(content),
    evidence: normalizeToken(evidence)
  };
}

function detectFindings(relativePath, content) {
  const findings = [];
  const ranges = functionRanges(content);
  const emitted = new Set();

  function emit(input) {
    const finding = buildRawFinding({ relativePath, content, ...input });
    if (emitted.has(finding.fingerprint)) return;
    emitted.add(finding.fingerprint);
    findings.push(finding);
  }

  const providerImportPatterns = [
    ["SUPABASE_SDK_IMPORT", "sdk", /@supabase\/supabase-js/g],
    ["SUPABASE_CREATE_CLIENT", "sdk", /\bcreateClient\s*\(/g]
  ];
  for (const [ruleCode, providerSurface, pattern] of providerImportPatterns) {
    for (const match of content.matchAll(pattern)) {
      const owner = owningFunction(ranges, match.index);
      emit({
        matchIndex: match.index,
        functionName: owner.name,
        ruleCode,
        operation: "unknown",
        providerSurface,
        target: match[0],
        evidence: match[0]
      });
    }
  }

  const helperRules = [
    {
      ruleCode: "HELPER_REST_CALL",
      providerSurface: "rest",
      pattern: /\bsupabaseRest\s*\(/g,
      targets: (block) => literalTargets(block, /supabaseRest\s*\(\s*[^,]+,\s*["'`]([^"'`]+)["'`]/g, "<dynamic-rest-resource>"),
      operation: (block) => detectOperation(block, "read")
    },
    {
      ruleCode: "HELPER_RPC_CALL",
      providerSurface: "rpc",
      pattern: /\bsupabaseRpc\s*\(/g,
      targets: (block) => literalTargets(block, /supabaseRpc\s*\(\s*(?:[^,]+,\s*)?["'`]([^"'`]+)["'`]/g, "<dynamic-rpc>"),
      operation: () => "unknown"
    },
    {
      ruleCode: "HELPER_INSERT_CALL",
      providerSurface: "rest",
      pattern: /\bsupabaseInsert\s*\(/g,
      targets: (block) => literalTargets(block, /supabaseInsert\s*\(\s*["'`]([^"'`]+)["'`]/g, "<dynamic-table>"),
      operation: () => "mutation"
    },
    {
      ruleCode: "HELPER_PATCH_CALL",
      providerSurface: "rest",
      pattern: /\bsupabasePatch\s*\(/g,
      targets: (block) => literalTargets(block, /supabasePatch\s*\(\s*["'`]([^"'`]+)["'`]/g, "<dynamic-table>"),
      operation: () => "mutation"
    },
    {
      ruleCode: "HELPER_DELETE_CALL",
      providerSurface: "rest",
      pattern: /\bsupabaseDelete\s*\(/g,
      targets: (block) => literalTargets(block, /supabaseDelete\s*\(\s*["'`]([^"'`]+)["'`]/g, "<dynamic-table>"),
      operation: () => "mutation"
    }
  ];

  for (const rule of helperRules) {
    for (const match of content.matchAll(rule.pattern)) {
      const owner = owningFunction(ranges, match.index);
      const block = owner.text || content;
      for (const target of rule.targets(block)) {
        emit({
          matchIndex: match.index,
          functionName: owner.name,
          ruleCode: rule.ruleCode,
          operation: rule.operation(block),
          providerSurface: rule.providerSurface,
          target,
          evidence: match[0]
        });
      }
    }
  }

  const directHttpRules = [
    {
      ruleCode: "REST_HTTP_CALL",
      providerSurface: "rest",
      pattern: /\/rest\/v1\//g,
      targets: (block) => literalTargets(block, /\/rest\/v1\/([^?"'`\s)]+)/g, "<dynamic-rest-path>")
    },
    {
      ruleCode: "EDGE_HTTP_CALL",
      providerSurface: "edge-function",
      pattern: /\/functions\/v1\//g,
      targets: (block) => literalTargets(block, /\/functions\/v1\/([^?"'`\s)]+)/g, "<dynamic-edge-function>")
    }
  ];

  for (const rule of directHttpRules) {
    for (const match of content.matchAll(rule.pattern)) {
      const owner = owningFunction(ranges, match.index);
      const block = owner.text || content;
      for (const target of rule.targets(block)) {
        emit({
          matchIndex: match.index,
          functionName: owner.name,
          ruleCode: rule.ruleCode,
          operation: detectOperation(block, "read"),
          providerSurface: rule.providerSurface,
          target,
          evidence: match[0]
        });
      }
    }
  }

  const sdkMutationPattern = /\.(insert|update|upsert|delete)\s*\(/g;
  for (const match of content.matchAll(sdkMutationPattern)) {
    const owner = owningFunction(ranges, match.index);
    const block = owner.text || content;
    const tables = literalTargets(block, /\.from\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g, "<dynamic-sdk-table>");
    for (const table of tables) {
      emit({
        matchIndex: match.index,
        functionName: owner.name,
        ruleCode: `SDK_${match[1].toUpperCase()}`,
        operation: "mutation",
        providerSurface: "sdk",
        target: table,
        evidence: match[0]
      });
    }
  }

  const sdkReadPattern = /\.from\s*\(/g;
  for (const match of content.matchAll(sdkReadPattern)) {
    const owner = owningFunction(ranges, match.index);
    const block = owner.text || content;
    if (/\.(insert|update|upsert|delete)\s*\(/.test(block)) continue;
    const tables = literalTargets(block, /\.from\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g, "<dynamic-sdk-table>");
    for (const table of tables) {
      emit({
        matchIndex: match.index,
        functionName: owner.name,
        ruleCode: "SDK_FROM_READ",
        operation: "read",
        providerSurface: "sdk",
        target: table,
        evidence: match[0]
      });
    }
  }

  const sdkRpcPattern = /\.rpc\s*\(\s*["'`]([^"'`]+)["'`]/g;
  for (const match of content.matchAll(sdkRpcPattern)) {
    const owner = owningFunction(ranges, match.index);
    emit({
      matchIndex: match.index,
      functionName: owner.name,
      ruleCode: "SDK_RPC_CALL",
      operation: "unknown",
      providerSurface: "rpc",
      target: match[1],
      evidence: match[0]
    });
  }

  for (const match of content.matchAll(/\.storage\.from\s*\(|\bstorage\.from\s*\(/g)) {
    const owner = owningFunction(ranges, match.index);
    emit({
      matchIndex: match.index,
      functionName: owner.name,
      ruleCode: "STORAGE_FROM",
      operation: "unknown",
      providerSurface: "storage",
      target: "<storage-bucket>",
      evidence: match[0]
    });
  }

  for (const match of content.matchAll(/\.functions\.invoke\s*\(|\bfunctions\.invoke\s*\(/g)) {
    const owner = owningFunction(ranges, match.index);
    emit({
      matchIndex: match.index,
      functionName: owner.name,
      ruleCode: "FUNCTIONS_INVOKE",
      operation: "unknown",
      providerSurface: "edge-function",
      target: "<dynamic-edge-function>",
      evidence: match[0]
    });
  }

  return findings;
}

async function filesBelow(root, relativePath) {
  const absolutePath = path.join(root, relativePath);
  const info = await stat(absolutePath).catch(() => null);
  if (!info) return [];
  if (info.isFile()) return [normalizePath(relativePath)];

  const files = [];
  for (const entry of await readdir(absolutePath, { withFileTypes: true })) {
    if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) continue;
    const child = normalizePath(path.join(relativePath, entry.name));
    if (entry.isDirectory()) files.push(...await filesBelow(root, child));
    else if (SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) files.push(child);
  }
  return files;
}

function shouldExcludeFile(relativePath) {
  if (SELF_EXCLUDED_FILES.has(relativePath)) return true;
  return SELF_EXCLUDED_PREFIXES.some((prefix) => relativePath.startsWith(prefix));
}

function validateBaseline(entries) {
  const errors = [];
  const seen = new Set();
  for (const entry of entries) {
    if (!entry.fingerprint) errors.push("baseline_entry_missing_fingerprint");
    if (seen.has(entry.fingerprint)) errors.push(`duplicate_baseline_fingerprint:${entry.fingerprint}`);
    seen.add(entry.fingerprint);
    for (const field of ["classification", "operation", "owner", "reason", "replacementPhase"]) {
      if (!entry[field]) errors.push(`baseline_entry_missing_${field}:${entry.fingerprint || "unknown"}`);
    }
    if (!["approved-boundary", "known-legacy-debt"].includes(entry.classification)) {
      errors.push(`invalid_baseline_classification:${entry.fingerprint || "unknown"}`);
    }
  }
  return errors;
}

function applyBaseline(findings, baselineEntries) {
  const baselineByFingerprint = new Map(baselineEntries.map((entry) => [entry.fingerprint, entry]));
  return findings.map((finding) => {
    const baseline = baselineByFingerprint.get(finding.fingerprint);
    if (!baseline) return finding;
    return {
      ...finding,
      classification: baseline.classification,
      operation: baseline.operation,
      reason: baseline.reason,
      replacementTarget: baseline.replacementTarget || null,
      owner: baseline.owner,
      replacementPhase: baseline.replacementPhase
    };
  });
}

function validationErrors(findings, baselineEntries, baselineErrors) {
  const errors = [...baselineErrors];
  const findingByFingerprint = new Map(findings.map((finding) => [finding.fingerprint, finding]));

  for (const entry of baselineEntries) {
    if (!findingByFingerprint.has(entry.fingerprint)) errors.push(`stale_baseline:${entry.fingerprint}`);
  }

  for (const finding of findings) {
    if (finding.operation === "mutation" && finding.consumer === "browser") {
      finding.classification = "forbidden";
      finding.reason = "Browser/client code must not mutate Supabase directly.";
      errors.push(`browser_direct_mutation:${finding.fingerprint}`);
    }
    if (finding.classification === "unclassified") errors.push(`unclassified_finding:${finding.fingerprint}`);
    if (finding.operation === "mutation" && /READ/i.test(finding.ruleCode)) {
      errors.push(`mutation_mislabeled_read:${finding.fingerprint}`);
    }
    if (
      finding.operation === "mutation" &&
      finding.usesServiceRole &&
      !["backend", "edge", "script", "admin", "ci"].includes(finding.consumer)
    ) {
      errors.push(`service_role_wrong_consumer:${finding.fingerprint}`);
    }
    if (
      finding.operation === "mutation" &&
      finding.consumer === "edge" &&
      finding.classification !== "known-legacy-debt"
    ) {
      errors.push(`public_edge_mutation_not_legacy_debt:${finding.fingerprint}`);
    }
  }

  return [...new Set(errors)].sort();
}

function summarize(findings) {
  const summary = {
    total: findings.length,
    approved: 0,
    legacyDebt: 0,
    forbidden: 0,
    unclassified: 0,
    read: 0,
    mutation: 0,
    unknownOperation: 0
  };
  for (const finding of findings) {
    if (finding.classification === "approved-boundary") summary.approved += 1;
    if (finding.classification === "known-legacy-debt") summary.legacyDebt += 1;
    if (finding.classification === "forbidden") summary.forbidden += 1;
    if (finding.classification === "unclassified") summary.unclassified += 1;
    if (finding.operation === "read") summary.read += 1;
    else if (finding.operation === "mutation") summary.mutation += 1;
    else summary.unknownOperation += 1;
  }
  return summary;
}

function textReport(result) {
  const status = result.errors.length === 0 ? "direct_db_mutation_audit_passed" : "direct_db_mutation_audit_failed";
  const lines = [
    status,
    `files=${result.files.length}`,
    `findings=${result.summary.total}`,
    `approved=${result.summary.approved}`,
    `legacy_debt=${result.summary.legacyDebt}`,
    `forbidden=${result.summary.forbidden}`,
    `unclassified=${result.summary.unclassified}`,
    `read=${result.summary.read}`,
    `mutation=${result.summary.mutation}`,
    `unknown_operation=${result.summary.unknownOperation}`
  ];

  if (result.errors.length) {
    lines.push("", "errors:");
    for (const error of result.errors) lines.push(`- ${error}`);
  }

  if (result.findings.length) {
    lines.push("", "findings:");
    for (const finding of result.findings) {
      lines.push(
        `- ${finding.fingerprint} ${finding.classification} ${finding.operation} ${finding.consumer} ${finding.providerSurface} ${finding.file}:${finding.line} ${finding.functionName} ${finding.ruleCode} target=${finding.target}`,
        `  reason=${finding.reason}`,
        `  owner=${finding.owner || "-"} replacementPhase=${finding.replacementPhase || "-"} replacementTarget=${finding.replacementTarget || "-"}`
      );
    }
  }
  return `${lines.join("\n")}\n`;
}

export async function scanRepository({
  root = process.cwd(),
  scanRoots = DEFAULT_SCAN_ROOTS,
  baselinePath = "scripts/direct-db-mutation-baseline.json",
  writeReports = true,
  findingsTextPath = "direct-db-mutation-findings.txt",
  findingsJsonPath = "direct-db-mutation-findings.json"
} = {}) {
  const files = [];
  for (const scanRoot of scanRoots) files.push(...await filesBelow(root, scanRoot));
  const uniqueFiles = [...new Set(files.map(normalizePath))]
    .filter((file) => !shouldExcludeFile(file))
    .sort();

  const rawFindings = [];
  for (const relativePath of uniqueFiles) {
    const content = await readFile(path.join(root, relativePath), "utf8").catch(() => "");
    rawFindings.push(...detectFindings(relativePath, content));
  }
  rawFindings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.ruleCode.localeCompare(b.ruleCode));

  const baselineDocument = JSON.parse(await readFile(path.join(root, baselinePath), "utf8"));
  const baselineEntries = Array.isArray(baselineDocument.entries) ? baselineDocument.entries : [];
  const baselineErrors = validateBaseline(baselineEntries);
  const findings = applyBaseline(rawFindings, baselineEntries);
  const errors = validationErrors(findings, baselineEntries, baselineErrors);
  const result = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    scanRoots,
    files: uniqueFiles,
    summary: summarize(findings),
    errors,
    findings
  };

  if (writeReports) {
    await writeFile(path.join(root, findingsTextPath), textReport(result), "utf8");
    await writeFile(path.join(root, findingsJsonPath), `${JSON.stringify(result, null, 2)}\n`, "utf8");
  }
  return result;
}

async function main() {
  let result;
  try {
    result = await scanRepository();
  } catch (error) {
    const failure = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      scanRoots: DEFAULT_SCAN_ROOTS,
      files: [],
      summary: summarize([]),
      errors: [`scanner_error:${error?.message || String(error)}`],
      findings: []
    };
    await writeFile("direct-db-mutation-findings.txt", textReport(failure), "utf8").catch(() => {});
    await writeFile("direct-db-mutation-findings.json", `${JSON.stringify(failure, null, 2)}\n`, "utf8").catch(() => {});
    console.error(textReport(failure).trimEnd());
    process.exitCode = 1;
    return;
  }

  const report = textReport(result);
  if (result.errors.length) {
    console.error(report.trimEnd());
    process.exitCode = 1;
  } else {
    console.log(report.trimEnd());
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) await main();
