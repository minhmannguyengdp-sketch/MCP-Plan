import { rpc, sessionCustomerAction, text } from "../_shared";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return sessionCustomerAction(request, async (body, sessionCustomerId) => rpc("mcp_create_followup_from_session_customer", {
    p_session_customer_id: sessionCustomerId,
    p_title: text(body.title) || "Follow-up khách",
    p_due_date: text(body.dueDate || body.due_date),
    p_priority: text(body.priority) || "medium",
    p_owner: text(body.owner),
    p_note: text(body.note),
    p_followup_type: text(body.followupType || body.followup_type) || "general"
  }));
}
