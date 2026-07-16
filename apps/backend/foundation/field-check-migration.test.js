import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sql = await readFile(
  new URL("../../../supabase/migrations/20260716234500_field_check_mutation_owner.sql", import.meta.url),
  "utf8"
);

test("migration defines one locked service-role field-check update RPC", () => {
  assert.match(sql, /create or replace function public\.mcp_update_field_check_result\(/i);
  assert.match(sql, /for update;/i);
  assert.match(sql, /deleted_at is null/i);
  assert.match(sql, /field_check_result_not_found/i);
  assert.match(sql, /field_check_session_customer_mismatch/i);
  assert.match(sql, /grant execute on function public\.mcp_update_field_check_result[\s\S]+to service_role;/i);
  assert.match(sql, /revoke execute on function public\.mcp_update_field_check_result[\s\S]+from public, anon, authenticated;/i);
  assert.doesNotMatch(sql, /revoke all on function public\.mcp_update_field_check_result/i);
});

test("migration preserves raw payload and stores Foundation context", () => {
  assert.match(sql, /coalesce\(v_existing\.raw_payload, '\{\}'::jsonb\)/i);
  assert.match(sql, /'field_check_update'/i);
  assert.match(sql, /'foundation_context'/i);
  assert.doesNotMatch(sql, /raw_payload\s*=\s*p_input_meta/i);
});

test("migration closes direct mutation grants and permissive policies", () => {
  for (const policy of [
    "anon insert test customer results",
    "anon update test customer results",
    "anon insert market reports",
    "anon update market reports"
  ]) {
    assert.match(sql, new RegExp(`drop policy if exists "${policy}"`, "i"));
  }
  assert.match(sql, /revoke insert, update, delete, truncate, references, trigger on table public\.test_customer_results from anon, authenticated;/i);
  assert.match(sql, /revoke insert, update, delete, truncate, references, trigger on table public\.market_reports from anon, authenticated;/i);
});
