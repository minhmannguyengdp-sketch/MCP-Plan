import fs from "node:fs";
import path from "node:path";

const srcRoot = path.join(process.cwd(), "src");
const explicitTsFiles = new Set([
  path.join(srcRoot, "ui", "shell", "navigation.ts"),
  path.join(srcRoot, "app", "manifest.ts")
]);
const forbidden = [
  "Frontend sạch trước",
  "Backend/VPS",
  "API thật",
  "Dữ liệu mẫu",
  "master data",
  "RPC hard delete",
  "Xóa thật khỏi DB",
  "Admin phụ",
  "Session setup",
  "Snapshot v2",
  "AI Prompt Context",
  "ADK Agent",
  "rebuild BC",
  "Đang rebuild",
  "MCP Setting",
  "Cai dat app",
  "Tai app",
  "Cap nhat ban moi",
  "popup mobile-first",
  "Khi nối backend thật",
  "Daily Session",
  "Global template",
  "product catalog thật",
  "Dữ liệu từ phiên MCP"
];

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (full === path.join(srcRoot, "app", "api")) return [];
      return walk(full);
    }
    if (entry.name.endsWith(".tsx") || explicitTsFiles.has(full)) return [full];
    return [];
  });
}

const failures = [];
for (const filename of walk(srcRoot)) {
  const content = fs.readFileSync(filename, "utf8");
  for (const phrase of forbidden) {
    if (content.includes(phrase)) failures.push(path.relative(process.cwd(), filename) + ": " + phrase);
  }
}

if (failures.length) {
  console.error("Phát hiện nội dung kỹ thuật hoặc nội dung mẫu còn xuất hiện trong giao diện:");
  failures.forEach((failure) => console.error("- " + failure));
  process.exit(1);
}

console.log("User-facing copy audit passed.");
