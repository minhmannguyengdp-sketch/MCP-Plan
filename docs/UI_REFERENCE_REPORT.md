# UI Reference - Old Report App

Source reviewed: `gustavjung01/report`.

Purpose: learn presentation patterns only. Do not copy old business logic, data flow, or legacy runtime patches.

## What to keep from old report UI

### 1. Mobile-first density

The old report app is rough, but it fits mobile data work well because it keeps each screen compact:

```text
short top area
compact KPI strip
horizontal filter chips
scrollable card list
small action row
fixed bottom navigation
```

This is useful for MCP-Plan because field users need fast scanning, not large decorative blocks.

### 2. Home cards

The home screen uses four simple action cards:

```text
MCP tuyến
Đơn hàng
Test sản phẩm
Báo cáo
```

Each card has:

```text
icon
short title
one-line description
small CTA pill
```

MCP-Plan should keep this idea, but with cleaner spacing and real module names.

### 3. Today dashboard

The old report app has a compact `Hôm nay` block with small KPIs:

```text
MCP
Đơn
DT
Test
BC
```

This is better than one large noisy dashboard for mobile. MCP-Plan should show the daily operational summary first.

### 4. Data hub tabs

The old report app uses four large tabs:

```text
MCP
Đơn
Test
Báo cáo
```

This is easy to understand. MCP-Plan can use this pattern for switching module data views, but the implementation should be React components, not legacy DOM mutation.

### 5. MCP route screen pattern

Good presentation pattern:

```text
route hero card
small score pills
4 KPI mini cards
horizontal status filters
customer card list
fixed action buttons per customer
```

This is the best pattern to reuse for MCP-Plan's route/day session screen.

### 6. List card structure

Each customer/list card should be compact:

```text
left: title + small metadata
right: status badge
actions: 3-4 fixed buttons
```

Avoid large paragraphs inside cards. Use one-line text, ellipsis, and clear badges.

### 7. Filter style

Use horizontal chips instead of big filter panels on mobile:

```text
Tất cả
Chưa ghé
Đã ghé
Có đơn
Cần quay lại
```

Filters should be scrollable horizontally and not consume vertical space.

## What not to copy

Do not copy:

```text
inline CSS blob in index.html
legacy DOM mutation scripts
emergency CSS overrides
runtime fix files
old IndexedDB flow
old Supabase direct-write logic
old AI bridge code
```

The old repo itself says many legacy files should be cleaned. Treat it as visual reference only.

## MCP-Plan UI direction

### Dashboard

Current MCP-Plan dashboard is too busy because it stacks:

```text
long page header
filter bar
4 KPI cards
table card
insight card
action card list
```

New dashboard should become:

```text
1. Today summary card
2. Compact KPI strip
3. Priority action list
4. Route health cards, not desktop table on mobile
```

### MCP daily route screen

Use the old report MCP presentation pattern:

```text
route/session hero
score pills
status filters
customer cards
action buttons
```

But business logic must use the new backend contract:

```text
mcp_route_sessions
mcp_session_customers
mcp_visits
orders
test results
market reports
follow-up tasks
```

### Card rules

```text
One card = one decision.
One card should answer: What is this? What status? What next action?
Max 3 visible metadata lines.
Badges must be short.
Actions must be predictable and fixed position.
```

### Mobile rules

```text
No dense desktop table as the primary mobile view.
No large empty hero blocks.
No filter panel that pushes content down.
No card with too many unrelated metrics.
Prefer chip filters and compact KPI strips.
```

## First UI refactor target

Start with Dashboard only:

```text
DashboardPage
KpiCard
FilterBar
mobile table/card handling
```

Then move to MCP day/session screen.
