import { readFile, writeFile } from "node:fs/promises";

const migrationPath = "supabase/migrations/20260717090000_idempotency_audit_core.sql";
const testPath = "apps/backend/foundation/idempotency-migration.test.js";

let migration = await readFile(migrationPath, "utf8");
const replacements = [
  ["create extension if not exists pgcrypto;", "create extension if not exists pgcrypto with schema extensions;"],
  ["    digest(\n      convert_to(trim(p_operation)", "    extensions.digest(\n      convert_to(trim(p_operation)"],
  ["else encode(digest(convert_to(v_record.response_payload::text", "else encode(extensions.digest(convert_to(v_record.response_payload::text"],
  ["v_after_hash := encode(digest(convert_to(v_payload::text", "v_after_hash := encode(extensions.digest(convert_to(v_payload::text"]
];

for (const [before, after] of replacements) {
  if (migration.includes(after)) continue;
  const count = migration.split(before).length - 1;
  if (count !== 1) throw new Error(`source_mismatch:${before}:${count}`);
  migration = migration.replace(before, after);
}

if ((migration.match(/extensions\.digest\(/g) || []).length !== 3) {
  throw new Error("qualified_digest_count_invalid");
}
await writeFile(migrationPath, migration, "utf8");

let testSource = await readFile(testPath, "utf8");
const marker = "  assert.match(coreSql, /expires_at = now\\(\\) \\+ interval '30 days'/i);\n";
const assertion = "  assert.equal((coreSql.match(/extensions\\.digest\\(/g) || []).length, 3);\n";
if (!testSource.includes(assertion)) {
  if (!testSource.includes(marker)) throw new Error("migration_test_marker_missing");
  testSource = testSource.replace(marker, marker + assertion);
}
await writeFile(testPath, testSource, "utf8");

console.log("a551_pgcrypto_schema_qualified");
