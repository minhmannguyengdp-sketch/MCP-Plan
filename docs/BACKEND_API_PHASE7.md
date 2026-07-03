# Backend API Phase 7

Goal: align frontend screens with real backend read endpoints, one module at a time.

## Current completed endpoints

```text
GET /api/dashboard/summary
GET /api/dashboard/overview
GET /api/routes
GET /api/routes/data
GET /api/routes/customers/data
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

curl -fsS http://165.22.109.61/api/dashboard/summary
curl -fsS http://165.22.109.61/api/dashboard/overview
curl -fsS http://165.22.109.61/api/routes
curl -fsS http://165.22.109.61/api/routes/data
curl -fsS http://165.22.109.61/api/routes/customers/data
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

## Next endpoint order

```text
1. /api/dashboard/summary - done
2. /api/dashboard/overview - done
3. /api/routes - done
4. /api/routes/data - done
5. /api/routes/customers/data - done
6. /api/route-sessions
7. /api/visits
8. /api/orders
9. /api/tests
10. /api/market-checks
11. /api/actions
```

## Important rule

This phase only adds read endpoints first. Do not tighten Supabase RLS or move browser writes until backend write APIs exist and are tested.
