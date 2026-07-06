import { csvResponse, yyyyMMdd } from "@/lib/export/csv";
import { errorResponse, restRows } from "@/lib/export/supabase-rest";

type FileRow = Record<string, string | number | boolean | null>;
type CustomerRow = Record<string, string | number | boolean | null>;
type ResultRow = Record<string, string | number | boolean | null>;
type ExportRow = FileRow & CustomerRow & ResultRow & { file_title?: string | null; customer_status?: string | null; result_status?: string | null; customer_note?: string | null; result_note?: string | null };

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const files = await restRows<FileRow>("test_files", {
      select: "id,title,test_date,sales,status,note,sync_status,created_at,updated_at",
      order: "test_date.desc,created_at.desc",
      limit: Number(params.get("limit") || 2000),
      filters: { test_date: params.get("date"), sales: params.get("sales"), status: params.get("fileStatus") }
    });
    const fileIds = new Set(files.map((file) => String(file.id || "")).filter(Boolean));
    const customers = await restRows<CustomerRow>("test_customers", { select: "id,file_id,customer_name,phone,area,status,note,created_at,updated_at", order: "file_id.asc,customer_name.asc", limit: 8000 });
    const scopedCustomers = customers.filter((customer) => fileIds.has(String(customer.file_id || "")));
    const customerIds = new Set(scopedCustomers.map((customer) => String(customer.id || "")).filter(Boolean));
    const results = await restRows<ResultRow>("test_customer_results", { select: "id,file_id,customer_id,product_id,product_name,status,note,created_at,updated_at", order: "file_id.asc,customer_id.asc,product_name.asc", limit: 12000 });
    const scopedResults = results.filter((result) => customerIds.has(String(result.customer_id || "")) || fileIds.has(String(result.file_id || "")));
    const filesById = files.reduce<Record<string, FileRow>>((acc, file) => { acc[String(file.id || "")] = file; return acc; }, {});
    const customersById = scopedCustomers.reduce<Record<string, CustomerRow>>((acc, customer) => { acc[String(customer.id || "")] = customer; return acc; }, {});
    const rows: ExportRow[] = scopedResults.length ? scopedResults.map((result) => {
      const file = filesById[String(result.file_id || "")] || {};
      const customer = customersById[String(result.customer_id || "")] || {};
      return { ...file, ...customer, ...result, file_title: String(file.title || ""), customer_status: String(customer.status || ""), result_status: String(result.status || ""), customer_note: String(customer.note || ""), result_note: String(result.note || "") };
    }) : scopedCustomers.map((customer) => {
      const file = filesById[String(customer.file_id || "")] || {};
      return { ...file, ...customer, file_title: String(file.title || ""), customer_status: String(customer.status || ""), customer_note: String(customer.note || "") };
    });
    return csvResponse(`mcp-tests-${yyyyMMdd()}.csv`, [
      { key: "test_date", header: "Ngày test" },
      { key: "sales", header: "Sale" },
      { key: "file_title", header: "Hồ sơ test" },
      { key: "customer_name", header: "Tên khách" },
      { key: "phone", header: "SĐT" },
      { key: "area", header: "Khu vực" },
      { key: "product_name", header: "Sản phẩm test" },
      { key: "product_id", header: "Product ID" },
      { key: "result_status", header: "Kết quả" },
      { key: "result_note", header: "Ghi chú kết quả" },
      { key: "customer_status", header: "Trạng thái khách" },
      { key: "customer_note", header: "Ghi chú khách" },
      { key: "status", header: "Trạng thái file" },
      { key: "sync_status", header: "Sync" },
      { key: "created_at", header: "Tạo lúc" },
      { key: "updated_at", header: "Cập nhật lúc" }
    ], rows);
  } catch (error) {
    return errorResponse(error);
  }
}
