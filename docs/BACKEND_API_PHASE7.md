# Backend API Phase 7

Goal: align frontend screens with real backend read endpoints, one module at a time.

## Current completed endpoints

```text
GET /api/dashboard/summary
GET /api/dashboard/overview
GET /api/routes
GET /api/routes/data
GET /api/routes/customers/data
GET /api/mcp-day/current
GET /api/mcp-day/data
GET /api/orders
GET /api/tests
GET /api/market-checks
GET /api/market-checks/data
GET /api/actions
GET /api/actions/data
```

These endpoints return wrapped payloads:

```json
{
  "data": {},
  "receivedAt": "2026-07-03T00:00:00.000Z"
}
```

The frontend API client recognizes this shape and marks the result as `source: api`.

## VPS deploy

From local, sync upstream to origin first, then deploy backend on VPS using the existing backend deploy script.

On VPS:

```bash
/var/www/deploy-mcp-backend.sh
```

## Quick checks on VPS

```bash
curl -fsS http://127.0.0.1:3001/api/health
curl -fsS http://127.0.0.1:3001/api/dashboard/summary
curl -fsS http://127.0.0.1:3001/api/dashboard/overview
curl -fsS http://127.0.0.1:3001/api/routes
curl -fsS http://127.0.0.1:3001/api/routes/data
curl -fsS http://127.0.0.1:3001/api/routes/customers/data
curl -fsS 'http://127.0.0.1:3001/api/routes/customers/data?routeId=route-cho-gao-center'
curl -fsS http://127.0.0.1:3001/api/mcp-day/current
curl -fsS http://127.0.0.1:3001/api/mcp-day/data
curl -fsS http://127.0.0.1:3001/api/orders
curl -fsS 'http://127.0.0.1:3001/api/orders?status=confirmed'
curl -fsS 'http://127.0.0.1:3001/api/orders?search=Minh'
curl -fsS http://127.0.0.1:3001/api/tests
curl -fsS http://127.0.0.1:3001/api/market-checks
curl -fsS http://127.0.0.1:3001/api/market-checks/data
curl -fsS 'http://127.0.0.1:3001/api/market-checks?status=risk'
curl -fsS 'http://127.0.0.1:3001/api/market-checks/data?search=Sua'
curl -fsS http://127.0.0.1:3001/api/actions
curl -fsS http://127.0.0.1:3001/api/actions/data
curl -fsS 'http://127.0.0.1:3001/api/actions?priority=high'
curl -fsS 'http://127.0.0.1:3001/api/actions/data?status=doing'

curl -fsS http://165.22.109.61/api/dashboard/summary
curl -fsS http://165.22.109.61/api/dashboard/overview
curl -fsS http://165.22.109.61/api/routes
curl -fsS http://165.22.109.61/api/routes/data
curl -fsS http://165.22.109.61/api/routes/customers/data
curl -fsS http://165.22.109.61/api/mcp-day/current
curl -fsS http://165.22.109.61/api/mcp-day/data
curl -fsS http://165.22.109.61/api/orders
curl -fsS http://165.22.109.61/api/tests
curl -fsS http://165.22.109.61/api/market-checks
curl -fsS http://165.22.109.61/api/market-checks/data
curl -fsS http://165.22.109.61/api/actions
curl -fsS http://165.22.109.61/api/actions/data
```

Expected dashboard summary shape:

```json
{
  "data": {
    "routeCount": 8,
    "accountCount": 51,
    "visitCount": 73,
    "orderAmount": 403000,
    "actionCount": 9
  },
  "receivedAt": "..."
}
```

Expected dashboard overview shape:

```text
data.kpis
data.routeHealth
data.actions
data.insights
receivedAt
```

Expected routes list shape:

```text
data[]
data[].id
data[].name
data[].area
data[].owner
data[].active
receivedAt
```

Expected routes data shape:

```text
data.kpis
data.routes
receivedAt
```

Expected route customers data shape:

```text
data.kpis
data.customers
data.customers[].routeId
data.customers[].accountName
data.customers[].status
data.customers[].gps optional
receivedAt
```

Expected MCP current day shape:

```text
data.id
data.routeName
data.date
data.owner
data.status
receivedAt
```

Expected MCP day data shape:

```text
data.run
data.kpis
data.lines
data.results
receivedAt
```

Expected orders shape:

```text
data[]
data[].id
data[].code
data[].date
data[].accountName
data[].routeName
data[].owner
data[].source
data[].skuCount
data[].quantity
data[].totalAmount
data[].status
receivedAt
```

Expected tests and market checks data shape:

```text
data.kpis
data.checks
data.checks[].id
data.checks[].date
data.checks[].routeName
data.checks[].accountName
data.checks[].productName
data.checks[].competitorName
data.checks[].shelfPrice
data.checks[].stockStatus
data.checks[].note
data.checks[].status
receivedAt
```

Expected market checks list shape:

```text
data[]
data[].id
data[].date
data[].routeName
data[].accountName
data[].productName
data[].status
receivedAt
```

Expected actions list shape:

```text
data[]
data[].id
data[].title
data[].owner
data[].priority
data[].status
data[].dueDate
receivedAt
```

Expected actions data shape:

```text
data.kpis
data.items
data.items[].id
data.items[].title
data.items[].accountName
data.items[].routeName
data.items[].owner
data.items[].source
data.items[].priority
data.items[].status
data.items[].dueDate
data.items[].note
receivedAt
```

Supported query params:

```text
status
priority
search
```

## Read API status

```text
Phase 7 read endpoints are complete for current frontend modules.
```

## Next backend work

```text
1. Replace in-memory mock data with Supabase read queries behind the same API contracts.
2. Add backend write APIs module by module.
3. Move browser writes to backend-owned endpoints.
4. Tighten Supabase RLS only after backend write flow is verified.
```

## Important rule

This phase only adds read endpoints first. Do not tighten Supabase RLS or move browser writes until backend write APIs exist and are tested.
