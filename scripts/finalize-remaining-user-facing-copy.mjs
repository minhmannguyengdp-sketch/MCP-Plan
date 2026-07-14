import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function update(relativePath, replacements, importPatch) {
  const absolutePath = path.join(root, relativePath);
  let content = fs.readFileSync(absolutePath, "utf8");

  if (importPatch && !content.includes(importPatch.line)) {
    content = content.replace(importPatch.anchor, `${importPatch.anchor}\n${importPatch.line}`);
  }

  for (const [from, to] of replacements) {
    if (content.includes(from)) content = content.split(from).join(to);
  }

  fs.writeFileSync(absolutePath, content, "utf8");
}

update(
  "src/features/mcp/MCPPageSplit.tsx",
  [
    ["Cần GPS", "Cần bổ sung vị trí"],
    ["Chưa có GPS", "Chưa có vị trí"],
    ["Mở phiên MCP:", "Mở phiên đi tuyến:"],
    ["Mở phiên MCP", "Mở phiên đi tuyến"],
    ["Mở phiên ngày", "Bắt đầu phiên"],
    ["Route Master", "Tuyến bán hàng"],
    ["<span>Sale</span>", "<span>Nhân viên phụ trách</span>"],
    ["<h3>Tạo snapshot ngày</h3>", "<h3>Danh sách điểm bán của phiên</h3>"],
    ["Mở phiên đi tuyến sẽ tạo Daily Session và snapshot khách. Sửa tuyến gốc sau đó không tự động sửa snapshot đã mở.", "Khi bắt đầu, hệ thống lưu danh sách điểm bán của phiên. Những thay đổi sau đó của tuyến không làm thay đổi phiên đã mở."],
    ["Mở phiên đi tuyến sẽ tạo phiên đi tuyến và snapshot khách. Sửa tuyến gốc sau đó không tự động sửa snapshot đã mở.", "Khi bắt đầu, hệ thống lưu danh sách điểm bán của phiên. Những thay đổi sau đó của tuyến không làm thay đổi phiên đã mở."],
    ["Route Customer Master", "Điểm bán trong tuyến"],
    ["<h3>Quy tắc khách trong tuyến</h3>", "<h3>Thông tin điểm bán</h3>"],
    ["Đây là danh sách mặc định của tuyến. Khi mở phiên ngày, danh sách này được copy thành session customer snapshot.", "Đây là danh sách điểm bán mặc định của tuyến. Mỗi phiên sẽ lưu danh sách riêng tại thời điểm bắt đầu."],
    ["Session Customer Snapshot", "Điểm bán trong phiên"],
    ["<span>Session customer</span>", "<span>Điểm bán</span>"],
    ["<h3>Xác nhận ghi dữ liệu</h3>", "<h3>Xác nhận thao tác</h3>"],
    ["Thao tác này ghi vào phiên MCP ngày hiện tại, không sửa tuyến master.", "Thông tin được lưu vào phiên hiện tại và không làm thay đổi danh sách điểm bán của tuyến."],
    [">Ghi có test<", ">Thử sản phẩm<"],
    [">Tạo follow-up<", ">Tạo việc theo dõi<"],
    ["<span>Test</span>", "<span>Thử sản phẩm</span>"],
    ["<span>Follow-up</span>", "<span>Việc theo dõi</span>"],
    ["<h3>Logic MCP</h3>", "<h3>Nguyên tắc ghi nhận</h3>"],
    ["Thao tác ở đây ghi vào phiên ngày. Không sửa dữ liệu tuyến master.", "Thông tin được lưu trong phiên hiện tại và không làm thay đổi tuyến bán hàng."],
    ["Có test", "Có thử sản phẩm"],
    ["Chưa test", "Chưa thử sản phẩm"],
    ["Follow-up ${Number(result.followupCount || 0)}", "Việc theo dõi ${Number(result.followupCount || 0)}"],
    ["Chưa có khách phù hợp", "Chưa có điểm bán phù hợp"],
    ["Tab này sẽ có dữ liệu khi phiên ngày phát sinh đúng trạng thái.", "Danh sách sẽ hiển thị khi phiên có dữ liệu phù hợp."],
    ["Tạo việc từ MCP Day cho", "Tạo việc theo dõi cho"],
    ["setActionMessage(error instanceof Error ? error.message : \"Không lưu được hành động MCP\")", "setActionMessage(userFacingError(error, \"Không lưu được thông tin. Vui lòng thử lại.\"))"],
    ["eyebrow={isVisits ? \"MCP Session\" : \"MCP Master\"}", "eyebrow={isVisits ? \"MCP\" : \"Tuyến bán hàng\"}"],
    ["title={isVisits ? \"Phiên MCP ngày\" : \"MCP tuyến master\"}", "title={isVisits ? \"Phiên đi tuyến hôm nay\" : \"Quản lý tuyến bán hàng\"}"],
    ["subtitle={isVisits ? \"Xử lý khách trong phiên ngày, ghi đơn/test/báo cáo/follow-up theo session snapshot.\" : \"Quản lý tuyến gốc, khách tuyến và GPS trước khi mở phiên ngày.\"}", "subtitle={isVisits ? \"Ghi nhận kết quả tại từng điểm bán: đơn hàng, thử sản phẩm, báo cáo và việc cần theo dõi.\" : \"Quản lý tuyến, điểm bán và vị trí trước khi bắt đầu đi thị trường.\"}"],
    ["{ label: \"Sale\", value: run.owner }", "{ label: \"Nhân viên phụ trách\", value: run.owner }"],
    ["khách trong phiên", "điểm bán trong phiên"],
    ["Khách trong phiên ngày", "Điểm bán trong phiên"],
    ["Khách phiên", "Điểm bán"],
    [">Follow-up <", ">Việc theo dõi <"],
    ["Tuyến master", "Tuyến bán hàng"],
    ["Khách tuyến + GPS", "Điểm bán và vị trí"],
    ["{routeCustomersData.customers.length} khách", "{routeCustomersData.customers.length} điểm bán"]
  ],
  {
    anchor: 'import { createApiClient } from "@/lib/api/api-client";',
    line: 'import { userFacingError } from "@/lib/ui/user-facing-error";'
  }
);

