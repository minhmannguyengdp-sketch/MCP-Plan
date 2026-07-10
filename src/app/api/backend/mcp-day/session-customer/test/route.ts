import { sessionCustomerAction, rpc, text } from "../_shared";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return sessionCustomerAction(request, async (body, sessionCustomerId) => {
    const results = Array.isArray(body.results) ? body.results : [];
    const safeResults = results.length ? results : [{ productName: text(body.productName) || "Test nhanh", status: text(body.status) || "tested", note: text(body.note) || "Tạo test từ MCP" }];
    return rpc("mcp_create_test_from_session_customer", {
      p_session_customer_id: sessionCustomerId,
      p_file_id: text(body.fileId || body.file_id || body.testFileId || body.test_file_id),
      p_file_title: text(body.fileTitle || body.file_title) || "Test nhanh từ checklist",
      p_results: safeResults,
      p_note: text(body.note),
      p_status: text(body.status) || "tested"
    });
  });
}
