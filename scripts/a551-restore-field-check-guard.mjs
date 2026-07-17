import { readFile, writeFile } from "node:fs/promises";

const path = "src/features/market-checks/MarketChecksClientPage.tsx";
let source = await readFile(path, "utf8");

const replacements = [
  [
    'disabled={saving} form="field-check-save-form"',
    'disabled={saving || !check?.resultId} form="field-check-save-form"'
  ],
  [
    '          {error ? <p className={styles.errorText}>{error}</p> : null}',
    '          {!check.resultId ? <p className={styles.errorText}>Chưa có kết quả để cập nhật</p> : null}\n          {error ? <p className={styles.errorText}>{error}</p> : null}'
  ]
];

for (const [before, after] of replacements) {
  if (source.includes(after)) continue;
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`field_check_guard_source_mismatch:${before}:${count}`);
  source = source.replace(before, after);
}

await writeFile(path, source, "utf8");
console.log("a551_field_check_guard_restored");
