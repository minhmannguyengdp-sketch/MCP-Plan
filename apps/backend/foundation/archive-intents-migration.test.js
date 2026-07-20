import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(
  new URL("../../../supabase/migrations/20260720223000_add_archive_intents.sql", import.meta.url),
  "utf8"
);
const terminal = await readFile(
  new URL("../../../supabase/migrations/20260720223500_link_archive_intent_delete_job_terminal.sql", import.meta.url),
  "utf8"
);

test("archive intents persist exact key, payload, target and delete-job linkage", () => {
  assert.match(migration, /create table if not exists public\.mcp_archive_intents/i);
  assert.match(migration, /unique \(installation_id, operation, idempotency_key\)/i);
  assert.match(migration, /unique \(installation_id, target_type, target_id\)/i);
  assert.match(migration, /delete_job_id text references public\.mcp_storage_delete_jobs\(id\)/i);
  assert.match(migration, /request_hash text not null/i);
  assert.match(migration, /response_payload jsonb/i);
});

test("archive claim enforces replay, resume and conflict without a competing target intent", () => {
  assert.match(migration, /create or replace function public\.mcp_claim_archive_intent/i);
  assert.match(migration, /idempotency_key_required/i);
  assert.match(migration, /idempotency_key_conflict/i);
  assert.match(migration, /v_mode := case when v_intent\.status = 'completed' then 'replay' else 'resume' end/i);
  assert.match(migration, /where installation_id = p_installation_id[\s\S]*target_type = p_target_type[\s\S]*target_id = p_target_id[\s\S]*for update/i);
});

test("archive intent and storage delete job must share the exact target", () => {
  assert.match(migration, /create or replace function public\.mcp_link_archive_intent_job/i);
  assert.match(migration, /v_job\.target_type is distinct from v_intent\.target_type/i);
  assert.match(migration, /v_job\.target_id is distinct from v_intent\.target_id/i);
  assert.match(migration, /archive_intent_job_conflict/i);
});

test("delete-job terminal state completes or fails the linked archive intent", () => {
  assert.match(terminal, /create or replace function public\.mcp_sync_archive_intent_from_delete_job/i);
  assert.match(terminal, /new\.status = 'completed'/i);
  assert.match(terminal, /new\.status = 'failed'/i);
  assert.match(terminal, /where installation_id = new\.installation_id[\s\S]*delete_job_id = new\.id/i);
  assert.match(terminal, /create trigger mcp_storage_delete_jobs_sync_archive_intent/i);
});

test("archive intent persistence is service-role only", () => {
  assert.match(migration, /revoke all on table public\.mcp_archive_intents from public, anon, authenticated/i);
  for (const fn of ["mcp_claim_archive_intent", "mcp_link_archive_intent_job", "mcp_finish_archive_intent"]) {
    assert.match(migration, new RegExp(`revoke all on function public\\.${fn}\\([\\s\\S]*?from public, anon, authenticated`, "i"));
    assert.match(migration, new RegExp(`grant execute on function public\\.${fn}\\([\\s\\S]*?to service_role`, "i"));
  }
});
