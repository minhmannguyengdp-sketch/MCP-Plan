# Gate 7 - Session report model

## Decision

MCP session is the source data file for the workday.

```text
mcp_route_sessions
= routeId + sessionDate + sessionId
= all session customers + orders + tests + observations + follow-ups + skip reasons
```

BC is not a standalone report created per customer.
BC must be a session-level summary generated from the active MCP session.

## Correct tree

```text
MCP route master
└─ MCP session / routeId + sessionDate + sessionId
   ├─ Customers in session
   │  ├─ Orders
   │  ├─ Tests
   │  ├─ Observations
   │  ├─ Follow-ups
   │  └─ Skip / no-buy reasons
   └─ Session report / BC phiên
      ├─ Overview
      ├─ Competitors
      ├─ Used products / brands
      ├─ Tests
      ├─ Orders
      ├─ Follow-ups
      ├─ Skip reasons
      ├─ Opportunities
      ├─ Risks
      └─ Next actions
```

## UX rule

Sales should not create a report and then choose a session manually.
The session already exists, so the report should auto-bind to that session.

```text
Open MCP session
→ visit customers
→ create orders / tests / observations / follow-ups / skips
→ BC phiên auto-updates from the session data
→ close session
→ snapshot official session report
```

## Gate 7A scope

Document the model only. No database schema change in this step.

## Gate 7B scope

Rename the per-customer report action to Observation / Quan sát.

Implemented:

- `src/features/mcp/mcp-customer-actions.ts`
  - `market_report` label changed from `Báo cáo` to `Quan sát`.
  - Description now explains that the input is quick observation data for later session report aggregation.

- `src/features/mcp/McpLineCard.tsx`
  - Customer action button changed from `Báo cáo` to `Quan sát`.
  - Customer result summary changed from `Có báo cáo` to `Có quan sát`.

- `src/features/mcp/McpMarketReportFields.tsx`
  - Popup copy changed from customer-level BC to `Quan sát thị trường`.
  - Clarifies that these fields are input data for BC phiên, not a final per-customer report.

## Not changed yet

- Existing API route name remains `/api/backend/mcp-day/session-customer/report` for compatibility.
- Existing action key remains `market_report` for compatibility.
- Existing DB table `market_reports` is not changed in this step.
- Header button `BC phiên` is not added yet.
- Session-level aggregation API is not added yet.
- `/reports` is not changed yet.

## Next gates

```text
Gate 7C: Add BC phiên button in /visits header.
Gate 7D: Add session report summary API by sessionId.
Gate 7E: Add read-only BC phiên popup with grouped session sections.
Gate 7F: Close session -> snapshot official report.
Gate 7G: Make /reports read session-level reports.
```
