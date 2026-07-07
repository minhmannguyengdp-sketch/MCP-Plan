"use client";

import { useState } from "react";
import type { RoutesData } from "@/features/routes/routes.types";

export function RouteCustomerExportMenu({ routesData }: { routesData: RoutesData }) {
  const [routeId, setRouteId] = useState(routesData.routes[0]?.id || "");
  const param = encodeURIComponent(routeId);
  return <div className="card" style={{ margin: "0 0 12px" }}>
    <details>
      <summary className="button">Xuất tuyến ▾</summary>
      <div className="grid" style={{ marginTop: 10 }}>
        <label className="form-field"><small>Chọn tuyến</small><select value={routeId} onChange={(event) => setRouteId(event.target.value)}>{routesData.routes.map((route) => <option key={route.id} value={route.id}>{route.name}</option>)}</select></label>
        <a className="button primary" href={`/api/backend/exports/route-customers.csv?routeId=${param}&active=true`} target="_blank" rel="noreferrer">Xuất khách tuyến</a>
        <a className="button" href={`/api/backend/exports/route-customers-needs-gps.csv?routeId=${param}`} target="_blank" rel="noreferrer">Xuất khách cần GPS</a>
      </div>
    </details>
  </div>;
}
