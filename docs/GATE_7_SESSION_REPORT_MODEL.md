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

## Gate 7C scope

Add `BC phiên` entry point on active `/visits`.

Implemented:

- `src/features/mcp/VisitsSessionReportPanel.tsx`
  - Adds a fixed `BC phiên` button next to the existing export control.
  - Opens a read-only bottom sheet bound to the current `mcpDayData.run.id`.
  - Does not require user to create/select a report manually.

- `src/features/mcp/McpSessionCompactView.tsx`
  - Mounts `VisitsSessionReportPanel` for the active visit session.

## Gate 7D scope

Add session report summary API by sessionId.

Implemented:

- `src/app/api/mcp-session-report/route.ts`
  - Accepts `sessionId`; also supports `routeId + date` fallback.
  - Reads:

```text
mcp_route_sessions
mcp_session_customers
market_reports
orders
test_customer_results
```

  - Aggregates sections:

```text
overview
competitors
usedProducts
opportunities
risks
nextActions
observations
orders
tests
skipped
```

  - Current summary is live/read-only. No snapshot table is written in this gate.

## Not changed yet

- Existing API route name remains `/api/backend/mcp-day/session-customer/report` for compatibility.
- Existing action key remains `market_report` for compatibility.
- Existing DB table `market_reports` is not changed in this step.
- Close-session snapshot is not added yet.
- `/reports` is not changed yet.

## Next gates

```text
Gate 7E: Polish read-only BC phiên popup and validate runtime data.
Gate 7F: Close session -> snapshot official report.
Gate 7G: Make /reports read session-level reports.
```

## Smoke checks

```text
/visits?routeId=<routeId>&date=<yyyy-mm-dd>
/api/mcp-session-report?sessionId=<sessionId>
/api/mcp-session-report?routeId=<routeId>&date=<yyyy-mm-dd>
```

Expected:

```text
- /visits shows BC phiên near the header/export controls.
- Opening BC phiên does not ask the user to create/select a report.
- The popup summarizes the current session by section.
- Quan sát from customers appears as input for the session report.
```
