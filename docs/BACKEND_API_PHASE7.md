# Backend API Phase 7

Goal: align frontend screens with real backend read endpoints, one module at a time.

## Current completed endpoints

```text
GET /api/dashboard/summary
GET /api/dashboard/overview
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
curl -fsS http://165.22.109.61/api/dashboard/summary
curl -fsS http://165.22.109.61/api/dashboard/overview
```

Expected summary shape:

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

Expected overview shape:

```text
data.kpis
data.routeHealth
data.actions
data.insights
receivedAt
```

## Next endpoint order

```text
1. /api/dashboard/summary - done
2. /api/dashboard/overview - done
3. /api/routes
4. /api/routes/:id/customers or /api/routes/customers/data
5. /api/route-sessions
6. /api/visits
7. /api/orders
8. /api/tests
9. /api/market-checks
10. /api/actions
```

## Important rule

This phase only adds read endpoints first. Do not tighten Supabase RLS or move browser writes until backend write APIs exist and are tested.
