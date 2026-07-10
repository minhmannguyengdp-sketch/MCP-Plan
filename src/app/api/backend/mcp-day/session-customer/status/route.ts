import { eq, sessionCustomerAction, supabasePatch, text, type Dict } from "../_shared";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return sessionCustomerAction(request, async (body, sessionCustomerId) => {
    const visitStatus = text(body.visitStatus || body.visit_status || body.status) || "visited";
    const patch: Dict = {
      visit_status: visitStatus,
      status_reason: text(body.statusReason || body.status_reason),
      note: text(body.note),
      raw_payload: body
    };

    const data = await supabasePatch<Array<Dict>>(`/rest/v1/mcp_session_customers?id=${eq(sessionCustomerId)}&select=*`, patch);
    return data[0] || { id: sessionCustomerId, visit_status: visitStatus };
  });
}
