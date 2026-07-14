import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const filePath = (relativePath) => path.join(root, relativePath);
const read = (relativePath) => fs.readFileSync(filePath(relativePath), "utf8");
const write = (relativePath, content) => {
  fs.mkdirSync(path.dirname(filePath(relativePath)), { recursive: true });
  fs.writeFileSync(filePath(relativePath), content.replace(/^\uFEFF/, ""), "utf8");
};
const writeLines = (relativePath, lines) => write(relativePath, `${lines.join("\n")}\n`);

function replaceMany(relativePath, replacements) {
  let content = read(relativePath);
  for (const [from, to] of replacements) {
    if (content.includes(from)) content = content.split(from).join(to);
  }
  write(relativePath, content);
}

function ensureImport(relativePath, anchor, importLine) {
  let content = read(relativePath);
  if (!content.includes(importLine)) content = content.replace(anchor, `${anchor}\n${importLine}`);
  write(relativePath, content);
}

writeLines("src/ui/status/SourceBadge.tsx", [
  'type SourceBadgeProps = { source: "api" | "mock" };',
  '',
  'export function SourceBadge({ source }: SourceBadgeProps) {',
  '  void source;',
  '  return null;',
  '}'
]);

ensureImport("src/app/mcp-setting/groups/page.tsx", 'import { PageHeader } from "@/ui/layout/PageHeader";', 'import { userFacingError } from "@/lib/ui/user-facing-error";');
replaceMany("src/app/mcp-setting/groups/page.tsx", [
  ['setMessage(error instanceof Error ? error.message : "Không tải được nhóm mẫu")', 'setMessage(userFacingError(error, "Không tải được nhóm lựa chọn. Vui lòng thử lại."))'],
  ['setMessage(error instanceof Error ? error.message : "Không lưu được nhóm mẫu")', 'setMessage(userFacingError(error, "Không lưu được nhóm lựa chọn. Vui lòng thử lại."))'],
  ['setMessage(error instanceof Error ? error.message : "Không đổi trạng thái nhóm")', 'setMessage(userFacingError(error, "Không thay đổi được trạng thái nhóm. Vui lòng thử lại."))'],
  ['eyebrow="MCP Setting"', 'eyebrow="Cài đặt MCP"'],
  ['title="Nhóm mẫu báo cáo"', 'title="Nhóm lựa chọn báo cáo"'],
  ['subtitle="Quản lý nhóm mẫu dùng chung toàn hệ thống."', 'subtitle="Quản lý các nhóm lựa chọn dùng chung trong báo cáo thị trường."'],
  ['Quay lại item mẫu', 'Quay lại danh sách lựa chọn'],
  ['placeholder="VD: SP đang dùng · Phụ gia"', 'placeholder="Ví dụ: Sản phẩm đang dùng · Phụ gia"'],
  ['{group.items.length} item', '{group.items.length} lựa chọn']
]);

