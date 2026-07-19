import { readFile, writeFile } from "node:fs/promises";

const target = "apps/backend/server.js";
const functionNames = [
  "normalizeMcpOrderTemplateItems",
  "saveMcpOrderTemplateSettings",
  "normalizeMcpTestTemplateItems",
  "saveMcpTestTemplateSettings",
  "saveMcpReportTemplateSettings",
  "saveMcpFollowupTemplateSettings",
  "normalizeMcpSkipReasonItems",
  "saveMcpSkipReasonTemplateSettings",
  "normalizeMcpCustomerAddMode",
  "saveMcpCustomerAddRuleSettings",
  "normalizeMcpRouteSessionStatus",
  "saveMcpRouteSessionStatusSettings"
];

const postLines = [
  '  if (url.pathname === "/api/mcp-settings/order-template") return wrap(await saveMcpOrderTemplateSettings(await readJsonBody(req)));\n',
  '  if (url.pathname === "/api/mcp-settings/test-template") return wrap(await saveMcpTestTemplateSettings(await readJsonBody(req)));\n',
  '  if (url.pathname === "/api/mcp-settings/report-template") return wrap(await saveMcpReportTemplateSettings(await readJsonBody(req)));\n',
  '  if (url.pathname === "/api/mcp-settings/followup-template") return wrap(await saveMcpFollowupTemplateSettings(await readJsonBody(req)));\n',
  '  if (url.pathname === "/api/mcp-settings/skip-reason-template") return wrap(await saveMcpSkipReasonTemplateSettings(await readJsonBody(req)));\n',
  '  if (url.pathname === "/api/mcp-settings/customer-add-rule") return wrap(await saveMcpCustomerAddRuleSettings(await readJsonBody(req)));\n',
  '  if (url.pathname === "/api/mcp-settings/session-status") return wrap(await saveMcpRouteSessionStatusSettings(await readJsonBody(req)));\n'
];

function count(source, needle) {
  return source.split(needle).length - 1;
}

function removeFunction(source, name) {
  const asyncMarker = `async function ${name}(`;
  const plainMarker = `function ${name}(`;
  const marker = source.includes(asyncMarker) ? asyncMarker : plainMarker;
  if (count(source, marker) !== 1) throw new Error(`unexpected_function_marker:${name}:${count(source, marker)}`);

  const start = source.indexOf(marker);
  const openingBrace = source.indexOf("{", start);
  if (openingBrace < 0) throw new Error(`function_opening_brace_missing:${name}`);

  let depth = 0;
  let state = "code";
  let quote = "";

  for (let index = openingBrace; index < source.length; index += 1) {
    const current = source[index];
    const next = source[index + 1] || "";

    if (state === "code") {
      if (current === "'" || current === '"' || current === "`") {
        state = "string";
        quote = current;
      } else if (current === "/" && next === "/") {
        state = "line-comment";
        index += 1;
      } else if (current === "/" && next === "*") {
        state = "block-comment";
        index += 1;
      } else if (current === "{") {
        depth += 1;
      } else if (current === "}") {
        depth -= 1;
        if (depth === 0) {
          let end = index + 1;
          while (source[end] === " " || source[end] === "\t") end += 1;
          if (source[end] === "\r") end += 1;
          if (source[end] === "\n") end += 1;
          if (source[end] === "\n") end += 1;
          return `${source.slice(0, start)}${source.slice(end)}`;
        }
      }
    } else if (state === "string") {
      if (current === "\\") index += 1;
      else if (current === quote) state = "code";
    } else if (state === "line-comment") {
      if (current === "\n") state = "code";
    } else if (state === "block-comment" && current === "*" && next === "/") {
      state = "code";
      index += 1;
    }
  }

  throw new Error(`function_not_closed:${name}`);
}

let source = await readFile(target, "utf8");
const original = source;

for (const name of functionNames) source = removeFunction(source, name);

for (const line of postLines) {
  if (count(source, line) !== 1) throw new Error(`unexpected_post_route_marker:${line.trim()}:${count(source, line)}`);
  source = source.replace(line, "");
}

for (const name of functionNames) {
  if (source.includes(name)) throw new Error(`retired_symbol_still_present:${name}`);
}

if (source === original) throw new Error("retirement_transform_no_change");
await writeFile(target, source, "utf8");
console.log(JSON.stringify({ target, removedFunctions: functionNames.length, removedPostRoutes: postLines.length }));
