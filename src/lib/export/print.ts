import { reportDate, reportDateTime, reportMoney } from "@/lib/export/business-report";

type Cell = string | number | boolean | null | undefined;

export function text(value: Cell) {
  return value == null ? "" : String(value);
}

export function esc(value: Cell) {
  return text(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function money(value: Cell) {
  return reportMoney(value);
}

export function dateText(value: Cell) {
  return reportDate(value);
}

export function printHtml(title: string, body: string) {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${esc(title)}</title><style>
  :root{--text:#111827;--muted:#667085;--line:#d0d5dd;--soft:#f8fafc;--brand:#1d4ed8;--green:#16a34a;--green-soft:#f0fdf4;--green-border:rgba(22,163,74,.28)}
  *{box-sizing:border-box}body{margin:0;background:#eef2f7;color:var(--text);font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.45}.page{width:min(980px,100%);margin:18px auto;background:white;border:1px solid var(--line);box-shadow:0 14px 40px rgba(16,24,40,.12);padding:28px}.toolbar{position:sticky;top:0;z-index:2;display:flex;justify-content:flex-end;gap:8px;background:rgba(255,255,255,.96);border-bottom:1px solid var(--line);padding:10px;margin:-28px -28px 22px;backdrop-filter:blur(10px)}.btn{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--green-border);border-radius:999px;background:var(--green-soft);color:#15803d;font-weight:800;padding:9px 14px;cursor:pointer;box-shadow:0 8px 18px rgba(22,163,74,.10)}h1{font-size:24px;margin:0 0 6px;letter-spacing:-.02em}h2{font-size:16px;margin:22px 0 10px}p{margin:4px 0}.muted{color:var(--muted)}.head{display:flex;justify-content:space-between;gap:18px;border-bottom:2px solid var(--text);padding-bottom:14px;margin-bottom:16px}.brand{font-weight:800;color:var(--brand);text-transform:uppercase;letter-spacing:.04em}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 18px}.box{border:1px solid var(--line);border-radius:12px;background:var(--soft);padding:12px}.kv{display:grid;grid-template-columns:150px 1fr;gap:4px 10px}.kv b{color:var(--muted);font-weight:700}.metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:14px 0}.metric{border:1px solid var(--line);border-radius:12px;padding:10px;background:var(--soft)}.metric span{display:block;color:var(--muted);font-size:12px}.metric b{font-size:18px}table{width:100%;border-collapse:collapse;margin-top:8px}th,td{border:1px solid var(--line);padding:7px 8px;text-align:left;vertical-align:top}th{background:#f1f5f9;font-size:12px;color:#344054}.right{text-align:right}.center{text-align:center}.footer{margin-top:28px;color:var(--muted);font-size:12px;text-align:right}@media(max-width:720px){.page{margin:0;border:0;padding:16px}.toolbar{margin:-16px -16px 18px}.head,.grid{display:grid;grid-template-columns:1fr}.metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.kv{grid-template-columns:120px 1fr}table{font-size:11px}}@media print{body{background:white}.page{width:100%;margin:0;border:0;box-shadow:none;padding:0}.toolbar{display:none}a{color:inherit;text-decoration:none}@page{size:A4;margin:12mm}}
  </style></head><body><main class="page"><div class="toolbar"><button class="btn" onclick="window.print()">In hoặc lưu PDF</button></div>${body}<div class="footer">Báo cáo được lập lúc ${esc(reportDateTime(new Date().toISOString()))}</div></main></body></html>`;
}

export function htmlResponse(title: string, body: string) {
  return new Response(printHtml(title, body), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

export function kv(items: Array<[string, Cell]>) {
  return `<div class="kv">${items.map(([k, v]) => `<b>${esc(k)}</b><span>${esc(v)}</span>`).join("")}</div>`;
}

export function table<T>(columns: Array<{ header: string; value: (row: T, index: number) => Cell; className?: string }>, rows: T[]) {
  return `<table><thead><tr>${columns.map((c) => `<th class="${esc(c.className || "")}">${esc(c.header)}</th>`).join("")}</tr></thead><tbody>${rows.map((row, index) => `<tr>${columns.map((c) => `<td class="${esc(c.className || "")}">${esc(c.value(row, index))}</td>`).join("") || `<tr><td colspan="${columns.length}" class="center muted">Không có dữ liệu trong kỳ báo cáo</td></tr>`}</tbody></table>`;
}