ensureImport("src/features/market-checks/MarketChecksClientPage.tsx", 'import { AppShell } from "@/ui/shell/AppShell";', 'import { userFacingError } from "@/lib/ui/user-facing-error";');
replaceMany("src/features/market-checks/MarketChecksClientPage.tsx", [
  ['Phiên có test', 'Phiên có thử sản phẩm'],
  ['Gom theo sessionId', 'Theo từng phiên đi tuyến'],
  ['Trong các phiên MCP', 'Trong các phiên đi tuyến'],
  ['Từ kết quả test', 'Từ kết quả thử sản phẩm'],
  ['title="Nhánh test trong phiên MCP"', 'title="Kết quả thử sản phẩm"'],
  ['title="Kết quả thử sản phẩm trong phiên MCP"', 'title="Kết quả thử sản phẩm"'],
  ['${group.customerCount} khách có test', '${group.customerCount} điểm bán có thử'],
  ['meta={[`routeId: ${group.routeId || "-"}`, `sessionId: ${group.sessionId}`, `${group.visitedCustomers}/${group.plannedCustomers} khách đã ghé`]}', 'meta={[`Tuyến: ${group.routeName}`, sessionStatusLabel(group.status), `${group.visitedCustomers}/${group.plannedCustomers} điểm bán đã ghé`]}'],
  ['label: "Xem nhánh"', 'label: "Xem kết quả"'],
  ['>Nhập</button>', '>Cập nhật</button>'],
  ['throw new Error(json.error || `save_failed_${response.status}`);', 'throw new Error(json.error || `request_failed_${response.status}`);'],
  ['setError(err instanceof Error ? err.message : "save_failed")', 'setError(userFacingError(err, "Không lưu được kết quả. Vui lòng thử lại."))'],
  ['title={check ? check.productName : "Chi tiết test"}', 'title={check ? check.productName : "Chi tiết kết quả thử"}'],
  ['<span>Khách trong phiên</span>', '<span>Điểm bán trong phiên</span>'],
  ['<small>{check.sessionCustomerId || "Dữ liệu từ phiên MCP"}</small>', '<small>{check.routeName} · {check.sessionDate || check.date}</small>'],
  ['<div className="metric-row"><span>Session</span><strong>{check.sessionId || "-"}</strong></div>', '<div className="metric-row"><span>Phiên đi tuyến</span><strong>{check.routeName}</strong></div>'],
  ['phản hồi khách, việc cần xử lý', 'phản hồi điểm bán và việc cần xử lý'],
  ['title={group ? `Nhánh test · ${group.routeName}` : "Nhánh test"}', 'title={group ? `Kết quả thử sản phẩm · ${group.routeName}` : "Kết quả thử sản phẩm"}'],
  ['description={group ? `${group.sessionDate} · sessionId: ${group.sessionId}` : undefined}', 'description={group ? `${group.sessionDate} · ${sessionStatusLabel(group.status)}` : undefined}'],
  ['description={group ? `${group.sessionDate} · Phiên: ${group.sessionId}` : undefined}', 'description={group ? `${group.sessionDate} · ${sessionStatusLabel(group.status)}` : undefined}'],
  ['Mở checklist phiên', 'Mở phiên đi tuyến'],
  ['Khách có test', 'Điểm bán có thử'],
  ['khách có test', 'điểm bán có thử'],
  ['MCP / Admin phụ', 'MCP'],
  ['Admin phụ', 'Theo dõi kết quả'],
  ['Session setup', 'Theo phiên đi tuyến'],
  ['Nhập kết quả', 'Cập nhật kết quả']
]);

replaceMany("src/features/mcp/ReportQuickFormEnhancer.tsx", [
  ['return "Next action";', 'return "Việc tiếp theo";'],
  ['<strong>Tick nhanh báo cáo</strong>', '<strong>Ghi nhận nhanh</strong>'],
  ['Dữ liệu lấy từ MCP Setting dùng chung.', 'Các lựa chọn được thiết lập dùng chung cho báo cáo thị trường.']
]);

ensureImport("src/features/mcp-settings/McpReportSettingsPage.tsx", 'import { PageHeader } from "@/ui/layout/PageHeader";', 'import { userFacingError } from "@/lib/ui/user-facing-error";');
replaceMany("src/features/mcp-settings/McpReportSettingsPage.tsx", [
  ['setMessage(error instanceof Error ? error.message : "Không tải được mẫu báo cáo")', 'setMessage(userFacingError(error, "Không tải được cài đặt báo cáo. Vui lòng thử lại."))'],
  ['setMessage(error instanceof Error ? error.message : "Không lưu được mẫu")', 'setMessage(userFacingError(error, "Không lưu được lựa chọn. Vui lòng thử lại."))'],
  ['setMessage(error instanceof Error ? error.message : "Không đổi trạng thái được")', 'setMessage(userFacingError(error, "Không thay đổi được trạng thái. Vui lòng thử lại."))'],
  ['eyebrow="MCP Setting"', 'eyebrow="Cài đặt MCP"'],
  ['title="Mẫu báo cáo thị trường"', 'title="Lựa chọn nhanh cho báo cáo thị trường"'],
  ['subtitle="Quản lý mẫu dùng chung cho toàn hệ thống: đối thủ, sản phẩm đang dùng và field báo cáo."', 'subtitle="Quản lý đối thủ, sản phẩm đang dùng và nội dung ghi nhận để nhân viên sử dụng thống nhất."'],
  ['<strong>Global template</strong>', '<strong>Mẫu dùng chung</strong>'],
  ['Không gắn mẫu riêng theo tuyến. Nút BC trong phiên sẽ dùng dữ liệu chung ở đây.', 'Các lựa chọn đang bật sẽ xuất hiện trong biểu mẫu báo cáo của mọi tuyến.'],
  ['placeholder="VD: Mama / Golden Farm / Thu Hương"', 'placeholder="Nhập tên đối thủ, thương hiệu hoặc lựa chọn"'],
  ['<small>Nhóm SP</small>', '<small>Nhóm sản phẩm</small>'],
  ['<small>Brand</small>', '<small>Thương hiệu</small>'],
  ['Không brand', 'Chưa có thương hiệu']
]);

