import { readFile, writeFile } from "node:fs/promises";

const path = "supabase/migrations/20260717090000_idempotency_audit_core.sql";
let source = await readFile(path, "utf8");

const replacements = [
  [
    "revoke all on table public.mcp_idempotency_records from public, anon, authenticated;",
    "revoke select, insert, update, delete, truncate, references, trigger on table public.mcp_idempotency_records from public, anon, authenticated;"
  ],
  [
    "revoke all on table public.mcp_audit_events from public, anon, authenticated;",
    "revoke select, insert, update, delete, truncate, references, trigger on table public.mcp_audit_events from public, anon, authenticated;"
  ],
  [
    "revoke all on function public.mcp_reject_audit_event_mutation() from public, anon, authenticated, service_role;",
    "revoke execute on function public.mcp_reject_audit_event_mutation() from public, anon, authenticated, service_role;"
  ],
  [
    "revoke all on function public.mcp_idempotency_request_hash(text, jsonb) from public, anon, authenticated, service_role;",
    "revoke execute on function public.mcp_idempotency_request_hash(text, jsonb) from public, anon, authenticated, service_role;"
  ],
  [
    "revoke all on function public.mcp_append_audit_event(text, text, text, text, text, text, text, text, text, text, text, text, text, text, integer, text, text, text, text, jsonb) from public, anon, authenticated, service_role;",
    "revoke execute on function public.mcp_append_audit_event(text, text, text, text, text, text, text, text, text, text, text, text, text, text, integer, text, text, text, text, jsonb) from public, anon, authenticated, service_role;"
  ],
  [
    "revoke all on function public.mcp_idempotency_begin(text, text, text, text, text, text, jsonb, jsonb, integer) from public, anon, authenticated, service_role;",
    "revoke execute on function public.mcp_idempotency_begin(text, text, text, text, text, text, jsonb, jsonb, integer) from public, anon, authenticated, service_role;"
  ],
  [
    "revoke all on function public.mcp_idempotency_complete(uuid, integer, jsonb, text) from public, anon, authenticated, service_role;",
    "revoke execute on function public.mcp_idempotency_complete(uuid, integer, jsonb, text) from public, anon, authenticated, service_role;"
  ]
];

for (const [before, after] of replacements) {
  if (source.includes(after)) continue;
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`privilege_source_mismatch:${before}:${count}`);
  source = source.replace(before, after);
}

await writeFile(path, source, "utf8");
console.log("a551_core_privileges_tightened");