update(
  "src/features/mcp-day/McpDayClientPage.tsx",
  [
    ['if (source === "planned") return "Tuyến gốc";', 'if (source === "planned") return "Có sẵn trong tuyến";'],
    ['return "Đồng bộ";', 'return "Có sẵn trong tuyến";'],
    ['{ label: "Test" }', '{ label: "Thử sản phẩm" }'],
    ["<h3>Logic MCP</h3>", "<h3>Nguyên tắc ghi nhận</h3>"],
    ["Popup này xử lý snapshot khách trong phiên ngày. Thay đổi ở đây không tự động sửa tuyến gốc nếu chưa có bước đồng bộ riêng.", "Thông tin được lưu trong phiên hiện tại và không làm thay đổi danh sách điểm bán của tuyến."],
    ['eyebrow="MCP Daily Session"', 'eyebrow="MCP"'],
    ['title="Phiên MCP ngày"', 'title="Phiên đi tuyến hôm nay"'],
    ['subtitle="Xử lý nhanh khách trong phiên: ghé, đơn, test, báo cáo và việc tiếp theo."', 'subtitle="Ghi nhận kết quả tại từng điểm bán: lượt ghé, đơn hàng, thử sản phẩm, báo cáo và việc cần theo dõi."'],
    ['{ label: "Sale", value: run.owner }', '{ label: "Nhân viên phụ trách", value: run.owner }'],
    ["<h2>Khách trong tuyến</h2>", "<h2>Điểm bán trong phiên</h2>"],
    ['ariaLabel="Lọc trạng thái khách"', 'ariaLabel="Lọc trạng thái điểm bán"'],
    ['pills={[{ label: "khách", value: data.lines.length }]}', 'pills={[{ label: "điểm bán", value: data.lines.length }]}']
  ]
);

console.log("Removed remaining developer language from MCP screens.");