ensureImport("src/features/mcp-settings/McpReportSettingsPageInternal.tsx", 'import { PageHeader } from "@/ui/layout/PageHeader";', 'import { userFacingError } from "@/lib/ui/user-facing-error";');
replaceMany("src/features/mcp-settings/McpReportSettingsPageInternal.tsx", [
  ['Tạo chip đối thủ', 'Thêm đối thủ'],
  ['Tên đối thủ để sales tick', 'Tên đối thủ'],
  ['VD: Thu Hương / Đại lý gần nhà / Nguồn chợ', 'Nhập tên đối thủ hoặc nguồn hàng cạnh tranh'],
  ['VD: giá thấp, đang phủ kệ, chiết khấu mạnh', 'Ví dụ: giá thấp, chiết khấu cao, phủ kệ tốt'],
  ['Tạo chip ghi chú nhanh', 'Thêm ghi chú nhanh'],
  ['Nội dung cần tick', 'Nội dung lựa chọn'],
  ['VD: Cần báo giá / Thiếu hàng / Muốn test', 'Ví dụ: cần báo giá, thiếu hàng, muốn thử sản phẩm'],
  ['VD: hiện khi sales bấm BC', 'Nội dung hiển thị khi ghi nhận thị trường'],
  ['Nhóm sản phẩm cũ', 'Nhóm sản phẩm đang dùng'],
  ['Không nên thêm brand mới ở đây', 'Tên thương hiệu hoặc sản phẩm'],
  ['Popup BC mới lấy sản phẩm từ catalog thật', 'Nhập thương hiệu hoặc sản phẩm'],
  ['Chỉ dùng khi cần giữ mẫu cũ', 'Thông tin bổ sung khi cần'],
  ['setMsg(e instanceof Error ? e.message : "Không tải được mẫu")', 'setMsg(userFacingError(e, "Không tải được cài đặt báo cáo. Vui lòng thử lại."))'],
  ['setMsg(e instanceof Error ? e.message : "Không lưu được chip tick")', 'setMsg(userFacingError(e, "Không lưu được lựa chọn. Vui lòng thử lại."))'],
  ['setMsg(e instanceof Error ? e.message : "Không đổi trạng thái được")', 'setMsg(userFacingError(e, "Không thay đổi được trạng thái. Vui lòng thử lại."))'],
  ['eyebrow="MCP Setting"', 'eyebrow="Cài đặt MCP"'],
  ['title="Mẫu tick báo cáo thị trường"', 'title="Lựa chọn nhanh cho báo cáo thị trường"'],
  ['subtitle="Quản lý chip thủ công: đối thủ và ghi chú nhanh. Thương hiệu/sản phẩm trong popup BC lấy từ product catalog thật."', 'subtitle="Quản lý đối thủ, ghi chú nhanh và nhóm sản phẩm để nhân viên ghi nhận thống nhất khi đi thị trường."'],
  ['Đối thủ và ghi chú nhanh có thể tạo ở đây. Các nhóm sản phẩm cũ vẫn giữ lại, nhưng popup BC mới ưu tiên catalog sản phẩm.', 'Các lựa chọn đang bật sẽ xuất hiện trong biểu mẫu ghi nhận thị trường. Có thể tắt mục ít dùng mà không làm mất dữ liệu cũ.'],
  ['Đã cập nhật chip tick.', 'Đã cập nhật lựa chọn.'],
  ['Đã thêm chip tick mới.', 'Đã thêm lựa chọn mới.'],
  ['Brand / nguồn hàng nếu cần', 'Thương hiệu hoặc nguồn hàng'],
  ['VD: Mama / Vina / Chợ / Nhà cung cấp A', 'Nhập khi cần phân biệt nguồn hàng'],
  ['Cập nhật chip', 'Cập nhật lựa chọn'],
  ['+ Thêm chip tick', '+ Thêm lựa chọn'],
  ['Chưa có chip tick', 'Chưa có lựa chọn'],
  ['Thêm chip đầu tiên cho mục tiêu này.', 'Thêm lựa chọn đầu tiên cho nhóm này.'],
  ['đang bật', 'đang sử dụng']
]);

