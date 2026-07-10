import { restRows } from "@/lib/export/supabase-rest";
import type { MarketCheckItem, MarketCheckKpi, MarketCheckStatus } from "./market-checks.types";
import { MarketChecksClientPage } from "./MarketChecksClientPage";

type FileRow = Record<string, string | number | boolean | null>;
type CustomerRow = Record<string, string | number | boolean | null>;
type ResultRow = Record<string, string | number | boolean | null>;

function text(value: unknown) {
  return String(value ?? "").trim();
}

function status(value: unknown): MarketCheckStatus {
  const normalized = text(value).toLowerCase();
  if (["risk", "fail", "failed", "bad", "issue", "problem"].includes(normalized)) return "risk";
  if (["opportunity", "good", "success", "passed", "positive"].includes(normalized)) return "opportunity";
  return "normal";
}

function buildChecks(files: FileRow[], customers: CustomerRow[], results: ResultRow[]): MarketCheckItem[] {
  const filesById = files.reduce<Record<string, FileRow>>((acc, file) => {
    acc[text(file.id)] = file;
    return acc;
  }, {});
  const customersById = customers.reduce<Record<string, CustomerRow>>((acc, customer) => {
    acc[text(customer.id)] = customer;
    return acc;
  }, {});
  const resultCustomerIds = new Set(results.map((result) => text(result.customer_id)).filter(Boolean));

  const rowsFromResults = results.map((result) => {
    const file = filesById[text(result.file_id)] || {};
    const customer = customersById[text(result.customer_id)] || {};
    return toCheck(file, customer, result);
  });

  const rowsWithoutResults = customers
    .filter((customer) => !resultCustomerIds.has(text(customer.id)))
    .map((customer) => toCheck(filesById[text(customer.file_id)] || {}, customer));

  return [...rowsFromResults, ...rowsWithoutResults];
}

function toCheck(file: FileRow, customer: CustomerRow, result: ResultRow = {}): MarketCheckItem {
  const fileId = text(file.id || customer.file_id || result.file_id);
  const customerId = text(customer.id || result.customer_id);
  const resultId = text(result.id);
  const productName = text(result.product_name) || text(file.title) || "Sản phẩm test";
  const resultStatus = status(result.status || customer.status || file.status);

  return {
    id: resultId || `${fileId}:${customerId}`,
    fileId,
    customerId,
    resultId: resultId || undefined,
    productId: text(result.product_id) || undefined,
    date: text(file.test_date).slice(0, 10),
    routeName: text(file.title) || "Đợt test",
    accountName: text(customer.customer_name) || "Khách chưa đặt tên",
    phone: text(customer.phone) || undefined,
    area: text(customer.area) || undefined,
    productName,
    competitorName: "-",
    shelfPrice: 0,
    stockStatus: text(result.status || customer.status || file.status) || "Chờ nhập",
    note: text(result.note || customer.note || file.note) || "Chưa có ghi chú",
    status: resultStatus
  };
}

function kpis(checks: MarketCheckItem[]): MarketCheckKpi[] {
  const done = checks.filter((check) => Boolean(check.resultId)).length;
  const opportunities = checks.filter((check) => check.status === "opportunity").length;
  const risks = checks.filter((check) => check.status === "risk").length;
  const products = new Set(checks.map((check) => check.productName).filter(Boolean)).size;

  return [
    { label: "Điểm test", value: checks.length, hint: "Dữ liệu thật" },
    { label: "Đã nhập", value: done, hint: "Có kết quả" },
    { label: "Cơ hội", value: opportunities, hint: "Kết quả tốt" },
    { label: "Rủi ro", value: risks || products, hint: risks ? "Cần xử lý" : "SKU theo dõi" }
  ];
}

export async function MarketChecksPage() {
  const files = await restRows<FileRow>("test_files", {
    select: "id,title,test_date,sales,status,note,sync_status,created_at,updated_at",
    order: "test_date.desc,created_at.desc",
    limit: 500
  });
  const fileIds = new Set(files.map((file) => text(file.id)).filter(Boolean));
  const customers = (await restRows<CustomerRow>("test_customers", {
    select: "id,file_id,customer_name,phone,area,status,note,created_at,updated_at",
    order: "file_id.asc,customer_name.asc",
    limit: 5000
  })).filter((customer) => !fileIds.size || fileIds.has(text(customer.file_id)));
  const customerIds = new Set(customers.map((customer) => text(customer.id)).filter(Boolean));
  const results = (await restRows<ResultRow>("test_customer_results", {
    select: "id,file_id,customer_id,product_id,product_name,status,note,created_at,updated_at",
    order: "file_id.asc,customer_id.asc,product_name.asc",
    limit: 8000
  })).filter((result) => (!fileIds.size || fileIds.has(text(result.file_id))) && (!customerIds.size || customerIds.has(text(result.customer_id))));

  const checks = buildChecks(files, customers, results);

  return <MarketChecksClientPage kpis={kpis(checks)} checks={checks} />;
}
