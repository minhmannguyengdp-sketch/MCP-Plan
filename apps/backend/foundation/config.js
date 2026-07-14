const IDENTIFIER_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{1,127}$/;

function text(value) {
  return String(value ?? "").trim();
}

function fail(code, detail) {
  const error = new Error(code);
  error.code = code;
  error.detail = detail;
  throw error;
}

function required(env, name) {
  const value = text(env[name]);
  if (!value) fail(`missing_${name.toLowerCase()}`, `${name} is required`);
  return value;
}

function identifier(env, name) {
  const value = required(env, name);
  if (!IDENTIFIER_PATTERN.test(value)) {
    fail(`invalid_${name.toLowerCase()}`, `${name} must match ${IDENTIFIER_PATTERN}`);
  }
  return value;
}

function port(value, fallback, name) {
  const raw = text(value);
  const parsed = raw ? Number(raw) : fallback;
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    fail(`invalid_${name.toLowerCase()}`, `${name} must be an integer from 1 to 65535`);
  }
  return parsed;
}

function positiveInteger(value, fallback, name) {
  const raw = text(value);
  const parsed = raw ? Number(raw) : fallback;
  if (!Number.isInteger(parsed) || parsed < 1) {
    fail(`invalid_${name.toLowerCase()}`, `${name} must be a positive integer`);
  }
  return parsed;
}

export function parseCorsOrigins(value, { nodeEnv = "development" } = {}) {
  const raw = text(value);
  if (!raw) {
    if (nodeEnv === "production") {
      fail("missing_cors_origins", "CORS_ORIGINS is required in production");
    }
    return Object.freeze([
      "http://localhost:3000",
      "http://127.0.0.1:3000"
    ]);
  }

  const origins = Array.from(
    new Set(raw.split(",").map((item) => item.trim()).filter(Boolean))
  );

  if (origins.length === 0) fail("missing_cors_origins", "CORS_ORIGINS is empty");
  if (origins.includes("*")) fail("cors_wildcard_forbidden", "CORS_ORIGINS cannot contain *");

  for (const origin of origins) {
    let parsed;
    try {
      parsed = new URL(origin);
    } catch {
      fail("invalid_cors_origin", `Invalid CORS origin: ${origin}`);
    }
    if (!/^https?:$/.test(parsed.protocol) || parsed.origin !== origin) {
      fail("invalid_cors_origin", `CORS origin must be an exact http(s) origin: ${origin}`);
    }
  }

  return Object.freeze(origins);
}

function validateBackendToken(token, nodeEnv) {
  const minimumLength = nodeEnv === "production" ? 32 : 16;
  if (token.length < minimumLength) {
    fail("backend_api_token_too_short", `BACKEND_API_TOKEN must contain at least ${minimumLength} characters`);
  }
  if (nodeEnv === "production" && /replace|change[-_ ]?me|example|dev[-_ ]?only/i.test(token)) {
    fail("backend_api_token_placeholder", "BACKEND_API_TOKEN still contains a placeholder value");
  }
}

export function loadFoundationConfig(env = process.env) {
  const nodeEnv = text(env.NODE_ENV) || "development";
  const publicHost = text(env.HOST) || "127.0.0.1";
  const publicPort = port(env.PORT, 3001, "PORT");
  const internalHost = "127.0.0.1";
  const internalPort = port(env.LEGACY_INTERNAL_PORT, publicPort + 1, "LEGACY_INTERNAL_PORT");
  if (internalPort === publicPort) {
    fail("legacy_internal_port_conflict", "LEGACY_INTERNAL_PORT must differ from PORT");
  }

  const installationId = identifier(env, "INSTALLATION_ID");
  const nppCode = identifier(env, "NPP_CODE");
  const legacyActorId = identifier(env, "MCP_LEGACY_ACTOR_ID");
  const backendApiToken = required(env, "BACKEND_API_TOKEN");
  validateBackendToken(backendApiToken, nodeEnv);

  const authMode = text(env.AUTH_MODE) || "proxy-service";
  if (authMode !== "proxy-service") {
    fail("invalid_auth_mode", "F0.2 supports AUTH_MODE=proxy-service only");
  }

  return Object.freeze({
    nodeEnv,
    service: text(env.SERVICE_NAME) || "mcp-plan-backend",
    publicHost,
    publicPort,
    internalHost,
    internalPort,
    installationId,
    nppCode,
    legacyActorId,
    backendApiToken,
    authMode,
    corsOrigins: parseCorsOrigins(env.CORS_ORIGINS, { nodeEnv }),
    upstreamTimeoutMs: positiveInteger(env.UPSTREAM_TIMEOUT_MS, 65000, "UPSTREAM_TIMEOUT_MS")
  });
}

export function publicFoundationConfig(config) {
  return Object.freeze({
    service: config.service,
    nodeEnv: config.nodeEnv,
    installationId: config.installationId,
    nppCode: config.nppCode,
    authMode: config.authMode,
    publicHost: config.publicHost,
    publicPort: config.publicPort,
    internalHost: config.internalHost,
    internalPort: config.internalPort,
    corsOrigins: [...config.corsOrigins]
  });
}
