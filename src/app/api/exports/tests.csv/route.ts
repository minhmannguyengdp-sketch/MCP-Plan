import { csvResponse, yyyyMMdd } from "@/lib/export/csv";
import { errorResponse, restRows } from "@/lib/export/supabase-rest";

type FileRow = Record<string, string | number | boolean | null>;
type CustomerRow = Record<string, string | number | boolean | null>;
type ResultRow = Record<string, string | number | boolean | null>;
type ExportRow = Record<string, string | number | boolean | null | undefined>;

export const dynamic = "force-dynamic";

function key(value: unknown) {
  return String(value || "").trim();
}

function exportRow(file: FileRow = {}, customer: CustomerRow = {}, result: ResultRow = {}): ExportRow {
  return {
    file_id: key(file.id),
    file_title: key(file.title),
    test_date: key(file.test_date),
    sales: key(file.sales),
    file_status: key(file.status),
    file_note: key(file.note),
    file_sync_status: key(file.sync_status),
    customer_row_id: key(customer.id),
    customer_name: key(customer.customer_name),
    phone: key(customer.phone),
    area: key(customer.area),
    customer_status: key(customer.status),
    customer_note: key(customer.note),
    result_id: key(result.id),
    product_id: key(result.product_id),
    product_name: key(result.product_name),
    result_status: key(result.status),
    result_note: key(result.note),
    created_at: key(result.created_at || customer.created_at || file.created_at),
    updated_at: key(result.updated_at || customer.updated_at || file.updated_at)
  };
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const files = await restRows<FileRow>("test_files", {
      select: "id,title,test_date,sales,status,note,sync_status,created_at,updated_at",
      order: "test_date.desc,created_at.desc",
      limit: Number(params.get("limit") || 2000),
      filters: { id: params.get("fileId") || params.get("file_id"), test_date: params.get("date"), sales: params.get("sales"), status: params.get("fileStatus") }
    });
    const fileIds = new Set(files.map((file) => key(file.id)).filter(Boolean));
    const customers = await restRows<CustomerRow>("test_customers", { select: "id,file_id,customer_name,phone,area,status,note,created_at,updated_at", order: "file_id.asc,customer_name.asc", limit: 8000, filters: { file_id: params.get("fileId") || params.get("file_id"), status: params.get("customerStatus") } });
    const scopedCustomers = customers.filter((customer) => !fileIds.size || fileIds.has(key(customer.file_id)));
    const customerIds = new Set(scopedCustomers.map((customer) => key(customer.id)).filter(Boolean));
    const results = await restRows<ResultRow>("test_customer_results", { select: "id,file_id,customer_id,product_id,product_name,status,note,created_at,updated_at", order: "file_id.asc,customer_id.asc,product_name.asc", limit: 12000, filters: { file_id: params.get("fileId") || params.get("file_id"), status: params.get("resultStatus") } });
    const scopedResults = results.filter((result) => (!customerIds.size || customerIds.has(key(result.customer_id))) && (!fileIds.size || fileIds.has(key(result.file_id))));

    const filesById = files.reduce<Record<string, FileRow>>((acc, file) => { acc[key(file.id)] = file; return acc; }, {});
    const customersById = scopedCustomers.reduce<Record<string, CustomerRow>>((acc, customer) => { acc[key(customer.id)] = customer; return acc; }, {});
    const resultCustomerIds = new Set(scopedResults.map((result) => key(result.customer_id)).filter(Boolean));
    const customerFileIds = new Set(scopedCustomers.map((customer) => key(customer.file_id)).filter(Boolean));

    const rows: ExportRow[] = [
      ...scopedResults.map((result) => exportRow(filesById[key(result.file_id)], customersById[key(result.customer_id)], result)),
      ...scopedCustomers.filter((customer) => !resultCustomerIds.has(key(customer.id))).map((customer) => exportRow(filesById[key(customer.file_id)], customer)),
      ...files.filter((file) => !customerFileIds.has(key(file.id))).map((file) => exportRow(file))
    ];

    return csvResponse(`mcp-tests-${yyyyMMdd()}.csv`, [
      { key: "test_date", header: "Ngày test" },
      { key: "sales", header: "Sale" },
      { key: "file_id", header: "File ID" },
      { key: "file_title", header: "Hồ sơ test" },
      { key: "file_status", header: "Trạng thái file" },
      { key: "customer_row_id", header: "Test Customer ID" },
      { key: "customer_name", header: "Tên khách" },
      { key: "phone", header: "SĐT" },
      { key: "area", header: "Khu vực" },
      { key: "customer_status", header: "Trạng thái khách" },
      { key: "product_name", header: "Sản phẩm test" },
      { key: "product_id", header: "Product ID" },
      { key: "result_status", header: "Kết quả" },
      { key: "result_note", header: "Ghi chú kết quả" },
      { key: "customer_note", header: "Ghi chú khách" },
      { key: "file_note", header: "Ghi chú file" },
      { key: "file_sync_status", header: "Sync" },
      { key: "created_at", header: "Tạo lúc" },
      { key: "updated_at", header: "Cập nhật lúc" }
    ], rows);
  } catch (error) {
    return errorResponse(error);
  }
}