replaceMany("src/features/routes/RoutesClientPage.tsx", [
  ['eyebrow="Routes"', 'eyebrow="Tuyến bán hàng"'],
  ['subtitle="Quản lý tuyến và mở phiên MCP ngày bằng popup mobile-first."', 'subtitle="Theo dõi tuyến, điểm bán và tiến độ đi thị trường theo ngày."'],
  ['<span className="badge">Dữ liệu mẫu</span>', '<span className="badge">Theo dõi tuyến</span>'],
  ['Tất cả sale', 'Tất cả nhân viên'],
  ['Active + Cần theo dõi', 'Đang chạy hoặc cần theo dõi'],
  ['Mở phiên MCP ngày', 'Mở phiên đi tuyến'],
  ['<h3>Mở phiên MCP</h3>', '<h3>Mở phiên đi tuyến</h3>'],
  ['Khi nối backend thật, nút mở phiên sẽ tạo Daily Session và snapshot danh sách khách trong tuyến. Sau khi mở phiên, thay đổi tuyến gốc không tự động làm đổi dữ liệu ngày đã mở.', 'Mỗi phiên lưu danh sách điểm bán tại thời điểm bắt đầu. Các thay đổi sau đó của tuyến không làm thay đổi phiên đã mở.']
]);

writeLines("scripts/audit-user-facing-copy.mjs", [
  'import fs from "node:fs";',
  'import path from "node:path";',
  '',
  'const srcRoot = path.join(process.cwd(), "src");',
  'const explicitTsFiles = new Set([',
  '  path.join(srcRoot, "ui", "shell", "navigation.ts"),',
  '  path.join(srcRoot, "app", "manifest.ts")',
  ']);',
  'const forbidden = [',
  '  "Frontend sạch trước",',
  '  "Backend/VPS",',
  '  "API thật",',
  '  "Dữ liệu mẫu",',
  '  "master data",',
  '  "RPC hard delete",',
  '  "Xóa thật khỏi DB",',
  '  "Admin phụ",',
  '  "Session setup",',
  '  "Snapshot v2",',
  '  "AI Prompt Context",',
  '  "ADK Agent",',
  '  "rebuild BC",',
  '  "Đang rebuild",',
  '  "MCP Setting",',
  '  "Cai dat app",',
  '  "Tai app",',
  '  "Cap nhat ban moi",',
  '  "popup mobile-first",',
  '  "Khi nối backend thật",',
  '  "Daily Session",',
  '  "Global template",',
  '  "product catalog thật",',
  '  "Dữ liệu từ phiên MCP"',
  '];',
  '',
  'function walk(directory) {',
  '  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {',
  '    const full = path.join(directory, entry.name);',
  '    if (entry.isDirectory()) {',
  '      if (full === path.join(srcRoot, "app", "api")) return [];',
  '      return walk(full);',
  '    }',
  '    if (entry.name.endsWith(".tsx") || explicitTsFiles.has(full)) return [full];',
  '    return [];',
  '  });',
  '}',
  '',
  'const failures = [];',
  'for (const filename of walk(srcRoot)) {',
  '  const content = fs.readFileSync(filename, "utf8");',
  '  for (const phrase of forbidden) {',
  '    if (content.includes(phrase)) failures.push(path.relative(process.cwd(), filename) + ": " + phrase);',
  '  }',
  '}',
  '',
  'if (failures.length) {',
  '  console.error("Phát hiện nội dung kỹ thuật hoặc nội dung mẫu còn xuất hiện trong giao diện:");',
  '  failures.forEach((failure) => console.error("- " + failure));',
  '  process.exit(1);',
  '}',
  '',
  'console.log("User-facing copy audit passed.");'
]);

console.log("Finished user-facing copy cleanup and focused the audit on rendered UI text.");
