import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const createSql = await readFile(new URL("../../../supabase/migrations/20260719153000_add_mcp_outlet_media.sql", import.meta.url), "utf8");
const deleteSql = await readFile(new URL("../../../supabase/migrations/20260719160000_add_outlet_media_deletion_lifecycle.sql", import.meta.url), "utf8");

test("outlet media migration owns pending to ready lifecycle", () => {
  assert.match(createSql, /create table if not exists public\.mcp_outlet_media/i);
  assert.match(createSql, /status in \('pending', 'ready', 'failed', 'deleted'\)/i);
  assert.match(createSql, /unique \(installation_id, client_upload_id\)/i);
  assert.match(createSql, /create or replace function public\.mcp_prepare_outlet_media_upload/i);
  assert.match(createSql, /create or replace function public\.mcp_finalize_outlet_media_upload/i);
  assert.match(createSql, /perform public\.mcp_assert_session_mutable/i);
  assert.match(createSql, /route_customer_route_mismatch/i);
  assert.match(createSql, /to service_role/i);
  assert.doesNotMatch(createSql, /grant .* to (?:anon|authenticated)/i);
});

test("deletion lifecycle owns retryable R2 cleanup before hard deletes", () => {
  assert.match(deleteSql, /status in \('pending', 'ready', 'failed', 'deleting', 'delete_failed', 'deleted'\)/i);
  assert.match(deleteSql, /delete_attempt_count integer not null default 0/i);
  assert.match(deleteSql, /create or replace function public\.mcp_claim_outlet_media_delete/i);
  assert.match(deleteSql, /create or replace function public\.mcp_finish_outlet_media_delete/i);
  assert.match(deleteSql, /create or replace function public\.mcp_claim_route_customer_media_delete/i);
  assert.match(deleteSql, /create or replace function public\.mcp_claim_route_media_delete/i);
  assert.match(deleteSql, /create or replace function public\.mcp_claim_stale_outlet_media_delete/i);
  assert.match(deleteSql, /for update skip locked/i);
  assert.match(deleteSql, /set active = false/i);
  assert.doesNotMatch(deleteSql, /delete from public\.mcp_route_customers/i);
  assert.doesNotMatch(deleteSql, /grant .* to (?:anon|authenticated)/i);
});
