import { SMOKE_PREFIX, SMOKE_SESSION_DATE } from "./f05-production-smoke-inventory.mjs";

function required(env, name) {
  const value = String(env[name] || "").trim();
  if (!value) throw new Error(`f05_smoke_guard_missing_${name}`);
  return value;
}

export function assertF05ProductionSmokeGuard(env = process.env) {
  if (required(env, "NPP_F05_RUNTIME_SMOKE_GUARDED") !== "I_UNDERSTAND_TEMPORARY_PRODUCTION_MUTATIONS") {
    throw new Error("f05_smoke_guard_explicit_opt_in_required");
  }
  const expectedInstallationId = required(env, "NPP_F05_EXPECTED_INSTALLATION_ID");
  const installationId = required(env, "MCP_INSTALLATION_ID");
  if (expectedInstallationId !== installationId) throw new Error("f05_smoke_guard_installation_identity_mismatch");
  const expectedNppCode = required(env, "NPP_F05_EXPECTED_NPP_CODE");
  const nppCode = required(env, "MCP_NPP_CODE");
  if (expectedNppCode !== nppCode) throw new Error("f05_smoke_guard_npp_identity_mismatch");

  const apiBase = new URL(required(env, "MCP_API_BASE_URL"));
  if (apiBase.protocol !== "https:" && apiBase.hostname !== "127.0.0.1" && apiBase.hostname !== "localhost") {
    throw new Error("f05_smoke_guard_api_transport_invalid");
  }
  const supabase = new URL(required(env, "SUPABASE_URL"));
  if (supabase.protocol !== "https:") throw new Error("f05_smoke_guard_supabase_https_required");
  if (required(env, "BACKEND_API_TOKEN").length < 32) throw new Error("f05_smoke_guard_backend_token_invalid");
  if (required(env, "SUPABASE_SERVICE_ROLE_KEY").length < 32) throw new Error("f05_smoke_guard_service_role_invalid");
  if (!SMOKE_PREFIX.startsWith("__NPP_F05_RUNTIME_SMOKE__")) throw new Error("f05_smoke_guard_prefix_invalid");
  if (!SMOKE_SESSION_DATE.startsWith("2099-")) throw new Error("f05_smoke_guard_date_invalid");

  return { apiBase: apiBase.toString().replace(/\/$/, ""), expectedInstallationId, expectedNppCode };
}

export function redactSmokeError(error) {
  const message = error instanceof Error ? error.message : String(error || "runtime_smoke_failed");
  return message.replace(/(?:eyJ|sb_|service_role|Bearer\s+)[A-Za-z0-9._-]+/gi, "[REDACTED]");
}
