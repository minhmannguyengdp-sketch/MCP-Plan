import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const script = await readFile(new URL("../ops/pullmcp", import.meta.url), "utf8");

function position(fragment) {
  const index = script.indexOf(fragment);
  assert.notEqual(index, -1, `missing deploy fragment: ${fragment}`);
  return index;
}

test("pullmcp verifies the complete source tree before staging runtime", () => {
  const verifySource = position('npm --prefix apps/backend run verify');
  const stageRuntime = position('cp -a "$SOURCE/apps/backend/." "$STAGE/"');

  assert.ok(verifySource < stageRuntime, "source verification must happen before backend staging");
  assert.match(script.slice(0, verifySource), /cd "\$SOURCE"\s*$/m);
});

test("pullmcp never runs backend verification from the partial stage tree", () => {
  assert.doesNotMatch(script, /cd "\$STAGE"[\s\S]{0,120}npm run verify/);
  assert.doesNotMatch(script, /npm --prefix "?\$STAGE"? run verify/);
});

test("staged production config resolves modules from the staged runtime cwd", () => {
  const validateStage = position('echo "4) Validate exact production environment..."');
  const swapRuntime = position('echo "5) Atomically replace runtime and start Foundation Gateway..."');
  const validationBlock = script.slice(validateStage, swapRuntime);

  assert.match(validationBlock, /read -r PUBLIC_PORT INTERNAL_PORT < <\(\s*cd "\$STAGE"/);
  assert.match(validationBlock, /node --env-file="\$STAGE\/\.env" --input-type=module/);
  assert.match(validationBlock, /import\("\.\/foundation\/config\.js"\)/);
});

test("pullmcp requires the A5.2 migration in source before deploy", () => {
  assert.match(
    script,
    /\$SOURCE\/supabase\/migrations\/20260715101500_add_atomic_session_customer_mutations\.sql/
  );
});

test("pullmcp packages cleanup runner, installer, and systemd units into runtime", () => {
  const stageRuntime = position('cp -a "$SOURCE/apps/backend/." "$STAGE/"');
  const installRunner = position('install -m 0750 "$SOURCE/ops/run-outlet-media-cleanup.sh" "$STAGE/ops/run-outlet-media-cleanup.sh"');
  const installService = position('install -m 0644 "$SOURCE/ops/systemd/mcp-outlet-media-cleanup.service" "$STAGE/ops/systemd/mcp-outlet-media-cleanup.service"');
  const installTimer = position('install -m 0644 "$SOURCE/ops/systemd/mcp-outlet-media-cleanup.timer" "$STAGE/ops/systemd/mcp-outlet-media-cleanup.timer"');
  const installEnv = position('install -m 600 "$RUNTIME/.env" "$STAGE/.env"');

  assert.ok(stageRuntime < installRunner, "runtime backend must be staged before operational assets");
  assert.ok(installRunner < installService && installService < installTimer, "cleanup assets must be packaged deterministically");
  assert.ok(installTimer < installEnv, "runtime assets must be complete before production env is attached");
});

test("pullmcp fails before verification when a required cleanup runtime asset is missing", () => {
  const assetCheck = position('missing_runtime_asset:$SOURCE/$runtime_asset');
  const verifySource = position('npm --prefix apps/backend run verify');

  assert.ok(assetCheck < verifySource, "missing operational assets must abort before build and runtime swap");
  assert.match(script, /ops\/install-outlet-media-cleanup-timer\.sh/);
  assert.match(script, /ops\/run-outlet-media-cleanup\.sh/);
  assert.match(script, /ops\/systemd\/mcp-outlet-media-cleanup\.service/);
  assert.match(script, /ops\/systemd\/mcp-outlet-media-cleanup\.timer/);
});
