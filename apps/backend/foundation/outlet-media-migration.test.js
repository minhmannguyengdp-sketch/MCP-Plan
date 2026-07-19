import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sql = await readFile(new URL("../../../supabase/migrations/20260719153000_add_mcp_outlet_media.sql", import.meta.url), "utf8");

test("outlet media migration owns pending to ready lifecycle", () => {
  assert.match(sql, /create table if not exists public\.mcp_outlet_media/i);
  assert.match(sql, /status in \('pending', 'ready', 'failed', 'deleted'\)/i);
  assert.match(sql, /unique \(installation_id, client_upload_id\)/i);
  assert.match(sql, /create or replace function public\.mcp_prepare_outlet_media_upload/i);
  assert.match(sql, /create or replace function public\.mcp_finalize_outlet_media_upload/i);
  assert.match(sql, /perform public\.mcp_assert_session_mutable/i);
  assert.match(sql, /route_customer_route_mismatch/i);
  assert.match(sql, /to service_role/i);
  assert.doesNotMatch(sql, /grant .* to (?:anon|authenticated)/i);
});
