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
